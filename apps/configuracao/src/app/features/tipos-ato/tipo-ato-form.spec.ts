import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { aviso } from './tipos-ato.testing';
import {
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeAto,
  normalizarCaixaDoCodigo,
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
    form.patchValue({ codigo: ' NOVO ', nome: ' Nome ', vigenciaFim: '', baseLegal: '  ' });
    expect(comandoDeCriacao(form)).toMatchObject({
      codigo: 'NOVO',
      nome: 'Nome',
      vigenciaFim: null,
      baseLegal: null,
    });
    expect(comandoDeAtualizacao('1', form)).toMatchObject({ id: '1', codigo: 'NOVO' });
  });

  it('liga o campo recusado pelo servidor ao controle, ignorando o desconhecido', () => {
    expect(controleDoCampoDoServidor('ExigeAtoCorrigido')).toBe('exigeAtoCorrigido');
    expect(controleDoCampoDoServidor('Desconhecido')).toBeNull();
  });

  describe('caixa do código', () => {
    it('escreve em maiúsculas só na criação, sem emitir novo evento', () => {
      TestBed.runInInjectionContext(() => {
        const form = criarFormularioDeAto();
        let criando = true;
        normalizarCaixaDoCodigo(form, () => criando);
        let emissoes = 0;
        form.controls.codigo.valueChanges.subscribe(() => emissoes++);

        form.controls.codigo.setValue('resultado_x');
        expect(form.controls.codigo.value).toBe('RESULTADO_X');
        expect(emissoes).toBe(1);

        criando = false;
        form.controls.codigo.setValue('minusculo');
        expect(form.controls.codigo.value).toBe('minusculo');
      });
    });
  });
});
