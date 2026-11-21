import { paginaDoErro, separarCausas, type ProblemDetails } from '@uniplus/shared-core/http';
import type { RecusaDoCampo } from '@uniplus/shared-ui/components';

/**
 * A recusa como o resumo do passo a diz: a mensagem da API, o código e, quando existe, a página
 * que a explica. O resumo é uma lista de textos, então a página vai por extenso.
 */
export function textoDaRecusaNoResumo(recusa: RecusaDoCampo): string {
  const pagina = recusa.pagina === null ? '' : `; entenda a recusa em ${recusa.pagina}`;
  return `${recusa.mensagem} (código ${recusa.codigo}${pagina})`;
}

/**
 * O resumo do passo depois de uma resposta recusada: só o que a tela não pôde pôr num campo, que
 * são as recusas sem lugar e as causas gerais, cada uma com mensagem, código e página, uma vez só.
 * Vazio quando todas as causas acharam o campo delas: o aviso do resumo não repete o que o campo
 * já diz.
 */
export function resumoDasRecusasSemLugar(
  problema: ProblemDetails,
  semLugar: readonly RecusaDoCampo[],
): string[] {
  const gerais = separarCausas(problema.errors).gerais.map((causa) => ({
    codigo: causa.code,
    mensagem: causa.message,
    pagina: paginaDoErro(problema, causa.code),
  }));
  return [...new Set([...semLugar, ...gerais].map(textoDaRecusaNoResumo))];
}
