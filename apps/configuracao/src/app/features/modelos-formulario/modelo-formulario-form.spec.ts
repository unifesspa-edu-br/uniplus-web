import { describe, expect, it } from 'vitest';
import {
  campoDaRecusa,
  comandoDeCriacao,
  criarFormularioDeModelo,
  mensagemDoCampo,
} from './modelo-formulario-form';

describe('formulário de criação do modelo', () => {
  it('monta o comando sem espaços nas pontas e com nulo nos opcionais em branco', () => {
    const form = criarFormularioDeModelo();
    form.setValue({
      codigo: ' INSCRICAO ',
      nome: ' Inscrição ',
      descricao: '   ',
      finalidade: 'INSCRICAO',
      tipoProcessoCodigo: '',
    });

    const comando = comandoDeCriacao(form);

    expect(comando).toMatchObject({
      codigo: 'INSCRICAO',
      nome: 'Inscrição',
      descricao: null,
      finalidade: 'INSCRICAO',
      tipoProcessoCodigo: null,
    });
    expect(comando.conteudo).not.toBeNull();
  });

  it('leva descrição e tipo de processo preenchidos ao comando', () => {
    const form = criarFormularioDeModelo();
    form.patchValue({ descricao: 'Texto', tipoProcessoCodigo: 'VESTIBULAR' });

    expect(comandoDeCriacao(form)).toMatchObject({
      descricao: 'Texto',
      tipoProcessoCodigo: 'VESTIBULAR',
    });
  });

  it.each([
    ['Nome', 'nome'],
    ['Command.Codigo', 'codigo'],
    ['TipoProcessoCodigo', 'tipoProcessoCodigo'],
    ['descricao', 'descricao'],
  ])('a recusa "%s" aponta o campo %s', (campo, esperado) => {
    expect(campoDaRecusa(campo)).toBe(esperado);
  });

  it.each(['Conteudo.Itens[0].Nome', 'Conteudo.Titulo', 'Desconhecido'])(
    'a recusa "%s" não aponta campo do drawer',
    (campo) => {
      expect(campoDaRecusa(campo)).toBeNull();
    },
  );

  describe('mensagem do campo', () => {
    it('não mostra erro antes de o campo ser tocado', () => {
      const form = criarFormularioDeModelo();

      expect(mensagemDoCampo(form.controls.nome)).toBeNull();
    });

    it('pede o campo obrigatório vazio e tocado', () => {
      const form = criarFormularioDeModelo();
      form.controls.nome.markAsTouched();

      expect(mensagemDoCampo(form.controls.nome)).toBe('Campo obrigatório.');
    });

    it('explica o formato do código', () => {
      const form = criarFormularioDeModelo();
      form.controls.codigo.setValue('1abc');
      form.controls.codigo.markAsTouched();

      expect(mensagemDoCampo(form.controls.codigo)).toBe(
        'Use caixa alta, começando por letra, com letras, números e sublinhado.',
      );
    });

    it('aponta o tamanho acima do permitido', () => {
      const form = criarFormularioDeModelo();
      form.controls.nome.setValue('a'.repeat(201));
      form.controls.nome.markAsTouched();

      expect(mensagemDoCampo(form.controls.nome)).toBe('Valor acima do tamanho permitido.');
    });

    it('a recusa do servidor vale mais que a regra local', () => {
      const form = criarFormularioDeModelo();
      form.controls.codigo.setValue('1abc');
      form.controls.codigo.setErrors({
        backend: { code: 'x', message: 'Código em uso.' },
        pattern: true,
      });
      form.controls.codigo.markAsTouched();

      expect(mensagemDoCampo(form.controls.codigo)).toBe('Código em uso.');
    });
  });
});
