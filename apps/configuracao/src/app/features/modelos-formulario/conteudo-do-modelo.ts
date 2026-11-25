import { OperadorCodigo, TipoDeCampoCodigo } from '@uniplus/shared-data/configuracao';
import type {
  ConteudoDoModeloInput,
  ModeloFormularioView,
} from '@uniplus/shared-data/configuracao';
import { codigosDoContrato } from '@uniplus/shared-data/utils';
import {
  CODIGOS_EM_TEXTO,
  conteudoComCodigos,
  type ConteudoDoFormulario,
} from '@uniplus/shared-inscricao/formulario';
import {
  paginasParaOModelo,
  gruposParaOModelo,
  itensParaOModelo,
  termosParaOModelo,
} from './codigos-de-pagina-e-obrigatoriedade';
import { documentoDoModelo, documentoParaOModelo } from './documentos-do-modelo';

type DocumentosDoEditor = Pick<
  ConteudoDoFormulario<number, OperadorCodigo | null>,
  'documentosExigidos' | 'gruposDeDocumentos'
>;

/** Os documentos e os grupos do editor, dentro do conjunto de documentos que o modelo grava. */
function conjuntoParaOModelo({ documentosExigidos, gruposDeDocumentos }: DocumentosDoEditor) {
  return {
    documentosExigidos: documentosExigidos?.map(documentoParaOModelo) ?? null,
    gruposDeDocumentos:
      gruposDeDocumentos?.map((grupo) => ({
        ...grupo,
        documentos: grupo.documentos.map(documentoParaOModelo),
      })) ?? null,
  };
}

/** O conteúdo do editor como o modelo o grava: cada operador e cada tipo de renderização no código do contrato. */
export function conteudoParaOModelo(conteudo: ConteudoDoFormulario<number>): ConteudoDoModeloInput {
  const { documentosExigidos, gruposDeDocumentos, ...convertido } = conteudoComCodigos(
    conteudo,
    codigosDoContrato(OperadorCodigo, TipoDeCampoCodigo),
  );
  return {
    ...convertido,
    paginas: paginasParaOModelo(convertido.paginas),
    itens: itensParaOModelo(convertido.itens),
    grupos: gruposParaOModelo(convertido.grupos),
    termos: termosParaOModelo(convertido.termos),
    conjuntoDeDocumentos: conjuntoParaOModelo({ documentosExigidos, gruposDeDocumentos }),
  };
}

/** O conteúdo que o modelo devolve, na forma do editor: cada código é convertido no texto que a tela confere. */
export function conteudoDoModelo(conteudo: ModeloFormularioView['conteudo']): ConteudoDoFormulario {
  const { conjuntoDeDocumentos, ...demais } = conteudo;
  return conteudoComCodigos(
    {
      ...demais,
      documentosExigidos: conjuntoDeDocumentos.documentosExigidos.map(documentoDoModelo),
      gruposDeDocumentos: conjuntoDeDocumentos.gruposDeDocumentos.map((grupo) => ({
        ...grupo,
        documentos: grupo.documentos.map(documentoDoModelo),
      })),
    },
    CODIGOS_EM_TEXTO,
  );
}
