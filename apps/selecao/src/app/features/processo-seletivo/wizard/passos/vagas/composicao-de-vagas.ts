import { ComposicaoVagasCodigo } from '@uniplus/shared-data/configuracao';

/**
 * O ramo em que a regra de distribuição monta o quadro: o cálculo da Lei 12.711 ou o quadro que o
 * edital fixa. É o que o catálogo publica em `ramoDaDistribuicao`, e não o código da regra, que é
 * identificador e não muda o que o formulário exige.
 */
export const RAMO_LEI_DE_COTAS = 'LEI_DE_COTAS';
export const RAMO_QUADRO_FIXADO_NO_EDITAL = 'QUADRO_FIXADO_NO_EDITAL';

/** Composições cuja quantidade o motor calcula; informá-las é recusado. */
export const COMPOSICOES_CALCULADAS: readonly string[] = [
  ComposicaoVagasCodigo.DENTRO_DA_RESERVA_LEGAL,
  ComposicaoVagasCodigo.RESTANTE_DAS_VAGAS_OFERTADAS,
] satisfies readonly ComposicaoVagasCodigo[];

/** Composições que o edital precisa fixar mesmo no ramo federal. */
export const COMPOSICOES_DECLARADAS: readonly string[] = [
  ComposicaoVagasCodigo.RETIRADA_DE_OUTRA_MODALIDADE,
  ComposicaoVagasCodigo.SUPLEMENTAR_AO_TOTAL,
] satisfies readonly ComposicaoVagasCodigo[];

/** A que acresce vagas ao total da oferta em vez de disputar as que ela tem. */
const COMPOSICAO_SUPLEMENTAR = ComposicaoVagasCodigo.SUPLEMENTAR_AO_TOTAL;

/** A distribuição segue a Lei 12.711, no ramo que a regra declara; sem ramo, não se presume. */
export function ehRamoFederal(ramoDaDistribuicao: string | null | undefined): boolean {
  return ramoDaDistribuicao === RAMO_LEI_DE_COTAS;
}

/**
 * O ramo é um dos dois que o contrato publica. Ramo ausente é regra que a API não reconhece: a
 * tela não o presume quadro fixado, porque isso trataria como declaradas quantidades que a regra
 * poderia calcular.
 */
export function ehRamoReconhecido(ramoDaDistribuicao: string | null | undefined): boolean {
  return (
    ramoDaDistribuicao === RAMO_LEI_DE_COTAS || ramoDaDistribuicao === RAMO_QUADRO_FIXADO_NO_EDITAL
  );
}

/**
 * A quantidade desta composição sai do total de vagas da oferta.
 *
 * A composição diz o que a modalidade é diante da oferta do curso, mas quem
 * decide se ela consome o total é o ramo da regra. Sob a Lei 12.711 a
 * suplementar acresce: o total publicado são as vagas ofertadas base mais as suplementares,
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
 * O catálogo de Configuração publica o token canônico (`RETIRADA_DE_OUTRA_MODALIDADE`); a
 * leitura também aceita o nome do membro do enum (`RetiradaDeOutraModalidade`). O resto da tela
 * compara com o canônico, então a grafia se resolve aqui.
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
 * o que deriva da reserva legal e do restante das vagas ofertadas, e informá-las é recusado.
 */
export function quantidadeEhDeclarada(composicaoVagas: string, federal: boolean): boolean {
  return !federal || COMPOSICOES_DECLARADAS.includes(composicaoVagas);
}
