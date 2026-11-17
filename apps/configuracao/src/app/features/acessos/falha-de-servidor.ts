import { effect, untracked, type Signal } from '@angular/core';
import { ProblemDetails, ProblemI18nService, separarCausas } from '@uniplus/shared-core/http';
import type { NotificationService } from '@uniplus/shared-core/notifications';
import { textoDaRecusa } from './mensagens-de-acesso';
import { textoDasCausasGerais } from '../../shared/formulario';

const PRIMEIRO_STATUS_DE_SERVIDOR = 500;

function falhaDeServidor(problema: ProblemDetails): boolean {
  return problema.status >= PRIMEIRO_STATUS_DE_SERVIDOR;
}

/** Textos que valem só no contexto de uma operação, por código completo, antes dos gerais. */
export type MensagensDoContexto = Readonly<Record<string, { title: string; detail?: string }>>;

/**
 * O texto da recusa para a tela: as mensagens das causas gerais no lugar do título do código, quando
 * há, com a orientação do código depois. A falha de servidor (5xx), que a pessoa não resolve, também
 * vira notificação com o código de rastreio; a recusa 4xx fica só no lugar onde a tela a mostra.
 */
export function mensagemDaRecusa(
  problemas: ProblemI18nService,
  notificacoes: NotificationService,
  problema: ProblemDetails,
  doContexto: MensagensDoContexto = {},
): string {
  const mensagem = doContexto[problema.code] ?? problemas.resolve(problema);
  if (falhaDeServidor(problema)) {
    notificacoes.errorFromProblem(problema, { title: mensagem.title });
  }
  const geral = textoDasCausasGerais(separarCausas(problema.errors).gerais);
  return geral === null ? textoDaRecusa(mensagem) : textoDaRecusa({ ...mensagem, title: geral });
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
  const notificar = (falha: ProblemDetails) =>
    notificacoes.errorFromProblem(falha, { title: problemas.resolve(falha).title });
  for (const problema of leituras) {
    effect(() => {
      const falha = problema();
      if (falha !== null && falhaDeServidor(falha)) untracked(() => notificar(falha));
    });
  }
}
