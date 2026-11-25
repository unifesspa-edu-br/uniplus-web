import { describe, expect, it } from 'vitest';
import { conteudoDoDocumento } from './conversao-do-formulario';
import { aceita, CATALOGOS, formulario } from './conversao.testing';

describe('leitura das partes do formulário', () => {
  it('atribui seção nula aos campos sem seção no documento', () => {
    const resultado = aceita(conteudoDoDocumento(formulario(), CATALOGOS));

    expect(resultado.conteudo.itens?.[0].paginaCodigo).toBeNull();
    expect(resultado.conteudo.grupos?.[0].subitens[0].paginaCodigo).toBeNull();
  });
});
