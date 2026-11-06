import { WritableSignal } from '@angular/core';
import { ProblemDetails, STATUS_HTTP } from '@uniplus/shared-core/http';
import { deveRotacionarIdempotencyKey, idempotencyKey } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { DATA_DUPLICADA_DATASET_CODE } from './calendario-dias-uteis.util';

/**
 * Como a tela trata uma recusa da API ao gravar:
 * - `dataDuplicada`: a data repete outra do dataset, com ou sem campo apontado;
 * - `campos`: o servidor apontou os campos recusados (`errors[]`), inclusive a referência de cidade;
 * - `geral`: o resto, que aparece no alerta do formulário.
 */
export type TipoDeFalha = 'campos' | 'dataDuplicada' | 'geral';

export interface FalhaDoCalendario {
  readonly tipo: TipoDeFalha;
  /** A recusa fica gravada contra o corpo enviado, então o reenvio corrigido precisa de chave nova. */
  readonly rotacionarChave: boolean;
  /** Falha do servidor: o único caso em que o aviso em toast acompanha o alerta. */
  readonly doServidor: boolean;
}

function tipoDaFalha(problem: ProblemDetails): TipoDeFalha {
  if (problem.status !== STATUS_HTTP.RECUSA_DE_NEGOCIO) {
    return 'geral';
  }
  if (problem.code === DATA_DUPLICADA_DATASET_CODE) {
    return 'dataDuplicada';
  }
  return problem.errors?.length ? 'campos' : 'geral';
}

export function classificarFalha(problem: ProblemDetails): FalhaDoCalendario {
  return {
    tipo: tipoDaFalha(problem),
    rotacionarChave: deveRotacionarIdempotencyKey(problem),
    doServidor: problem.status >= 500,
  };
}

/**
 * A parte da política que as duas escritas do calendário repetiam: renova a chave de
 * idempotência quando a recusa a gastou e avisa por toast só a falha do servidor. Devolve a
 * classificação, para quem chama decidir onde a mensagem aparece.
 */
export function aplicarPoliticaDaFalha(
  problem: ProblemDetails,
  chave: WritableSignal<string>,
  notifications: NotificationService,
): FalhaDoCalendario {
  const falha = classificarFalha(problem);
  if (falha.rotacionarChave) {
    chave.set(idempotencyKey.create());
  }
  if (falha.doServidor) {
    notifications.errorFromProblem(problem);
  }
  return falha;
}
