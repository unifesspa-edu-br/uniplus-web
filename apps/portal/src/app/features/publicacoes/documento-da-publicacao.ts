import { PapelDoDocumento, type DocumentoDoEventoResponse } from '@uniplus/shared-data/portal';
import { formatarTamanhoDeArquivo } from '@uniplus/shared-utils';

import type { DocumentoDaPublicacao, DocumentosDaPublicacao } from './publicacoes.model';

const FORMATOS_POR_TIPO_DE_MIDIA: Readonly<Record<string, string>> = {
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.oasis.opendocument.text': 'ODT',
};

/** Rótulo curto do formato; tipo de mídia fora do catálogo cai na extensão do nome, e sem ela em "arquivo". */
export function formatoDoDocumento(tipoDeMidia: string, nome: string): string {
  const conhecido = FORMATOS_POR_TIPO_DE_MIDIA[tipoDeMidia.split(';')[0].trim().toLowerCase()];
  if (conhecido) return conhecido;
  const extensao = /\.([A-Za-z0-9]{1,5})$/.exec(nome)?.[1];
  return extensao ? extensao.toUpperCase() : 'arquivo';
}

function paraDocumento(documento: DocumentoDoEventoResponse): DocumentoDaPublicacao {
  return {
    nome: documento.nome,
    formato: formatoDoDocumento(documento.tipoDeMidia, documento.nome),
    tamanho: formatarTamanhoDeArquivo(documento.tamanhoBytes),
    url: documento.url,
  };
}

/** Separa o documento principal dos anexos, preservando a ordem em que o ato os apresenta. */
export function paraDocumentos(
  documentos: readonly DocumentoDoEventoResponse[],
): DocumentosDaPublicacao {
  const principal = documentos.find((d) => d.papel === PapelDoDocumento.principal);
  return {
    ...(principal ? { principal: paraDocumento(principal) } : {}),
    anexos: documentos.filter((d) => d.papel === PapelDoDocumento.anexo).map(paraDocumento),
  };
}
