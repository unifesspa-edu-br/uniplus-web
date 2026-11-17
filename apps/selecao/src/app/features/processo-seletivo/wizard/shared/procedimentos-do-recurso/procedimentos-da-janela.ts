import type {
  AlvoDoProcedimentoDeRecurso,
  ProcedimentoDeRecurso,
} from '../../processo-seletivo.models';
import { mesmoAlvo } from './alvo-do-procedimento';

/** Como o tipo de decisão é coberto: um procedimento para o tipo inteiro ou um por alvo. */
export type ModoDoTipo = 'tipoInteiro' | 'porAlvo';

/** O que distingue um procedimento dentro da janela de recurso: o tipo de decisão e o alvo. */
export interface IdentidadeDoProcedimento {
  readonly tipoDeDecisao: string;
  readonly alvo: AlvoDoProcedimentoDeRecurso | null;
}

/** A regra do catálogo que conduz o recurso. */
export interface RegraDoProcedimento {
  readonly regraCodigo: string;
  readonly regraVersao: string;
}

/** O modo que o tipo de decisão já tem na janela e que a declaração contrariaria. */
export interface RecusaDaDeclaracao {
  readonly tipoDeDecisao: string;
  readonly modoVigente: ModoDoTipo;
}

export type ResultadoDaDeclaracao =
  | { readonly declarado: true; readonly procedimentos: readonly ProcedimentoDeRecurso[] }
  | { readonly declarado: false; readonly recusa: RecusaDaDeclaracao };

/**
 * Declara o procedimento na janela. O par tipo e alvo que já existe tem a regra trocada, sem
 * duplicar. Um tipo não se declara inteiro e por alvo ao mesmo tempo: a declaração que contraria o
 * modo vigente do tipo é recusada e a lista fica como está; só `trocarModoDoTipo` substitui o modo.
 */
export function declararProcedimento(
  procedimentos: readonly ProcedimentoDeRecurso[],
  identidade: IdentidadeDoProcedimento,
  regra: RegraDoProcedimento,
): ResultadoDaDeclaracao {
  const modoVigente = modoVigenteDoTipo(procedimentos, identidade.tipoDeDecisao);
  if (modoVigente !== null && modoVigente !== modoDoAlvo(identidade.alvo)) {
    return { declarado: false, recusa: { tipoDeDecisao: identidade.tipoDeDecisao, modoVigente } };
  }
  return { declarado: true, procedimentos: comDeclarado(procedimentos, identidade, regra) };
}

/** Troca a regra do procedimento declarado; sem ele na janela, nada muda. */
export function trocarRegraDoProcedimento(
  procedimentos: readonly ProcedimentoDeRecurso[],
  identidade: IdentidadeDoProcedimento,
  regra: RegraDoProcedimento,
): readonly ProcedimentoDeRecurso[] {
  return procedimentos.map((procedimento) =>
    eIdentico(procedimento, identidade) ? { ...procedimento, ...regra } : procedimento,
  );
}

/** Tira o procedimento da janela, qualquer que seja o tipo, sem mexer nos demais. */
export function removerProcedimento(
  procedimentos: readonly ProcedimentoDeRecurso[],
  identidade: IdentidadeDoProcedimento,
): readonly ProcedimentoDeRecurso[] {
  return procedimentos.filter((procedimento) => !eIdentico(procedimento, identidade));
}

/**
 * Passa o tipo de decisão para o modo dado: os procedimentos dele que não são desse modo saem, e
 * o editor declara os novos. Os de outros tipos ficam como estão.
 */
export function trocarModoDoTipo(
  procedimentos: readonly ProcedimentoDeRecurso[],
  tipoDeDecisao: string,
  modo: ModoDoTipo,
): readonly ProcedimentoDeRecurso[] {
  return procedimentos.filter(
    (procedimento) =>
      procedimento.tipoDeDecisao !== tipoDeDecisao || modoDoAlvo(procedimento.alvo) === modo,
  );
}

function comDeclarado(
  procedimentos: readonly ProcedimentoDeRecurso[],
  identidade: IdentidadeDoProcedimento,
  regra: RegraDoProcedimento,
): readonly ProcedimentoDeRecurso[] {
  const jaDeclarado = procedimentos.some((procedimento) => eIdentico(procedimento, identidade));
  return jaDeclarado
    ? trocarRegraDoProcedimento(procedimentos, identidade, regra)
    : [...procedimentos, { ...identidade, ...regra, sugestao: null }];
}

/** O modo em que o tipo de decisão está declarado na janela; `null` enquanto não tem procedimento. */
export function modoVigenteDoTipo(
  procedimentos: readonly ProcedimentoDeRecurso[],
  tipoDeDecisao: string,
): ModoDoTipo | null {
  const doTipo = procedimentos.find((procedimento) => procedimento.tipoDeDecisao === tipoDeDecisao);
  return doTipo === undefined ? null : modoDoAlvo(doTipo.alvo);
}

function modoDoAlvo(alvo: AlvoDoProcedimentoDeRecurso | null): ModoDoTipo {
  return alvo === null ? 'tipoInteiro' : 'porAlvo';
}

function eIdentico(
  procedimento: ProcedimentoDeRecurso,
  identidade: IdentidadeDoProcedimento,
): boolean {
  return (
    procedimento.tipoDeDecisao === identidade.tipoDeDecisao &&
    mesmoAlvo(procedimento.alvo, identidade.alvo)
  );
}
