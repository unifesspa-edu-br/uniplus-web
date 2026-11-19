import {
  FormaDeAvaliacaoDaEtapa as Forma,
  type RegraCatalogoDto,
} from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { sugerirProcedimentoDeRecurso } from './sugestao-do-procedimento';

const RECORRECAO = 'PROCEDIMENTO-RECURSO-RECORRECAO';
const RECALCULO = 'PROCEDIMENTO-RECURSO-RECALCULO';

function regra(codigo: string, parcial: Partial<RegraCatalogoDto> = {}): RegraCatalogoDto {
  return {
    codigo,
    versao: 'v1',
    tipo: 'regra_procedimento_recurso',
    declaracaoDaRegra: {},
    invariantes: {},
    baseLegal: 'Referência institucional',
    hash: '',
    modalidadesAdmitidas: null,
    ramoDaDistribuicao: null,
    ...parcial,
  };
}

const catalogo = [regra(RECORRECAO), regra(RECALCULO)];

describe('sugestão pela forma da etapa', () => {
  it.each([
    [Forma.HUMANA, false, RECORRECAO],
    [Forma.OBJETIVA, false, RECALCULO],
    [null, true, RECALCULO],
    [Forma.HUMANA, true, RECALCULO],
  ] as const)('sugere para forma %s e origem no ENEM %s', (forma, enem, codigo) => {
    expect(sugerirProcedimentoDeRecurso(forma, enem, catalogo)).toEqual({ codigo, versao: 'v1' });
  });

  it.each([
    [null, false],
    [null, null],
    [Forma.HUMANA, null],
    [Forma.OBJETIVA, null],
  ] as const)('não sugere sem informação suficiente: %s, %s', (forma, enem) => {
    expect(sugerirProcedimentoDeRecurso(forma, enem, catalogo)).toBeNull();
  });

  it('não oferece referência ausente nem reconhece regra pelo texto livre', () => {
    expect(sugerirProcedimentoDeRecurso(Forma.HUMANA, false, [])).toBeNull();
    expect(
      sugerirProcedimentoDeRecurso(Forma.HUMANA, false, [
        regra('OUTRA', { baseLegal: RECORRECAO }),
      ]),
    ).toBeNull();
    expect(
      sugerirProcedimentoDeRecurso(Forma.OBJETIVA, false, [
        regra(RECALCULO, { tipo: 'regra_calculo' }),
      ]),
    ).toBeNull();
  });

  it('usa a única versão do código devolvida pelo catálogo', () => {
    const versoes = [regra(RECORRECAO, { versao: 'v9' })];
    expect(sugerirProcedimentoDeRecurso(Forma.HUMANA, false, versoes)).toEqual({
      codigo: RECORRECAO,
      versao: 'v9',
    });
  });

  it('não sugere quando há mais de uma versão sem indicação de vigência', () => {
    const versoes = [regra(RECORRECAO, { versao: 'v9' }), regra(RECORRECAO)];
    expect(sugerirProcedimentoDeRecurso(Forma.HUMANA, false, versoes)).toBeNull();
    expect(sugerirProcedimentoDeRecurso(Forma.HUMANA, false, versoes.reverse())).toBeNull();
  });

  it('não altera o catálogo congelado e não compartilha um objeto mutável de referência', () => {
    const recebido = Object.freeze(catalogo.map((atual) => Object.freeze(atual)));
    const sugerida = sugerirProcedimentoDeRecurso(Forma.HUMANA, false, recebido);
    expect(sugerida).toEqual({ codigo: RECORRECAO, versao: 'v1' });
    expect(recebido).toHaveLength(2);
  });
});
