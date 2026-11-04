import type { CriterioDesempateConfigurado } from '../../processo-seletivo.models';
import { problemaDaCondicao, type FatoEscolhivel } from '../../shared/gatilho-de-exigencia';
import { inteiroNaForma } from '../../shared/numero-do-campo';
import { repetidos } from '../../shared/repetidos';
import {
  desempateUsaAreas,
  desempateUsaEtapa,
  desempateUsaIdadeMinima,
  desempateUsaPredicadoFato,
} from './desempate-para-comando';
import { outroCriterioQueCita, RECUSA_DA_AREA } from './recusas-do-desempate';
import {
  areasCitadasPor,
  areasForaDoQuadro,
  recusaSemAreas,
  type SituacaoDoQuadro,
} from './situacao-do-quadro';

/** O que a conferência do desempate precisa saber além dos critérios. */
export interface DesempateParaConferir {
  readonly criterios: readonly CriterioDesempateConfigurado[];
  /** Com inscrição feita no sistema, ao menos um critério é obrigatório. */
  readonly obrigatorio: boolean;
  readonly etapas: readonly { readonly id: string | null }[];
  readonly fatos: ReadonlyMap<string, FatoEscolhivel>;
  readonly situacaoDoQuadro: SituacaoDoQuadro;
  readonly rotuloDaArea: (codigo: string) => string;
}

/** As mensagens de recusa do desempate, na ordem da lista. */
export function mensagensDoDesempate(entrada: DesempateParaConferir): string[] {
  const mensagens: string[] = [];
  if (entrada.obrigatorio && entrada.criterios.length === 0) {
    mensagens.push(
      'Informe ao menos um critério de desempate: com inscrição feita no sistema, ele é obrigatório.',
    );
  }

  entrada.criterios.forEach((criterio, indice) => {
    const posicao = indice + 1;
    const problemas = criterio.regraCodigo
      ? problemasDoCriterio(entrada, criterio, indice)
      : ['selecione uma regra'];
    mensagens.push(
      ...problemas.map((problema) => `Critério de desempate ${posicao}: ${problema}.`),
    );
  });
  return mensagens;
}

function problemasDoCriterio(
  entrada: DesempateParaConferir,
  criterio: CriterioDesempateConfigurado,
  indice: number,
): string[] {
  if (desempateUsaEtapa(criterio.regraCodigo)) return problemasDaEtapa(entrada, criterio);
  if (desempateUsaIdadeMinima(criterio.regraCodigo)) {
    const idade = inteiroNaForma(criterio.idadeMinima);
    return idade === null || idade <= 0 ? ['informe a idade mínima, maior que zero'] : [];
  }
  if (desempateUsaPredicadoFato(criterio.regraCodigo)) {
    // Espelha o validador do domínio — fato do vocabulário, operador que o domínio admite, valor
    // dentro do domínio declarado. Conferir só "os três campos estão preenchidos" aprovava texto
    // que o servidor recusava sem dizer qual das três coisas estava errada.
    const problema = problemaDaCondicao(criterio, entrada.fatos);
    return problema === null ? [] : [problema];
  }
  if (desempateUsaAreas(criterio.regraCodigo)) {
    const problema = problemaDasAreas(entrada, criterio, indice);
    return problema === null ? [] : [problema];
  }
  return [];
}

function problemasDaEtapa(
  entrada: DesempateParaConferir,
  criterio: CriterioDesempateConfigurado,
): string[] {
  if (criterio.etapaRef === '') return ['selecione a etapa referenciada'];
  return entrada.etapas.some((etapa) => etapa.id === criterio.etapaRef)
    ? []
    : ['a etapa referenciada não existe mais no cronograma'];
}

/**
 * Espelha o que o servidor recusa no critério por área. A conferência contra o quadro só vale com
 * o quadro lido: sem ele, "não achei" é "ainda não sei", e a recusa fica com o servidor.
 */
function problemaDasAreas(
  entrada: DesempateParaConferir,
  criterio: CriterioDesempateConfigurado,
  indice: number,
): string | null {
  const situacao = entrada.situacaoDoQuadro;
  const semAreas = recusaSemAreas(situacao);
  if (semAreas !== null) return semAreas;
  if (criterio.areas.length === 0) return RECUSA_DA_AREA.obrigatorias();

  if (situacao.tipo === 'lido') {
    const [foraDoQuadro] = areasForaDoQuadro(criterio.areas, situacao.aceitas);
    if (foraDoQuadro !== undefined) {
      return RECUSA_DA_AREA.foraDoQuadro(entrada.rotuloDaArea(foraDoQuadro));
    }
  }

  const [repetida] = repetidos(criterio.areas);
  if (repetida !== undefined) return RECUSA_DA_AREA.repetida(entrada.rotuloDaArea(repetida));

  const anteriores = new Set(areasCitadasPor(entrada.criterios.slice(0, indice)));
  const citada = criterio.areas.find((codigo) => anteriores.has(codigo));
  return citada === undefined
    ? null
    : RECUSA_DA_AREA.citadaPorOutro(
        entrada.rotuloDaArea(citada),
        outroCriterioQueCita(entrada.criterios, citada, indice),
      );
}
