import { describe, expect, it } from 'vitest';
import type { ProblemDetails } from '@uniplus/shared-core/http';
import { recusasDoControle } from '../../../shared/formulario';
import { CampoDoMotivo } from './campo-do-motivo';

const CAUSA_GERAL = { code: 'bloqueada', message: 'A versão está bloqueada.' };

function problema(errors: ProblemDetails['errors']): ProblemDetails {
  return {
    type: 'x',
    title: 'Dados inválidos',
    status: 422,
    code: 'validacao',
    traceId: '',
    errors,
  };
}

describe('CampoDoMotivo.recusar', () => {
  it('marca o motivo recusado e devolve verdadeiro, com ou sem causa geral na resposta', () => {
    const campo = new CampoDoMotivo();

    const semGeral = campo.recusar(
      problema([{ field: 'Motivo', code: 'motivo_invalido', message: 'Motivo longo.' }]),
    );
    const comGeral = campo.recusar(
      problema([
        { field: 'motivo', code: 'motivo_invalido', message: 'Motivo longo.' },
        CAUSA_GERAL,
      ]),
    );

    expect([semGeral, comGeral]).toEqual([true, true]);
    expect(recusasDoControle(campo.controle)).toHaveLength(1);
    expect(campo.pedidoDeFoco()).toBe(2);
  });

  it('devolve falso, sem marcar o campo, quando a recusa é só de causa geral ou de outro campo', () => {
    const campo = new CampoDoMotivo();

    const soGeral = campo.recusar(problema([CAUSA_GERAL]));
    const outroCampo = campo.recusar(problema([{ field: 'Outro', code: 'x', message: 'Outro.' }]));

    expect([soGeral, outroCampo]).toEqual([false, false]);
    expect(recusasDoControle(campo.controle)).toHaveLength(0);
    expect(campo.pedidoDeFoco()).toBe(0);
  });
});
