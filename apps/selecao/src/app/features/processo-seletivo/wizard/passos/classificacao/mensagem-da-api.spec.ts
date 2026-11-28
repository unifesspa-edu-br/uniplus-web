import { describe, expect, it } from 'vitest';

import { mensagemDaApiOu } from './recusas-da-classificacao';

describe('mensagemDaApiOu', () => {
  it('devolve a mensagem como veio, com os espaços das pontas', () => {
    expect(mensagemDaApiOu({ message: '  mensagem inventada ' }, 'Genérico.')).toBe(
      '  mensagem inventada ',
    );
  });

  it.each(['', '   '])('sem mensagem (%j), devolve o texto genérico', (message) => {
    expect(mensagemDaApiOu({ message }, 'Genérico.')).toBe('Genérico.');
  });
});
