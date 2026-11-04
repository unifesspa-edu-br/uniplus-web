import type { ProblemDetails } from '@uniplus/shared-core/http';
import { describe, expect, it } from 'vitest';

import { resumoDaRecusa } from './resumo-da-recusa';

const TITULO = 'Título da raiz.';

function problema(
  errors: { readonly field: string; readonly code: string }[] | undefined,
  code = 'raiz',
): ProblemDetails {
  return {
    type: 'about:blank',
    title: TITULO,
    status: 422,
    code,
    traceId: 't',
    errors: errors?.map((erro) => ({ ...erro, message: 'x' })),
  } as ProblemDetails;
}

const explicarConhecido = (erro: { readonly code: string }) =>
  erro.code === 'conhecido' ? 'Texto da tela.' : null;

describe('resumoDaRecusa', () => {
  it('explica cada erro uma vez, sem o título quando a tela explica todos', () => {
    const resumo = resumoDaRecusa(
      problema([
        { field: 'a', code: 'conhecido' },
        { field: 'b', code: 'conhecido' },
      ]),
      explicarConhecido,
      () => TITULO,
    );

    expect(resumo).toEqual(['Texto da tela.']);
  });

  it('acrescenta o título da raiz quando algum erro a tela não explica', () => {
    const resumo = resumoDaRecusa(
      problema([
        { field: 'a', code: 'conhecido' },
        { field: 'b', code: 'outro' },
      ]),
      explicarConhecido,
      () => TITULO,
    );

    expect(resumo).toEqual(['Texto da tela.', TITULO]);
  });

  it('sem erro de campo, explica a raiz pelo próprio code', () => {
    expect(
      resumoDaRecusa(problema(undefined, 'conhecido'), explicarConhecido, () => TITULO),
    ).toEqual(['Texto da tela.']);
  });

  it('sem erro de campo e sem explicação para a raiz, dá o título', () => {
    expect(resumoDaRecusa(problema([]), explicarConhecido, () => TITULO)).toEqual([TITULO]);
  });
});
