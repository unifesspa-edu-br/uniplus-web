import { describe, expect, it } from 'vitest';
import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import { WizardDraft } from '../processo-seletivo.models';
import { hidratarDraft } from './hidratacao';

/** Só o que `hidratarDraft` lê; o resto do rascunho não participa. */
const DRAFT = { identificacao: {} } as unknown as WizardDraft;

/**
 * Grafia do wire que o detalhe de Seleção emite — PascalCase, e não o token
 * canônico do catálogo de Configuração (uniplus-api#1294). Escrever a fixture
 * com o vocabulário do catálogo esconderia o defeito que este arquivo cobre.
 */
const DISTRIBUICAO = {
  id: 'snapshot-1',
  ofertaCursoOrigemId: 'oferta-1',
  voBase: 40,
  pr: 0.5,
  regraDistribuicao: { codigo: 'DISTRIB-VAGAS-LEI-12711', versao: 'v1' },
  regraAjuste: { codigo: 'RECONCILIACAO-VAGAS-ART11-PU', versao: 'v1' },
  referenciaDemografica: { id: 'snapshot-ref', origemId: 'ref-1' },
  modalidades: [
    {
      id: 'snapshot-m',
      modalidadeOrigemId: 'modalidade-1',
      codigo: 'AC',
      composicaoVagas: 'ResidualDoVo',
    },
    {
      id: 'snapshot-p',
      modalidadeOrigemId: 'modalidade-2',
      codigo: 'AC_PCD',
      composicaoVagas: 'RetiraDe',
    },
  ],
  quadro: [
    { modalidadeOrigemId: 'modalidade-1', modalidadeCodigo: 'AC', quantidade: 19 },
    { modalidadeOrigemId: 'modalidade-2', modalidadeCodigo: 'AC_PCD', quantidade: 2 },
  ],
};

function dtoCom(distribuicao: unknown): ProcessoSeletivoDto {
  return {
    nome: 'PS 2026',
    tipoProcesso: { origemId: 'tipo-1', nome: 'SiSU' },
    unidadeAdministradora: { origemId: 'unidade-1' },
    origemCandidatos: 'Interno',
    localidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
    distribuicaoVagas: distribuicao,
  } as unknown as ProcessoSeletivoDto;
}

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
          { id: 'modalidade-1', codigo: 'AC' },
          { id: 'modalidade-2', codigo: 'AC_PCD' },
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
