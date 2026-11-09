import { describe, expect, it } from 'vitest';
import {
  controleDoCampoDoServidor,
  criarFormularioDePerfil,
  exigirCamposDaProposta,
  mensagemDoCampoDoPerfil,
  valoresDoPerfil,
} from './perfil-form';

describe('formulário de perfil', () => {
  it('começa vazio e exige nome, descrição e protocolo do documento instituidor', () => {
    const form = criarFormularioDePerfil();
    expect(form.invalid).toBe(true);
    expect(form.getRawValue()).toEqual(valoresDoPerfil(null));
    form.patchValue({ nome: 'Consulta', descricao: 'Permite consultar.' });
    expect(form.controls.protocolo.hasError('required')).toBe(true);
    form.patchValue({ protocolo: '23479.000123/2026-10' });
    expect(form.valid).toBe(true);
  });

  it('só exige motivo e categoria quando a proposta retira permissões', () => {
    const form = criarFormularioDePerfil();
    form.patchValue({ nome: 'Consulta', descricao: 'Permite consultar.', protocolo: 'P-1' });

    exigirCamposDaProposta(form, { documento: true, remocao: true });
    expect(form.controls.motivoDaRemocao.hasError('required')).toBe(true);
    expect(form.controls.categoriaDaRemocao.hasError('required')).toBe(true);

    exigirCamposDaProposta(form, { documento: true, remocao: false });
    expect(form.valid).toBe(true);
  });

  it('dispensa o protocolo quando a proposta só retira permissões', () => {
    const form = criarFormularioDePerfil();
    form.patchValue({ nome: 'Consulta', descricao: 'Permite consultar.' });

    exigirCamposDaProposta(form, { documento: false, remocao: false });

    expect(form.controls.protocolo.valid).toBe(true);
  });

  it('reconhece o campo que o servidor aponta, em qualquer caixa, e ignora o desconhecido', () => {
    expect(controleDoCampoDoServidor('Nome')).toBe('nome');
    expect(controleDoCampoDoServidor('descricao')).toBe('descricao');
    expect(controleDoCampoDoServidor('Protocolo')).toBe('protocolo');
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
