import { describe, expect, it } from 'vitest';
import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { comoComando } from '../passos/vagas/distribuicao-para-comando';
import { hidratarDraft } from './hidratacao';
import { DRAFT, DISTRIBUICAO, FIXADO_COM_AJUSTE, dtoCom, gravada } from './hidratacao.testing';

describe('hidratarDraft — identificador legível', () => {
  it('projeta o identificador gravado sobre o rascunho', () => {
    const dto = { ...dtoCom([]), identificadorLegivel: 'medicina-2027' } as ProcessoSeletivoDto;

    expect(hidratarDraft(DRAFT, dto).identificacao.identificadorLegivel).toBe('medicina-2027');
  });

  it('deixa o campo vazio quando o processo ainda não declarou identificador', () => {
    const dto = { ...dtoCom([]), identificadorLegivel: null } as ProcessoSeletivoDto;

    expect(hidratarDraft(DRAFT, dto).identificacao.identificadorLegivel).toBe('');
  });
});

describe('hidratarDraft — tipo do processo', () => {
  it('guarda o código do tipo, que filtra os modelos de formulário', () => {
    expect(hidratarDraft(DRAFT, dtoCom([])).tipoProcesso.codigo).toBe('SISU');
  });
});

describe('hidratarDraft — distribuição de vagas', () => {
  it('projeta a distribuição gravada sobre o rascunho', () => {
    const { ofertas } = hidratarDraft(DRAFT, dtoCom([DISTRIBUICAO])).vagas;

    expect(ofertas).toEqual([
      {
        ofertaCursoId: 'oferta-1',
        voBase: '40',
        pr: '0,5',
        regraDistribuicaoCodigo: 'DISTRIB-VAGAS-LEI-12711',
        regraDistribuicaoVersao: 'v1',
        ramoDaDistribuicao: 'LEI_DE_COTAS',
        regraAjusteCodigo: 'RECONCILIACAO-VAGAS-ART11-PU',
        regraAjusteVersao: 'v1',
        referenciaReservaDemograficaId: 'ref-1',
        ajusteDoQuadro: null,
        modalidades: [
          { id: 'modalidade-1', codigo: 'AC', gravada: gravada('RESTANTE_DAS_VAGAS_OFERTADAS') },
          {
            id: 'modalidade-2',
            codigo: 'AC_PCD',
            gravada: gravada('RETIRADA_DE_OUTRA_MODALIDADE'),
          },
        ],
        quadro: [{ modalidadeId: 'modalidade-2', quantidade: '2' }],
      },
    ]);
  });

  /**
   * O campo edita com vírgula, e é assim que o operador informou o percentual:
   * reabrir mostrando `0.5` exibiria grafia diferente da que a tela pediu.
   */
  it.each([
    [0.5, '0,5'],
    [1, '1'],
    ['0.75', '0,75'],
  ])('devolve o percentual %j como %j', (pr, esperado) => {
    const { ofertas } = hidratarDraft(
      DRAFT,
      dtoCom([{ ...DISTRIBUICAO, percentualDaReservaLegal: pr }]),
    ).vagas;
    expect(ofertas[0].pr).toBe(esperado);
  });

  /** O id do snapshot não é aceito de volta pelo comando de gravação. */
  it('guarda os identificadores de origem, não os do snapshot', () => {
    const { ofertas } = hidratarDraft(DRAFT, dtoCom([DISTRIBUICAO])).vagas;

    expect(ofertas[0].modalidades[0].id).toBe('modalidade-1');
    expect(ofertas[0].referenciaReservaDemograficaId).toBe('ref-1');
  });

  /**
   * O quadro devolvido é o cálculo do servidor. Trazer AC de volta ao rascunho
   * faria a gravação seguinte reenviá-la como quantidade do edital, e a API
   * recusaria (`quantidade_calculada_nao_informavel`) a configuração que ela
   * mesma acabou de devolver — falha que só aparece na segunda edição.
   */
  it('descarta do quadro o que a Lei 12.711 calcula', () => {
    const { ofertas } = hidratarDraft(DRAFT, dtoCom([DISTRIBUICAO])).vagas;

    expect(ofertas[0].quadro.map((item) => item.modalidadeId)).toEqual(['modalidade-2']);
  });

  /** Fora do ramo federal o edital fixa todas — nada é descartado. */
  it('mantém a declaração inteira quando o ramo é o quadro fixado no edital', () => {
    const { ofertas } = hidratarDraft(DRAFT, dtoCom([FIXADO_COM_AJUSTE])).vagas;

    expect(ofertas[0].quadro).toHaveLength(2);
    expect(ofertas[0].ramoDaDistribuicao).toBe('QUADRO_FIXADO_NO_EDITAL');
    expect(ofertas[0].pr).toBe('');
  });

  /** O quadro devolvido já traz o ajuste aplicado; a declaração do edital é a entrada. */
  it('hidrata a quantidade declarada, não a que o ajuste do quadro deixou', () => {
    const { ofertas } = hidratarDraft(DRAFT, dtoCom([FIXADO_COM_AJUSTE])).vagas;

    expect(ofertas[0].quadro).toEqual([
      { modalidadeId: 'modalidade-1', quantidade: '25' },
      { modalidadeId: 'modalidade-2', quantidade: '15' },
    ]);
  });

  /** Salvar sem mexer não pode trocar a declaração de 25 pela de 20, já reduzida. */
  it('reenvia a quantidade declarada ao salvar sem alterar o quadro reduzido pelo ajuste', () => {
    const { ofertas } = hidratarDraft(DRAFT, dtoCom([FIXADO_COM_AJUSTE])).vagas;

    expect(comoComando(ofertas[0]).quadro).toEqual([
      { modalidadeId: 'modalidade-1', quantidade: 25 },
      { modalidadeId: 'modalidade-2', quantidade: 15 },
    ]);
  });

  it('reenvia o quadro declarado quando o quadro fixado não tem ajuste', () => {
    const semAjuste = {
      ...FIXADO_COM_AJUSTE,
      ajusteDoQuadro: null,
      quadro: [
        { modalidadeOrigemId: 'modalidade-1', modalidadeCodigo: 'AC', quantidade: 25 },
        { modalidadeOrigemId: 'modalidade-2', modalidadeCodigo: 'AC_PCD', quantidade: 15 },
      ],
    };
    const { ofertas } = hidratarDraft(DRAFT, dtoCom([semAjuste])).vagas;

    expect(comoComando(ofertas[0]).quadro.map((item) => item.quantidade)).toEqual([25, 15]);
  });

  /** O ramo é o que a API congelou; o código da regra e a composição não o deduzem. */
  it('não presume o ramo quando a distribuição gravada o declara nulo', () => {
    const semRamo = { ...DISTRIBUICAO, ramoDaDistribuicao: null };
    const { ofertas } = hidratarDraft(DRAFT, dtoCom([semRamo])).vagas;

    expect(ofertas[0].ramoDaDistribuicao).toBeNull();
  });

  it('trata processo sem distribuição gravada', () => {
    expect(hidratarDraft(DRAFT, dtoCom(undefined)).vagas.ofertas).toEqual([]);
  });

  it('deixa a regra de ajuste nula quando o processo não a tem', () => {
    const semAjuste = { ...DISTRIBUICAO, regraAjuste: null, referenciaDemografica: null };
    const { ofertas } = hidratarDraft(DRAFT, dtoCom([semAjuste])).vagas;

    expect(ofertas[0].regraAjusteCodigo).toBeNull();
    expect(ofertas[0].regraAjusteVersao).toBeNull();
    expect(ofertas[0].referenciaReservaDemograficaId).toBeNull();
  });

  /** A gravação substitui a distribuição inteira: o que o servidor devolveu volta como veio. */
  it('devolve ao comando o ajuste do quadro fixado e o percentual ausente que o servidor entregou', () => {
    const ajuste = { $tipo: 'reduzirDe', modalidadeCodigo: 'AC' } as const;
    const fixado = {
      ...DISTRIBUICAO,
      regraDistribuicao: { codigo: 'DISTRIB-VAGAS-INSTITUCIONAL', versao: 'v1' },
      ramoDaDistribuicao: 'QUADRO_FIXADO_NO_EDITAL',
      percentualDaReservaLegal: null,
      regraAjuste: null,
      referenciaDemografica: null,
      ajusteDoQuadro: ajuste,
    };
    const { ofertas } = hidratarDraft(DRAFT, dtoCom([fixado])).vagas;
    const comando = comoComando(ofertas[0]);

    expect(comando.ajusteDoQuadro).toStrictEqual(ajuste);
    expect(comando.percentualDaReservaLegal).toBeNull();
    expect(comando.vagasOfertadasBase).toBe(40);
  });
});
