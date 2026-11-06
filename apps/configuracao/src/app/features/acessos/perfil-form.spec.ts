import { describe, expect, it } from 'vitest';
import {
  controleDoCampoDoServidor,
  criarFormularioDePerfil,
  mensagemDoCampoDoPerfil,
  valoresDoPerfil,
} from './perfil-form';

describe('formulário de perfil', () => {
  it('começa vazio e exige nome e descrição', () => {
    const form = criarFormularioDePerfil();
    expect(form.invalid).toBe(true);
    expect(form.getRawValue()).toEqual(valoresDoPerfil(null));
    form.setValue({ nome: 'Consulta', descricao: 'Permite consultar.' });
    expect(form.valid).toBe(true);
  });

  it('reconhece o campo que o servidor aponta, em qualquer caixa, e ignora o desconhecido', () => {
    expect(controleDoCampoDoServidor('Nome')).toBe('nome');
    expect(controleDoCampoDoServidor('descricao')).toBe('descricao');
    expect(controleDoCampoDoServidor('permissoes')).toBeNull();
  });

  it('só mostra a mensagem do campo depois de tocado e prefere a do servidor', () => {
    const { nome, descricao } = criarFormularioDePerfil().controls;
    expect(mensagemDoCampoDoPerfil('nome', nome)).toBeNull();
    nome.markAsTouched();
    descricao.markAsTouched();
    expect(mensagemDoCampoDoPerfil('nome', nome)).toBe('Informe o nome do perfil.');
    expect(mensagemDoCampoDoPerfil('descricao', descricao)).toBe('Descreva o perfil.');
    nome.setErrors({ backend: { code: 'x', message: 'Nome recusado.' } });
    expect(mensagemDoCampoDoPerfil('nome', nome)).toBe('Nome recusado.');
  });
});
