import {
  OperadorCodigo,
  TipoRenderizacaoCodigo,
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
} from '@uniplus/shared-ui/components';
import {
  BlocoSistemaCodigo,
  TipoEtapaFormularioCodigo,
  TipoObrigatoriedadeCodigo,
} from '@uniplus/shared-data/selecao';
import { codigoDoContrato } from '@uniplus/shared-data/utils';
import type {
  EtapaDoFormulario,
  ExibicaoEObrigatoriedade,
  GrupoDoFormulario,
  ItemDoFormulario,
  TermoDoFormulario,
} from '@uniplus/shared-ui/components';

function regras<O>(valor: ExibicaoEObrigatoriedade<O>) {
  return {
    ...valor,
    obrigatoriedade: {
      ...valor.obrigatoriedade,
      tipo: codigoDoContrato(TipoObrigatoriedadeCodigo, valor.obrigatoriedade.tipo ?? ''),
    },
  };
}

export function etapaParaEnvio<O>(etapa: EtapaDoFormulario<O>) {
  const tipo = codigoDoContrato(TipoEtapaFormularioCodigo, etapa.tipo);
  if (tipo === null) throw new Error('Tipo de etapa do formulário desconhecido.');
  return { ...etapa, tipo, bloco: codigoDoContrato(BlocoSistemaCodigo, etapa.bloco ?? '') };
}

export function itemParaEnvio<N, O, T>(item: ItemDoFormulario<N, O, T>) {
  return { ...item, regras: { ...item.regras, ...regras(item.regras) } };
}

export function grupoParaEnvio<N, O, T>(grupo: GrupoDoFormulario<N, O, T>) {
  return { ...grupo, regras: regras(grupo.regras), subitens: grupo.subitens.map(itemParaEnvio) };
}

export function termoParaEnvio<O>(termo: TermoDoFormulario<O>) {
  return { ...termo, regras: regras(termo.regras) };
}

function semSecaoSeNecessario<T extends { readonly etapaCodigo?: string | null }>(
  item: T,
  semSecao: boolean,
): T {
  return semSecao ? { ...item, etapaCodigo: null } : item;
}

const CODIGOS_DA_SELECAO = codigosDoContrato(OperadorCodigo, TipoRenderizacaoCodigo);

/** O cabeçalho para o PUT: fase, título e etapas, sem a seção dos dados básicos, que a API repõe. */
export function cabecalhoParaEnvio(
  faseId: string,
  conteudo: ConteudoDoFormulario,
): DefinirFormularioRequest {
  return {
    faseId,
    titulo: conteudo.titulo,
    etapas: (conteudoComCodigos(semDadosBasicos(conteudo), CODIGOS_DA_SELECAO).etapas ?? []).map(
      etapaParaEnvio,
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
