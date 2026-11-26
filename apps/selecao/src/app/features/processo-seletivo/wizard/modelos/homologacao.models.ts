import type { CondicaoEmClausula } from '@uniplus/shared-inscricao/formulario';

/**
 * Uma condição que a inscrição precisa cumprir para ser homologada. O `tipo` viaja como o código
 * do contrato, sem estreitar: um tipo que o servidor acrescente continua na regra, e é o servidor
 * que o recusa se não o apura.
 *
 * A edição do exame só vale em condição que lê o retorno de um exame e fica `null` até a pessoa a
 * digitar; o enquadramento é opcional e vazio quando a condição vale para toda inscrição.
 */
export interface CondicaoDeHomologacao {
  readonly tipo: string;
  readonly edicaoDoExame: number | null;
  /** Código do motivo desfavorável que a fase escolheu; `null` enquanto não apontado. */
  readonly motivoDesfavoravelCodigo: string | null;
  readonly enquadramento: readonly CondicaoEmClausula[];
}

/** Condições que valem juntas (E). */
export interface AlternativaDeHomologacao {
  readonly condicoes: readonly CondicaoDeHomologacao[];
}

/**
 * Como a fase decide a homologação das inscrições: o resultado que publica a lista e as
 * alternativas (OU) de condições. A **presença** da regra é o que declara a capacidade; sem
 * alternativa, a fase homologa toda inscrição enviada. O cronograma é gravado por substituição, e
 * por isso a regra atravessa toda gravação como foi lida.
 */
export interface RegraDeHomologacao {
  /** Código do tipo de ato, entre os produtos da própria fase; `null` enquanto não apontado. */
  readonly resultadoAtoCodigo: string | null;
  readonly alternativas: readonly AlternativaDeHomologacao[];
}
