import {
  OperadorCodigo,
  TipoDeCampoCodigo,
  TipoRestricaoValorCodigo,
  type DefinirFormularioRequest,
  type DefinirItensDoFormularioRequest,
  type DefinirTermosDoFormularioRequest,
} from '@uniplus/shared-data/selecao';
import { codigosDoContrato } from '@uniplus/shared-data/utils';
import {
  conteudoComCodigos,
  conteudoParaEnvio,
  semDadosBasicos,
  type ConteudoDoFormulario,
} from '@uniplus/shared-inscricao/formulario';
import {
  BlocoSistemaCodigo,
  TipoPaginaFormularioCodigo,
  TipoObrigatoriedadeCodigo,
} from '@uniplus/shared-data/selecao';
import { codigoDoContrato, codigoExigidoDoContrato } from '@uniplus/shared-data/utils';
import type {
  PaginaDoFormulario,
  ExibicaoEObrigatoriedade,
  GrupoDoFormulario,
  ItemDoFormulario,
  TermoDoFormulario,
} from '@uniplus/shared-inscricao/formulario';

function regras<O>(valor: ExibicaoEObrigatoriedade<O>) {
  return {
    ...valor,
    obrigatoriedade: {
      ...valor.obrigatoriedade,
      tipo: codigoDoContrato(TipoObrigatoriedadeCodigo, valor.obrigatoriedade.tipo ?? ''),
    },
  };
}

export function paginaParaEnvio<O>(pagina: PaginaDoFormulario<O>) {
  const tipo = codigoExigidoDoContrato(TipoPaginaFormularioCodigo, pagina.tipo, 'tipo de página');
  return { ...pagina, tipo, bloco: codigoDoContrato(BlocoSistemaCodigo, pagina.bloco ?? '') };
}

function restricoesParaEnvio<N, O>(restricoes: ItemDoFormulario<N, O>['regras']['restricoes']) {
  return restricoes == null
    ? restricoes
    : restricoes.map((restricao) => ({
        ...restricao,
        tipo: codigoExigidoDoContrato(
          TipoRestricaoValorCodigo,
          restricao.tipo,
          'tipo de restrição',
        ),
      }));
}

export function itemParaEnvio<N, O, T>(item: ItemDoFormulario<N, O, T>) {
  return {
    ...item,
    regras: {
      ...item.regras,
      ...regras(item.regras),
      restricoes: restricoesParaEnvio(item.regras.restricoes),
    },
  };
}

export function grupoParaEnvio<N, O, T>(grupo: GrupoDoFormulario<N, O, T>) {
  return { ...grupo, regras: regras(grupo.regras), subitens: grupo.subitens.map(itemParaEnvio) };
}

export function termoParaEnvio<O>(termo: TermoDoFormulario<O>) {
  return { ...termo, regras: regras(termo.regras) };
}

function semSecaoSeNecessario<T extends { readonly paginaCodigo?: string | null }>(
  item: T,
  semSecao: boolean,
): T {
  return semSecao ? { ...item, paginaCodigo: null } : item;
}

const CODIGOS_DA_SELECAO = codigosDoContrato(OperadorCodigo, TipoDeCampoCodigo);

/** O cabeçalho para o PUT: fase, título e páginas, sem a seção dos dados básicos, que a API repõe. */
export function cabecalhoParaEnvio(
  faseId: string,
  conteudo: ConteudoDoFormulario,
): DefinirFormularioRequest {
  return {
    faseId,
    titulo: conteudo.titulo,
    paginas: (conteudoComCodigos(semDadosBasicos(conteudo), CODIGOS_DA_SELECAO).paginas ?? []).map(
      paginaParaEnvio,
    ),
  };
}

/**
 * Os itens e os grupos para o PUT, sem os dados básicos. `semSecao` tira a seção de todos — o
 * rascunho aceita item sem seção —, para gravar os itens antes de um cabeçalho que muda as seções.
 * `grupos` vai sempre como lista: nulo manteria os grupos gravados. Nulo quando algum limite digitado
 * não é número: a API recusa número em texto, então o corpo não se monta.
 */
export function itensParaEnvio(
  conteudo: ConteudoDoFormulario,
  semSecao = false,
): DefinirItensDoFormularioRequest | null {
  const enviado = conteudoParaEnvio(semDadosBasicos(conteudo));
  if (enviado === null) return null;
  const { itens, grupos } = conteudoComCodigos(enviado, CODIGOS_DA_SELECAO);
  return {
    itens: (itens ?? []).map((item) => semSecaoSeNecessario(itemParaEnvio(item), semSecao)),
    grupos: (grupos ?? []).map((grupo) => semSecaoSeNecessario(grupoParaEnvio(grupo), semSecao)),
  };
}

export function termosParaEnvio(conteudo: ConteudoDoFormulario): DefinirTermosDoFormularioRequest {
  return {
    termos: (conteudoComCodigos(conteudo, CODIGOS_DA_SELECAO).termos ?? []).map(termoParaEnvio),
  };
}
