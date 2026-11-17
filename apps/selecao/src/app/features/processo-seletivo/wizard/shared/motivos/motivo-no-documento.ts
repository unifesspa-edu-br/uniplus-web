/**
 * A fase ou a etapa do documento a que o motivo pertence, pela chave: exatamente uma das duas.
 * A chave da fase e a da etapa são de tipos diferentes e nunca se confundem.
 */
export type FaseOuEtapaDoMotivo =
  | { readonly faseChave: string; readonly etapaChave?: never }
  | { readonly etapaChave: string; readonly faseChave?: never };

/** O que distingue um motivo no documento: a fase ou etapa, o tipo de decisão e o código. */
export type IdentidadeDoMotivo = FaseOuEtapaDoMotivo & {
  readonly tipoCodigo: string;
  readonly codigo: string;
};

/**
 * Um motivo escolhido por uma fase ou etapa, como o documento o guarda. Os descritivos, a
 * justificativa e a versão de entrada são só de leitura: a referência é a identidade.
 */
export type MotivoNoDocumento = IdentidadeDoMotivo & {
  readonly descricao?: string;
  readonly subclassificacao?: string;
  readonly sentido?: string;
  readonly justificativaDaInclusao?: string;
  readonly versaoDoEditalDeEntrada?: number;
};

export function daMesmaFaseOuEtapa(uma: FaseOuEtapaDoMotivo, outra: FaseOuEtapaDoMotivo): boolean {
  return uma.faseChave === undefined
    ? uma.etapaChave === outra.etapaChave
    : uma.faseChave === outra.faseChave;
}

export function ehOMesmoMotivo(um: IdentidadeDoMotivo, outro: IdentidadeDoMotivo): boolean {
  return (
    daMesmaFaseOuEtapa(um, outro) &&
    um.tipoCodigo === outro.tipoCodigo &&
    um.codigo === outro.codigo
  );
}
