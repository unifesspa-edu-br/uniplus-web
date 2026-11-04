import type { ProblemDetails } from '@uniplus/shared-core/http';

/**
 * O resumo de uma recusa do servidor: cada erro que a tela explica, com o texto dela, uma vez só; e
 * o título da raiz quando há erro que ela não explica, ou nenhum erro de campo e a raiz também sem
 * explicação. Sem erro de campo, a raiz é explicada pelo próprio `code`.
 */
export function resumoDaRecusa(
  problema: ProblemDetails,
  explicar: (erro: { readonly field: string; readonly code: string }) => string | null,
  tituloDaRaiz: () => string,
): string[] {
  const erros = problema.errors ?? [];
  const explicadas = [
    ...new Set(
      (erros.length > 0 ? erros : [{ field: '', code: problema.code }]).flatMap(
        (erro) => explicar(erro) ?? [],
      ),
    ),
  ];
  const haOutraRecusa =
    erros.length === 0 ? explicadas.length === 0 : erros.some((erro) => explicar(erro) === null);
  return [...explicadas, ...(haOutraRecusa ? [tituloDaRaiz()] : [])];
}
