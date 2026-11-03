import { FinalidadeDoDocumento, type DocumentoAPublicarDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { classificarDocumentos, descreverDocumento } from './documentos-do-edital';

describe('descreverDocumento', () => {
  const documento: DocumentoAPublicarDto = {
    id: '019f41cf-69fd-759a-ac6d-09acabc1b030',
    processoSeletivoId: '019f41cf-69fd-759a-ac6d-09acabc1b031',
    finalidade: FinalidadeDoDocumento.documentoDoEdital,
    nomeArquivo: 'edital-de-abertura.pdf',
    tipoDeMidia: 'application/pdf',
    status: 'Confirmado',
    criadoEm: '2026-08-20T12:00:00Z',
    expiraEm: '2026-08-20T12:15:00Z',
    tamanhoBytes: 2048,
    hashSha256: 'a'.repeat(64),
    confirmadoEm: '2026-08-20T12:05:00Z',
  };

  it('começa pelo nome do arquivo', () => {
    expect(descreverDocumento(documento).startsWith('edital-de-abertura.pdf · ')).toBe(true);
  });

  it('usa o texto de reserva quando o nome vem vazio', () => {
    expect(
      descreverDocumento({ ...documento, nomeArquivo: '  ' }).startsWith('nome indisponível · '),
    ).toBe(true);
  });
});

describe('classificarDocumentos', () => {
  const pdf: DocumentoAPublicarDto = {
    id: '019f41cf-69fd-759a-ac6d-09acabc1b040',
    processoSeletivoId: '019f41cf-69fd-759a-ac6d-09acabc1b031',
    finalidade: FinalidadeDoDocumento.documentoDoEdital,
    nomeArquivo: 'edital-de-abertura.pdf',
    tipoDeMidia: 'application/pdf',
    status: 'Confirmado',
    criadoEm: '2026-08-20T12:00:00Z',
    expiraEm: '2026-08-20T12:15:00Z',
    tamanhoBytes: 2048,
    hashSha256: 'a'.repeat(64),
    confirmadoEm: '2026-08-20T12:05:00Z',
  };
  const docx: DocumentoAPublicarDto = {
    ...pdf,
    id: '019f41cf-69fd-759a-ac6d-09acabc1b041',
    nomeArquivo: 'quadro-de-vagas.docx',
    tipoDeMidia: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    hashSha256: 'b'.repeat(64),
  };

  it('não toma um documento que não é PDF pelo edital', () => {
    expect(classificarDocumentos([docx])).toEqual({ vinculo: null, escolha: [] });
    expect(classificarDocumentos([pdf, docx]).vinculo?.documentoAPublicarId).toBe(pdf.id);
  });
});
