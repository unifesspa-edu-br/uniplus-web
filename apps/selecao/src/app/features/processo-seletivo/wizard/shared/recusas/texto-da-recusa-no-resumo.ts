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

/**
 * A gravação foi recusada e toda recusa achou o campo dela. O resumo não pode ficar vazio: lista
 * vazia é o sinal de gravação superada, que sai calada, e a recusa precisa contar como pendência.
 */
export const RECUSA_MOSTRADA_NOS_CAMPOS =
  'A gravação do cronograma foi recusada. A mensagem de cada recusa está no campo a que ela se refere.';

/** O que a recusa diz da gravação como um todo, a partir do `code` da resposta. */
export interface ExplicacaoDaRaiz {
  /** O texto próprio do `code` da resposta, quando a tela o tem. */
  readonly doCodigo: string | null;
  /** O título que a API dá à resposta, para a recusa sem causa nenhuma. */
  readonly titulo: () => string;
}

/**
 * O resumo do passo depois de uma gravação recusada. Sem nenhuma causa em `errors[]`, a recusa é
 * da raiz e o `code` dela é que se explica. Com causas, o resumo traz o texto do `code` (se há) e
 * só o que não achou campo; quando tudo achou campo, uma frase própria diz onde ver.
 */
export function resumoDaGravacaoRecusada(
  problema: ProblemDetails,
  semLugar: readonly RecusaDoCampo[],
  raiz: ExplicacaoDaRaiz,
): string[] {
  const { deCampo, gerais } = separarCausas(problema.errors);
  if (deCampo.length === 0 && gerais.length === 0) return [raiz.doCodigo ?? raiz.titulo()];
  const resumo = resumoDasRecusasSemLugar(problema, semLugar);
  const doCodigo = raiz.doCodigo === null ? [] : [raiz.doCodigo];
  return [...doCodigo, ...(resumo.length > 0 ? resumo : [RECUSA_MOSTRADA_NOS_CAMPOS])];
}
