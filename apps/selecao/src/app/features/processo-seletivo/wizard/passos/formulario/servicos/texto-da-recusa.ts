import type { ProblemDetails, ProblemI18nService } from '@uniplus/shared-core/http';

/**
 * A recusa em texto: o título e, quando houver, o detalhe e o que cada erro de validação diz, cada
 * frase uma só vez. A API repete no detalhe a mensagem do primeiro erro, e a frase que já foi
 * mostrada não volta; as causas diferentes aparecem todas, na ordem em que a API as enviou.
 */
export function textoDaRecusa(problem: ProblemDetails, i18n: ProblemI18nService): string {
  const { title, detail } = i18n.resolve(problem);
  const partes = [title, detail, ...(problem.errors ?? []).map((erro) => erro.message)]
    .filter((parte): parte is string => parte !== undefined)
    .map((parte) => parte.trim())
    .filter((parte) => parte !== '');
  return [...new Set(partes)].join(' ');
}
