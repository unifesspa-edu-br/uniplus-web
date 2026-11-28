import type { ReferenciaAoSuporte } from '@uniplus/shared-core/http';

/**
 * Resultado da validação declarativa de um passo. Passos de domínio implementam
 * `validar(): ValidacaoDoPasso`; os de formulário clássico traduzem o estado do form para ela.
 */
export interface ValidacaoDoPasso {
  valid: boolean;
  /** Lista de mensagens exibida com role="alert" quando `valid === false`. */
  messages?: string[];
  /**
   * Mensagem única (forma simples). Normalizada para `messages` pela page.
   * @deprecated Prefira `messages` para coletar todos os erros de uma vez.
   */
  message?: string;
  /** O que a pessoa informa ao suporte quando a recusa veio do servidor; ausente na validação local. */
  referenciaAoSuporte?: ReferenciaAoSuporte;
}

/**
 * O que o resumo de erro do passo mostra: as mensagens e, para cada passo cuja recusa veio do
 * servidor, a referência que a pessoa leva ao suporte.
 */
export interface ErroDoPasso {
  readonly mensagens: readonly string[];
  readonly referencias: readonly ReferenciaDoPasso[];
}

export interface ReferenciaDoPasso {
  /** Como a tela nomeia o passo, por exemplo "Passo 4 — Vagas". */
  readonly passo: string;
  readonly referencia: ReferenciaAoSuporte;
}

export interface TipoProcessoOption {
  value: string;
  /** O código do tipo no catálogo — o que os modelos de formulário citam. */
  codigo: string;
  name: string;
  description: string;
  tags: string[];
  legal?: string;
}

/**
 * Por que a leitura por URL não entregou um processo. `naoEncontrado` e `idInvalido` não têm
 * retentativa útil, porque o endereço é que está errado; `semPermissao` e `falhaTemporaria` têm.
 */
export type MotivoFalhaDeLeitura =
  | 'idInvalido'
  | 'naoEncontrado'
  | 'semPermissao'
  | 'falhaTemporaria';

export interface FalhaDeLeitura {
  readonly motivo: MotivoFalhaDeLeitura;
  /** Texto já resolvido para exibição — vem do `ProblemDetails` quando há um. */
  readonly mensagem: string;
}
