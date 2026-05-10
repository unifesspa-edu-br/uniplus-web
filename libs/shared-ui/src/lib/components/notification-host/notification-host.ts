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
      class="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-end gap-2 px-4 sm:items-end"
      role="region"
      aria-label="Notificações do sistema"
    >
      @for (notification of notifications(); track notification.id) {
        <article
          class="pointer-events-auto flex w-full max-w-md flex-col gap-2 rounded-md border px-4 py-3 shadow-lg"
          [attr.data-testid]="'notification-host-toast-' + notification.type"
          [class.border-green-200]="notification.type === 'success'"
          [class.bg-green-50]="notification.type === 'success'"
          [class.text-green-900]="notification.type === 'success'"
          [class.border-red-200]="notification.type === 'error'"
          [class.bg-red-50]="notification.type === 'error'"
          [class.text-red-900]="notification.type === 'error'"
          [class.border-amber-200]="notification.type === 'warning'"
          [class.bg-amber-50]="notification.type === 'warning'"
          [class.text-amber-900]="notification.type === 'warning'"
          [class.border-blue-200]="notification.type === 'info'"
          [class.bg-blue-50]="notification.type === 'info'"
          [class.text-blue-900]="notification.type === 'info'"
          [attr.role]="papelAria(notification.type)"
          [attr.aria-live]="ariaLive(notification.type)"
          [attr.aria-atomic]="true"
        >
          <div class="flex items-start justify-between gap-2">
            <p class="text-sm font-semibold" data-testid="notification-host-title">{{ notification.title }}</p>
            <button
              type="button"
              class="-m-1 rounded p-1 text-current opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-govbr-primary"
              data-testid="notification-host-dismiss"
              [attr.aria-label]="dismissLabel"
              (click)="dispensar(notification.id)"
            >
              ×
            </button>
          </div>
          @if (notification.detail) {
            <p class="text-xs leading-relaxed" data-testid="notification-host-detail">{{ notification.detail }}</p>
          }
          @if (notification.traceId) {
            <div
              class="flex flex-wrap items-center gap-2 border-t border-current/10 pt-2 text-xs"
              data-testid="notification-host-trace-block"
            >
              <span>{{ traceIdLabel }}</span>
              <code
                class="select-all rounded bg-black/5 px-1 py-0.5 font-mono text-[11px]"
                data-testid="notification-host-trace-id"
              >{{ notification.traceId }}</code>
              <button
                type="button"
                class="rounded border border-current/20 bg-white/60 px-2 py-0.5 text-[11px] font-medium hover:bg-white focus:outline-none focus:ring-2 focus:ring-govbr-primary"
                data-testid="notification-host-copy-trace"
                [attr.aria-label]="copyTraceLabelFor(notification.traceId)"
                [attr.aria-pressed]="idsCopiados().has(notification.id)"
                (click)="copiarTrace(notification.id, notification.traceId)"
              >
                {{ idsCopiados().has(notification.id) ? copiedLabel : copyLabel }}
              </button>
            </div>
          }
        </article>
      }
    </section>
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

  protected copyTraceLabelFor(traceId: string): string {
    return `Copiar ID de rastreamento ${traceId}`;
  }

  protected resetTraceCopiadoFlag(_notification: Notification): void {
    // Reservado para futuro reset por timeout — por enquanto a flag persiste
    // até o toast ser dispensado, o que é o ciclo de vida natural.
  }
}
