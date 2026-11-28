import { Injectable, signal } from '@angular/core';
import {
  referenciaDaRecusa,
  type ProblemDetails,
  type ReferenciaAoSuporte,
} from '@uniplus/shared-core/http';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

/**
 * Toast renderizado pelo `NotificationHostComponent` (`shared-ui`).
 *
 * `referencia` só existe em avisos disparados por `errorFromProblem(problem)`
 * cuja resposta traz código do erro ou identificador do pedido no formato da
 * API; o host a mostra pelo bloco `ui-referencia-ao-suporte`.
 *
 * `persistent: true` instrui o host a não auto-dismiss; vale em 5xx e em todo
 * aviso que traz `referencia` (a pessoa precisa de tempo para copiar).
 */
export interface Notification {
  readonly id: number;
  readonly type: NotificationType;
  readonly title: string;
  readonly detail?: string;
  readonly referencia?: ReferenciaAoSuporte;
  readonly persistent: boolean;
}

export interface NotificationOptions {
  /** Override do timeout (ms). Default: 5000. Ignorado se `persistent`. */
  readonly timeoutMs?: number;
  /** Quando `true`, toast não auto-dismisses — usuário fecha manualmente. */
  readonly persistent?: boolean;
}

/**
 * Override opcional ao despachar a partir de `ProblemDetails`. Quando ausentes,
 * `title`/`detail` vêm do próprio `problem` — o backend já garante PII-safe.
 *
 * **LGPD:** quem registrar override é responsável por garantir que o texto
 * não interpole `errors[].message`/`detail` raw. Use `errors[].code` (com
 * `errors[].field`, quando a causa aponta um campo) como chave para mensagens
 * estáticas pt-BR.
 */
export interface NotificationFromProblemOptions extends NotificationOptions {
  readonly title?: string;
  readonly detail?: string;
}

const DEFAULT_TIMEOUT_MS = 5000;
const SERVER_ERROR_THRESHOLD = 500;

/**
 * Hub de notificações da `uniplus-web` (ADR-0011/0012).
 *
 * Mantém a fila de toasts ativos como signal e expõe API tipada para os
 * containers despacharem mensagens. O renderer fica em `shared-ui`
 * (`NotificationHostComponent`) — o serviço é puro de UI.
 *
 * **Avisos disparados via `errorFromProblem(problem)`** carregam a referência
 * ao suporte (quando a resposta a traz) e ficam persistentes com ela e em 5xx;
 * sem referência, 4xx segue com o prazo normal.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private counter = 0;
  private readonly _notifications = signal<readonly Notification[]>([]);
  readonly notifications = this._notifications.asReadonly();
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  success(title: string, detail?: string, options?: NotificationOptions): number {
    return this.add('success', title, detail, options);
  }

  warning(title: string, detail?: string, options?: NotificationOptions): number {
    return this.add('warning', title, detail, options);
  }

  info(title: string, detail?: string, options?: NotificationOptions): number {
    return this.add('info', title, detail, options);
  }

  error(title: string, detail?: string, options?: NotificationOptions): number {
    return this.add('error', title, detail, options);
  }

  /**
   * Dispara toast de erro a partir de `ProblemDetails` (`ApiFailure.problem`).
   *
   * - `title`/`detail` vêm de `overrides` quando providos; senão de
   *   `problem.title`/`problem.detail`.
   * - `referencia` só existe quando a resposta traz código do erro ou
   *   identificador do pedido no formato da API.
   * - `persistent` é sempre `true` com `referencia`; sem ela, é `true` por
   *   default em status `>= 500` e pode ser sobrescrito via `overrides.persistent`.
   */
  errorFromProblem(problem: ProblemDetails, overrides?: NotificationFromProblemOptions): number {
    const notification = notificacaoDoProblema(++this.counter, problem, overrides);
    return this.publish(notification, overrides?.timeoutMs);
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this._notifications.update((items) => items.filter((n) => n.id !== id));
  }

  /** Limpa todas as notificações ativas — útil em logout/route change. */
  clearAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this._notifications.set([]);
  }

  private add(
    type: NotificationType,
    title: string,
    detail: string | undefined,
    options: NotificationOptions | undefined,
  ): number {
    const { timeoutMs, persistent = false }: NotificationOptions = options ?? {};
    return this.publish({ id: ++this.counter, type, title, detail, persistent }, timeoutMs);
  }

  private publish(notification: Notification, timeoutMs: number | undefined): number {
    this._notifications.update((items) => [...items, notification]);
    if (!notification.persistent) {
      const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;
      this.timers.set(
        notification.id,
        setTimeout(() => this.dismiss(notification.id), timeout),
      );
    }
    return notification.id;
  }
}

function ficaAteFechar(
  problem: ProblemDetails,
  referencia: ReferenciaAoSuporte | undefined,
  overrides: NotificationFromProblemOptions | undefined,
): boolean {
  if (referencia !== undefined) return true;
  return overrides?.persistent ?? problem.status >= SERVER_ERROR_THRESHOLD;
}

function notificacaoDoProblema(
  id: number,
  problem: ProblemDetails,
  overrides: NotificationFromProblemOptions | undefined,
): Notification {
  const referencia = referenciaDaRecusa(problem) ?? undefined;
  return {
    id,
    type: 'error',
    title: overrides?.title ?? problem.title,
    detail: overrides?.detail ?? problem.detail,
    referencia,
    persistent: ficaAteFechar(problem, referencia, overrides),
  };
}
