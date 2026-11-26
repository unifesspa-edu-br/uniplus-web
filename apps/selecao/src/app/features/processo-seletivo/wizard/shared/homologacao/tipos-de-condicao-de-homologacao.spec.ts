import { TipoDeCondicaoDeHomologacaoCodigo } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import {
  TIPOS_DE_CONDICAO_DE_HOMOLOGACAO,
  rotuloDoTipoDeCondicao,
} from './tipos-de-condicao-de-homologacao';

describe('tipos de condição de homologação', () => {
  it('oferece cada tipo do contrato com o rótulo em português', () => {
    expect(TIPOS_DE_CONDICAO_DE_HOMOLOGACAO).toStrictEqual([
      { valor: 'RESULTADO_NO_RETORNO_DO_INEP', rotulo: 'Resultado no retorno do INEP' },
    ]);
  });

  it('nomeia o tipo pelo rótulo', () => {
    expect(
      rotuloDoTipoDeCondicao(TipoDeCondicaoDeHomologacaoCodigo.RESULTADO_NO_RETORNO_DO_INEP),
    ).toBe('Resultado no retorno do INEP');
  });

  it('mostra o código que o cliente não conhece como veio', () => {
    expect(rotuloDoTipoDeCondicao('TIPO_NOVO_DA_API')).toBe('TIPO_NOVO_DA_API');
  });
});
