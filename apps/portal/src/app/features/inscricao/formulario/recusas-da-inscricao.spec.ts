import type { CausaDeCampo } from '@uniplus/shared-core/http';
import { describe, expect, it } from 'vitest';

import { separarRecusas } from './recusas-da-inscricao';

const causa = (field: string, code: string, message: string): CausaDeCampo => ({
  field,
  code,
  message,
});

describe('separarRecusas', () => {
  it('a recusa de um campo leva a mensagem da API, sem texto próprio do portal', () => {
    const { porCampo } = separarRecusas([
      causa('NOME', 'uniplus.selecao.inscricao.aceite_repetido', 'O aceite veio duas vezes.'),
    ]);

    expect(porCampo).toEqual([{ campo: 'NOME', mensagem: 'O aceite veio duas vezes.' }]);
  });

  it('a recusa da 1ª opção de curso leva a mensagem da API e não entra nas de campo', () => {
    const recusas = separarRecusas([
      causa('ofertaCursoId', 'uniplus.selecao.inscricao.oferta_obrigatoria', 'Escolha o curso.'),
    ]);

    expect(recusas.daOferta).toBe('Escolha o curso.');
    expect(recusas.porCampo).toEqual([]);
  });

  it('a recusa da 2ª opção de curso leva a mensagem e o código da API', () => {
    const { daSegunda } = separarRecusas([
      causa(
        'ofertaCursoSegundaOpcaoId',
        'uniplus.selecao.inscricao.nenhuma_modalidade',
        'Sem vaga.',
      ),
    ]);

    expect(daSegunda).toEqual({
      mensagem: 'Sem vaga.',
      codigo: 'uniplus.selecao.inscricao.nenhuma_modalidade',
    });
  });

  it('sem recusa das opções de curso, nenhuma é devolvida', () => {
    expect(separarRecusas([])).toEqual({ porCampo: [], daOferta: null, daSegunda: null });
  });
});
