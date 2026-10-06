/**
 * As regras de um formulário, as respostas simuladas e a avaliação, na forma em que a API as publica
 * e as devolve (ADR-0139 da API). O interpretador só conhece este vocabulário: operadores, tipos de
 * restrição, obrigatoriedades e estados. Nenhum fato e nenhuma regra específica vivem aqui.
 *
 * Os tipos espelham o contrato da API. Quem chama passa os tipos gerados do OpenAPI, e o compilador
 * acusa a divergência quando o contrato muda.
 */

/** Um valor JSON qualquer: a resposta de um campo, o valor de uma condição. */
export type ValorJson =
  | string
  | number
  | boolean
  | null
  | readonly ValorJson[]
  | { readonly [chave: string]: ValorJson };

/** Uma condição sobre um fato: `{ fato, operador, valor }`. */
export interface CondicaoDasRegras {
  readonly fato: string;
  readonly operador: string;
  readonly valor: ValorJson;
}

/**
 * Um predicado na forma normal disjuntiva: a lista externa é o OU de cláusulas, e cada cláusula é o E
 * de condições. Nulo é ausência de condição; a lista vazia é o predicado sem cláusula, que avalia falso.
 */
export type PredicadoDasRegras = readonly (readonly CondicaoDasRegras[])[] | null | undefined;

export interface OpcoesCondicionadasDasRegras {
  readonly quando?: PredicadoDasRegras;
  readonly valores?: readonly string[] | null;
}

export interface RestricaoDasRegras {
  readonly tipo: string;
  readonly minimo?: number | null;
  readonly maximo?: number | null;
  readonly entradas?: readonly OpcoesCondicionadasDasRegras[] | null;
  readonly fatos?: readonly string[] | null;
}

export interface ImpedimentoDasRegras {
  readonly quando?: PredicadoDasRegras;
  readonly mensagem?: string | null;
}

export interface ItemDasRegras {
  readonly fatoCodigo: string;
  readonly exibicao?: PredicadoDasRegras;
  readonly obrigatoriedade: string;
  readonly predicadoObrigatoriedade?: PredicadoDasRegras;
  readonly restricoes?: readonly RestricaoDasRegras[] | null;
  readonly impedimento?: ImpedimentoDasRegras | null;
  readonly oferta?: readonly string[] | null;
  readonly formato?: string | null;
}

export interface GrupoDasRegras {
  readonly codigo: string;
  readonly exibicao?: PredicadoDasRegras;
  readonly obrigatoriedade: string;
  readonly predicadoObrigatoriedade?: PredicadoDasRegras;
  readonly minimo: number;
  readonly maximo?: number | null;
  readonly incluiCandidato: boolean;
  readonly subitens?: readonly ItemDasRegras[] | null;
}

export interface EtapaDasRegras {
  readonly codigo: string;
  readonly exibicao?: PredicadoDasRegras;
  readonly itens?: readonly ItemDasRegras[] | null;
  readonly grupos?: readonly GrupoDasRegras[] | null;
}

export interface TermoDasRegras {
  readonly codigo: string;
  readonly exibicao?: PredicadoDasRegras;
  readonly obrigatoriedade: string;
  readonly predicadoObrigatoriedade?: PredicadoDasRegras;
}

export interface RegraDeDerivacaoDasRegras {
  readonly quando?: PredicadoDasRegras;
  readonly contribui?: string | null;
}

export interface DerivacaoDasRegras {
  readonly fatoCodigo: string;
  readonly booleano: boolean;
  readonly regras?: readonly RegraDeDerivacaoDasRegras[] | null;
}

export interface AgregadoDasRegras {
  readonly codigo: string;
  readonly grupoCodigo: string;
  readonly fatoDeMembro: string;
  readonly operacao: string;
}

/** As regras de um formulário, como o formulário renderizável as traz em `regras`. */
export interface RegrasDoFormulario {
  readonly etapas?: readonly EtapaDasRegras[] | null;
  readonly termos?: readonly TermoDasRegras[] | null;
  readonly derivacoes?: readonly DerivacaoDasRegras[] | null;
  readonly agregados?: readonly AgregadoDasRegras[] | null;
}

/** Uma ocorrência de grupo repetível: a identidade própria dela e as respostas, por fato. */
export interface OcorrenciaSimulada {
  readonly id: string;
  readonly respostas?: Readonly<Record<string, ValorJson>> | null;
}

/**
 * As respostas simuladas: as do formulário, por fato; as ocorrências de cada grupo; as seções dadas
 * como concluídas, pelo código delas nas regras; e os pressupostos, fatos conhecidos de fora do
 * formulário. É o corpo da avaliação sem cadastro da API, menos as regras.
 */
export interface SimulacaoDoFormulario {
  readonly respostas?: Readonly<Record<string, ValorJson>> | null;
  readonly grupos?: Readonly<Record<string, readonly OcorrenciaSimulada[] | null>> | null;
  readonly etapasConcluidas?: readonly string[] | null;
  readonly pressupostos?: Readonly<Record<string, ValorJson>> | null;
}

/** As opções que o campo de escolha permite; definitivas quando nenhuma resposta pendente pode mudá-las. */
export interface OpcoesVigentes {
  /** Opcional e anulável no contrato da API; o interpretador sempre o preenche. */
  readonly codigos?: readonly string[] | null;
  readonly definitivas: boolean;
}

export interface EtapaAvaliada {
  readonly codigo: string;
  readonly visivel: string;
}

export interface CampoAvaliado {
  readonly fatoCodigo: string;
  readonly etapaCodigo: string;
  readonly estado: string;
  readonly visivel: string;
  readonly obrigatorio: string;
  readonly restricoesVioladas: readonly string[];
  readonly impedido: string;
  readonly opcoes: OpcoesVigentes | null;
}

export interface OcorrenciaAvaliada {
  readonly id: string;
  readonly estado: string;
  readonly campos: readonly CampoAvaliado[];
}

export interface GrupoAvaliado {
  readonly codigo: string;
  readonly etapaCodigo: string;
  readonly visivel: string;
  readonly obrigatorio: string;
  readonly estado: string;
  readonly contagemValida: boolean;
  readonly ocorrenciaDoCandidatoValida: boolean;
  readonly ocorrencias: readonly OcorrenciaAvaliada[];
}

export interface TermoAvaliado {
  readonly codigo: string;
  readonly visivel: string;
  readonly obrigatorio: string;
}

/** A avaliação do formulário, na forma que a avaliação sem cadastro da API devolve. */
export interface AvaliacaoDoFormulario {
  readonly etapas: readonly EtapaAvaliada[];
  readonly campos: readonly CampoAvaliado[];
  readonly grupos: readonly GrupoAvaliado[];
  readonly termos: readonly TermoAvaliado[];
}
