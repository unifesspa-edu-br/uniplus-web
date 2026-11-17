import { describe, expect, it } from 'vitest';
import openapi from '../../../../openapi/selecao.openapi.json';
import {
  PARAMETROS_DA_ELIMINACAO,
  PARAMETROS_DO_DESEMPATE,
} from './parametros-das-regras.contrato';

function ramosDoContrato(
  ramos: typeof openapi.components.schemas.DocumentoDaConfiguracaoEliminacao.allOf,
): Record<string, string> {
  return Object.fromEntries(
    ramos.map((ramo) => [
      ramo.if.properties.regra.properties.codigo.const,
      ramo.then.properties.parametros.$ref.replace('#/components/schemas/', ''),
    ]),
  );
}

describe('parâmetros das regras no contrato', () => {
  it('mantém todos os ramos de eliminação sincronizados', () => {
    expect(PARAMETROS_DA_ELIMINACAO).toEqual(
      ramosDoContrato(openapi.components.schemas.DocumentoDaConfiguracaoEliminacao.allOf),
    );
  });
  it('mantém todos os ramos de desempate sincronizados', () => {
    expect(PARAMETROS_DO_DESEMPATE).toEqual(
      ramosDoContrato(openapi.components.schemas.DocumentoDaConfiguracaoDesempate.allOf),
    );
  });
});
