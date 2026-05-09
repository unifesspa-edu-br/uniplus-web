import { Injectable, signal } from '@angular/core';
import type { ProblemDetails } from '../http/problem-details';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

/**
 * Toast renderizado pelo `NotificationHostComponent` (`shared-ui`).
 *
 * Campos `traceId` e `code` só aparecem em notificações disparadas por
 * `errorFromProblem(problem)` — em `success/info/warning/error` simples
 * ficam `undefined`. O host usa `traceId` para habilitar botão
 * "Copiar traceId" e `code` para hooks futuros de i18n/analytics.
 *
 * `persistent: true` instrui o host a não auto-dismiss; default em 5xx.
 */
export interface Notification {
  readonly id: number;
  readonly type: NotificationType;
  readonly title: string;
  readonly detail?: string;
  readonly traceId?: string;
  readonly code?: string;
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
 * não interpole `errors[].message`/`detail` raw. Use `errors[].field` +
 * `errors[].code` como chaves para mensagens estáticas pt-BR.
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
 * **Toasts disparados via `errorFromProblem(problem)`** carregam `traceId`,
 * `code` e ficam persistentes em 5xx por default — o suporte de incidentes
 * precisa do trace ID copiável para vincular ao log/Tempo. Status 4xx
 * permanece com timeout normal.
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
   * - `traceId` é exposto para o host renderizar botão "Copiar traceId"
   *   quando o backend emitiu trace context não-vazio.
   * - `persistent` é `true` por default em status `>= 500`; pode ser
   *   sobrescrito via `overrides.persistent`.
   */
  errorFromProblem(
    problem: ProblemDetails,
    overrides?: NotificationFromProblemOptions,
  ): number {
    const id = ++this.counter;
    const persistent =
      overrides?.persistent ?? problem.status >= SERVER_ERROR_THRESHOLD;
    const traceId = problem.traceId.length > 0 ? problem.traceId : undefined;
    const notification: Notification = {
      id,
      type: 'error',
      title: overrides?.title ?? problem.title,
      detail: overrides?.detail ?? problem.detail,
      traceId,
      code: problem.code,
      persistent,
    };
    this.publish(notification, overrides?.timeoutMs);
    return id;
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
    const id = ++this.counter;
    const persistent = options?.persistent ?? false;
    const notification: Notification = {
      id,
      type,
      title,
      detail,
      persistent,
    };
    this.publish(notification, options?.timeoutMs);
    return id;
  }

  private publish(notification: Notification, timeoutMs: number | undefined): void {
    this._notifications.update((items) => [...items, notification]);
    if (notification.persistent) {
      return;
    }
    const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timer = setTimeout(() => this.dismiss(notification.id), timeout);
    this.timers.set(notification.id, timer);
  }
}
