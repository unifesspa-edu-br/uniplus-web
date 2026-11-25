import { describe, expect, it } from 'vitest';

import { detalheDoArquivoEnviado } from './envio-de-documentos';

describe('detalheDoArquivoEnviado', () => {
  it('diz o formato, o tamanho e o envio', () => {
    expect(
      detalheDoArquivoEnviado({
        tipoDeMidia: 'application/pdf',
        tamanhoBytes: 2048,
        confirmadoEm: '2026-10-22T12:33:00Z',
      }),
    ).toBe('PDF · 2,0 KB · enviado em 22/10/2026, 09:33');
  });

  it('omite o tamanho que não se conhece e o envio sem data válida', () => {
    expect(
      detalheDoArquivoEnviado({
        tipoDeMidia: 'application/pdf',
        tamanhoBytes: null,
        confirmadoEm: 'invalida',
      }),
    ).toBe('PDF');
  });

  it('omite o formato desconhecido em vez de mostrar o tipo de mídia cru', () => {
    expect(
      detalheDoArquivoEnviado({
        tipoDeMidia: 'application/x-segredo',
        tamanhoBytes: 2048,
        confirmadoEm: '2026-10-22T12:33:00Z',
      }),
    ).toBe('2,0 KB · enviado em 22/10/2026, 09:33');
  });
});
