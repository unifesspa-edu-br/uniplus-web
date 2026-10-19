import type { AtoDoProcessoDto, DocumentoDoAtoDto } from '@uniplus/shared-data/selecao';

/** Como o ato é citado no texto: o tipo e, quando o documento declara, o número. */
export function rotuloDoAto(ato: Pick<AtoDoProcessoDto, 'tipoNome' | 'numero'>): string {
  return ato.numero === null ? ato.tipoNome : `${ato.tipoNome} nº ${ato.numero}`;
}

/** O nome com que o documento aparece: o de exibição, quando o ato o definiu, ou o do arquivo. */
export function nomeDoDocumento(documento: DocumentoDoAtoDto): string {
  return documento.nomeDeExibicao ?? documento.nomeArquivo;
}
