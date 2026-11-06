import { describe, expect, it } from 'vitest';
import {
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeTipoDocumento,
  desserializarFormatosAceitos,
  serializarFormatosAceitos,
  valoresDoTipoDocumento,
  valoresEmBrancoDoTipoDocumento,
} from './tipo-documento-form';
import { PROTECAO_PREENCHIDA, rg } from './tipos-documento.testing';

describe('formulário de tipo de documento', () => {
  it('nasce vazio e exige código, categoria, nome e a proteção de dados', () => {
    const form = criarFormularioDeTipoDocumento();
    form.reset(valoresEmBrancoDoTipoDocumento());
    expect(form.invalid).toBe(true);
    form.patchValue({ codigo: 'RG', categoria: 'IDENTIFICACAO', nome: 'Registro Geral' });
    expect(form.invalid).toBe(true);
    form.patchValue(PROTECAO_PREENCHIDA);
    expect(form.valid).toBe(true);
  });

  it('respeita o limite de tamanho de cada campo de texto', () => {
    const form = criarFormularioDeTipoDocumento();
    form.patchValue({
      codigo: 'X'.repeat(51),
      nome: 'x',
      descricao: 'x'.repeat(1001),
      tipoEquivalente: 'X'.repeat(51),
      finalidadeTratamento: 'x'.repeat(501),
    });
    const erros = (nome: keyof typeof form.controls) =>
      Object.keys(form.controls[nome].errors ?? {});
    expect(erros('codigo')).toContain('maxlength');
    expect(erros('nome')).toEqual(['minlength']);
    expect(erros('descricao')).toEqual(['maxlength']);
    expect(erros('tipoEquivalente')).toEqual(['maxlength']);
    expect(erros('finalidadeTratamento')).toEqual(['maxlength']);
  });

  it('aceita o tamanho máximo vazio ou positivo e recusa menos de 1', () => {
    const form = criarFormularioDeTipoDocumento();
    const tamanho = form.controls.tamanhoMaximoMb;
    for (const [valor, valido] of [
      [null, true],
      [1, true],
      [0, false],
      [-3, false],
    ] as const) {
      tamanho.setValue(valor);
      expect(tamanho.valid, String(valor)).toBe(valido);
    }
  });

  it('o tipo equivalente invalida o grupo só na grafia exata do código', () => {
    const form = criarFormularioDeTipoDocumento();
    form.patchValue({ codigo: 'RG', tipoEquivalente: 'rg' });
    expect(form.hasError('tipoEquivalenteIgualAoCodigo')).toBe(false);
    form.patchValue({ tipoEquivalente: 'RG' });
    expect(form.hasError('tipoEquivalenteIgualAoCodigo')).toBe(true);
    form.patchValue({ tipoEquivalente: 'CIN' });
    expect(form.hasError('tipoEquivalenteIgualAoCodigo')).toBe(false);
  });

  it('carrega o tipo no formulário e apara os textos nos comandos', () => {
    const form = criarFormularioDeTipoDocumento();
    form.reset(valoresDoTipoDocumento(rg));
    expect(form.getRawValue()).toMatchObject({
      codigo: 'RG',
      formatoPdf: true,
      formatoJpeg: true,
      formatoPng: false,
      tamanhoMaximoMb: 10,
    });
    form.patchValue({
      codigo: ' NOVO ',
      nome: ' Nome ',
      descricao: '  ',
      tipoEquivalente: '',
      finalidadeTratamento: ' Finalidade ',
    });
    expect(comandoDeCriacao(form)).toMatchObject({
      codigo: 'NOVO',
      nome: 'Nome',
      descricao: null,
      tipoEquivalente: null,
      finalidadeTratamento: 'Finalidade',
      formatosAceitos: 'pdf,jpg',
    });
    expect(comandoDeAtualizacao('1', form)).toMatchObject({ id: '1', codigo: 'NOVO' });
  });

  it('um tipo sem descrição, equivalente e formatos volta a campos vazios', () => {
    const valores = valoresDoTipoDocumento({
      ...rg,
      descricao: null,
      tipoEquivalente: null,
      formatosAceitos: null,
    });
    expect(valores).toMatchObject({ descricao: '', tipoEquivalente: '', formatoPdf: false });
  });

  describe('formatos aceitos', () => {
    it('serializa na ordem fixa e devolve null sem nenhuma caixa marcada', () => {
      const todos = { formatoPdf: true, formatoJpeg: true, formatoPng: true, formatoTiff: true };
      expect(serializarFormatosAceitos(todos)).toBe('pdf,jpg,png,tiff');
      expect(
        serializarFormatosAceitos({
          ...todos,
          formatoPdf: false,
          formatoJpeg: false,
          formatoPng: false,
          formatoTiff: false,
        }),
      ).toBeNull();
    });

    it('desserializa ignorando caixa, espaços, sinônimos e vazios', () => {
      expect(desserializarFormatosAceitos(' PDF , jpeg,, tif ')).toEqual({
        formatoPdf: true,
        formatoJpeg: true,
        formatoPng: false,
        formatoTiff: true,
      });
      expect(desserializarFormatosAceitos(null)).toEqual({
        formatoPdf: false,
        formatoJpeg: false,
        formatoPng: false,
        formatoTiff: false,
      });
    });
  });

  it('liga o campo recusado pelo servidor ao controle, ignorando o desconhecido', () => {
    expect(controleDoCampoDoServidor('TamanhoMaximoMb')).toBe('tamanhoMaximoMb');
    expect(controleDoCampoDoServidor('tipoEquivalente')).toBe('tipoEquivalente');
    expect(controleDoCampoDoServidor('Desconhecido')).toBeNull();
  });
});
