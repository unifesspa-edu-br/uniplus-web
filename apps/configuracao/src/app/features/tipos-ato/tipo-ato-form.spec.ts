import { describe, expect, it } from 'vitest';
import { aviso } from './tipos-ato.testing';
import {
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeAto,
  valoresDoAto,
  valoresEmBrancoDoAto,
} from './tipo-ato-form';

describe('formulário de tipo de ato', () => {
  it('nasce sem resposta nos dois atributos de publicação e exige o essencial', () => {
    const form = criarFormularioDeAto();
    form.reset(valoresEmBrancoDoAto());
    expect(form.invalid).toBe(true);
    expect(form.controls.publicavelComoAvulso.value).toBeNull();
    form.patchValue({ codigo: 'AVISO', nome: 'Aviso', vigenciaInicio: '2026-01-01' });
    expect(form.invalid).toBe(true);
    form.patchValue({ publicavelComoAvulso: false, exigeAtoCorrigido: false });
    expect(form.valid).toBe(true);
  });

  it('respeita os limites de tamanho do código, do nome e da base legal', () => {
    const form = criarFormularioDeAto();
    form.patchValue({ codigo: 'X'.repeat(61), nome: 'x', baseLegal: 'x'.repeat(501) });
    expect(Object.keys(form.controls.codigo.errors ?? {})).toEqual(['maxlength']);
    expect(Object.keys(form.controls.nome.errors ?? {})).toEqual(['minlength']);
    expect(Object.keys(form.controls.baseLegal.errors ?? {})).toEqual(['maxlength']);
  });

  it('carrega a vigência no formulário e apara os textos nos comandos', () => {
    const form = criarFormularioDeAto();
    form.reset(valoresDoAto(aviso));
    expect(form.getRawValue()).toMatchObject({
      codigo: 'AVISO',
      vigenciaFim: '2026-06-30',
      baseLegal: '',
      publicavelComoAvulso: true,
    });
  });

  it('preserva o código e apara os demais textos nos comandos', () => {
    const form = criarFormularioDeAto();
    form.reset(valoresDoAto(aviso));
    form.patchValue({ codigo: ' NOVO ', nome: ' Nome ', vigenciaFim: '', baseLegal: '  ' });
    expect(comandoDeCriacao(form)).toMatchObject({
      codigo: ' NOVO ',
      nome: 'Nome',
      vigenciaFim: null,
      baseLegal: null,
    });
    expect(comandoDeAtualizacao('1', form)).toMatchObject({ id: '1', codigo: ' NOVO ' });
  });

  it('liga o campo recusado pelo servidor ao controle, ignorando o desconhecido', () => {
    expect(controleDoCampoDoServidor('ExigeAtoCorrigido')).toBe('exigeAtoCorrigido');
    expect(controleDoCampoDoServidor('Desconhecido')).toBeNull();
  });
});

describe('limites do código (60 caracteres)', () => {
  it.each(['A', 'A'.repeat(60)])('aceita o código válido %s', (valor) => {
    const codigo = criarFormularioDeAto().controls.codigo;
    codigo.setValue(valor);
    expect(codigo.valid).toBe(true);
  });

  it.each([
    ['', 'required'],
    ['A'.repeat(61), 'maxlength'],
  ] as const)('recusa o código %s por %s', (valor, erro) => {
    const codigo = criarFormularioDeAto().controls.codigo;
    codigo.setValue(valor);
    expect(codigo.hasError(erro)).toBe(true);
  });

  it.each(['a', ' A', 'A ', '1A', 'A__B', 'A_'])(
    'preserva e recusa o código fora do formato %s',
    (valor) => {
      const codigo = criarFormularioDeAto().controls.codigo;
      codigo.setValue(valor);
      expect(codigo.hasError('pattern')).toBe(true);
      expect(codigo.value).toBe(valor);
    },
  );
});
