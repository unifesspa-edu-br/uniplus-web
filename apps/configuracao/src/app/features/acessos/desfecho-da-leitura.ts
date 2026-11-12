import { computed, type Signal } from '@angular/core';
import {
  ehRecusaDefinitiva,
  type ProblemDetails,
  type ProblemI18nService,
  type UseApiResourceRef,
} from '@uniplus/shared-core/http';
import { recusaDe, type RecusaDaLeitura } from '../../shared/recusa-da-leitura';
import { FALHA_INESPERADA_DE_LEITURA, textoDaRecusa } from './mensagens-de-acesso';

type Consulta = Pick<UseApiResourceRef<unknown>, 'problem' | 'error'>;

/** O desfecho de uma ou mais consultas lidas juntas, separando o que a nova tentativa pode resolver. */
export interface DesfechoDaLeitura {
  /** A falha que uma nova tentativa pode resolver; `null` na recusa definitiva. */
  readonly falha: Signal<string | null>;
  /** A recusa definitiva (sem permissão, não encontrado), que a tela mostra sem oferecer nova tentativa. */
  readonly recusa: Signal<RecusaDaLeitura | null>;
  /** A mensagem de qualquer um dos dois desfechos; a recusa vale mais que a falha. */
  readonly mensagem: Signal<string | null>;
}

type TextoDoProblema = (problema: ProblemDetails) => string;

export function desfechoDaLeitura(
  consultas: readonly Consulta[],
  problemas: ProblemI18nService,
): DesfechoDaLeitura {
  const textoDe: TextoDoProblema = (problema) => textoDaRecusa(problemas.resolve(problema));
  const problemasDas = (): ProblemDetails[] =>
    consultas.flatMap((consulta) => consulta.problem() ?? []);

  const recusa = computed(() => recusaDefinitiva(problemasDas(), textoDe));
  const falha = computed(() =>
    recusa() === null ? falhaRecuperavel(consultas, problemasDas(), textoDe) : null,
  );
  return { falha, recusa, mensagem: computed(() => recusa()?.texto ?? falha()) };
}

function recusaDefinitiva(
  problemas: readonly ProblemDetails[],
  textoDe: TextoDoProblema,
): RecusaDaLeitura | null {
  const problema = problemas.find(ehRecusaDefinitiva);
  return problema ? recusaDe(problema, textoDe(problema)) : null;
}

/** O problema da primeira consulta que falhou ou, sem problema, a falha inesperada de qualquer uma. */
function falhaRecuperavel(
  consultas: readonly Consulta[],
  problemas: readonly ProblemDetails[],
  textoDe: TextoDoProblema,
): string | null {
  const problema = problemas[0];
  if (problema) return textoDe(problema);
  return consultas.some((consulta) => consulta.error()) ? FALHA_INESPERADA_DE_LEITURA : null;
}
