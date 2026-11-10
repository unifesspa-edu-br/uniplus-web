import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ok, recusa } from '../testes';
import { itemDaJanela, janelaDeMigracao, PERFIL } from './janela.testing';
import {
  PROTECAO_DE_DADOS,
  abrirJanela,
  api,
  botao,
  linhaDe,
  notificacoes,
  presente,
} from './pagina-da-janela.testing';

const BETINA = itemDaJanela({ concessaoId: 'c1', beneficiarioNome: 'Betina Teste', situacao: 'retida' });
const REBECA = itemDaJanela({
  concessaoId: 'c3',
  beneficiarioNome: 'Rebeca Teste',
  situacao: 'retida',
  ehDoLeitor: true,
});
const DEPOIS_DO_LOTE = janelaDeMigracao({ loteEnviado: true, itens: [BETINA, REBECA] });

describe('concessões retidas da janela', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    document.body.innerHTML = '';
  });

  it('oferece migrar e recusar nas retidas de outras pessoas e nenhuma ação na própria', async () => {
    const { host } = await abrirJanela(DEPOIS_DO_LOTE);

    const retidas = presente(host.querySelector('cfg-retidas-da-janela'));
    expect(retidas.querySelector('tr[data-concessao-id="c1"]')).not.toBeNull();
    expect(retidas.querySelector('tr[data-concessao-id="c3"]')).toBeNull();
    expect(botao(linhaDe(host, 'c1'), 'Migrar')).toBeDefined();
    expect(botao(linhaDe(host, 'c1'), 'Recusar')).toBeDefined();
    expect(linhaDe(host, 'c3').querySelector('button')).toBeNull();
    expect(host.textContent).toContain('Retidas: outra pessoa decide');
  });

  it('migra a retida sem pedir confirmação', async () => {
    api.decidirRetida.mockReturnValue(of(ok(DEPOIS_DO_LOTE)));
    const { host, responder } = await abrirJanela(DEPOIS_DO_LOTE);

    presente(botao(linhaDe(host, 'c1'), 'Migrar')).click();
    await responder(janelaDeMigracao({ loteEnviado: true, itens: [{ ...BETINA, situacao: 'migrada' }] }));

    expect(api.decidirRetida).toHaveBeenCalledWith(
      PERFIL,
      'c1',
      { decisao: 'migrar', confirmacaoDeExclusao: false },
      expect.anything(),
    );
    expect(notificacoes.success).toHaveBeenCalledWith('Concessão migrada');
    expect(host.querySelector('cfg-retidas-da-janela')).toBeNull();
    expect(host.textContent).toContain('Migrada');
  });

  it('recusa a retida só depois de a pessoa confirmar a revogação', async () => {
    api.decidirRetida.mockReturnValue(of(ok(DEPOIS_DO_LOTE)));
    const { host, assentar, responder } = await abrirJanela(DEPOIS_DO_LOTE);

    presente(botao(linhaDe(host, 'c1'), 'Recusar')).click();
    await assentar();
    const dialogo = presente(host.querySelector('cfg-retidas-da-janela cfg-exclusao-dialog'));
    expect(dialogo.textContent).toContain('A concessão de Betina Teste perde o acesso');
    expect(api.decidirRetida).not.toHaveBeenCalled();

    presente(dialogo.querySelector<HTMLInputElement>('input[type="checkbox"]')).click();
    await assentar();
    presente(botao(dialogo, 'Recusar concessão')).click();
    await responder(DEPOIS_DO_LOTE);

    expect(api.decidirRetida).toHaveBeenCalledWith(
      PERFIL,
      'c1',
      { decisao: 'recusar', confirmacaoDeExclusao: true },
      expect.anything(),
    );
    expect(notificacoes.success).toHaveBeenCalledWith('Concessão recusada');
  });

  it('mostra a recusa da API junto à concessão decidida', async () => {
    api.decidirRetida.mockReturnValue(
      of(recusa('uniplus.autorizacao.migracao.decisao_da_propria_concessao', 422)),
    );
    const { host, assentar } = await abrirJanela(DEPOIS_DO_LOTE);

    presente(botao(linhaDe(host, 'c1'), 'Migrar')).click();
    await assentar();

    expect(linhaDe(host, 'c1').querySelector('ui-alert')?.textContent).toContain(
      'Ninguém decide a própria concessão.',
    );
    expect(botao(linhaDe(host, 'c1'), 'Migrar')?.disabled).toBe(false);
  });

  it('falha que não veio da API explica junto à concessão e libera a decisão', async () => {
    api.decidirRetida.mockReturnValue(throwError(() => new Error('rede')));
    const { host, assentar } = await abrirJanela(DEPOIS_DO_LOTE);

    presente(botao(linhaDe(host, 'c1'), 'Migrar')).click();
    await assentar();

    expect(linhaDe(host, 'c1').querySelector('ui-alert')?.textContent).toContain(
      'Não foi possível concluir a operação.',
    );
    expect(botao(linhaDe(host, 'c1'), 'Migrar')?.disabled).toBe(false);
  });

  it('prazo encerrado relê a janela e mantém a explicação no aviso da página', async () => {
    api.decidirRetida.mockReturnValue(of(recusa('uniplus.autorizacao.migracao.prazo_encerrado', 422)));
    const { host, responder } = await abrirJanela(DEPOIS_DO_LOTE);

    presente(botao(linhaDe(host, 'c1'), 'Migrar')).click();
    await responder(
      janelaDeMigracao({
        situacao: 'encerrada',
        loteEnviado: true,
        itens: [{ ...BETINA, situacao: 'nao_migrada' }],
      }),
    );

    expect(host.textContent).toContain('A janela mudou');
    expect(host.textContent).toContain('O prazo da janela de migração terminou.');
    expect(host.textContent).toContain('Não migrada no prazo');
    expect(host.querySelector('cfg-retidas-da-janela')).toBeNull();
  });

  it('quem só tem a permissão da proteção de dados consulta a retida sem decidir', async () => {
    const { host } = await abrirJanela(DEPOIS_DO_LOTE, [PROTECAO_DE_DADOS]);

    expect(host.querySelector('cfg-retidas-da-janela')?.textContent).toContain(
      'a decisão cabe à gestão de acessos',
    );
    expect(linhaDe(host, 'c1').querySelector('button')).toBeNull();
  });
});
