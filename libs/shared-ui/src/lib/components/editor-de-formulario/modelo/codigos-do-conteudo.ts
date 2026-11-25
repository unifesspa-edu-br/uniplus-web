import { converterLista } from '@uniplus/shared-utils';
import { predicadoComOperadores } from '../../editor-de-condicoes/condicoes/condicoes-no-wire';
import type {
  DocumentoExigidoDoFormulario,
  GrupoDeDocumentosDoFormulario,
} from '../../editor-de-documentos-exigidos/documentos-exigidos';
import type {
  ConteudoDoFormulario,
  PaginaDoFormulario,
  ExibicaoEObrigatoriedade,
  GrupoDoFormulario,
  Impedimento,
  ItemDoFormulario,
  OpcoesCondicionadas,
  RegrasDoCampo,
  RestricaoDeValor,
  TermoDoFormulario,
} from './tipos';

/**
 * Como trocar os dois códigos que o conteúdo do formulário carrega — o operador de cada condição e
 * o tipo de renderização de cada item — de uma representação para outra: texto na tela, enum
 * gerado no contrato da API.
 */
export interface TrocaDeCodigos<O1, T1, O2, T2> {
  readonly operador: (codigo: O1) => O2;
  readonly tipoDeCampo: (codigo: T1) => T2;
}

/**
 * Do contrato para a tela: o código que o contrato não informa fica como texto vazio. A tela confere esse
 * texto, e a API continua a autoridade sobre o que é aceito.
 */
export const CODIGOS_EM_TEXTO: TrocaDeCodigos<string | null, string | null, string, string> = {
  operador: (codigo) => codigo ?? '',
  tipoDeCampo: (codigo) => codigo ?? '',
};

function opcoesComCodigos<O1, T1, O2, T2>(
  opcoes: OpcoesCondicionadas<O1>,
  troca: TrocaDeCodigos<O1, T1, O2, T2>,
): OpcoesCondicionadas<O2> {
  return { ...opcoes, quando: predicadoComOperadores(opcoes.quando, troca.operador) };
}

function restricaoComCodigos<N, O1, T1, O2, T2>(
  restricao: RestricaoDeValor<N, O1>,
  troca: TrocaDeCodigos<O1, T1, O2, T2>,
): RestricaoDeValor<N, O2> {
  return {
    ...restricao,
    entradas: converterLista(restricao.entradas, (entrada) => opcoesComCodigos(entrada, troca)),
  };
}

function impedimentoComCodigos<O1, T1, O2, T2>(
  impedimento: Impedimento<O1> | null | undefined,
  troca: TrocaDeCodigos<O1, T1, O2, T2>,
): Impedimento<O2> | null | undefined {
  if (!impedimento) return impedimento;
  return { ...impedimento, quando: predicadoComOperadores(impedimento.quando, troca.operador) };
}

function regrasComCodigos<O1, T1, O2, T2>(
  regras: ExibicaoEObrigatoriedade<O1>,
  troca: TrocaDeCodigos<O1, T1, O2, T2>,
): ExibicaoEObrigatoriedade<O2> {
  return {
    ...regras,
    exibicao: predicadoComOperadores(regras.exibicao, troca.operador),
    obrigatoriedade: {
      ...regras.obrigatoriedade,
      predicado: predicadoComOperadores(regras.obrigatoriedade.predicado, troca.operador),
    },
  };
}

function regrasDoCampoComCodigos<N, O1, T1, O2, T2>(
  regras: RegrasDoCampo<N, O1>,
  troca: TrocaDeCodigos<O1, T1, O2, T2>,
): RegrasDoCampo<N, O2> {
  return {
    ...regrasComCodigos(regras, troca),
    restricoes: converterLista(regras.restricoes, (restricao) =>
      restricaoComCodigos(restricao, troca),
    ),
    impedimento: impedimentoComCodigos(regras.impedimento, troca),
  };
}

function itemComCodigos<N, O1, T1, O2, T2>(
  item: ItemDoFormulario<N, O1, T1>,
  troca: TrocaDeCodigos<O1, T1, O2, T2>,
): ItemDoFormulario<N, O2, T2> {
  return {
    ...item,
    apresentacao: {
      ...item.apresentacao,
      tipoDeCampo: troca.tipoDeCampo(item.apresentacao.tipoDeCampo),
    },
    regras: regrasDoCampoComCodigos(item.regras, troca),
  };
}

function grupoComCodigos<N, O1, T1, O2, T2>(
  grupo: GrupoDoFormulario<N, O1, T1>,
  troca: TrocaDeCodigos<O1, T1, O2, T2>,
): GrupoDoFormulario<N, O2, T2> {
  return {
    ...grupo,
    regras: regrasComCodigos(grupo.regras, troca),
    subitens: converterLista(grupo.subitens, (subitem) => itemComCodigos(subitem, troca)),
  };
}

function termoComCodigos<O1, T1, O2, T2>(
  termo: TermoDoFormulario<O1>,
  troca: TrocaDeCodigos<O1, T1, O2, T2>,
): TermoDoFormulario<O2> {
  return { ...termo, regras: regrasComCodigos(termo.regras, troca) };
}

function paginaComCodigos<O1, T1, O2, T2>(
  pagina: PaginaDoFormulario<O1>,
  troca: TrocaDeCodigos<O1, T1, O2, T2>,
): PaginaDoFormulario<O2> {
  return { ...pagina, exibicao: predicadoComOperadores(pagina.exibicao, troca.operador) };
}

function documentoComCodigos<O1, T1, O2, T2>(
  documento: DocumentoExigidoDoFormulario<O1>,
  troca: TrocaDeCodigos<O1, T1, O2, T2>,
): DocumentoExigidoDoFormulario<O2> {
  return { ...documento, quando: predicadoComOperadores(documento.quando, troca.operador) };
}

function grupoDeDocumentosComCodigos<O1, T1, O2, T2>(
  grupo: GrupoDeDocumentosDoFormulario<O1>,
  troca: TrocaDeCodigos<O1, T1, O2, T2>,
): GrupoDeDocumentosDoFormulario<O2> {
  return {
    ...grupo,
    documentos: grupo.documentos.map((documento) => documentoComCodigos(documento, troca)),
  };
}

interface DocumentosDoConteudo<N, O, T> {
  readonly documentosExigidos: ConteudoDoFormulario<N, O, T>['documentosExigidos'];
  readonly gruposDeDocumentos: ConteudoDoFormulario<N, O, T>['gruposDeDocumentos'];
}

function documentosDoConteudoComCodigos<N, O1, T1, O2, T2>(
  conteudo: ConteudoDoFormulario<N, O1, T1>,
  troca: TrocaDeCodigos<O1, T1, O2, T2>,
): DocumentosDoConteudo<N, O2, T2> {
  return {
    documentosExigidos: converterLista(conteudo.documentosExigidos, (documento) =>
      documentoComCodigos(documento, troca),
    ),
    gruposDeDocumentos: converterLista(conteudo.gruposDeDocumentos, (grupo) =>
      grupoDeDocumentosComCodigos(grupo, troca),
    ),
  };
}

/**
 * O conteúdo do formulário com cada operador e cada tipo de renderização trocados, em páginas, itens,
 * grupos e seus subitens, termos, restrições, impedimentos e documentos exigidos. O que o conteúdo
 * não codifica segue como veio, e as listas opcionais ausentes (`null` ou `undefined`) continuam
 * ausentes.
 */
export function conteudoComCodigos<N, O1, T1, O2, T2>(
  conteudo: ConteudoDoFormulario<N, O1, T1>,
  troca: TrocaDeCodigos<O1, T1, O2, T2>,
): ConteudoDoFormulario<N, O2, T2> {
  return {
    ...conteudo,
    paginas: converterLista(conteudo.paginas, (pagina) => paginaComCodigos(pagina, troca)),
    itens: converterLista(conteudo.itens, (item) => itemComCodigos(item, troca)),
    grupos: converterLista(conteudo.grupos, (grupo) => grupoComCodigos(grupo, troca)),
    termos: converterLista(conteudo.termos, (termo) => termoComCodigos(termo, troca)),
    ...documentosDoConteudoComCodigos(conteudo, troca),
  };
}
