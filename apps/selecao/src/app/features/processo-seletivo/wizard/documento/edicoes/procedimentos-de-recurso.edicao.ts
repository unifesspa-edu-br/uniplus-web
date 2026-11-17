import {
  AreaDoEnemDoProcedimento,
  type DocumentoDaConfiguracao,
  type DocumentoDaConfiguracaoProcedimentoDeRecurso,
  type TipoDeDecisaoDoDocumento,
} from '@uniplus/shared-data/selecao';

import type {
  ModoDoTipo,
  RecusaDaDeclaracao,
} from '../../shared/procedimentos-do-recurso/procedimentos-da-janela';
import { membroDoEnum } from '../membro-do-enum';
import {
  impedimentoDaDeclaracao,
  mesmoAlvo,
} from '../../shared/procedimentos-do-recurso/unicidade-dos-procedimentos';
import { type RegraEscolhida } from '../regra-escolhida';
import { comCampo, comLista } from './secao-do-documento';
import { noRecursoDaEtapa, naRegraDeRecursoDaFase } from './recurso-por-lugar';

type Procedimento = DocumentoDaConfiguracaoProcedimentoDeRecurso;
type AlvoLido = NonNullable<Procedimento['alvo']>;

/** O que um procedimento contesta: um item de avaliação da etapa ou uma área do ENEM. */
export type AlvoDoProcedimento =
  | { readonly itemDeAvaliacaoChave: string }
  | { readonly areaDoEnem: AreaDoEnemDoProcedimento };

/** O que distingue um procedimento na janela de recurso: o tipo de decisão e o alvo, se houver. */
export interface IdentidadeDoProcedimento {
  readonly tipoDeDecisao: TipoDeDecisaoDoDocumento;
  readonly alvo: AlvoDoProcedimento | null;
  readonly ocorrencia?: number;
}

export type ResultadoDaDeclaracao =
  | { readonly declarado: true; readonly procedimentos: readonly Procedimento[] }
  | {
      readonly declarado: false;
      readonly recusa: RecusaDaDeclaracao & { readonly motivo: 'duplicado' | 'conflitante' };
    };

/** A área do ENEM que o alvo aponta, ou `undefined` quando o documento traz outro código. */
export function areaDoEnem(codigo: string): AreaDoEnemDoProcedimento | undefined {
  return membroDoEnum(AreaDoEnemDoProcedimento, codigo);
}

/** O alvo do procedimento; sem item nem área, o procedimento vale para o tipo de decisão inteiro. */
export function alvoDoProcedimento(alvo: AlvoLido | undefined): AlvoDoProcedimento | null {
  if (alvo?.itemDeAvaliacaoChave !== undefined) {
    return { itemDeAvaliacaoChave: alvo.itemDeAvaliacaoChave };
  }
  return alvo?.areaDoEnem === undefined ? null : { areaDoEnem: alvo.areaDoEnem };
}

function modoDoAlvo(alvo: AlvoDoProcedimento | null): ModoDoTipo {
  return alvo === null ? 'tipoInteiro' : 'porAlvo';
}

function eIdentico(procedimento: Procedimento, identidade: IdentidadeDoProcedimento): boolean {
  return (
    procedimento.tipoDeDecisao === identidade.tipoDeDecisao &&
    mesmoAlvo(alvoDoProcedimento(procedimento.alvo), identidade.alvo)
  );
}

/** O modo em que o tipo de decisão está declarado na janela; `null` enquanto não tem procedimento. */
export function modoVigenteDoTipo(
  procedimentos: readonly Procedimento[],
  tipoDeDecisao: string,
): ModoDoTipo | null {
  const doTipo = procedimentos.find((procedimento) => procedimento.tipoDeDecisao === tipoDeDecisao);
  return doTipo === undefined ? null : modoDoAlvo(alvoDoProcedimento(doTipo.alvo));
}

function comRegra(procedimento: Procedimento, regra: RegraEscolhida): Procedimento {
  const mesma =
    procedimento.regra.codigo === regra.codigo && procedimento.regra.versao === regra.versao;
  return mesma
    ? procedimento
    : comCampo(procedimento, 'regra', { codigo: regra.codigo, versao: regra.versao });
}

function novoProcedimento(
  identidade: IdentidadeDoProcedimento,
  regra: RegraEscolhida,
): Procedimento {
  const { tipoDeDecisao, alvo } = identidade;
  return {
    tipoDeDecisao,
    ...(alvo !== null && { alvo }),
    regra: { codigo: regra.codigo, versao: regra.versao },
  };
}

function posicaoDoProcedimento(
  procedimentos: readonly Procedimento[],
  identidade: IdentidadeDoProcedimento,
): number {
  const posicoes = procedimentos.flatMap((procedimento, indice) =>
    eIdentico(procedimento, identidade) ? [indice] : [],
  );
  return posicoes[identidade.ocorrencia ?? 0] ?? -1;
}

/** Troca a regra do procedimento declarado; sem ele na janela, nada muda. */
export function trocarRegraDoProcedimento(
  procedimentos: readonly Procedimento[],
  identidade: IdentidadeDoProcedimento,
  regra: RegraEscolhida,
): readonly Procedimento[] {
  const posicao = posicaoDoProcedimento(procedimentos, identidade);
  return procedimentos.map((procedimento, indice) =>
    indice === posicao ? comRegra(procedimento, regra) : procedimento,
  );
}

/**
 * Declara sem substituir o que existe. Repetição e mistura da decisão inteira com alvos são
 * recusadas; trocar uma regra exige a operação explícita de troca.
 */
export function declararProcedimento(
  procedimentos: readonly Procedimento[],
  identidade: IdentidadeDoProcedimento,
  regra: RegraEscolhida,
): ResultadoDaDeclaracao {
  const motivo = impedimentoDaDeclaracao(procedimentos, identidade);
  const { tipoDeDecisao } = identidade;
  const modoVigente =
    modoVigenteDoTipo(procedimentos, tipoDeDecisao) ?? modoDoAlvo(identidade.alvo);
  return motivo === null
    ? { declarado: true, procedimentos: [...procedimentos, novoProcedimento(identidade, regra)] }
    : { declarado: false, recusa: { tipoDeDecisao, modoVigente, motivo } };
}

/** Tira o procedimento da janela, qualquer que seja o tipo, sem mexer nos demais. */
export function removerProcedimento(
  procedimentos: readonly Procedimento[],
  identidade: IdentidadeDoProcedimento,
): readonly Procedimento[] {
  const posicao = posicaoDoProcedimento(procedimentos, identidade);
  return procedimentos.filter((_procedimento, indice) => indice !== posicao);
}

/**
 * Passa o tipo de decisão para o modo dado: os procedimentos dele que não são desse modo saem, e
 * o editor declara os novos. Os de outros tipos ficam como estão.
 */
export function trocarModoDoTipo(
  procedimentos: readonly Procedimento[],
  tipoDeDecisao: string,
  modo: ModoDoTipo,
): readonly Procedimento[] {
  return procedimentos.filter(
    (procedimento) =>
      procedimento.tipoDeDecisao !== tipoDeDecisao ||
      modoDoAlvo(alvoDoProcedimento(procedimento.alvo)) === modo,
  );
}

/** Os procedimentos de recurso da fase; a fase sem regra de recurso não ganha uma. */
export function definirProcedimentosDaFase(
  documento: DocumentoDaConfiguracao,
  faseChave: string,
  procedimentos: readonly Procedimento[],
  ocorrencia = 0,
): DocumentoDaConfiguracao {
  return naRegraDeRecursoDaFase(
    documento,
    faseChave,
    (regra) => comLista(regra, 'procedimentosDeRecurso', procedimentos),
    ocorrencia,
  );
}

/** Os procedimentos de recurso do recurso da etapa que está na posição. */
export function definirProcedimentosDaEtapa(
  documento: DocumentoDaConfiguracao,
  etapaChave: string,
  posicao: number | { readonly posicao: number; readonly ocorrencia: number },
  procedimentos: readonly Procedimento[],
): DocumentoDaConfiguracao {
  return noRecursoDaEtapa(documento, etapaChave, posicao, (recurso) =>
    comLista(recurso, 'procedimentosDeRecurso', procedimentos),
  );
}
