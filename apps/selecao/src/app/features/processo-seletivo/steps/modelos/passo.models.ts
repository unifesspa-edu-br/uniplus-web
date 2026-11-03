/**
 * Resultado da validação declarativa de um passo. Passos de domínio implementam
 * `validate(): StepValidation`; os de formulário clássico traduzem o estado do form para ela.
 */
export interface StepValidation {
  valid: boolean;
  /** Lista de mensagens exibida com role="alert" quando `valid === false`. */
  messages?: string[];
  /**
   * Mensagem única (forma simples). Normalizada para `messages` pela page.
   * @deprecated Prefira `messages` para coletar todos os erros de uma vez.
   */
  message?: string;
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
