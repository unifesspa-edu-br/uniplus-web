import { OperadorCodigo, TipoRenderizacaoCodigo } from '@uniplus/shared-data/configuracao';
import type {
  ConteudoDoModeloInput,
  ModeloFormularioView,
} from '@uniplus/shared-data/configuracao';
import { codigosDoContrato } from '@uniplus/shared-data/utils';
import {
  CODIGOS_EM_TEXTO,
  conteudoComCodigos,
  type ConteudoDoFormulario,
} from '@uniplus/shared-ui/components';

/** O conteúdo do editor como o modelo o grava: cada operador e cada tipo de renderização no código do contrato. */
export function conteudoParaOModelo(conteudo: ConteudoDoFormulario<number>): ConteudoDoModeloInput {
  return conteudoComCodigos(conteudo, codigosDoContrato(OperadorCodigo, TipoRenderizacaoCodigo));
}

/** O conteúdo que o modelo devolve, na forma do editor: cada código é convertido no texto que a tela confere. */
export function conteudoDoModelo(conteudo: ModeloFormularioView['conteudo']): ConteudoDoFormulario {
  return conteudoComCodigos(conteudo, CODIGOS_EM_TEXTO);
}
