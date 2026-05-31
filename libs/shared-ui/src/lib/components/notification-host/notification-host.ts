import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  Notification,
  NotificationService,
  NotificationType,
} from '@uniplus/shared-core';

/**
 * Apresentacional (ADR-0017): renderiza a fila de toasts mantida pelo
 * `NotificationService` (`shared-core`).
 *
 * Coloque uma única instância no shell de cada app:
 * ```html
 * <ui-notification-host />
 * ```
 *
 * **Acessibilidade (WCAG 2.1 AA + e-MAG 3.1):**
 * - Container com `role="region"` + `aria-label` descritivo.
 * - Cada toast renderizado com `role="status"` (info/success/warning) ou
 *   `role="alert"` (error). Em info/success usa `aria-live="polite"`,
 *   em error/warning usa `aria-live="assertive"` para garantir anúncio
 *   imediato pelo leitor de tela.
 * - Botões "Copiar traceId" e "Fechar" são `<button type="button">`
 *   focáveis via Tab; navegação por teclado nativa.
 *
 * **`Copiar traceId`:** botão renderizado apenas quando
 * `notification.traceId` é não-vazio. Usa `navigator.clipboard.writeText`
 * com fallback silencioso em navegadores antigos (operador opt-in via
 * `aria-pressed` para feedback). `traceId` selecionável via `select-all`
 * dispensa clipboard quando esta API não existir.
 */
@Component({
  selector: 'ui-notification-host',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="toast-stack"
      role="region"
      aria-label="Notificações do sistema"
    >
      <div class="toast-region">
        @for (notification of notifications(); track notification.id) {
          <article
            class="toast"
            [class.toast--success]="notification.type === 'success'"
            [class.toast--danger]="notification.type === 'error'"
            [class.toast--warning]="notification.type === 'warning'"
            [class.toast--info]="notification.type === 'info'"
            [attr.data-testid]="'notification-host-toast-' + notification.type"
            [attr.role]="papelAria(notification.type)"
            [attr.aria-live]="ariaLive(notification.type)"
            [attr.aria-atomic]="true"
          >
            <span class="toast__icon" aria-hidden="true">{{ iconFor(notification.type) }}</span>
            <div class="toast__body">
              <p class="toast__title" data-testid="notification-host-title">{{ notification.title }}</p>
              @if (notification.detail) {
                <p class="toast__msg" data-testid="notification-host-detail">{{ notification.detail }}</p>
              }
              @if (notification.traceId) {
                <div class="ui-toast-trace" data-testid="notification-host-trace-block">
                  <span>{{ traceIdLabel }}</span>
                  <code data-testid="notification-host-trace-id">{{ notification.traceId }}</code>
                  <button
                    type="button"
                    class="btn btn--tertiary btn--sm"
                    data-testid="notification-host-copy-trace"
                    [attr.aria-label]="copyTraceLabelFor(notification.traceId)"
                    [attr.aria-pressed]="idsCopiados().has(notification.id)"
                    (click)="copiarTrace(notification.id, notification.traceId)"
                  >
                    {{ idsCopiados().has(notification.id) ? copiedLabel : copyLabel }}
                  </button>
                </div>
              }
            </div>
            <button
              type="button"
              class="toast__close"
              data-testid="notification-host-dismiss"
              [attr.aria-label]="dismissLabel"
              (click)="dispensar(notification.id)"
            >
              ×
            </button>
          </article>
        }
      </div>
    </section>
  `,
  styles: `
    .ui-toast-trace {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      margin-top: var(--space-2);
      padding-top: var(--space-2);
      border-top: 1px solid var(--border-subtle);
      font-size: var(--text-xs);
      color: var(--text-secondary);
    }

    .ui-toast-trace code {
      font-family: var(--font-mono);
      color: var(--text-primary);
      background: var(--surface-subtle);
      border-radius: var(--radius-sm);
      padding: 0 var(--space-1);
      user-select: all;
    }
  `,
})
export class NotificationHostComponent {
  private readonly service = inject(NotificationService);
  protected readonly notifications = this.service.notifications;
  /** IDs de notifications cujo traceId já foi copiado (para feedback de "Copiado!"). */
  private readonly _idsCopiados = signal<ReadonlySet<number>>(new Set());
  protected readonly idsCopiados = this._idsCopiados.asReadonly();

  /** Labels — futuramente movíveis para um service de i18n; por enquanto pt-BR fixo. */
  protected readonly dismissLabel = 'Fechar notificação';
  protected readonly traceIdLabel = 'ID de rastreamento:';
  protected readonly copyLabel = 'Copiar';
  protected readonly copiedLabel = 'Copiado!';

  protected readonly hasNotifications = computed(
    () => this.notifications().length > 0,
  );

  protected dispensar(id: number): void {
    this.service.dismiss(id);
  }

  /**
   * Copia o `traceId` para o clipboard. Em navegadores sem
   * `navigator.clipboard` (HTTP non-secure context, IE legado etc.) cai em
   * fallback no-op — o usuário pode selecionar o `<code>` (que tem
   * `select-all`) e copiar manualmente.
   */
  protected copiarTrace(id: number, traceId: string): void {
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
    if (!clipboard?.writeText) {
      return;
    }
    void clipboard.writeText(traceId).then(
      () => {
        this._idsCopiados.update((current) => {
          const next = new Set(current);
          next.add(id);
          return next;
        });
      },
      () => {
        // Falha silenciosa: o `<code>` continua selecionável manualmente
        // (atributo `select-all`) e o usuário pode copiar via Ctrl+C.
      },
    );
  }

  protected papelAria(type: NotificationType): 'alert' | 'status' {
    return type === 'error' ? 'alert' : 'status';
  }

  protected ariaLive(type: NotificationType): 'assertive' | 'polite' {
    return type === 'error' || type === 'warning' ? 'assertive' : 'polite';
  }

  protected iconFor(type: NotificationType): string {
    const icons: Record<NotificationType, string> = {
      success: '✓',
      warning: '!',
      error: '!',
      info: 'i',
    };
    return icons[type];
  }

  protected copyTraceLabelFor(traceId: string): string {
    return `Copiar ID de rastreamento ${traceId}`;
  }

  protected resetTraceCopiadoFlag(_notification: Notification): void {
    // Reservado para futuro reset por timeout — por enquanto a flag persiste
    // até o toast ser dispensado, o que é o ciclo de vida natural.
  }
}
