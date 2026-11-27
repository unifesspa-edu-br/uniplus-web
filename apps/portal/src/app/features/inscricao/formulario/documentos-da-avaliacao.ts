import {
  SituacaoDoDocumentoCodigo,
  type AvaliacaoDaInscricaoDto,
} from '@uniplus/shared-data/selecao';
import type { DocumentosAvaliados } from '@uniplus/shared-inscricao/formulario';

type DocumentoDaApi = AvaliacaoDaInscricaoDto['documentos']['fases'][number]['documentos'][number];
type DocumentoAvaliado = DocumentosAvaliados['fases'][number]['documentos'][number];
type CodigoDaSituacao = DocumentoDaApi['situacao']['codigo'];
type ApresentacaoDaSituacao = Pick<DocumentoAvaliado, 'situacao' | 'exigido' | 'atendido'>;

const APRESENTACAO: Record<
  CodigoDaSituacao,
  Omit<ApresentacaoDaSituacao, 'situacao'> & {
    readonly variante: DocumentoAvaliado['situacao']['variante'];
  }
> = {
  [SituacaoDoDocumentoCodigo.NAO_EXIGIDO]: { variante: 'neutral', exigido: false, atendido: false },
  [SituacaoDoDocumentoCodigo.PENDENTE]: { variante: 'warning', exigido: true, atendido: false },
  [SituacaoDoDocumentoCodigo.PODE_SER_EXIGIDO]: {
    variante: 'info',
    exigido: false,
    atendido: false,
  },
  [SituacaoDoDocumentoCodigo.DEPENDE_DE_FASE_POSTERIOR]: {
    variante: 'neutral',
    exigido: false,
    atendido: false,
  },
  [SituacaoDoDocumentoCodigo.SATISFEITA]: { variante: 'success', exigido: true, atendido: true },
};

function apresentarDocumento(documento: DocumentoDaApi): DocumentoAvaliado {
  const { variante, exigido, atendido } = APRESENTACAO[documento.situacao.codigo];
  return {
    ...documento,
    modelo: apresentarModelo(documento.modelo),
    formatos: apresentarFormatos(documento.formatos),
    formatosAceitos: documento.formatosAceitos.map((f) => f.codigo),
    arquivos: documento.arquivos.map(apresentarArquivo),
    situacao: { rotulo: documento.situacao.rotulo, variante },
    exigido,
    atendido,
  };
}

function apresentarModelo(modelo: DocumentoDaApi['modelo']): DocumentoAvaliado['modelo'] {
  return modelo ? { ...modelo, formato: modelo.formato.rotulo } : null;
}

function apresentarFormatos(formatos: DocumentoDaApi['formatos']): DocumentoAvaliado['formatos'] {
  return { ...formatos, lista: formatos.lista?.map((formato) => formato.codigo) ?? null };
}

function apresentarArquivo(
  arquivo: DocumentoDaApi['arquivos'][number],
): DocumentoAvaliado['arquivos'][number] {
  return { ...arquivo, situacao: arquivo.situacao.codigo };
}

export function apresentarDocumentos(
  documentos: AvaliacaoDaInscricaoDto['documentos'],
): DocumentosAvaliados {
  return {
    fases: documentos.fases.map((fase) => ({
      ...fase,
      documentos: fase.documentos.map(apresentarDocumento),
    })),
  };
}
