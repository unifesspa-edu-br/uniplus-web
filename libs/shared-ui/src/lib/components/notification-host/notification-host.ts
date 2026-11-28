import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationService, NotificationType } from '@uniplus/shared-core/notifications';
import { ReferenciaAoSuporteComponent } from '../referencia-ao-suporte/referencia-ao-suporte';

/**
 * Apresentacional (ADR-0017): renderiza a fila de avisos mantida pelo
 * `NotificationService` (`shared-core`).
 *
 * Coloque uma única instância no shell de cada app:
 * ```html
 * <ui-notification-host />
 * ```
 *
 * **Acessibilidade (WCAG 2.1 AA + e-MAG 3.1):**
 * - Container com `role="region"` + `aria-label` descritivo.
 * - O texto de cada aviso fica num elemento com `role="status"` (info/success)
 *   ou `role="alert"` (error/warning); o leitor de tela o anuncia uma vez.
 * - A referência ao suporte (código do erro e identificador do pedido) fica
 *   no mesmo aviso, fora do elemento que anuncia, e usa a região de status
 *   do próprio bloco para dizer o resultado da cópia.
 * - "Fechar" é `<button type="button">` focável por Tab.
 */
@Component({
  selector: 'ui-notification-host',
  standalone: true,
  imports: [ReferenciaAoSuporteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="toast-stack" role="region" aria-label="Notificações do sistema">
      <div class="toast-region">
        @for (notification of notifications(); track notification.id) {
          <article
            class="toast"
            [class.toast--success]="notification.type === 'success'"
            [class.toast--danger]="notification.type === 'error'"
            [class.toast--warning]="notification.type === 'warning'"
            [class.toast--info]="notification.type === 'info'"
            [attr.data-testid]="'notification-host-toast-' + notification.type"
          >
            <div
              class="toast__anuncio"
              data-testid="notification-host-anuncio"
              [attr.role]="papelAria(notification.type)"
              [attr.aria-live]="ariaLive(notification.type)"
              [attr.aria-atomic]="true"
            >
              <span class="toast__icon" aria-hidden="true">{{ iconFor(notification.type) }}</span>
              <div class="toast__body">
                <p class="toast__title" data-testid="notification-host-title">
                  {{ notification.title }}
                </p>
                @if (notification.detail) {
                  <p class="toast__msg" data-testid="notification-host-detail">
                    {{ notification.detail }}
                  </p>
                }
              </div>
            </div>
            @if (notification.referencia; as referencia) {
              <ui-referencia-ao-suporte
                class="toast__referencia"
                data-testid="notification-host-referencia"
                [referencia]="referencia"
              />
            }
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
})
export class NotificationHostComponent {
  private readonly service = inject(NotificationService);
  protected readonly notifications = this.service.notifications;
  protected readonly dismissLabel = 'Fechar notificação';

  protected dispensar(id: number): void {
    this.service.dismiss(id);
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
}
