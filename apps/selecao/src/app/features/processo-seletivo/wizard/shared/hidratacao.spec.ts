import { describe, expect, it } from 'vitest';
import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { hidratarDraft } from './hidratacao';
import { DRAFT, DISTRIBUICAO, dtoCom, gravada } from './hidratacao.testing';

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
        regraAjusteCodigo: 'RECONCILIACAO-VAGAS-ART11-PU',
        regraAjusteVersao: 'v1',
        referenciaReservaDemograficaId: 'ref-1',
        modalidades: [
          { id: 'modalidade-1', codigo: 'AC', gravada: gravada('RESIDUAL_DO_VO') },
          { id: 'modalidade-2', codigo: 'AC_PCD', gravada: gravada('RETIRA_DE') },
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
    const { ofertas } = hidratarDraft(DRAFT, dtoCom([{ ...DISTRIBUICAO, pr }])).vagas;
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
  it('mantém o quadro inteiro quando a regra não é a Lei 12.711', () => {
    const institucional = {
      ...DISTRIBUICAO,
      regraDistribuicao: { codigo: 'DISTRIB-VAGAS-INSTITUCIONAL', versao: 'v1' },
    };
    const { ofertas } = hidratarDraft(DRAFT, dtoCom([institucional])).vagas;

    expect(ofertas[0].quadro).toHaveLength(2);
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
});
