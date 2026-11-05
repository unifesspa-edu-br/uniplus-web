import type { DocumentoExigidoDoFormulario } from '../../editor-de-documentos-exigidos/documentos-exigidos';
import {
  type CondicaoNoWire,
  type FatoDoCatalogo,
} from '../../editor-de-condicoes/condicoes-de-fatos';

/**
 * O conteúdo de um formulário — o do modelo, na Configuração, e o do processo, na Seleção — na
 * forma das entradas da API (ADR-0136). Os tipos são estruturais: os DTOs gerados satisfazem esta
 * forma, nos dois sentidos, sem que a biblioteca dependa deles.
 *
 * A gravação substitui o conteúdo inteiro, então o que o editor não edita viaja como veio: as
 * funções daqui copiam o item com `...item` e só trocam o que a edição muda.
 *
 * O que as funções espelham da API — a ordem global, a citação só de fato anterior, o campo que
 * precisa ser obrigatório sempre — evita oferecer o que seria recusado. A API continua a
 * autoridade: confere tudo de novo, e a recusa dela aparece no item ou no resumo.
 */

/** Um predicado em forma normal disjuntiva: as cláusulas valem por OU, as condições de cada uma por E. */
export type PredicadoNoWire = readonly (readonly CondicaoNoWire[])[] | null;

export interface OpcoesCondicionadas {
  readonly quando: PredicadoNoWire;
  readonly valores: readonly string[];
}

/**
 * O número de um campo de texto do editor: o que o administrador digitou e não é número fica como
 * texto, para o problema dizer o quê. Só existe no rascunho; `conteudoParaEnvio` o converte e recusa o
 * que não for número, então o corpo da gravação nunca leva número em texto.
 */
export type NumeroDigitado = number | string;

/**
 * Um limite da faixa de data: `DATA_FIXA` com a data `AAAA-MM-DD`, ou `ENVIO` com os anos e os dias
 * somados ao dia do envio.
 */
export interface LimiteDeDataNoWire<N = NumeroDigitado> {
  readonly ancora: string;
  readonly data?: null | string;
  readonly anos?: null | N;
  readonly dias?: null | N;
}

export interface RestricaoDeValor<N = NumeroDigitado> {
  readonly tipo: string;
  readonly minimo?: null | N;
  readonly maximo?: null | N;
  readonly entradas?: null | readonly OpcoesCondicionadas[];
  readonly fatos?: null | readonly string[];
  readonly dataMinima?: null | LimiteDeDataNoWire<N>;
  readonly dataMaxima?: null | LimiteDeDataNoWire<N>;
}

export interface Impedimento {
  readonly quando: PredicadoNoWire;
  readonly mensagem: null | string;
}

export interface ItemDoFormulario<N = NumeroDigitado> {
  readonly fatoCodigo: string;
  readonly ordem: number;
  readonly rotulo: string;
  readonly tipoRenderizacao: string;
  readonly obrigatoriedade: null | string;
  /** A exibição do item: ele só aparece quando o predicado vale. */
  readonly precondicao: PredicadoNoWire;
  readonly etapaCodigo?: null | string;
  readonly predicadoObrigatoriedade?: PredicadoNoWire;
  readonly ajuda?: null | string;
  readonly pedirConfirmacao: boolean;
  readonly restricoes?: null | readonly RestricaoDeValor<N>[];
  readonly impedimento?: null | Impedimento;
}

export interface EtapaDoFormulario {
  readonly codigo: string;
  readonly ordem: number;
  readonly tipo: string;
  readonly bloco: null | string;
  readonly titulo: string;
  readonly descricao: null | string;
  readonly aviso: null | string;
  readonly exibicao?: PredicadoNoWire;
}

export interface GrupoDoFormulario<N = NumeroDigitado> {
  readonly codigo: string;
  readonly ordem: number;
  readonly rotulo: string;
  readonly etapaCodigo: null | string;
  readonly minimo: N;
  readonly maximo: null | N;
  readonly exibicao: PredicadoNoWire;
  readonly obrigatoriedade: null | string;
  readonly predicadoObrigatoriedade: PredicadoNoWire;
  readonly subitens: readonly ItemDoFormulario<N>[];
  readonly incluiCandidato: boolean;
}

export interface TermoDoFormulario {
  readonly codigo: string;
  readonly ordem: number;
  readonly termoId: string;
  readonly versaoId: string;
  readonly exibicao: PredicadoNoWire;
  readonly obrigatoriedade: string;
  readonly predicadoObrigatoriedade: PredicadoNoWire;
}

export interface ConteudoDoFormulario<N = NumeroDigitado> {
  readonly titulo: null | string;
  readonly etapas: null | readonly EtapaDoFormulario[];
  readonly itens: null | readonly ItemDoFormulario<N>[];
  readonly termos: null | readonly TermoDoFormulario[];
  readonly pressupostos: null | readonly string[];
  readonly grupos?: null | readonly GrupoDoFormulario<N>[];
  /** O conjunto padrão de documentos exigidos; o PUT substitui o conteúdo inteiro, então ele viaja a cada gravação. */
  readonly documentosExigidos?: null | readonly DocumentoExigidoDoFormulario[];
}

/** O que o editor precisa saber de um fato do catálogo para oferecê-lo como campo. */
export interface FatoDoFormulario extends FatoDoCatalogo {
  readonly cardinalidade: string;
  readonly fonteValores: null | string;
  readonly escopo: string;
  readonly ativo: boolean;
}

/** Um termo de consentimento que o formulário pode exigir, com as versões promovidas — a mais nova primeiro. */
export interface TermoDisponivel {
  readonly termoId: string;
  readonly nome: string;
  readonly versoes: readonly { readonly versaoId: string; readonly rotulo: string }[];
}

/** O desfecho de uma edição que a tela pode recusar: o conteúdo novo, ou o motivo da recusa. */
export type ResultadoDaEdicao =
  | { readonly ok: true; readonly conteudo: ConteudoDoFormulario }
  | { readonly ok: false; readonly recusa: string };

export interface OpcaoDoFormulario {
  readonly valor: string;
  readonly rotulo: string;
}

/** Do candidato, ou de cada membro de um grupo repetível: o de membro só existe dentro do grupo. */
export type EscopoDoCampo = 'CANDIDATO' | 'MEMBRO_GRUPO';
export const ESCOPO_CANDIDATO: EscopoDoCampo = 'CANDIDATO';
export const ESCOPO_MEMBRO: EscopoDoCampo = 'MEMBRO_GRUPO';
export const FONTE_GEO_MUNICIPIO = 'GEO_MUNICIPIO';
export const FONTE_GEO_UF = 'GEO_UF';
export const MULTIVALORADO = 'MULTIVALORADO';

/** Um item ou um grupo de uma seção, na posição que ocupa nela. */
export type EntradaDaSecao =
  | { readonly tipo: 'item'; readonly item: ItemDoFormulario }
  | { readonly tipo: 'grupo'; readonly grupo: GrupoDoFormulario };

/** Um item ou um grupo, pelo que o identifica no formulário. */
export type ChaveDaEntrada =
  | { readonly tipo: 'item'; readonly fatoCodigo: string }
  | { readonly tipo: 'grupo'; readonly codigo: string };

/** O desfecho de uma edição de grupo que a tela pode recusar. */
export type ResultadoDoGrupo =
  | { readonly ok: true; readonly grupo: GrupoDoFormulario }
  | { readonly ok: false; readonly recusa: string };
