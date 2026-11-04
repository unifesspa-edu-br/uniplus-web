/**
 * Códigos de regra do ramo federal (Lei 12.711) no `rol_de_regras`: a
 * fórmula pura do art. 10 e a variação que soma AC_PCD a ela.
 *
 * O ramo federal muda o que o resto do formulário exige — referência
 * demográfica, regra de ajuste e o conjunto de modalidades —, então a tela
 * precisa reconhecê-lo pelo código, que é estável, e não pelo rótulo. Espelha
 * `RegraDistribuicaoVagasCodigo.EhRamoFederal` do uniplus-api: comparar com
 * um único literal deixaria a variação -COM-AC-PCD caindo no ramo
 * institucional, sem referência demográfica nem regra de ajuste.
 */
const REGRAS_RAMO_FEDERAL = ['DISTRIB-VAGAS-LEI-12711', 'DISTRIB-VAGAS-LEI-12711-COM-AC-PCD'];

/** Composições cuja quantidade o motor calcula; informá-las é recusado. */
export const COMPOSICOES_CALCULADAS = ['DENTRO_DO_VR', 'RESIDUAL_DO_VO'];

/** Composições que o edital precisa fixar mesmo no ramo federal. */
export const COMPOSICOES_DECLARADAS = ['RETIRA_DE', 'SUPLEMENTAR_AO_TOTAL'];

/** A que acresce vagas ao total da oferta em vez de disputar as que ela tem. */
const COMPOSICAO_SUPLEMENTAR = 'SUPLEMENTAR_AO_TOTAL';

/** A distribuição segue a Lei 12.711 (em alguma de suas variações). */
export function ehRamoFederal(regraDistribuicaoCodigo: string): boolean {
  return REGRAS_RAMO_FEDERAL.includes(regraDistribuicaoCodigo);
}

/**
 * A quantidade desta composição sai do total de vagas da oferta.
 *
 * A composição diz o que a modalidade é diante da oferta do curso, mas quem
 * decide se ela consome o total é o ramo da regra. Sob a Lei 12.711 a
 * suplementar acresce: o total publicado é o `VO_base` mais as suplementares,
 * e somá-la aqui recusaria o edital por oferecer justamente o que a Portaria
 * MEC 18/2012 art. 12 permite acrescentar. Fora dela não há cálculo algum — o
 * quadro é o que se publica, e o total publicado é a soma de tudo que ele
 * traz. Num certame exclusivo de indígenas e quilombolas, sem ampla
 * concorrência, são as suplementares que compõem o total: não há outro
 * conjunto a que elas se somem.
 */
export function consomeOTotalDeVagas(composicaoVagas: string, federal: boolean): boolean {
  return !federal || composicaoVagas !== COMPOSICAO_SUPLEMENTAR;
}

/**
 * Traduz a composição como o detalhe do processo a emite.
 *
 * O catálogo de Configuração publica o token canônico (`RETIRA_DE`), mas o
 * detalhe de Seleção serializa o nome do membro do enum (`RetiraDe`) — a
 * assimetria de contrato registrada em uniplus-api#1294. O resto da tela
 * compara com o canônico, então a grafia do detalhe se resolve aqui.
 *
 * Composição fora do vocabulário devolve `null`: o que a tela não reconhece é
 * ausência de informação, não uma composição a inventar.
 */
export function decodificarComposicaoVagas(valor: string): string | null {
  const procurada = semGrafia(valor);
  return (
    [...COMPOSICOES_CALCULADAS, ...COMPOSICOES_DECLARADAS].find(
      (composicao) => semGrafia(composicao) === procurada,
    ) ?? null
  );
}

/** Ignora o que separa as duas grafias do mesmo token: o `_` e a caixa. */
export function semGrafia(valor: string): string {
  return valor.replace(/_/g, '').toLowerCase();
}

/**
 * A quantidade desta composição é fixada pelo edital, e não calculada pela
 * regra. Fora do ramo federal o edital fixa todas; dentro dele, o motor calcula
 * o que deriva do VR e do residual, e informá-las é recusado.
 */
export function quantidadeEhDeclarada(composicaoVagas: string, federal: boolean): boolean {
  return !federal || COMPOSICOES_DECLARADAS.includes(composicaoVagas);
}
