import type { Predicado } from './predicado';
import type { Restricao } from './restricoes';

/** A obrigatoriedade: sempre, nunca, ou quando o predicado é verdadeiro. */
export type Obrigatoriedade =
  | { readonly tipo: 'SEMPRE' | 'NUNCA'; readonly predicado: null }
  | { readonly tipo: 'QUANDO'; readonly predicado: Predicado };

export interface DefinicaoItem {
  readonly fatoCodigo: string;
  readonly exibicao: Predicado | null;
  readonly obrigatoriedade: Obrigatoriedade;
  /** As restrições declaradas e, no campo de texto com formato, a do formato. */
  readonly restricoesDaResposta: readonly Restricao[];
  readonly impedimento: Predicado | null;
  /** Os fatos de que o campo depende; a condição do impedimento sobre o próprio campo não conta. */
  readonly fatosCitados: readonly string[];
}

export interface DefinicaoGrupo {
  readonly codigo: string;
  readonly exibicao: Predicado | null;
  readonly obrigatoriedade: Obrigatoriedade;
  readonly minimo: number;
  readonly maximo: number | null;
  readonly incluiCandidato: boolean;
  readonly subitens: readonly DefinicaoItem[];
  /** Os fatos fora da ocorrência de que o grupo depende. */
  readonly fatosDoCandidatoCitados: readonly string[];
}

export interface DefinicaoEtapa {
  readonly codigo: string;
  readonly exibicao: Predicado | null;
  readonly itens: readonly DefinicaoItem[];
  readonly grupos: readonly DefinicaoGrupo[];
}

export interface DefinicaoTermo {
  readonly codigo: string;
  readonly exibicao: Predicado | null;
  readonly obrigatoriedade: Obrigatoriedade;
}

/** As regras de um fato derivado: booleano (alguma regra ativa) ou a união do que as ativas contribuem. */
export interface DefinicaoDerivacao {
  readonly fatoCodigo: string;
  readonly booleano: boolean;
  /** A regra sem cláusula é a âncora, sempre ativa. */
  readonly regras: readonly { readonly quando: Predicado; readonly contribui: string | null }[];
  readonly dependencias: readonly string[];
}

export interface DefinicaoAgregado {
  readonly codigo: string;
  readonly grupoCodigo: string;
  readonly fatoDeMembro: string;
  readonly operacao: 'EXISTE' | 'VALORES_PRESENTES';
}

export interface DefinicaoFormulario {
  readonly etapas: readonly DefinicaoEtapa[];
  readonly termos: readonly DefinicaoTermo[];
  readonly derivacoes: readonly DefinicaoDerivacao[];
  readonly agregados: readonly DefinicaoAgregado[];
  /** A oferta de valores de cada campo que tem uma: a resposta fora dela não vale. */
  readonly ofertas: ReadonlyMap<string, ReadonlySet<string>>;
}

/** Regras que não formam um formulário: o caminho do problema nas regras e a causa. */
export interface RegrasInvalidas {
  readonly caminho: string;
  readonly mensagem: string;
}

export type LeituraDasRegras =
  | { readonly valida: true; readonly definicao: DefinicaoFormulario }
  | { readonly valida: false; readonly erro: RegrasInvalidas };
