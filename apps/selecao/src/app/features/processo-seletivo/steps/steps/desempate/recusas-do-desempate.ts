import type { CriterioDesempateConfigurado } from '../../processo-seletivo.models';
import { ehCampoDaResolucao } from '../classificacao/classificacao-para-comando';

const CRITERIO_GRAVADO_SEM_QUADRO =
  'compara a nota de área do ENEM, que só existe com a classificação baseada no ENEM pela média ponderada. Troque a regra do critério ou remova-o no passo Desempate e grave o passo, ou marque o ENEM e a média ponderada no passo Fórmula.';

/**
 * A recusa por um critério de desempate gravado que compara a nota de área do ENEM, com a
 * classificação fora do ENEM pela média ponderada — pela posição do critério, quando se sabe.
 */
export function recusaPorCriterioGravadoSemQuadro(posicao: number | null): string {
  return posicao === null
    ? `Um critério de desempate gravado ${CRITERIO_GRAVADO_SEM_QUADRO}`
    : `Critério de desempate ${posicao} gravado: ${CRITERIO_GRAVADO_SEM_QUADRO}`;
}

/**
 * O que a tela diz de uma área recusada num critério, depois de "Critério de desempate N: ". Sem o
 * rótulo — a recusa do servidor que não aponta a área —, a frase fala de uma das áreas.
 */
export const RECUSA_DA_AREA = {
  foraDoQuadro: (rotulo: string | null) =>
    `${aArea(rotulo)} não é comum a todos os grupos da resolução de Peso por Área`,
  repetida: (rotulo: string | null) =>
    `${aArea(rotulo)} aparece mais de uma vez na ordem de desempate`,
  citadaPorOutro: (rotulo: string | null, outro: number | null) =>
    outro === null
      ? `${aArea(rotulo)} já é citada por outro critério de desempate`
      : `${aArea(rotulo)} já é citada pelo critério ${outro}`,
  invalida: (rotulo: string | null) => `${aArea(rotulo)} não é uma área do ENEM`,
  obrigatorias: () => 'acrescente ao menos uma área do ENEM',
  emExcesso: () => 'o critério cita mais áreas do que o desempate admite',
} as const;

function aArea(rotulo: string | null): string {
  return rotulo === null ? 'uma das áreas' : `a área ${rotulo}`;
}

const PREFIXO_DA_RECUSA = 'uniplus.selecao.processo_seletivo.';
const FORA_DO_QUADRO = `${PREFIXO_DA_RECUSA}desempate_area_enem_fora_do_quadro`;
const SEM_QUADRO = `${PREFIXO_DA_RECUSA}desempate_area_enem_sem_quadro`;
const CITADA_POR_OUTRO_CRITERIO = `${PREFIXO_DA_RECUSA}area_enem_citada_por_outro_criterio`;
const PREFIXO_DA_RECUSA_DO_CRITERIO = 'uniplus.selecao.criterio_desempate.';

/**
 * O que a tela diz para a recusa do servidor a uma classificação que deixaria sem nota de área um
 * critério de desempate já gravado, pelo `code` e pelo campo — o `message` do servidor não é
 * contrato da tela. Sem quadro no campo da resolução, falta escolhê-la; nos campos do ENEM e da
 * regra de cálculo, falta a própria classificação pelo ENEM pela média ponderada.
 */
export function recusaDaClassificacaoPeloDesempate(erro: {
  readonly field: string;
  readonly code: string;
}): string | null {
  if (erro.code === FORA_DO_QUADRO) {
    return 'Um critério de desempate gravado cita área do ENEM que a resolução escolhida não tem em todos os grupos. No passo Desempate, retire a área — ou, se nenhuma área do critério sobrar, troque a regra dele ou remova-o — e grave o passo; ou escolha outra resolução.';
  }
  if (erro.code !== SEM_QUADRO) return null;
  return ehCampoDaResolucao(erro.field)
    ? 'Um critério de desempate gravado compara a nota de área do ENEM, que exige o quadro da resolução de Peso por Área. Troque a regra do critério no passo Desempate e grave o passo, ou escolha a resolução no passo Fórmula.'
    : recusaPorCriterioGravadoSemQuadro(null);
}

/**
 * As recusas do servidor à gravação do desempate que a tela explica, pelo `code`, com o rótulo da
 * área quando o campo da recusa aponta uma. São as mesmas frases da validação da tela.
 */
const RECUSA_AO_GRAVAR_O_DESEMPATE: ReadonlyMap<
  string,
  (rotulo: string | null, outro: number | null) => string
> = new Map([
  [FORA_DO_QUADRO, RECUSA_DA_AREA.foraDoQuadro],
  [CITADA_POR_OUTRO_CRITERIO, RECUSA_DA_AREA.citadaPorOutro],
  [`${PREFIXO_DA_RECUSA_DO_CRITERIO}area_repetida`, RECUSA_DA_AREA.repetida],
  [`${PREFIXO_DA_RECUSA_DO_CRITERIO}area_invalida`, RECUSA_DA_AREA.invalida],
  [`${PREFIXO_DA_RECUSA_DO_CRITERIO}areas_obrigatorias`, RECUSA_DA_AREA.obrigatorias],
  [`${PREFIXO_DA_RECUSA_DO_CRITERIO}areas_em_excesso`, RECUSA_DA_AREA.emExcesso],
  [
    SEM_QUADRO,
    () =>
      'a classificação gravada não tem o quadro de Peso por Área; escolha a resolução no passo Fórmula, se ainda não escolheu, e grave a classificação no passo Eliminação',
  ],
]);

/** A posição do primeiro critério, fora o de `indice`, que cita a área; `null` se nenhum. */
export function outroCriterioQueCita(
  criterios: readonly CriterioDesempateConfigurado[],
  codigo: string,
  indice: number,
): number | null {
  const outro = criterios.findIndex(
    (criterio, posicao) => posicao !== indice && criterio.areas.includes(codigo),
  );
  return outro < 0 ? null : outro + 1;
}

/** O campo da recusa: `criterios[i]`, e `.areas[j]` quando aponta uma área. */
const CAMPO_DO_CRITERIO = /criterios\[(\d+)\](?:\.areas\[(\d+)\])?/;

/**
 * A recusa do servidor à gravação do desempate, com o critério e a área que o campo aponta, ou
 * `null` quando a tela não tem texto para o `code`.
 */
export function recusaAoGravarODesempate(
  erro: { readonly field: string; readonly code: string },
  criterios: readonly CriterioDesempateConfigurado[],
  rotuloDaArea: (codigo: string) => string,
): string | null {
  const texto = RECUSA_AO_GRAVAR_O_DESEMPATE.get(erro.code);
  if (texto === undefined) return null;

  const campo = CAMPO_DO_CRITERIO.exec(erro.field);
  const indice = campo === null ? null : Number(campo[1]);
  const area =
    indice === null || campo?.[2] === undefined
      ? undefined
      : criterios[indice]?.areas[Number(campo[2])];
  const corpo =
    area === undefined || indice === null
      ? texto(null, null)
      : texto(rotuloDaArea(area), outroCriterioQueCita(criterios, area, indice));
  return indice === null
    ? `${corpo.charAt(0).toUpperCase()}${corpo.slice(1)}.`
    : `Critério de desempate ${indice + 1}: ${corpo}.`;
}
