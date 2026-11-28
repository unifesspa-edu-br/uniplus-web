import { itemDeEliminacaoDoCampo } from '../classificacao/recusas-do-catalogo';
import { mensagemDaApiOu, PREFIXO_DA_RECUSA } from '../classificacao/recusas-da-classificacao';

/**
 * As recusas das regras de eliminação que a tela mostra junto da regra, pelo código. O servidor
 * aponta a regra pelo campo `regrasEliminacao[i]`, e a tela a nomeia pela posição, como na própria
 * validação. O texto é sempre o que o servidor deu.
 */
const CODIGOS_DA_RECUSA_DA_ELIMINACAO: ReadonlySet<string> = new Set([
  `${PREFIXO_DA_RECUSA}corte_em_area_repetido`,
  `${PREFIXO_DA_RECUSA}corte_em_area_fora_do_quadro`,
  `${PREFIXO_DA_RECUSA}falta_em_dia_de_prova_enem_repetida`,
  `${PREFIXO_DA_RECUSA}ausencia_na_etapa_repetida`,
  'uniplus.selecao.processo_seletivo.ausencia_na_etapa_do_enem',
  'uniplus.selecao.regra_eliminacao.area_invalida',
  'uniplus.selecao.processo_seletivo.eliminacao_enem_fora_de_processo_enem',
]);

const TEXTO_GENERICO_DA_RECUSA =
  'O servidor recusou a regra de eliminação. Confira os campos da regra.';

const REGRA = 'Regra de eliminação';

export type CampoDaRegra = 'etapa' | 'area' | 'minimo';

/** Pelo nome em minúsculas, como `itemDeEliminacaoDoCampo` o devolve. */
const CAMPO_DA_REGRA: Readonly<Record<string, CampoDaRegra>> = {
  etaparef: 'etapa',
  areacodigo: 'area',
  minimo: 'minimo',
};

/**
 * O campo de cada recusa que o servidor aponta só pela regra, sem sufixo: a repetição da área e a
 * da etapa são recusadas em `regrasEliminacao[i]`, e é o campo delas que as corrige.
 */
const CAMPO_DA_RECUSA_SEM_SUFIXO: Readonly<Record<string, CampoDaRegra>> = {
  [`${PREFIXO_DA_RECUSA}corte_em_area_repetido`]: 'area',
  [`${PREFIXO_DA_RECUSA}ausencia_na_etapa_repetida`]: 'etapa',
};

/** As recusas que o servidor aponta num campo de uma regra, por `índice.campo`. */
export function recusasDoCorte(
  erros: readonly { readonly field: string; readonly code: string; readonly message: string }[],
): ReadonlyMap<string, string> {
  const recusas = new Map<string, string>();
  for (const erro of erros) {
    const item = itemDeEliminacaoDoCampo(erro.field);
    const indice = item?.posicao;
    const campo =
      item?.nome === undefined ? CAMPO_DA_RECUSA_SEM_SUFIXO[erro.code] : CAMPO_DA_REGRA[item.nome];
    if (indice === undefined || campo === undefined) continue;
    if (!CODIGOS_DA_RECUSA_DA_ELIMINACAO.has(erro.code)) continue;
    recusas.set(`${indice}.${campo}`, mensagemDaApiOu(erro, TEXTO_GENERICO_DA_RECUSA));
  }
  return recusas;
}

/**
 * O texto da recusa de uma regra de eliminação no resumo: a mensagem que a API deu, com a posição
 * da regra quando o campo a aponta. Fora de uma regra e de um código de eliminação, `null`.
 */
export function recusaDaEliminacao(erro: {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}): string | null {
  const indice = itemDeEliminacaoDoCampo(erro.field)?.posicao;
  if (indice === undefined && !CODIGOS_DA_RECUSA_DA_ELIMINACAO.has(erro.code)) return null;
  const mensagem = mensagemDaApiOu(erro, TEXTO_GENERICO_DA_RECUSA);
  return indice === undefined ? mensagem : `${REGRA} ${indice + 1}: ${mensagem}`;
}
