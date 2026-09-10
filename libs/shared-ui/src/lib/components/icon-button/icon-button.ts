import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/** Posição da dica — contrato `[data-tooltip-position]` do Uni+ DS. */
export type UiTooltipPosition = 'top' | 'bottom' | 'left' | 'right';

/**
 * Botão de ação só-ícone com dica (tooltip). Padroniza as células de "Ações"
 * das tabelas (editar, remover, inativar, etc.) e barras de ferramentas.
 *
 * Aparência fixa do Uni+ DS: `btn btn--tertiary btn--sm btn--rect
 * btn--icon-only`; `danger` troca para a variante destrutiva. O `<i>` é
 * `aria-hidden` — `accessibleName` é o rótulo lido por leitor de tela (inclua
 * o identificador da linha, ex.: "Editar curso BCC") e `tooltip` é o texto
 * curto exibido no hover/foco (cai em `accessibleName` quando vazio). O
 * `[data-tooltip]` do DS já aparece no `:hover` **e** no `:focus-visible`.
 */
@Component({
  selector: 'ui-icon-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="btn btn--sm btn--rect btn--icon-only"
      [class.btn--tertiary]="!danger()"
      [class.btn--danger]="danger()"
      [attr.aria-label]="accessibleName()"
      [attr.data-tooltip]="tooltip() || accessibleName()"
      [attr.data-tooltip-position]="tooltipPosition()"
      [disabled]="isDisabled()"
      (click)="triggered.emit()"
    >
      <i [class]="iconClasses()" aria-hidden="true"></i>
    </button>
  `,
})
export class IconButtonComponent {
  /** Classe do PrimeIcon, ex.: `pi-pencil`. */
  readonly icon = input.required<string>();
  /** Rótulo acessível (aria-label). Inclua o identificador da linha. */
  readonly accessibleName = input.required<string>();
  /** Texto curto da dica; vazio usa o `accessibleName`. */
  readonly tooltip = input<string>('');
  readonly tooltipPosition = input<UiTooltipPosition>('left');
  /** Variante destrutiva (remover, inativar). */
  readonly danger = input<boolean>(false);
  readonly isDisabled = input<boolean>(false);
  readonly triggered = output<void>();

  protected readonly iconClasses = computed(() => `pi ${this.icon()}`);
}
