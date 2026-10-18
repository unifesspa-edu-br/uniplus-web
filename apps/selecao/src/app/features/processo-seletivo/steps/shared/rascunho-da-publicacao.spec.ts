import { describe, expect, it } from 'vitest';

import type { AnexoDoEdital } from '../processo-seletivo.models';
import { blocoDoDocumento, documentoDoRascunho, temAlgoAGuardar } from './rascunho-da-publicacao';

const DOCUMENTO = '01960000-0000-7000-0000-0000000005d1';

function anexo(parcial: Partial<AnexoDoEdital> = {}): AnexoDoEdital {
  return {
    id: 'local',
    nomeArquivo: 'cronograma.pdf',
    nome: 'Cronograma',
    progress: 100,
    fase: 'confirmado',
    documentoAPublicarId: DOCUMENTO,
    enviado: true,
    ...parcial,
  };
}

describe('rascunho da publicação — anexos do edital', () => {
  it('guarda só os anexos confirmados, pelo documento selado', () => {
    const bloco = blocoDoDocumento(null);
    bloco.anexos = [anexo(), anexo({ id: 'b', fase: 'enviando', documentoAPublicarId: 'doc-b' })];

    expect(documentoDoRascunho(bloco).anexos).toEqual([
      { documentoId: DOCUMENTO, nome: 'Cronograma', nomeArquivo: 'cronograma.pdf' },
    ]);
  });

  it('reabre o rascunho com os anexos como confirmados, na ordem guardada', () => {
    const bloco = blocoDoDocumento(
      JSON.parse(
        JSON.stringify(documentoDoRascunho({ ...blocoDoDocumento(null), anexos: [anexo()] })),
      ),
    );

    expect(bloco.anexos).toEqual([
      {
        id: DOCUMENTO,
        nomeArquivo: 'cronograma.pdf',
        nome: 'Cronograma',
        progress: 100,
        fase: 'confirmado',
        documentoAPublicarId: DOCUMENTO,
        enviado: true,
      },
    ]);
  });

  it('ignora entrada guardada sem documento ou sem arquivo, e rascunho sem anexos', () => {
    expect(blocoDoDocumento({ anexos: [{ nome: 'x' }, 'texto', null] }).anexos).toEqual([]);
    expect(blocoDoDocumento({}).anexos).toEqual([]);
  });

  it('só os anexos confirmados já dão o que guardar', () => {
    const vazio = blocoDoDocumento(null);

    expect(temAlgoAGuardar(vazio)).toBe(false);
    expect(temAlgoAGuardar({ ...vazio, anexos: [anexo({ fase: 'erro' })] })).toBe(false);
    expect(temAlgoAGuardar({ ...vazio, anexos: [anexo()] })).toBe(true);
  });
});
