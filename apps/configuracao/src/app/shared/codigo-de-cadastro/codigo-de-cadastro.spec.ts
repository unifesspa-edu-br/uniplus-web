import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { ligarCodigoDeCadastro } from './codigo-de-cadastro';

function montar(emCriacao: () => boolean) {
  const campos = {
    nome: new FormControl('', { nonNullable: true }),
    codigo: new FormControl('', { nonNullable: true }),
  };
  const ligacao = TestBed.runInInjectionContext(() => ligarCodigoDeCadastro(campos, emCriacao));
  return { ...campos, ligacao };
}

describe('ligarCodigoDeCadastro', () => {
  it('na criação, o código acompanha o nome enquanto é a sugestão', () => {
    const { nome, codigo } = montar(() => true);

    nome.setValue('Sala de fácil acesso');
    expect(codigo.value).toBe('SALA_DE_FACIL_ACESSO');

    nome.setValue('Sala de fácil acesso térrea');
    expect(codigo.value).toBe('SALA_DE_FACIL_ACESSO_TERREA');
  });

  it('para de sugerir quando o operador troca o código', () => {
    const { nome, codigo } = montar(() => true);
    nome.setValue('Ledor');

    codigo.setValue('LEITOR');
    nome.setValue('Ledor de prova');

    expect(codigo.value).toBe('LEITOR');
  });

  it('fora da criação, nunca escreve no código, nem sobre a própria sugestão', () => {
    let emCriacao = true;
    const { nome, codigo } = montar(() => emCriacao);
    nome.setValue('Ledor');

    emCriacao = false;
    nome.setValue('Ledor de prova');

    expect(codigo.value).toBe('LEDOR');
  });

  it('reiniciada, a sugestão do formulário anterior não conta como do operador no novo', () => {
    const { nome, codigo, ligacao } = montar(() => true);
    nome.setValue('Ledor');

    ligacao.reiniciar();
    nome.setValue('', { emitEvent: false });
    codigo.setValue('LEDOR');
    nome.setValue('Ledor de prova');

    expect(codigo.value).toBe('LEDOR');
  });

  it('o código digitado em minúsculas vai em caixa alta', () => {
    const { codigo } = montar(() => true);

    codigo.setValue('ledor');

    expect(codigo.value).toBe('LEDOR');
  });
});
