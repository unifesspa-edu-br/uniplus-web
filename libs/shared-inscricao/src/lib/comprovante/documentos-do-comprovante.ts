import type { DocumentoDoComprovanteDto } from '@uniplus/shared-data/selecao';
import { formatarTamanhoDeArquivo } from '@uniplus/shared-utils';

type ArquivoDoDocumento = DocumentoDoComprovanteDto['arquivos'][number];

export interface ArquivoExibido {
  readonly formato: string;
  readonly tamanho: string;
  /** O código de verificação do arquivo, abreviado para caber numa linha. */
  readonly codigoAbreviado: string;
  readonly codigo: string;
}

export interface DocumentoExibido {
  readonly nome: string;
  readonly integrante: string | null;
  readonly obrigatoriedade: 'Obrigatório' | 'Facultativo';
  readonly situacao: string;
  readonly consequencia: string | null;
  readonly arquivos: readonly ArquivoExibido[];
}

/** Quantos caracteres do código de verificação ficam de cada lado quando ele é abreviado. */
const LADO_DO_CODIGO_ABREVIADO = 8;

const abreviado = (codigo: string): string =>
  codigo.length <= 2 * LADO_DO_CODIGO_ABREVIADO + 1
    ? codigo
    : `${codigo.slice(0, LADO_DO_CODIGO_ABREVIADO)}…${codigo.slice(-LADO_DO_CODIGO_ABREVIADO)}`;

/** Os documentos como a tela os lista: a situação e a consequência já vêm em texto da API. */
export function documentosExibidos(
  documentos: readonly DocumentoDoComprovanteDto[],
): DocumentoExibido[] {
  return documentos.map(documentoExibido);
}

function documentoExibido(documento: DocumentoDoComprovanteDto): DocumentoExibido {
  return {
    nome: documento.nome,
    integrante: documento.integrante,
    obrigatoriedade: documento.obrigatorio ? 'Obrigatório' : 'Facultativo',
    situacao: documento.situacao,
    consequencia: documento.consequencia,
    arquivos: documento.arquivos.map(arquivoExibido),
  };
}

function arquivoExibido(arquivo: ArquivoDoDocumento): ArquivoExibido {
  return {
    formato: arquivo.formato,
    tamanho: formatarTamanhoDeArquivo(arquivo.tamanhoBytes),
    codigoAbreviado: abreviado(arquivo.hashSha256),
    codigo: arquivo.hashSha256,
  };
}
