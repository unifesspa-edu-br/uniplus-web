import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { ligarCodigoDeCadastro } from './codigo-de-cadastro';

function montar(emCriacao: () => boolean) {
  const campos = {
    nome: new FormControl('', { nonNullable: true }),
    codigo: new FormControl('', { nonNullable: true }),
  };
  const ligacao = TestBed.runInInjectionContext(() => ligarCodigoDeCadastro(campos, emCriacao, 50));
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

  it('preserva o código digitado em minúsculas', () => {
    const { codigo } = montar(() => true);
    codigo.setValue('ledor');
    expect(codigo.value).toBe('ledor');
  });
  it('limpa a sugestão longa e o aviso quando o nome volta a caber', () => {
    const { nome, codigo, ligacao } = montar(() => true);
    nome.setValue('a'.repeat(50));
    expect(codigo.value).toBe('A'.repeat(50));
    nome.setValue('a'.repeat(51));
    expect(codigo.value).toBe('');
    expect(ligacao.avisoDoNome()).toBe(
      'O código formado a partir deste nome passa de 50 caracteres. Use um nome mais curto.',
    );
    nome.setValue('1ª etapa');
    expect(codigo.value).toBe('PRIMEIRA_ETAPA');
    expect(ligacao.avisoDoNome()).toBe('');
  });

  it('limpa o aviso ao digitar código ou reiniciar e não avisa para símbolos', () => {
    const { nome, codigo, ligacao } = montar(() => true);
    nome.setValue('a'.repeat(51));
    codigo.setValue('ESCOLHIDO');
    expect(ligacao.avisoDoNome()).toBe('');
    codigo.setValue('');
    nome.setValue('a'.repeat(51));
    ligacao.reiniciar();
    expect(ligacao.avisoDoNome()).toBe('');
    nome.setValue('---');
    expect(codigo.value).toBe('');
    expect(ligacao.avisoDoNome()).toBe('');
  });
});
