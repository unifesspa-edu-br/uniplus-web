import { describe, expect, it } from 'vitest';

import { formatoDoDocumento } from './documento-da-publicacao';

describe('formatoDoDocumento', () => {
  it.each([
    ['application/pdf', 'a.pdf', 'PDF'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'a.docx', 'DOCX'],
    ['application/vnd.oasis.opendocument.text', 'a.odt', 'ODT'],
    ['application/pdf; charset=binary', 'a.pdf', 'PDF'],
  ])('reconhece %s', (tipoDeMidia, nome, esperado) => {
    expect(formatoDoDocumento(tipoDeMidia, nome)).toBe(esperado);
  });

  it('tipo de mídia fora do catálogo cai na extensão do nome', () => {
    expect(formatoDoDocumento('application/octet-stream', 'quadro.xlsx')).toBe('XLSX');
  });

  it('sem tipo conhecido nem extensão, devolve "arquivo"', () => {
    expect(formatoDoDocumento('application/octet-stream', 'quadro')).toBe('arquivo');
  });
});
