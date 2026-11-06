import { describe, expect, it } from 'vitest';
import {
  campoDoServidor,
  comandoDeAtualizacao,
  comandoDeCriacao,
  criarFormularioDeBaseLegal,
  valoresDaBaseLegal,
  valoresEmBrancoDaBaseLegal,
} from './base-legal-form';
import { MARABA, portaria } from './base-legal-bonus-regional.testing';

const MUNICIPIO = { codigoIbge: MARABA.codigoIbge, nome: MARABA.nome, uf: MARABA.uf };

describe('formulário de base legal', () => {
  it('nasce em branco e exige tipo, identificação e descrição', () => {
    const form = criarFormularioDeBaseLegal();
    form.reset(valoresEmBrancoDaBaseLegal());
    expect(form.invalid).toBe(true);

    form.patchValue({ tipoInstrumento: 'PORTARIA', identificacao: 'Portaria', descricao: 'Texto' });
    expect(form.valid).toBe(true);
  });

  it('confere o texto aparado: só espaços é obrigatório e curto demais tem o mínimo', () => {
    const form = criarFormularioDeBaseLegal();
    form.patchValue({ identificacao: '   ', descricao: ' ab ' });

    expect(Object.keys(form.controls.identificacao.errors ?? {})).toEqual(['required']);
    expect(form.controls.descricao.errors?.['minlength']).toEqual({
      requiredLength: 3,
      actualLength: 2,
    });
  });

  it('respeita o limite de tamanho da identificação e da descrição, e aceita o limite exato', () => {
    const form = criarFormularioDeBaseLegal();
    form.patchValue({ identificacao: 'x'.repeat(501), descricao: 'x'.repeat(2001) });
    expect(Object.keys(form.controls.identificacao.errors ?? {})).toEqual(['maxlength']);
    expect(Object.keys(form.controls.descricao.errors ?? {})).toEqual(['maxlength']);

    form.patchValue({ identificacao: 'x'.repeat(500), descricao: 'x'.repeat(2000) });
    expect(form.controls.identificacao.errors).toBeNull();
    expect(form.controls.descricao.errors).toBeNull();
  });

  it('carrega a base no formulário', () => {
    const form = criarFormularioDeBaseLegal();
    form.reset(valoresDaBaseLegal(portaria));
    expect(form.getRawValue()).toEqual({
      tipoInstrumento: 'PORTARIA',
      identificacao: portaria.identificacao,
      descricao: portaria.descricao,
    });
  });

  it('apara os textos nos comandos e envia só código, nome e UF de cada município', () => {
    const form = criarFormularioDeBaseLegal();
    form.patchValue({ tipoInstrumento: 'LEI', identificacao: ' Lei 1 ', descricao: ' Texto ' });
    const municipios = [{ ...MUNICIPIO, ddd: '94' }];

    expect(comandoDeCriacao(form, municipios)).toEqual({
      tipoInstrumento: 'LEI',
      identificacao: 'Lei 1',
      descricao: 'Texto',
      municipios: [MUNICIPIO],
    });
    expect(comandoDeAtualizacao('1', form, municipios)).toMatchObject({
      id: '1',
      identificacao: 'Lei 1',
    });
  });

  it('liga o campo recusado pelo servidor ao controle, e os municípios ao campo próprio', () => {
    expect(campoDoServidor('Identificacao')).toBe('identificacao');
    expect(campoDoServidor('TipoInstrumento')).toBe('tipoInstrumento');
    expect(campoDoServidor('Municipios[2]')).toBe('municipios');
    expect(campoDoServidor('Desconhecido')).toBeNull();
  });
});
