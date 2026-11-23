import { describe, expect, it } from 'vitest';
import {
  aceitarQualquerFormato,
  definirTamanhoDoFormato,
  retirarFormato,
  selecionarFormato,
  tamanhoDoFormatoInvalido,
} from './edicao-do-arquivo-da-exigencia';

describe('edição do arquivo da exigência', () => {
  it('mantém a lista vazia ao retirar o último formato', () => {
    const formatos = selecionarFormato(aceitarQualquerFormato(), 'PDF');
    expect(retirarFormato(formatos, 'PDF')).toEqual({ tipo: 'lista', itens: [] });
  });

  it('define o tamanho de um formato e descarta a lista ao aceitar qualquer formato', () => {
    const formatos = selecionarFormato(aceitarQualquerFormato(), 'PDF');
    expect(definirTamanhoDoFormato(formatos, 'PDF', 1024)).toEqual({
      tipo: 'lista',
      itens: [{ formato: 'PDF', tamanhoMaximoBytes: 1024 }],
    });
    expect(aceitarQualquerFormato()).toEqual({ tipo: 'qualquer' });
  });

  it('recusa tamanho superior ao limite da exigência', () => {
    expect(tamanhoDoFormatoInvalido(1025, 1024)).toBe(true);
    expect(tamanhoDoFormatoInvalido(1024, 1024)).toBe(false);
    expect(tamanhoDoFormatoInvalido(null, 1024)).toBe(false);
  });

  it('mantém uma única entrada ao selecionar o mesmo formato novamente', () => {
    const formatos = selecionarFormato(aceitarQualquerFormato(), 'PDF');
    expect(selecionarFormato(formatos, 'PDF')).toEqual(formatos);
  });

  it('recusa tamanhos não positivos, fracionários ou acima do limite do contrato', () => {
    expect(tamanhoDoFormatoInvalido(0, null)).toBe(true);
    expect(tamanhoDoFormatoInvalido(1.5, null)).toBe(true);
    expect(tamanhoDoFormatoInvalido(2_147_483_648, null)).toBe(true);
    expect(tamanhoDoFormatoInvalido(2_147_483_647, null)).toBe(false);
  });
});
