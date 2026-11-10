import { HttpHeaders } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFailure } from '@uniplus/shared-core/http';
import { ok, recusa } from '../testes';
import { itemDaJanela, janelaDeMigracao, PERFIL } from './janela.testing';
import {
  PROTECAO_DE_DADOS,
  abrirJanela,
  api,
  botao,
  notificacoes,
  presente,
} from './pagina-da-janela.testing';

const JANELA = janelaDeMigracao({
  loteEnviado: true,
  itens: [itemDaJanela({ concessaoId: 'c1', situacao: 'retida' })],
});

describe('encerramento manual da janela', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    document.body.innerHTML = '';
  });

  async function preencher(host: HTMLElement, assentar: () => Promise<void>, motivo: string) {
    const campo = presente(host.querySelector<HTMLTextAreaElement>('cfg-encerramento-da-janela textarea'));
    campo.value = motivo;
    campo.dispatchEvent(new Event('input'));
    await assentar();
  }

  const caixa = (host: HTMLElement) =>
    presente(host.querySelector<HTMLInputElement>('cfg-encerramento-da-janela input[type="checkbox"]'));

  it('não encerra sem motivo e sem confirmação, e leva o foco ao primeiro campo a corrigir', async () => {
    const { host, assentar } = await abrirJanela(JANELA);

    presente(botao(host, 'Encerrar a janela')).click();
    await assentar();

    expect(api.encerrar).not.toHaveBeenCalled();
    const motivo = presente(host.querySelector<HTMLTextAreaElement>('cfg-encerramento-da-janela textarea'));
    expect(motivo.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(motivo);
    expect(host.textContent).toContain('Marque a caixa para confirmar.');
  });

  it('com o motivo e sem a confirmação, o foco vai à caixa', async () => {
    const { host, assentar } = await abrirJanela(JANELA);
    await preencher(host, assentar, 'Versão anterior substituída por engano.');

    presente(botao(host, 'Encerrar a janela')).click();
    await assentar();

    expect(api.encerrar).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(caixa(host));
    expect(caixa(host).getAttribute('aria-invalid')).toBe('true');
  });

  it('encerra com o motivo e a confirmação e relê a janela encerrada', async () => {
    api.encerrar.mockReturnValue(of(ok(JANELA)));
    const { host, assentar, responder } = await abrirJanela(JANELA);
    await preencher(host, assentar, '  Versão anterior substituída por engano.  ');
    caixa(host).click();
    await assentar();

    presente(botao(host, 'Encerrar a janela')).click();
    await responder(
      janelaDeMigracao({
        situacao: 'encerrada',
        forma: 'manual',
        encerradaEm: '2026-11-10T09:00:00Z',
        loteEnviado: true,
        itens: [itemDaJanela({ concessaoId: 'c1', situacao: 'nao_migrada' })],
      }),
    );

    expect(api.encerrar).toHaveBeenCalledWith(
      PERFIL,
      { motivo: 'Versão anterior substituída por engano.', confirmacaoDeExclusao: true },
      expect.anything(),
    );
    expect(notificacoes.success).toHaveBeenCalledWith('Janela encerrada');
    expect(host.textContent).toContain('A gestão de acessos encerrou a janela antes do prazo.');
    expect(host.querySelector('cfg-encerramento-da-janela')).toBeNull();
  });

  it('mostra a recusa do motivo junto ao campo e leva o foco a ele', async () => {
    api.encerrar.mockReturnValue(
      of(
        apiFailure(
          {
            type: 'x',
            title: 'Motivo ausente ou longo demais',
            status: 422,
            code: 'uniplus.autorizacao.migracao.motivo_invalido',
            traceId: '',
            errors: [{ field: 'Motivo', code: 'motivo_invalido', message: 'Motivo longo demais.' }],
          },
          422,
          new HttpHeaders(),
        ),
      ),
    );
    const { host, assentar } = await abrirJanela(JANELA);
    await preencher(host, assentar, 'Versão anterior substituída por engano.');
    caixa(host).click();
    await assentar();

    presente(botao(host, 'Encerrar a janela')).click();
    await assentar();

    const motivo = presente(host.querySelector<HTMLTextAreaElement>('cfg-encerramento-da-janela textarea'));
    expect(host.textContent).toContain('Motivo longo demais.');
    expect(document.activeElement).toBe(motivo);
  });

  it('mostra a recusa que não é de campo no aviso do formulário, com o foco nele', async () => {
    api.encerrar.mockReturnValue(
      of(recusa('uniplus.autorizacao.migracao.sem_permissao_na_etapa', 403)),
    );
    const { host, assentar } = await abrirJanela(JANELA);
    await preencher(host, assentar, 'Versão anterior substituída por engano.');
    caixa(host).click();
    await assentar();

    presente(botao(host, 'Encerrar a janela')).click();
    await assentar();

    const erro = presente(host.querySelector<HTMLElement>('#cfg-encerramento-erro'));
    expect(erro.textContent).toContain('Falta a permissão da etapa para esta decisão.');
    expect(document.activeElement).toBe(erro);
  });

  it('janela que já terminou relê a tela e mantém a explicação à vista', async () => {
    api.encerrar.mockReturnValue(of(recusa('uniplus.autorizacao.migracao.janela_encerrada', 422)));
    const { host, assentar, responder } = await abrirJanela(JANELA);
    await preencher(host, assentar, 'Versão anterior substituída por engano.');
    caixa(host).click();
    await assentar();

    presente(botao(host, 'Encerrar a janela')).click();
    await responder(janelaDeMigracao({ situacao: 'encerrada', forma: 'concluida', encerradaEm: '2026-11-10T09:00:00Z' }));

    expect(host.textContent).toContain('A janela mudou');
    expect(host.textContent).toContain('A janela de migração já terminou.');
  });

  it('quem só tem a permissão da proteção de dados não vê o encerramento', async () => {
    const { host } = await abrirJanela(JANELA, [PROTECAO_DE_DADOS]);

    expect(host.querySelector('cfg-encerramento-da-janela')).toBeNull();
  });
});
