import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ok, recusa } from '../testes';
import { itemDaJanela, janelaDeMigracao, PERFIL } from './janela.testing';
import {
  GESTAO_DE_ACESSOS,
  abrirJanela,
  api,
  botao,
  escolher,
  linhaDe,
  notificacoes,
  presente,
} from './pagina-da-janela.testing';

const naEtapa = (concessaoId: string, beneficiarioNome: string) =>
  itemDaJanela({
    concessaoId,
    beneficiarioNome,
    situacao: 'aguardando_protecao_de_dados',
    exigeProtecaoDeDados: true,
  });
const BETINA = naEtapa('c1', 'Betina Teste');
const LEANDRO = naEtapa('c2', 'Leandro Teste');
const DISPENSADA = itemDaJanela({
  concessaoId: 'c4',
  beneficiarioNome: 'Aline Teste',
  situacao: 'migrada',
  dispensa: 'beneficiario_ja_tem_protecao_de_dados',
});
const JANELA = janelaDeMigracao({ loteEnviado: true, itens: [BETINA, LEANDRO, DISPENSADA] });

describe('etapa da proteção de dados da janela', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    document.body.innerHTML = '';
  });

  it('lista as concessões que aguardam a etapa e explica a dispensa das demais', async () => {
    const { host } = await abrirJanela(JANELA);

    const etapa = presente(host.querySelector('cfg-protecao-de-dados-da-janela'));
    expect(etapa.querySelector('tr[data-concessao-id="c1"]')).not.toBeNull();
    expect(etapa.querySelector('tr[data-concessao-id="c4"]')).toBeNull();
    expect(etapa.textContent).toContain('Passa pela proteção de dados.');
    expect(linhaDe(host, 'c4').textContent).toContain(
      'Dispensada: a pessoa beneficiada já exerce a proteção de dados.',
    );
  });

  it('não envia sem nenhuma escolha e diz por quê', async () => {
    const { host } = await abrirJanela(JANELA);

    const enviar = presente(botao(host, 'Enviar as decisões'));
    expect(enviar.disabled).toBe(true);
    expect(host.textContent).toContain('Escolha migrar ou recusar em ao menos uma concessão.');
  });

  it('decide só as concessões escolhidas, e as demais seguem aguardando', async () => {
    api.decidirProtecaoDeDados.mockReturnValue(of(ok(JANELA)));
    const { host, assentar, responder } = await abrirJanela(JANELA);

    escolher(linhaDe(host, 'c2'), 'Migrar');
    await assentar();
    expect(host.textContent).toContain('1 concessão escolhida; as demais seguem aguardando.');
    presente(botao(host, 'Enviar as decisões')).click();
    await responder(JANELA);

    expect(api.decidirProtecaoDeDados).toHaveBeenCalledWith(
      PERFIL,
      { decisoes: [{ concessaoId: 'c2', decisao: 'migrar' }], confirmacaoDeExclusao: false },
      expect.anything(),
    );
    expect(notificacoes.success).toHaveBeenCalledWith('Decisões da proteção de dados enviadas');
  });

  it('migra algumas e recusa outras no mesmo envio, com a confirmação da revogação', async () => {
    api.decidirProtecaoDeDados.mockReturnValue(of(ok(JANELA)));
    const { host, assentar, responder } = await abrirJanela(JANELA);

    escolher(linhaDe(host, 'c1'), 'Migrar');
    escolher(linhaDe(host, 'c2'), 'Recusar');
    await assentar();
    presente(botao(host, 'Enviar as decisões')).click();
    await assentar();
    const dialogo = presente(host.querySelector('cfg-protecao-de-dados-da-janela cfg-exclusao-dialog'));
    expect(dialogo.textContent).toContain('1 concessão recusada perde o acesso');
    expect(api.decidirProtecaoDeDados).not.toHaveBeenCalled();

    presente(dialogo.querySelector<HTMLInputElement>('input[type="checkbox"]')).click();
    await assentar();
    presente(botao(dialogo, 'Recusar e enviar')).click();
    await responder(JANELA);

    expect(api.decidirProtecaoDeDados.mock.calls[0]?.[1]).toEqual({
      decisoes: [
        { concessaoId: 'c1', decisao: 'migrar' },
        { concessaoId: 'c2', decisao: 'recusar' },
      ],
      confirmacaoDeExclusao: true,
    });
  });

  it('migrar todas e recusar todas escolhem toda a etapa', async () => {
    const { host, assentar } = await abrirJanela(JANELA);
    const etapa = presente(host.querySelector('cfg-protecao-de-dados-da-janela'));

    presente(botao(etapa, 'Recusar todas')).click();
    await assentar();

    expect(etapa.querySelectorAll('input[type="radio"]:checked')).toHaveLength(2);
    expect(presente(botao(etapa, 'Enviar as decisões')).disabled).toBe(false);
  });

  it('mostra a recusa de a mesma pessoa decidir as duas etapas junto ao envio, com o foco nela', async () => {
    api.decidirProtecaoDeDados.mockReturnValue(
      of(recusa('uniplus.autorizacao.migracao.mesma_pessoa_nas_duas_etapas', 422)),
    );
    const { host, assentar } = await abrirJanela(JANELA);
    escolher(linhaDe(host, 'c1'), 'Migrar');
    await assentar();

    presente(botao(host, 'Enviar as decisões')).click();
    await assentar();

    const erro = presente(host.querySelector<HTMLElement>('#cfg-protecao-erro'));
    expect(erro.textContent).toContain('A mesma pessoa não decide as duas etapas.');
    expect(document.activeElement).toBe(erro);
  });

  it('falha que não veio da API explica junto ao envio', async () => {
    api.decidirProtecaoDeDados.mockReturnValue(throwError(() => new Error('rede')));
    const { host, assentar } = await abrirJanela(JANELA);
    escolher(linhaDe(host, 'c1'), 'Migrar');
    await assentar();

    presente(botao(host, 'Enviar as decisões')).click();
    await assentar();

    expect(host.querySelector('#cfg-protecao-erro')?.textContent).toContain(
      'Não foi possível concluir a operação.',
    );
  });

  it('quem só tem a permissão da gestão de acessos consulta a etapa sem decidir', async () => {
    const { host } = await abrirJanela(JANELA, [GESTAO_DE_ACESSOS]);

    const etapa = presente(host.querySelector('cfg-protecao-de-dados-da-janela'));
    expect(etapa.textContent).toContain('a decisão cabe à proteção de dados');
    expect(etapa.querySelector('input[type="radio"]')).toBeNull();
    expect(botao(etapa, 'Enviar as decisões')).toBeUndefined();
  });
});
