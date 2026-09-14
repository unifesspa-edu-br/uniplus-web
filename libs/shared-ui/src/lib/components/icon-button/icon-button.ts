import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

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
 *
 * `description` adiciona um motivo lido via `aria-describedby` (ex.: por que
 * a ação está desabilitada) — sem ele, um motivo condicional só visível no
 * `tooltip` não chega à árvore de acessibilidade (o `[data-tooltip]` é
 * `content` gerado por CSS).
 *
 * `link` troca o `<button>` por `<a [routerLink]>`: use para ações de
 * navegação (ex.: "Editar" que abre outra rota) — preserva abrir em nova
 * aba, "Copiar endereço do link" e o papel `link` no leitor de tela, que um
 * `<button>` + `Router.navigate` não tem. Nesse modo `isDisabled` e
 * `triggered` não se aplicam (a navegação é feita pelo próprio `routerLink`).
 */
@Component({
  selector: 'ui-icon-button',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (link(); as destino) {
      <a
        class="btn btn--sm btn--rect btn--icon-only"
        [class.btn--tertiary]="!danger()"
        [class.btn--danger]="danger()"
        [routerLink]="destino"
        [attr.aria-label]="accessibleName()"
        [attr.aria-describedby]="description() ? descriptionId : null"
        [attr.data-tooltip]="tooltip() || accessibleName()"
        [attr.data-tooltip-position]="tooltipPosition()"
      >
        <i [class]="iconClasses()" aria-hidden="true"></i>
      </a>
    } @else {
      <button
        type="button"
        class="btn btn--sm btn--rect btn--icon-only"
        [class.btn--tertiary]="!danger()"
        [class.btn--danger]="danger()"
        [attr.aria-label]="accessibleName()"
        [attr.aria-describedby]="description() ? descriptionId : null"
        [attr.data-tooltip]="tooltip() || accessibleName()"
        [attr.data-tooltip-position]="tooltipPosition()"
        [disabled]="isDisabled()"
        (click)="triggered.emit()"
      >
        <i [class]="iconClasses()" aria-hidden="true"></i>
      </button>
    }
    @if (description(); as texto) {
      <span class="sr-only" [id]="descriptionId">{{ texto }}</span>
    }
  `,
})
export class IconButtonComponent {
  private static idSeed = 0;

  /** Classe do PrimeIcon, ex.: `pi-pencil`. */
  readonly icon = input.required<string>();
  /** Rótulo acessível (aria-label). Inclua o identificador da linha. */
  readonly accessibleName = input.required<string>();
  /** Texto curto da dica; vazio usa o `accessibleName`. */
  readonly tooltip = input<string>('');
  readonly tooltipPosition = input<UiTooltipPosition>('left');
  /**
   * Motivo lido via `aria-describedby` (ex.: por que a ação está
   * desabilitada). Vazio não renderiza nada.
   */
  readonly description = input<string>('');
  /**
   * Variante destrutiva. Disponível para uso fora de célula de tabela; nas
   * células de "Ações" o padrão do repo mantém `tertiary` mesmo em
   * remover/inativar — o glifo (`pi-trash`/`pi-power-off`) já diferencia a
   * ação, e pintar a linha inteira de vermelho polui a tabela.
   */
  readonly danger = input<boolean>(false);
  readonly isDisabled = input<boolean>(false);
  /** Destino do `routerLink`; quando definido, renderiza `<a>` em vez de `<button>`. */
  readonly link = input<unknown[] | string | undefined>(undefined);
  readonly triggered = output<void>();

  protected readonly iconClasses = computed(() => `pi ${this.icon()}`);
  protected readonly descriptionId = `ui-icon-button-desc-${++IconButtonComponent.idSeed}`;
}
