import { effect, untracked, type Signal } from '@angular/core';
import type { ProblemDetails, ProblemI18nService } from '@uniplus/shared-core/http';
import type { NotificationService } from '@uniplus/shared-core/notifications';
import { textoDaRecusa } from './mensagens-de-acesso';

const PRIMEIRO_STATUS_DE_SERVIDOR = 500;

function falhaDeServidor(problema: ProblemDetails): boolean {
  return problema.status >= PRIMEIRO_STATUS_DE_SERVIDOR;
}

/**
 * O texto da recusa para a tela. A falha de servidor (5xx), que a pessoa não resolve, também vira
 * notificação com o código de rastreio; a recusa 4xx fica só no lugar onde a tela a mostra.
 */
export function mensagemDaRecusa(
  problemas: ProblemI18nService,
  notificacoes: NotificationService,
  problema: ProblemDetails,
): string {
  const mensagem = problemas.resolve(problema);
  if (falhaDeServidor(problema)) {
    notificacoes.errorFromProblem(problema, { title: mensagem.title });
  }
  return textoDaRecusa(mensagem);
}

/**
 * Notifica a falha de servidor (5xx) de cada leitura assim que ela chega. Chamar em contexto de
 * injeção, no construtor do store.
 */
export function notificarFalhasDeLeitura(
  problemas: ProblemI18nService,
  notificacoes: NotificationService,
  leituras: readonly Signal<ProblemDetails | null>[],
): void {
  for (const problema of leituras) {
    effect(() => {
      const falha = problema();
      if (falha !== null && falhaDeServidor(falha)) {
        untracked(() =>
          notificacoes.errorFromProblem(falha, { title: problemas.resolve(falha).title }),
        );
      }
    });
  }
}
