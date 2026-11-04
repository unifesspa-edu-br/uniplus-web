import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { fatosCitadosPelasModalidadesOfertadas } from './campos-pressupostos.service';

const condicao = (fato: string) => ({ fato, operador: 'IGUAL', valor: true });

function processoCom(
  modalidades: readonly { codigo: string; regraDeAplicabilidade: unknown }[],
  regrasDerivacao: readonly unknown[] = [],
): ProcessoSeletivoDto {
  return {
    distribuicaoVagas: [{ modalidades }],
    regrasDerivacao,
  } as unknown as ProcessoSeletivoDto;
}

describe('os fatos que as regras das modalidades ofertadas citam', () => {
  it('junta os fatos de todas as cláusulas, e o que cita a derivação que o processo configura para um deles', () => {
    const processo = processoCom(
      [
        { codigo: 'AC', regraDeAplicabilidade: [] },
        {
          codigo: 'LI_Q',
          regraDeAplicabilidade: [[condicao('QUILOMBOLA_DECLARADO'), condicao('CONCORRER_Q')]],
        },
      ],
      [
        {
          codigoFato: 'QUILOMBOLA_DECLARADO',
          regras: [{ ordem: 0, contribui: null, quando: [[condicao('QUILOMBOLA')]] }],
        },
      ],
    );

    expect([...fatosCitadosPelasModalidadesOfertadas(processo)].sort()).toEqual([
      'CONCORRER_Q',
      'QUILOMBOLA',
      'QUILOMBOLA_DECLARADO',
    ]);
  });
});
