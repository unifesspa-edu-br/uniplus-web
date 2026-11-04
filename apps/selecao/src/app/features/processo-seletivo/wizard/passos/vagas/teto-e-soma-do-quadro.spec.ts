import { describe, expect, it } from 'vitest';

import { DistribuicaoDeVagas } from '../../processo-seletivo.models';
import {
  AC,
  AC_PCD,
  modalidade,
  par,
  mensagens,
  catalogo,
  distribuicao,
  federal,
} from './distribuicao-de-vagas.testing';
import {
  problemaDeSomaDoQuadro,
  problemaDeVagasAutorizadas,
  totalFixadoDoVo,
} from './teto-e-soma-do-quadro';
import { problemasDaDistribuicao } from './validacao-da-distribuicao';

describe('problemaDeVagasAutorizadas', () => {
  /** O processo não distribui mais vagas do que o ato de autorização concede. */
  it('recusa total acima do autorizado', () => {
    expect(problemaDeVagasAutorizadas('41', 40)).toBe(
      'O total de vagas (41) passa das 40 autorizadas para a oferta.',
    );
  });

  it.each([['40'], ['39'], ['1']])('aceita total %j dentro do autorizado', (voBase) => {
    expect(problemaDeVagasAutorizadas(voBase, 40)).toBeNull();
  });

  /** Ausência do dado não é permissão nem proibição: não há teto a aplicar. */
  it('não impõe teto quando a oferta não registra vagas autorizadas', () => {
    expect(problemaDeVagasAutorizadas('99999', null)).toBeNull();
  });

  /** A forma do campo já é recusada em outro lugar; não empilhar mensagem. */
  it.each([[''], ['0'], ['-5'], ['dez'], ['1e2']])('ignora total malformado %j', (voBase) => {
    expect(problemaDeVagasAutorizadas(voBase, 40)).toBeNull();
  });
});

describe('soma do quadro contra o total de vagas', () => {
  const SUPLEMENTAR = modalidade({
    id: 'm-supl',
    codigo: 'IND',
    composicaoVagas: 'SUPLEMENTAR_AO_TOTAL',
  });
  const CATALOGO_DA_SOMA = catalogo([AC, AC_PCD, SUPLEMENTAR]);

  function quadro(itens: Record<string, string>): DistribuicaoDeVagas {
    return distribuicao({
      voBase: '40',
      modalidades: [par(AC), par(AC_PCD), par(SUPLEMENTAR)],
      quadro: Object.entries(itens).map(([modalidadeId, quantidade]) => ({
        modalidadeId,
        quantidade,
      })),
    });
  }

  /** As declaradas dividem o total da oferta; não o ampliam. */
  it('recusa soma acima do total de vagas', () => {
    const problema = problemaDeSomaDoQuadro(
      quadro({ [AC.id]: '40', [AC_PCD.id]: '2' }),
      CATALOGO_DA_SOMA,
    );

    expect(problema).toBe(
      'As quantidades fixadas somam 42 e passam do total de 40 vagas da oferta.',
    );
  });

  it.each([
    ['exata', { [AC.id]: '38', [AC_PCD.id]: '2' }],
    ['abaixo', { [AC.id]: '10', [AC_PCD.id]: '2' }],
  ])('aceita soma %s', (_caso, itens) => {
    expect(problemaDeSomaDoQuadro(quadro(itens), CATALOGO_DA_SOMA)).toBeNull();
  });

  /**
   * Sob a Lei 12.711 a suplementar acresce vagas ao total em vez de disputá-las
   * (Portaria MEC 18/2012 art. 12), então somá-la faria o edital ser recusado
   * por oferecer exatamente o que a norma permite acrescentar.
   */
  it('não conta a modalidade suplementar no ramo federal', () => {
    const comSuplementar = federal({
      voBase: '40',
      modalidades: [par(AC), par(SUPLEMENTAR)],
      quadro: [
        { modalidadeId: AC.id, quantidade: '40' },
        { modalidadeId: SUPLEMENTAR.id, quantidade: '10' },
      ],
    });

    expect(totalFixadoDoVo(comSuplementar, CATALOGO_DA_SOMA)).toBe(40);
    expect(problemaDeSomaDoQuadro(comSuplementar, CATALOGO_DA_SOMA)).toBeNull();
  });

  /**
   * Fora do ramo federal não há cálculo: o total publicado é a soma do quadro
   * inteiro, suplementar inclusive. Num certame exclusivo de indígenas e
   * quilombolas — sem ampla concorrência — são elas que compõem o total, e
   * deixá-las de fora da soma dispensaria do teto as únicas modalidades que o
   * quadro tem.
   */
  it('conta a modalidade suplementar no ramo institucional', () => {
    const exclusivo = quadro({ [SUPLEMENTAR.id]: '41' });

    expect(totalFixadoDoVo(exclusivo, CATALOGO_DA_SOMA)).toBe(41);
    expect(problemaDeSomaDoQuadro(exclusivo, CATALOGO_DA_SOMA)).toBe(
      'As quantidades fixadas somam 41 e passam do total de 40 vagas da oferta.',
    );
  });

  /** A forma do total já é recusada em outro lugar. */
  it.each([[''], ['0'], ['dez']])('ignora total malformado %j', (voBase) => {
    const invalido = { ...quadro({ [AC.id]: '99' }), voBase };
    expect(problemaDeSomaDoQuadro(invalido, CATALOGO_DA_SOMA)).toBeNull();
  });

  it('entra na lista de problemas da distribuição', () => {
    const problemas = problemasDaDistribuicao(
      quadro({ [AC.id]: '40', [AC_PCD.id]: '2', [SUPLEMENTAR.id]: '5' }),
      CATALOGO_DA_SOMA,
    );

    expect(mensagens(problemas).some((p) => p.includes('passam do total de 40 vagas'))).toBe(true);
  });
});
