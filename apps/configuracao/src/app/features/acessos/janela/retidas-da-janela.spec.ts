import {
  SituacaoDaConcessaoNaRevisaoCodigo,
  SituacaoDaRevisaoDasConcessoesCodigo,
} from '@uniplus/shared-data/autorizacao';
import { ResultadoDaMigracao } from '@uniplus/shared-data/autorizacao';
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

const BETINA = itemDaJanela({
  concessaoId: 'c1',
  beneficiarioNome: 'Betina Teste',
  situacao: { codigo: SituacaoDaConcessaoNaRevisaoCodigo.RETIDA, rotulo: 'Retida' },
});
const REBECA = itemDaJanela({
  concessaoId: 'c3',
  beneficiarioNome: 'Rebeca Teste',
  situacao: { codigo: SituacaoDaConcessaoNaRevisaoCodigo.RETIDA, rotulo: 'Retida' },
  ehDoLeitor: true,
});
const DEPOIS_DO_ENVIO = janelaDeMigracao({ decisoesEnviadas: true, itens: [BETINA, REBECA] });

describe('concessões retidas da revisão', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    document.body.innerHTML = '';
  });

  it('oferece aprovar e recusar nas retidas de outras pessoas e nenhuma ação na própria', async () => {
    const { host } = await abrirJanela(DEPOIS_DO_ENVIO);

    const retidas = presente(host.querySelector('cfg-retidas-da-janela'));
    expect(retidas.querySelector('tr[data-concessao-id="c1"]')).not.toBeNull();
    expect(retidas.querySelector('tr[data-concessao-id="c3"]')).toBeNull();
    expect(botao(linhaDe(host, 'c1'), 'Aprovar')).toBeDefined();
    expect(botao(linhaDe(host, 'c1'), 'Recusar')).toBeDefined();
    expect(linhaDe(host, 'c3').querySelector('button')).toBeNull();
    expect(host.textContent).toContain('Retidas: outra pessoa decide');
  });

  it('aprova a retida sem pedir confirmação', async () => {
    api.decidirRetida.mockReturnValue(of(ok(DEPOIS_DO_ENVIO)));
    const { host, responder } = await abrirJanela(DEPOIS_DO_ENVIO);

    presente(botao(linhaDe(host, 'c1'), 'Aprovar')).click();
    await responder(
      janelaDeMigracao({
        decisoesEnviadas: true,
        itens: [
          {
            ...BETINA,
            situacao: { codigo: SituacaoDaConcessaoNaRevisaoCodigo.MIGRADA, rotulo: 'Aprovada' },
          },
        ],
      }),
    );

    expect(api.decidirRetida).toHaveBeenCalledWith(
      PERFIL,
      'c1',
      { decisao: ResultadoDaMigracao.MIGRAR, confirmacaoDeExclusao: false },
      expect.anything(),
    );
    expect(notificacoes.success).toHaveBeenCalledWith('Concessão aprovada');
    expect(host.querySelector('cfg-retidas-da-janela')).toBeNull();
    expect(host.textContent).toContain('Aprovada');
  });

  it('recusa a retida só depois de a pessoa confirmar a revogação', async () => {
    api.decidirRetida.mockReturnValue(of(ok(DEPOIS_DO_ENVIO)));
    const { host, assentar, responder } = await abrirJanela(DEPOIS_DO_ENVIO);

    presente(botao(linhaDe(host, 'c1'), 'Recusar')).click();
    await assentar();
    const dialogo = presente(host.querySelector('cfg-retidas-da-janela cfg-exclusao-dialog'));
    expect(dialogo.textContent).toContain('A concessão de Betina Teste perde o acesso');
    expect(api.decidirRetida).not.toHaveBeenCalled();

    presente(dialogo.querySelector<HTMLInputElement>('input[type="checkbox"]')).click();
    await assentar();
    presente(botao(dialogo, 'Recusar concessão')).click();
    await responder(DEPOIS_DO_ENVIO);

    expect(api.decidirRetida).toHaveBeenCalledWith(
      PERFIL,
      'c1',
      { decisao: ResultadoDaMigracao.RECUSAR, confirmacaoDeExclusao: true },
      expect.anything(),
    );
    expect(notificacoes.success).toHaveBeenCalledWith('Concessão recusada');
  });

  it('mostra a recusa da API junto à concessão decidida', async () => {
    api.decidirRetida.mockReturnValue(
      of(recusa('uniplus.autorizacao.revisao_das_concessoes.decisao_da_propria_concessao', 422)),
    );
    const { host, assentar } = await abrirJanela(DEPOIS_DO_ENVIO);

    presente(botao(linhaDe(host, 'c1'), 'Aprovar')).click();
    await assentar();

    expect(linhaDe(host, 'c1').querySelector('ui-alert')?.textContent).toContain(
      'Ninguém decide a própria concessão.',
    );
    expect(botao(linhaDe(host, 'c1'), 'Aprovar')?.disabled).toBe(false);
  });

  it('falha que não veio da API explica junto à concessão e libera a decisão', async () => {
    api.decidirRetida.mockReturnValue(throwError(() => new Error('rede')));
    const { host, assentar } = await abrirJanela(DEPOIS_DO_ENVIO);

    presente(botao(linhaDe(host, 'c1'), 'Aprovar')).click();
    await assentar();

    expect(linhaDe(host, 'c1').querySelector('ui-alert')?.textContent).toContain(
      'Não foi possível concluir a operação.',
    );
    expect(botao(linhaDe(host, 'c1'), 'Aprovar')?.disabled).toBe(false);
  });

  it('prazo encerrado relê a revisão e mantém a explicação no aviso da página', async () => {
    api.decidirRetida.mockReturnValue(
      of(recusa('uniplus.autorizacao.revisao_das_concessoes.prazo_encerrado', 422)),
    );
    const { host, responder } = await abrirJanela(DEPOIS_DO_ENVIO);

    presente(botao(linhaDe(host, 'c1'), 'Aprovar')).click();
    await responder(
      janelaDeMigracao({
        situacao: { codigo: SituacaoDaRevisaoDasConcessoesCodigo.ENCERRADA, rotulo: 'Encerrada' },
        decisoesEnviadas: true,
        itens: [
          {
            ...BETINA,
            situacao: {
              codigo: SituacaoDaConcessaoNaRevisaoCodigo.NAO_MIGRADA,
              rotulo: 'Não aprovada no prazo',
            },
          },
        ],
      }),
    );

    expect(host.textContent).toContain('A revisão das concessões mudou');
    expect(host.textContent).toContain('O prazo da revisão das concessões terminou.');
    expect(host.textContent).toContain('Não aprovada no prazo');
    expect(host.querySelector('cfg-retidas-da-janela')).toBeNull();
  });

  it('quem só tem a permissão da proteção de dados consulta a retida sem decidir', async () => {
    const { host } = await abrirJanela(DEPOIS_DO_ENVIO, [PROTECAO_DE_DADOS]);

    expect(host.querySelector('cfg-retidas-da-janela')?.textContent).toContain(
      'a decisão cabe à gestão de acessos',
    );
    expect(linhaDe(host, 'c1').querySelector('button')).toBeNull();
  });
});
