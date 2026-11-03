import { describe, expect, it } from 'vitest';

import { formatosDeclarados } from './arquivo-da-exigencia';
import { exigenciaNova } from './exigencias-documentais';
import { ID_CONTRACHEQUE, comando, rascunho } from './exigencias.testing';

describe('teto de tamanho', () => {
  /**
   * O contrato recebe o teto como `int32`; o cadastro não limita o valor em MB. Acima do que
   * o campo comporta, a gravação da árvore inteira voltaria 400 por causa de um documento.
   */
  it('omite o teto que não cabe no inteiro de 32 bits', () => {
    const raizes = comando(
      rascunho(exigenciaNova(ID_CONTRACHEQUE, 'HABILITACAO', { tamanhoMaximoMb: 4096 })),
    );
    expect(raizes[0].documento?.tamanhoMaximoBytes).toBeNull();
  });

  it('mantém o teto que cabe', () => {
    const raizes = comando(
      rascunho(exigenciaNova(ID_CONTRACHEQUE, 'HABILITACAO', { tamanhoMaximoMb: 5 })),
    );
    expect(raizes[0].documento?.tamanhoMaximoBytes).toBe(5 * 1024 * 1024);
  });
});

describe('formatosDeclarados', () => {
  it('traduz as grafias do cadastro para o vocabulário do contrato', () => {
    expect(formatosDeclarados('PDF, jpg; PNG').tokens).toEqual(['PDF', 'JPEG', 'PNG']);
  });

  it('reporta o formato que o contrato não expressa em vez de descartá-lo', () => {
    const { tokens, naoExpressos } = formatosDeclarados('PDF, TIFF');
    expect(tokens).toEqual(['PDF']);
    expect(naoExpressos).toEqual(['TIFF']);
  });

  it('cadastro sem restrição não declara formato nenhum', () => {
    expect(formatosDeclarados(null).tokens).toEqual([]);
  });
});
