import { EtapaDaVersao } from '@uniplus/shared-data/autorizacao';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ok } from '../testes';
import {
  GESTAO_DE_ACESSOS,
  PROTECAO_DE_DADOS,
  abrirReclassificacao,
  api,
  botao,
  caixaDe,
  concessao,
  leituras,
  presente,
  reclassificacao,
  type PaginaDaReclassificacao,
} from './reclassificacao.testing';

const DECISAO = {
  loteId: 'lote-1',
  decididas: ['c1'],
  liberadas: ['c1'],
  paraOutraPessoa: [],
  puladasPorEscopo: [],
};

describe('decisão da reclassificação', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  const marcarBetina = async (pagina: PaginaDaReclassificacao): Promise<void> => {
    presente(caixaDe(pagina.host, 'Betina Teste')).click();
    await pagina.assentar();
  };
  it('pela gestão de acessos, diz que o escopo só deixa de fora a liberação, não a manutenção', async () => {
    const pagina = await abrirReclassificacao(ok(reclassificacao()), [GESTAO_DE_ACESSOS]);

    const texto = pagina.host.querySelector(
      'cfg-decisao-da-reclassificacao p.cfg-muted',
    )?.textContent;

    expect(texto).toContain('A sua própria concessão fica de fora');
    expect(texto).toContain(
      'Ao liberar, ficam de fora também as que o escopo da permissão não comporta',
    );
    expect(texto).toContain('manter suspensas essas concessões é permitido');
  });

  it('pela proteção de dados, não fala de escopo, que só restringe a gestão de acessos', async () => {
    const rec = reclassificacao({
      concessoes: [concessao({ etapasExigidas: [EtapaDaVersao.PROTECAO_DE_DADOS] })],
    });
    const pagina = await abrirReclassificacao(ok(rec), [PROTECAO_DE_DADOS]);

    const texto = pagina.host.querySelector(
      'cfg-decisao-da-reclassificacao p.cfg-muted',
    )?.textContent;

    expect(texto).toContain('A sua própria concessão fica de fora');
    expect(texto).not.toContain('escopo');
  });

  it('bloqueia as ações enquanto a decisão grava', async () => {
    const resposta = new Subject<ReturnType<typeof ok<typeof DECISAO>>>();
    api.decidir.mockReturnValue(resposta);
    const pagina = await abrirReclassificacao();
    await marcarBetina(pagina);

    presente(botao(pagina.host, 'Liberar as concessões')).click();
    pagina.fixture.detectChanges();

    expect(presente(botao(pagina.host, 'Liberar as concessões')).disabled).toBe(true);
    expect(presente(botao(pagina.host, 'Manter suspensas')).disabled).toBe(true);
    expect(presente(caixaDe(pagina.host, 'Betina Teste')).disabled).toBe(true);
    resposta.next(ok(DECISAO));
    resposta.complete();
    await pagina.assentar();
  });

  it('mantém a seleção travada enquanto a reclassificação é relida e a libera ao fim', async () => {
    api.decidir.mockReturnValue(of(ok(DECISAO)));
    const pagina = await abrirReclassificacao();
    await marcarBetina(pagina);
    const releitura = new Subject<unknown>();
    leituras.mockReturnValue(releitura);

    presente(botao(pagina.host, 'Liberar as concessões')).click();
    await pagina.assentar();

    expect(presente(caixaDe(pagina.host, 'Betina Teste')).disabled).toBe(true);
    releitura.next(ok(reclassificacao()));
    releitura.complete();
    await pagina.assentar();
    expect(presente(caixaDe(pagina.host, 'Betina Teste')).disabled).toBe(false);
  });

  it('com as duas permissões, escolhe a etapa e decide só as concessões que a aguardam', async () => {
    api.decidir.mockReturnValue(of(ok(DECISAO)));
    const rec = reclassificacao({
      concessoes: [
        concessao({ etapasExigidas: [EtapaDaVersao.GESTAO_DE_ACESSOS] }),
        concessao({
          concessaoId: 'c4',
          beneficiarioNome: 'Rebeca Teste',
          etapasExigidas: [EtapaDaVersao.PROTECAO_DE_DADOS],
        }),
      ],
    });
    const pagina = await abrirReclassificacao(ok(rec), [GESTAO_DE_ACESSOS, PROTECAO_DE_DADOS]);
    expect(caixaDe(pagina.host, 'Rebeca Teste')).toBeNull();

    const etapas = [
      ...pagina.host.querySelectorAll<HTMLInputElement>('input[name="cfg-decisao-etapa"]'),
    ];
    presente(etapas[1]).click();
    await pagina.assentar();
    expect(caixaDe(pagina.host, 'Betina Teste')).toBeNull();
    presente(caixaDe(pagina.host, 'Rebeca Teste')).click();
    await pagina.assentar();
    presente(botao(pagina.host, 'Liberar as concessões')).click();
    await pagina.assentar();

    expect(api.decidir.mock.calls[0]?.[1]).toMatchObject({
      etapa: EtapaDaVersao.PROTECAO_DE_DADOS,
      concessoes: ['c4'],
    });
  });
});
