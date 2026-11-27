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

const MENSAGEM_CRITERIO_OBRIGATORIO =
  'Informe ao menos um critério de desempate: com inscrição feita no sistema, ele é obrigatório.';

/** As mensagens de recusa do desempate, na ordem da lista. */
export function mensagensDoDesempate(entrada: DesempateParaConferir): string[] {
  const faltaCriterio = entrada.obrigatorio && entrada.criterios.length === 0;
  return [
    ...(faltaCriterio ? [MENSAGEM_CRITERIO_OBRIGATORIO] : []),
    ...entrada.criterios.flatMap((criterio, indice) =>
      problemasNaLista(entrada, criterio, indice).map(
        (problema) => `Critério de desempate ${indice + 1}: ${problema}.`,
      ),
    ),
  ];
}

function problemasNaLista(
  entrada: DesempateParaConferir,
  criterio: CriterioDesempateConfigurado,
  indice: number,
): string[] {
  return criterio.regraCodigo
    ? problemasDoCriterio(entrada, criterio, indice)
    : ['selecione uma regra'];
}

function problemasDoCriterio(
  entrada: DesempateParaConferir,
  criterio: CriterioDesempateConfigurado,
  indice: number,
): string[] {
  const regra = criterio.regraCodigo;
  if (desempateUsaEtapa(regra)) return problemasDaEtapa(entrada, criterio);
  if (desempateUsaIdadeMinima(regra)) return problemasDaIdadeMinima(criterio);
  if (desempateUsaPredicadoFato(regra)) return problemasDoFato(entrada, criterio);
  if (desempateUsaAreas(regra)) return comoLista(problemaDasAreas(entrada, criterio, indice));
  return [];
}

// Espelha o validador do domínio — fato do vocabulário, operador que o domínio admite, valor
// dentro do domínio declarado. Conferir só "os três campos estão preenchidos" aprovava texto
// que o servidor recusava sem dizer qual das três coisas estava errada.
function problemasDoFato(
  entrada: DesempateParaConferir,
  criterio: CriterioDesempateConfigurado,
): string[] {
  return comoLista(problemaDaCondicao(criterio, entrada.fatos));
}

function comoLista(problema: string | null): string[] {
  return problema === null ? [] : [problema];
}

function problemasDaIdadeMinima(criterio: CriterioDesempateConfigurado): string[] {
  const idade = inteiroNaForma(criterio.idadeMinima);
  return idade === null || idade <= 0 ? ['informe a idade mínima, maior que zero'] : [];
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
  return (
    recusaForaDoQuadro(entrada, criterio) ??
    recusaRepetida(entrada, criterio) ??
    recusaCitadaPorAnterior(entrada, criterio, indice)
  );
}

function recusaForaDoQuadro(
  entrada: DesempateParaConferir,
  criterio: CriterioDesempateConfigurado,
): string | null {
  const situacao = entrada.situacaoDoQuadro;
  if (situacao.tipo !== 'lido') return null;
  const [foraDoQuadro] = areasForaDoQuadro(criterio.areas, situacao.aceitas);
  return foraDoQuadro === undefined
    ? null
    : RECUSA_DA_AREA.foraDoQuadro(entrada.rotuloDaArea(foraDoQuadro));
}

function recusaRepetida(
  entrada: DesempateParaConferir,
  criterio: CriterioDesempateConfigurado,
): string | null {
  const [repetida] = repetidos(criterio.areas);
  return repetida === undefined ? null : RECUSA_DA_AREA.repetida(entrada.rotuloDaArea(repetida));
}

function recusaCitadaPorAnterior(
  entrada: DesempateParaConferir,
  criterio: CriterioDesempateConfigurado,
  indice: number,
): string | null {
  const anteriores = new Set(areasCitadasPor(entrada.criterios.slice(0, indice)));
  const citada = criterio.areas.find((codigo) => anteriores.has(codigo));
  return citada === undefined
    ? null
    : RECUSA_DA_AREA.citadaPorOutro(
        entrada.rotuloDaArea(citada),
        outroCriterioQueCita(entrada.criterios, citada, indice),
      );
}
