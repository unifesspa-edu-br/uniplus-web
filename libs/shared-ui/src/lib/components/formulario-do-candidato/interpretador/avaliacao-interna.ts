import type { EstadoDoFato, Fatos, Ternario } from './logica';
import type { ValorJson } from './regras-do-formulario';
import type { OpcoesDaRestricao } from './restricoes';

export interface OcorrenciaRespondida {
  readonly id: string;
  readonly respostas: ReadonlyMap<string, ValorJson>;
}

/** As respostas já lidas e dentro da oferta, as seções concluídas e os fatos conhecidos de fora. */
export interface EntradaDaAvaliacao {
  readonly respostas: ReadonlyMap<string, ValorJson>;
  readonly grupos: ReadonlyMap<string, readonly OcorrenciaRespondida[]>;
  readonly etapasConcluidas: ReadonlySet<string>;
  readonly fatosConhecidos: Fatos;
  /** O dia do envio, `AAAA-MM-DD`; nulo quando o envio não se sabe. */
  readonly diaDoEnvio: string | null;
  /**
   * Os fatos de resposta fixa, que vêm da conta: valem como estão, sem conferência das restrições
   * (formato, tamanho), porque o candidato não tem como corrigi-los.
   */
  readonly fatosFixos?: ReadonlySet<string>;
}

export interface ItemAvaliado {
  readonly fatoCodigo: string;
  readonly etapaCodigo: string;
  readonly visivel: Ternario;
  readonly obrigatorio: Ternario;
  readonly restricoesVioladas: readonly string[];
  readonly impedido: Ternario;
  readonly opcoes: OpcoesDaRestricao | null;
}

export interface OcorrenciaAvaliadaInterna {
  readonly id: string;
  readonly itens: readonly ItemAvaliado[];
  readonly fatos: Fatos;
  readonly estado: EstadoDoFato;
}

export interface GrupoAvaliadoInterno {
  readonly codigo: string;
  readonly etapaCodigo: string;
  readonly visivel: Ternario;
  readonly obrigatorio: Ternario;
  readonly estado: EstadoDoFato;
  readonly contagemValida: boolean;
  readonly ocorrenciaDoCandidatoValida: boolean;
  readonly ocorrencias: readonly OcorrenciaAvaliadaInterna[];
}

export interface AvaliacaoInterna {
  readonly fatos: Fatos;
  readonly etapas: readonly { readonly codigo: string; readonly visivel: Ternario }[];
  readonly itens: readonly ItemAvaliado[];
  readonly grupos: readonly GrupoAvaliadoInterno[];
  readonly termos: readonly {
    readonly codigo: string;
    readonly visivel: Ternario;
    readonly obrigatorio: Ternario;
  }[];
}
