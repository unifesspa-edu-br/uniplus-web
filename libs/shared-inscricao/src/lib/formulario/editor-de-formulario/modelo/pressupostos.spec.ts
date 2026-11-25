import { describe, expect, it } from 'vitest';

import { conteudo, exibidoQuando, item, secao } from './conteudos-de-exemplo.testing';
import { acrescentarPressuposto, removerPressuposto } from './pressupostos';

describe('removerPressuposto', () => {
  it('recusa retirar o pressuposto que uma regra cita', () => {
    const atual = conteudo({
      paginas: [secao('S1', 0)],
      pressupostos: ['P'],
      itens: [item('A', 0, 'S1', { regras: { exibicao: exibidoQuando('P') } })],
    });

    expect(removerPressuposto(atual, 'P', new Map([['P', 'Forma de conclusão']]))).toEqual({
      ok: false,
      recusa: 'Não é possível retirar “Forma de conclusão”: o campo “A” cita esse fato.',
    });
  });
});

it('acrescenta o primeiro pressuposto quando a lista está ausente', () => {
  expect(acrescentarPressuposto(conteudo({ pressupostos: undefined }), 'P').pressupostos).toEqual([
    'P',
  ]);
});

it('remove pressuposto não citado e preserva os demais', () => {
  const atual = conteudo({ pressupostos: ['P', 'Q'] });
  const resultado = removerPressuposto(atual, 'P', new Map());
  expect(resultado.ok && resultado.conteudo.pressupostos).toEqual(['Q']);
  expect(atual.pressupostos).toEqual(['P', 'Q']);
});
