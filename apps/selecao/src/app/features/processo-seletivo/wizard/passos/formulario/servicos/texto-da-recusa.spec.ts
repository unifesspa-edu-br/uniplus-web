import type { ProblemDetails, ProblemI18nService } from '@uniplus/shared-core/http';
import { describe, expect, it } from 'vitest';

import { textoDaRecusa } from './texto-da-recusa';

const CAUSA =
  'O modelo cita um dado que só existe no processo que oferta a opção; ofereça-a antes.';

function i18nCom(title: string, detail?: string): ProblemI18nService {
  return { resolve: () => ({ title, detail }) } as unknown as ProblemI18nService;
}

function problemaCom(...mensagens: readonly string[]): ProblemDetails {
  return {
    type: 'about:blank',
    title: 'x',
    status: 422,
    code: 'uniplus.erro',
    traceId: '',
    errors: mensagens.map((message) => ({ field: 'campo', code: 'uniplus.causa', message })),
  } as ProblemDetails;
}

describe('textoDaRecusa', () => {
  it('mostra uma só vez a causa única que a API repete no detalhe', () => {
    const texto = textoDaRecusa(
      problemaCom(CAUSA),
      i18nCom('O modelo não pôde ser aplicado.', CAUSA),
    );

    expect(texto).toBe(`O modelo não pôde ser aplicado. ${CAUSA}`);
  });

  it('mostra cada causa diferente uma vez, e o detalhe não repete a primeira delas', () => {
    const outra = 'Outra causa, diferente da primeira.';

    const texto = textoDaRecusa(problemaCom(CAUSA, outra), i18nCom('Recusado.', CAUSA));

    expect(texto).toBe(`Recusado. ${CAUSA} ${outra}`);
  });

  it('mostra uma vez só o título igual ao detalhe', () => {
    const texto = textoDaRecusa(
      problemaCom(),
      i18nCom('Recusado pelo servidor.', 'Recusado pelo servidor.'),
    );

    expect(texto).toBe('Recusado pelo servidor.');
  });

  it('sem lista de erros, junta o título e o detalhe', () => {
    const problema = { ...problemaCom(), errors: undefined } as ProblemDetails;

    expect(textoDaRecusa(problema, i18nCom('Recusado.', 'Explicação do servidor.'))).toBe(
      'Recusado. Explicação do servidor.',
    );
  });

  it('sem detalhe nem erros, devolve só o título', () => {
    expect(textoDaRecusa(problemaCom(), i18nCom('Recusado.'))).toBe('Recusado.');
  });
});
