import { describe, expect, it } from 'vitest';
import type { TipoDocumentoDto } from '@uniplus/shared-data/configuracao';

import { documentosPorCategoria } from './documentos-por-categoria';

describe('documentos por categoria do cadastro', () => {
  function docsDe(tipo: Record<string, unknown>) {
    const tipos = [
      { id: 'd1', codigo: 'D1', nome: 'Doc', categoria: 'X', ...tipo },
    ] as unknown as readonly TipoDocumentoDto[];
    return documentosPorCategoria(tipos, [])[0].docs[0];
  }

  /** Sem formato, o limite aparece sozinho; o texto não traz "Formatos aceitos: ." vazio. */
  it('monta o texto do cadastro só com as partes presentes', () => {
    expect(docsDe({ formatosAceitos: null, tamanhoMaximoMb: 10 }).formatos).toBe('Até 10 MB.');
    expect(docsDe({ formatosAceitos: 'pdf', tamanhoMaximoMb: null }).formatos).toBe(
      'Formatos aceitos: pdf.',
    );
    expect(docsDe({ formatosAceitos: ' ', tamanhoMaximoMb: null }).formatos).toBeNull();
  });

  /** O contrato admite o tamanho como texto: vazio ou não numérico não vira "Até  MB.". */
  it('ignora o tamanho que não é um número positivo', () => {
    expect(docsDe({ formatosAceitos: 'pdf', tamanhoMaximoMb: '' }).formatos).toBe(
      'Formatos aceitos: pdf.',
    );
    expect(docsDe({ formatosAceitos: 'pdf', tamanhoMaximoMb: 'abc' }).formatos).toBe(
      'Formatos aceitos: pdf.',
    );
    expect(docsDe({ formatosAceitos: null, tamanhoMaximoMb: '10' }).formatos).toBe('Até 10 MB.');
  });

  /** O limite é texto para o usuário: o decimal sai com vírgula. */
  it('escreve o tamanho fracionário com vírgula decimal', () => {
    expect(docsDe({ formatosAceitos: null, tamanhoMaximoMb: 2.5 }).formatos).toBe('Até 2,5 MB.');
  });

  /** Sem descrição, formato nem tamanho, não há o que orientar: nada a renderizar. */
  it('não tem orientação quando o cadastro não declara nada', () => {
    const doc = docsDe({ descricao: ' ', formatosAceitos: null, tamanhoMaximoMb: null });

    expect(doc.orientacao).toBeNull();
  });

  /** Descrição em branco não é descrição: a consulta lê "Sem descrição" e a edição cai nos formatos. */
  it('trata a descrição em branco como ausente', () => {
    const doc = docsDe({ descricao: '   ', formatosAceitos: 'pdf', tamanhoMaximoMb: null });

    expect(doc.descricao).toBeNull();
    expect(doc.orientacao).toBe('Formatos aceitos: pdf.');
  });
});
