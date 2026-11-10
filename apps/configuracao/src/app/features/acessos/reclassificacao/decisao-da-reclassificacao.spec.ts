import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDEMPOTENCY_KEY_TOKEN } from '@uniplus/shared-core/idempotency';
import { ok, recusa, recusaPeloInterceptor } from '../testes';
import {
  GESTAO_DE_ACESSOS,
  ID,
  PROTECAO_DE_DADOS,
  abrirReclassificacao,
  api,
  botao,
  caixaDe,
  concessao,
  leituras,
  notificacoes,
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
  const motivo = (host: HTMLElement): HTMLTextAreaElement =>
    presente(host.querySelector<HTMLTextAreaElement>('cfg-motivo-dialog textarea'));
  const alertaDaAcao = (host: HTMLElement): HTMLElement | null =>
    host.querySelector<HTMLElement>('cfg-decisao-da-reclassificacao [role="alert"]');

  it('libera a concessão marcada, com chave, avisa e relê a reclassificação', async () => {
    api.decidir.mockReturnValue(of(ok(DECISAO)));
    const pagina = await abrirReclassificacao();
    await marcarBetina(pagina);

    presente(botao(pagina.host, 'Liberar as concessões')).click();
    await pagina.assentar();

    expect(api.decidir).toHaveBeenCalledWith(
      ID,
      {
        etapa: 'gestao_de_acessos',
        resultado: 'liberada',
        concessoes: ['c1'],
        todas: false,
        motivo: null,
      },
      expect.anything(),
    );
    expect(api.decidir.mock.calls[0]?.[2].get(IDEMPOTENCY_KEY_TOKEN)).toBeTruthy();
    expect(notificacoes.success).toHaveBeenCalledWith('Decisão registrada');
    expect(leituras).toHaveBeenCalledTimes(2);
    expect(pagina.host.textContent).toContain(
      'Decisão registrada. Concessões decididas: 1. Liberadas: 1.',
    );
  });

  it('sem concessão marcada, não chama a API e leva o foco ao aviso junto à ação', async () => {
    const pagina = await abrirReclassificacao();

    presente(botao(pagina.host, 'Liberar as concessões')).click();
    await pagina.assentar();

    expect(api.decidir).not.toHaveBeenCalled();
    expect(pagina.host.textContent).toContain('Marque ao menos uma concessão');
    expect(document.activeElement?.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement?.contains(alertaDaAcao(pagina.host))).toBe(true);
  });

  it('decide todas as pendentes da etapa e lista as que ficaram para outra pessoa ou foram puladas por escopo', async () => {
    api.decidir.mockReturnValue(
      of(
        ok({
          loteId: 'lote-2',
          decididas: ['c1'],
          liberadas: ['c1'],
          paraOutraPessoa: ['c2'],
          puladasPorEscopo: ['c3'],
        }),
      ),
    );
    const pagina = await abrirReclassificacao();
    const todas = [
      ...pagina.host.querySelectorAll<HTMLInputElement>('input[name="cfg-decisao-alcance"]'),
    ][1];
    presente(todas).click();
    await pagina.assentar();

    presente(botao(pagina.host, 'Liberar as concessões')).click();
    await pagina.assentar();

    expect(api.decidir.mock.calls[0]?.[1]).toEqual({
      etapa: 'gestao_de_acessos',
      resultado: 'liberada',
      concessoes: null,
      todas: true,
      motivo: null,
    });
    expect(pagina.host.textContent).toContain('Ficaram para outra pessoa decidir');
    expect(pagina.host.textContent).toContain('Diogo Teste');
    expect(pagina.host.textContent).toContain('Puladas porque o escopo não comporta a liberação');
    expect(pagina.host.textContent).toContain('Paulo Teste');
  });

  it('distingue as puladas homônimas pelo escopo e pela versão, que o contrato traz', async () => {
    api.decidir.mockReturnValue(of(ok({ ...DECISAO, puladasPorEscopo: ['c5', 'c6'] })));
    const rec = reclassificacao({
      concessoes: [
        concessao(),
        concessao({
          concessaoId: 'c5',
          beneficiarioNome: 'Paulo Teste',
          unidadeId: null,
          versao: 1,
        }),
        concessao({
          concessaoId: 'c6',
          beneficiarioNome: 'Paulo Teste',
          unidadeId: null,
          versao: 2,
        }),
      ],
    });
    const pagina = await abrirReclassificacao(ok(rec));
    await marcarBetina(pagina);

    presente(botao(pagina.host, 'Liberar as concessões')).click();
    await pagina.assentar();

    const itens = [...pagina.host.querySelectorAll('cfg-decisao-da-reclassificacao ul li')].map(
      (li) => li.textContent?.trim(),
    );
    expect(itens).toEqual([
      'Paulo Teste — Instituição, versão 1',
      'Paulo Teste — Instituição, versão 2',
    ]);
  });

  it('diz que a concessão não está mais na lista e oferece recarregar, sem inventar nome', async () => {
    api.decidir.mockReturnValue(of(ok({ ...DECISAO, puladasPorEscopo: ['c-sumiu'] })));
    const pagina = await abrirReclassificacao();
    await marcarBetina(pagina);
    presente(botao(pagina.host, 'Liberar as concessões')).click();
    await pagina.assentar();
    leituras.mockClear();

    expect(pagina.host.textContent).toContain(
      'Uma concessão do resultado não está mais na lista lida.',
    );
    expect(pagina.host.textContent).not.toContain('Pessoa sem nome informado');
    presente(botao(pagina.host, 'Recarregar a lista')).click();
    await pagina.assentar();

    expect(leituras).toHaveBeenCalledTimes(1);
  });

  it('manter suspensa pede o motivo, não envia sem ele e marca o campo', async () => {
    const pagina = await abrirReclassificacao();
    await marcarBetina(pagina);

    presente(botao(pagina.host, 'Manter suspensas')).click();
    await pagina.assentar();
    presente(
      botao(presente(pagina.host.querySelector('cfg-motivo-dialog')), 'Manter suspensas'),
    ).click();
    await pagina.assentar();

    expect(api.decidir).not.toHaveBeenCalled();
    expect(motivo(pagina.host).getAttribute('aria-invalid')).toBe('true');
  });

  it('manter suspensa envia o motivo aparado', async () => {
    api.decidir.mockReturnValue(of(ok({ ...DECISAO, liberadas: [] })));
    const pagina = await abrirReclassificacao();
    await marcarBetina(pagina);
    presente(botao(pagina.host, 'Manter suspensas')).click();
    await pagina.assentar();
    const campo = motivo(pagina.host);
    campo.value = '  Aguarda esclarecimento do documento.  ';
    campo.dispatchEvent(new Event('input'));
    await pagina.assentar();

    presente(
      botao(presente(pagina.host.querySelector('cfg-motivo-dialog')), 'Manter suspensas'),
    ).click();
    await pagina.assentar();

    expect(api.decidir.mock.calls[0]?.[1]).toMatchObject({
      resultado: 'mantida',
      motivo: 'Aguarda esclarecimento do documento.',
    });
  });

  it('o motivo recusado pela API fica no campo do diálogo', async () => {
    api.decidir.mockReturnValue(
      of({
        ...recusa('uniplus.validacao', 422),
        problem: {
          type: 'x',
          title: 'Dados inválidos',
          status: 422,
          code: 'uniplus.validacao',
          traceId: '',
          errors: [
            {
              field: 'Motivo',
              code: 'uniplus.autorizacao.reclassificacao.motivo_invalido',
              message: 'Motivo inválido.',
            },
          ],
        },
      }),
    );
    const pagina = await abrirReclassificacao();
    await marcarBetina(pagina);
    presente(botao(pagina.host, 'Manter suspensas')).click();
    await pagina.assentar();
    const campo = motivo(pagina.host);
    campo.value = 'Motivo longo.';
    campo.dispatchEvent(new Event('input'));
    await pagina.assentar();

    presente(
      botao(presente(pagina.host.querySelector('cfg-motivo-dialog')), 'Manter suspensas'),
    ).click();
    await pagina.assentar();

    expect(motivo(pagina.host).getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(motivo(pagina.host));
  });

  it('documento não lido mostra a orientação junto à ação e leva o foco à leitura das versões', async () => {
    api.decidir.mockReturnValue(
      of(recusa('uniplus.autorizacao.reclassificacao.documento_nao_lido', 422)),
    );
    const pagina = await abrirReclassificacao();
    await marcarBetina(pagina);

    presente(botao(pagina.host, 'Liberar as concessões')).click();
    await pagina.assentar();

    expect(alertaDaAcao(pagina.host)?.textContent).toContain(
      'O documento instituidor ainda não foi lido.',
    );
    expect(document.activeElement?.id).toBe('cfg-versoes-em-uso');
  });

  it('reclassificação superada pede a recarga e tira os botões de decidir', async () => {
    api.decidir.mockReturnValue(of(recusa('uniplus.autorizacao.reclassificacao.superada', 409)));
    const pagina = await abrirReclassificacao();
    await marcarBetina(pagina);

    presente(botao(pagina.host, 'Liberar as concessões')).click();
    await pagina.assentar();

    expect(pagina.host.textContent).toContain(
      'Esta reclassificação foi substituída por outra mais recente.',
    );
    expect(botao(pagina.host, 'Liberar as concessões')).toBeUndefined();
    leituras.mockClear();
    presente(botao(pagina.host, 'Recarregar')).click();
    await pagina.assentar();
    expect(leituras).toHaveBeenCalledTimes(1);
  });

  it('reclassificação que a leitura já traz como substituída não oferece decidir', async () => {
    const { host } = await abrirReclassificacao(ok(reclassificacao({ vigente: false })));

    expect(host.textContent).toContain('Reclassificação substituída');
    expect(botao(host, 'Liberar as concessões')).toBeUndefined();
    expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  });

  it.each([
    ['etapa_ja_decidida', 'A etapa já foi decidida para uma das concessões.'],
    ['mesmo_decisor_nas_duas_etapas', 'Você já decidiu a outra etapa desta reclassificação.'],
    ['sem_permissao_na_etapa', 'Falta a permissão da etapa para esta decisão.'],
    ['decisor_e_beneficiario', 'Ninguém decide a própria concessão.'],
  ])('a recusa %s tem o texto da reclassificação junto à ação', async (codigo, texto) => {
    api.decidir.mockReturnValue(of(recusa(`uniplus.autorizacao.reclassificacao.${codigo}`, 422)));
    const pagina = await abrirReclassificacao();
    await marcarBetina(pagina);

    presente(botao(pagina.host, 'Liberar as concessões')).click();
    await pagina.assentar();

    expect(alertaDaAcao(pagina.host)?.textContent).toContain(texto);
  });

  it('o catálogo desatualizado na decisão diz que o sistema está sendo atualizado', async () => {
    api.decidir.mockReturnValue(
      of(
        recusaPeloInterceptor(
          'uniplus.autorizacao.catalogo.desatualizado',
          503,
          'Catalog out of date',
        ),
      ),
    );
    const pagina = await abrirReclassificacao();
    await marcarBetina(pagina);

    presente(botao(pagina.host, 'Liberar as concessões')).click();
    await pagina.assentar();

    const texto = alertaDaAcao(pagina.host)?.textContent ?? '';
    expect(texto).toContain('O sistema está sendo atualizado. Tente novamente em instantes.');
    expect(texto.split('Tente novamente').length - 1).toBe(1);
    expect(texto).not.toContain('undefined');
    expect(presente(botao(pagina.host, 'Liberar as concessões')).disabled).toBe(false);
  });

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
      concessoes: [concessao({ etapasExigidas: ['protecao_de_dados'] })],
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
        concessao({ etapasExigidas: ['gestao_de_acessos'] }),
        concessao({
          concessaoId: 'c4',
          beneficiarioNome: 'Rebeca Teste',
          etapasExigidas: ['protecao_de_dados'],
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
      etapa: 'protecao_de_dados',
      concessoes: ['c4'],
    });
  });
});
