import type { ProblemDetails, ProblemI18nService } from '@uniplus/shared-core/http';

/** A recusa em texto: o título e, quando houver, o detalhe e o que cada erro de validação diz. */
export function textoDaRecusa(problem: ProblemDetails, i18n: ProblemI18nService): string {
  const { title, detail } = i18n.resolve(problem);
  return [title, detail, ...(problem.errors ?? []).map((erro) => erro.message)]
    .filter((parte): parte is string => parte !== undefined && parte !== '')
    .join(' ');
}
