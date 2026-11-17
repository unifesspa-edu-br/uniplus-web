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

  it('a causa geral entra com a própria mensagem e não pede o título da raiz', () => {
    const geral = { ...problema(undefined), errors: [{ code: 'geral', message: 'Bloqueado.' }] };

    expect(resumoDaRecusa(geral, explicarConhecido, () => TITULO)).toEqual(['Bloqueado.']);
  });

  it('a causa geral vem depois das explicadas e não esconde o erro de campo sem explicação', () => {
    const mista = {
      ...problema([
        { field: 'a', code: 'conhecido' },
        { field: 'b', code: 'outro' },
      ]),
      errors: [
        { field: 'a', code: 'conhecido', message: 'x' },
        { code: 'geral', message: 'Bloqueado.' },
        { field: 'b', code: 'outro', message: 'x' },
      ],
    };

    expect(resumoDaRecusa(mista, explicarConhecido, () => TITULO)).toEqual([
      'Texto da tela.',
      'Bloqueado.',
      TITULO,
    ]);
  });

  it('a causa de campo vazio, a raiz do documento, é causa de campo e segue a explicação da tela', () => {
    const raiz = problema([{ field: '', code: 'conhecido' }]);

    expect(resumoDaRecusa(raiz, explicarConhecido, () => TITULO)).toEqual(['Texto da tela.']);
  });

  it('a causa geral igual ao texto de um campo continua no resumo, e a repetida entre gerais não', () => {
    const mista = {
      ...problema([{ field: 'a', code: 'conhecido' }]),
      errors: [
        { field: 'a', code: 'conhecido', message: 'x' },
        { code: 'geral', message: 'Texto da tela.' },
        { code: 'geral', message: 'Texto da tela.' },
      ],
    };

    expect(resumoDaRecusa(mista, explicarConhecido, () => TITULO)).toEqual([
      'Texto da tela.',
      'Texto da tela.',
    ]);
  });
});
