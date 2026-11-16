import { describe, expect, it } from 'vitest';

import type { AjusteDoQuadro } from '../../processo-seletivo.models';

import {
  AC_PCD,
  CATALOGO,
  INSTITUCIONAL,
  distribuicao,
  federal,
  par,
} from './distribuicao-de-vagas.testing';
import { comOfertasAdicionadas, comPadraoAplicado } from './edicao-do-quadro';
import { padraoDaOferta } from './padrao-do-edital';

const AJUSTE_DA_PRIMEIRA: AjusteDoQuadro = { modalidadeCodigo: 'AC' };
const AJUSTE_DA_SEGUNDA: AjusteDoQuadro = { modalidadeCodigo: 'AC_PCD' };

const OFERTAS = [
  distribuicao({ ofertaCursoId: 'oferta-1', ajusteDoQuadro: AJUSTE_DA_PRIMEIRA }),
  distribuicao({ ofertaCursoId: 'oferta-2', ajusteDoQuadro: AJUSTE_DA_SEGUNDA }),
];

function ajustes(ofertas: readonly { readonly ajusteDoQuadro: unknown }[]): unknown[] {
  return ofertas.map((oferta) => oferta.ajusteDoQuadro);
}

describe('comPadraoAplicado', () => {
  it.each([
    ['as modalidades', { modalidades: [par(INSTITUCIONAL), par(AC_PCD)] }],
    ['o percentual', { pr: '0,75' }],
    ['a referência demográfica', { referenciaReservaDemograficaId: 'ref-2' }],
  ])('mantém o ajuste de cada oferta ao alterar %s', (_caso, alteracao) => {
    const padrao = { ...padraoDaOferta(OFERTAS[0]), ...alteracao };

    const aplicadas = comPadraoAplicado(OFERTAS, padrao, CATALOGO);

    expect(ajustes(aplicadas)).toEqual([AJUSTE_DA_PRIMEIRA, AJUSTE_DA_SEGUNDA]);
  });

  it.each([
    ['o código da regra', { regraDistribuicaoCodigo: 'DISTRIB-VAGAS-PSIQ' }],
    ['a versão da regra', { regraDistribuicaoVersao: '2.0' }],
  ])('zera o ajuste de todas as ofertas ao trocar %s', (_caso, troca) => {
    const padrao = { ...padraoDaOferta(OFERTAS[0]), ...troca };

    const aplicadas = comPadraoAplicado(OFERTAS, padrao, CATALOGO);

    expect(ajustes(aplicadas)).toEqual([null, null]);
  });

  it('zera o ajuste de toda oferta quando o padrão passa à Lei de Cotas, que o servidor recusa', () => {
    const aplicadas = comPadraoAplicado(OFERTAS, padraoDaOferta(federal()), CATALOGO);

    expect(ajustes(aplicadas)).toEqual([null, null]);
  });
});

describe('comOfertasAdicionadas', () => {
  it('entra sem ajuste, mesmo quando a primeira oferta o traz', () => {
    const ofertas = comOfertasAdicionadas(OFERTAS, padraoDaOferta(OFERTAS[0]), ['oferta-3']);

    expect(ajustes(ofertas)).toEqual([AJUSTE_DA_PRIMEIRA, AJUSTE_DA_SEGUNDA, null]);
  });
});
