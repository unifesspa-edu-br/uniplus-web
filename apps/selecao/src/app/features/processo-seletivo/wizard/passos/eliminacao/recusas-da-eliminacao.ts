import { NOME_DO_PASSO_DA_FORMULA } from '../../processo-seletivo.data';
import { itemDeEliminacaoDoCampo } from '../classificacao/recusas-do-catalogo';
import { PREFIXO_DA_RECUSA } from '../classificacao/recusas-da-classificacao';

/**
 * O que a tela diz para cada recusa das regras de eliminação. O servidor aponta a regra pelo campo
 * `regrasEliminacao[i]`, e a tela a nomeia pela posição, como na própria validação.
 */
const RECUSA_DA_ELIMINACAO: ReadonlyMap<string, string> = new Map([
  [
    `${PREFIXO_DA_RECUSA}corte_em_area_repetido`,
    'a área já tem um corte em outra regra; deixe um corte por área',
  ],
  [
    `${PREFIXO_DA_RECUSA}corte_em_area_fora_do_quadro`,
    `a área não está em todos os grupos da resolução de Peso por Área; escolha outra área ou outra resolução no passo ${NOME_DO_PASSO_DA_FORMULA}`,
  ],
  [
    `${PREFIXO_DA_RECUSA}falta_em_dia_de_prova_enem_repetida`,
    'a falta em dia de prova do ENEM já foi declarada em outra regra; deixe uma só',
  ],
  [
    `${PREFIXO_DA_RECUSA}ausencia_na_etapa_repetida`,
    'a ausência nesta etapa já foi declarada em outra regra; deixe uma só',
  ],
  [
    'uniplus.selecao.processo_seletivo.ausencia_na_etapa_do_enem',
    'a ausência não se aplica à etapa de nota do ENEM; escolha outra etapa',
  ],
  [
    'uniplus.selecao.regra_eliminacao.area_invalida',
    'a área do corte não é uma área do ENEM válida; escolha a área na lista',
  ],
  [
    'uniplus.selecao.processo_seletivo.eliminacao_enem_fora_de_processo_enem',
    `as regras de eliminação do ENEM só se aplicam à classificação baseada em ENEM; marque o ENEM no passo ${NOME_DO_PASSO_DA_FORMULA} ou retire essas regras`,
  ],
]);

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
  erros: readonly { readonly field: string; readonly code: string }[],
): ReadonlyMap<string, string> {
  const recusas = new Map<string, string>();
  for (const erro of erros) {
    const item = itemDeEliminacaoDoCampo(erro.field);
    const indice = item?.posicao;
    const campo =
      item?.nome === undefined ? CAMPO_DA_RECUSA_SEM_SUFIXO[erro.code] : CAMPO_DA_REGRA[item.nome];
    const texto = RECUSA_DA_ELIMINACAO.get(erro.code);
    if (indice === undefined || campo === undefined || texto === undefined) continue;
    recusas.set(`${indice}.${campo}`, `${texto.charAt(0).toUpperCase()}${texto.slice(1)}.`);
  }
  return recusas;
}

/**
 * O texto da recusa de uma regra de eliminação no resumo: o da tela, quando ela orienta com o nome
 * do passo; senão a mensagem que a API deu, com a posição da regra. Fora de uma regra, sem texto da
 * tela, `null`.
 */
export function recusaDaEliminacao(erro: {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}): string | null {
  const indice = itemDeEliminacaoDoCampo(erro.field)?.posicao;
  const texto = RECUSA_DA_ELIMINACAO.get(erro.code);
  if (texto === undefined) {
    return indice === undefined ? null : `${REGRA} ${indice + 1}: ${erro.message}`;
  }
  return indice === undefined
    ? `${texto.charAt(0).toUpperCase()}${texto.slice(1)}.`
    : `${REGRA} ${indice + 1}: ${texto}.`;
}
