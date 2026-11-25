import {
  SituacaoDaConcessaoNaRevisaoCodigo,
  SituacaoDaRevisaoDasConcessoesCodigo,
  FormaDoEncerramentoCodigo,
} from '@uniplus/shared-data/autorizacao';
import { HttpHeaders } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
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

const REVISAO = janelaDeMigracao({
  decisoesEnviadas: true,
  itens: [
    itemDaJanela({
      concessaoId: 'c1',
      situacao: { codigo: SituacaoDaConcessaoNaRevisaoCodigo.RETIDA, rotulo: 'Retida' },
    }),
  ],
});

describe('encerramento manual da revisão', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    document.body.innerHTML = '';
  });

  async function preencher(host: HTMLElement, assentar: () => Promise<void>, motivo: string) {
    const campo = presente(
      host.querySelector<HTMLTextAreaElement>('cfg-encerramento-da-janela textarea'),
    );
    campo.value = motivo;
    campo.dispatchEvent(new Event('input'));
    await assentar();
  }

  const caixa = (host: HTMLElement) =>
    presente(
      host.querySelector<HTMLInputElement>('cfg-encerramento-da-janela input[type="checkbox"]'),
    );

  it('não encerra sem motivo e sem confirmação, e leva o foco ao primeiro campo a corrigir', async () => {
    const { host, assentar } = await abrirJanela(REVISAO);

    presente(botao(host, 'Encerrar a revisão das concessões')).click();
    await assentar();

    expect(api.encerrar).not.toHaveBeenCalled();
    const motivo = presente(
      host.querySelector<HTMLTextAreaElement>('cfg-encerramento-da-janela textarea'),
    );
    expect(motivo.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(motivo);
    expect(host.textContent).toContain('Marque a caixa para confirmar.');
  });

  it('com o motivo e sem a confirmação, o foco vai à caixa', async () => {
    const { host, assentar } = await abrirJanela(REVISAO);
    await preencher(host, assentar, 'Versão anterior substituída por engano.');

    presente(botao(host, 'Encerrar a revisão das concessões')).click();
    await assentar();

    expect(api.encerrar).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(caixa(host));
    expect(caixa(host).getAttribute('aria-invalid')).toBe('true');
  });

  it('encerra com o motivo e a confirmação e relê a revisão encerrada', async () => {
    api.encerrar.mockReturnValue(of(ok(REVISAO)));
    const { host, assentar, responder } = await abrirJanela(REVISAO);
    await preencher(host, assentar, '  Versão anterior substituída por engano.  ');
    caixa(host).click();
    await assentar();

    presente(botao(host, 'Encerrar a revisão das concessões')).click();
    await responder(
      janelaDeMigracao({
        situacao: { codigo: SituacaoDaRevisaoDasConcessoesCodigo.ENCERRADA, rotulo: 'Encerrada' },
        forma: {
          codigo: FormaDoEncerramentoCodigo.MANUAL,
          rotulo: 'Encerramento informado',
        },
        encerradaEm: '2026-11-10T09:00:00Z',
        decisoesEnviadas: true,
        itens: [
          itemDaJanela({
            concessaoId: 'c1',
            situacao: {
              codigo: SituacaoDaConcessaoNaRevisaoCodigo.NAO_MIGRADA,
              rotulo: 'Não aprovada no prazo',
            },
          }),
        ],
      }),
    );

    expect(api.encerrar).toHaveBeenCalledWith(
      PERFIL,
      { motivo: 'Versão anterior substituída por engano.', confirmacaoDeExclusao: true },
      expect.anything(),
    );
    expect(notificacoes.success).toHaveBeenCalledWith('Revisão das concessões encerrada');
    expect(host.textContent).toContain('Encerramento informado');
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
            code: 'uniplus.autorizacao.revisao_das_concessoes.motivo_invalido',
            traceId: '',
            errors: [{ field: 'Motivo', code: 'motivo_invalido', message: 'Motivo longo demais.' }],
          },
          422,
          new HttpHeaders(),
        ),
      ),
    );
    const { host, assentar } = await abrirJanela(REVISAO);
    await preencher(host, assentar, 'Versão anterior substituída por engano.');
    caixa(host).click();
    await assentar();

    presente(botao(host, 'Encerrar a revisão das concessões')).click();
    await assentar();

    const motivo = presente(
      host.querySelector<HTMLTextAreaElement>('cfg-encerramento-da-janela textarea'),
    );
    expect(host.textContent).toContain('Motivo longo demais.');
    expect(document.activeElement).toBe(motivo);
  });

  it('mostra a recusa que não é de campo no aviso do formulário, com o foco nele', async () => {
    api.encerrar.mockReturnValue(
      of(recusa('uniplus.autorizacao.revisao_das_concessoes.sem_permissao_na_etapa', 403)),
    );
    const { host, assentar } = await abrirJanela(REVISAO);
    await preencher(host, assentar, 'Versão anterior substituída por engano.');
    caixa(host).click();
    await assentar();

    presente(botao(host, 'Encerrar a revisão das concessões')).click();
    await assentar();

    const erro = presente(host.querySelector<HTMLElement>('#cfg-encerramento-erro'));
    expect(erro.textContent).toContain('Acesso negado: a operação exige a permissão da etapa.');
    expect(document.activeElement).toBe(erro);
  });

  it('falha que não veio da API explica no aviso do formulário', async () => {
    api.encerrar.mockReturnValue(throwError(() => new Error('rede')));
    const { host, assentar } = await abrirJanela(REVISAO);
    await preencher(host, assentar, 'Versão anterior substituída por engano.');
    caixa(host).click();
    await assentar();

    presente(botao(host, 'Encerrar a revisão das concessões')).click();
    await assentar();

    expect(host.querySelector('#cfg-encerramento-erro')?.textContent).toContain(
      'Não foi possível concluir a operação.',
    );
  });

  it('revisão que já terminou relê a tela e mantém a explicação à vista', async () => {
    api.encerrar.mockReturnValue(
      of(recusa('uniplus.autorizacao.revisao_das_concessoes.revisao_encerrada', 422)),
    );
    const { host, assentar, responder } = await abrirJanela(REVISAO);
    await preencher(host, assentar, 'Versão anterior substituída por engano.');
    caixa(host).click();
    await assentar();

    presente(botao(host, 'Encerrar a revisão das concessões')).click();
    await responder(
      janelaDeMigracao({
        situacao: { codigo: SituacaoDaRevisaoDasConcessoesCodigo.ENCERRADA, rotulo: 'Encerrada' },
        forma: {
          codigo: FormaDoEncerramentoCodigo.CONCLUIDA,
          rotulo: 'Encerramento informado',
        },
        encerradaEm: '2026-11-10T09:00:00Z',
      }),
    );

    expect(host.textContent).toContain('A revisão das concessões mudou');
    expect(host.textContent).toContain('A revisão das concessões já terminou.');
  });

  it('o motivo recusado com causa geral marca o campo e mostra a causa no aviso, sem reler a revisão', async () => {
    api.encerrar.mockReturnValue(
      of(
        apiFailure(
          {
            type: 'x',
            title: 'Revisão das concessões encerrada',
            status: 422,
            code: 'uniplus.autorizacao.revisao_das_concessoes.revisao_encerrada',
            traceId: '',
            errors: [
              { field: 'Motivo', code: 'motivo_invalido', message: 'Motivo longo demais.' },
              { code: 'bloqueada', message: 'A janela está bloqueada.' },
            ],
          },
          422,
          new HttpHeaders(),
        ),
      ),
    );
    const { host, assentar } = await abrirJanela(REVISAO);
    await preencher(host, assentar, 'Versão anterior substituída por engano.');
    caixa(host).click();
    await assentar();

    presente(botao(host, 'Encerrar a revisão das concessões')).click();
    await assentar();

    expect(host.textContent).toContain('Motivo longo demais.');
    expect(host.querySelector('#cfg-encerramento-erro')?.textContent).toContain(
      'A janela está bloqueada.',
    );
    expect(host.textContent).not.toContain('A revisão das concessões mudou');
  });

  it('quem só tem a permissão da proteção de dados não vê o encerramento', async () => {
    const { host } = await abrirJanela(REVISAO, [PROTECAO_DE_DADOS]);

    expect(host.querySelector('cfg-encerramento-da-janela')).toBeNull();
  });
});
