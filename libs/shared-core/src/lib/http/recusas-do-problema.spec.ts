import { describe, expect, it } from 'vitest';

import type { ProblemDetails } from './problem-details';
import { recusasDoProblema } from './recusas-do-problema';

const BASE_DAS_PAGINAS = 'https://developers.example.test/erros/';

function problema(parcial: Partial<ProblemDetails> = {}): ProblemDetails {
  return {
    type: `${BASE_DAS_PAGINAS}uniplus.selecao.validacao`,
    title: 'Validação',
    status: 422,
    code: 'uniplus.selecao.validacao',
    traceId: '',
    ...parcial,
  };
}

describe('recusasDoProblema', () => {
  it('leva cada recusa de campo com a página que explica o código', () => {
    const recusas = recusasDoProblema(
      problema({
        errors: [{ field: 'Nome', code: 'uniplus.selecao.nome', message: 'Informe o nome.' }],
      }),
    );

    expect(recusas.deCampo).toEqual([
      {
        campo: 'Nome',
        codigo: 'uniplus.selecao.nome',
        mensagem: 'Informe o nome.',
        pagina: `${BASE_DAS_PAGINAS}uniplus.selecao.nome`,
        ordem: 0,
      },
    ]);
  });

  it('numera cada recusa de campo pela posição em errors[], contando a causa geral', () => {
    const recusas = recusasDoProblema(
      problema({
        errors: [
          { field: 'b', code: 'x', message: 'Do b.' },
          { code: 'geral', message: 'Geral.' },
          { field: 'a', code: 'y', message: 'Do a.' },
        ],
      }),
    );

    expect(recusas.deCampo.map((recusa) => [recusa.campo, recusa.ordem])).toEqual([
      ['b', 0],
      ['a', 2],
    ]);
    expect(recusas.gerais).toEqual([{ code: 'geral', message: 'Geral.' }]);
  });

  it('deixa a página vazia quando o código é uma URN que não aponta página', () => {
    const [recusa] = recusasDoProblema(
      problema({ errors: [{ field: 'Nome', code: 'urn:uniplus:nome', message: 'Informe.' }] }),
    ).deCampo;

    expect(recusa.pagina).toBeNull();
  });

  it('devolve lista vazia para o problema sem recusa de campo, como o 409', () => {
    expect(recusasDoProblema(problema({ status: 409 }))).toEqual({ deCampo: [], gerais: [] });
  });
});
