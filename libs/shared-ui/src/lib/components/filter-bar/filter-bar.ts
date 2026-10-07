import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';

/** Um filtro ativo, como o resumo do bloco recolhido o mostra: o nome do filtro e o valor escolhido. */
export interface UiFiltroAtivo {
  readonly nome: string;
  readonly valor: string;
}

/** Quantas etiquetas de filtro ativo o bloco recolhido mostra antes do "+N". */
const ETIQUETAS_VISIVEIS = 2;

let sementeDaBarra = 0;

/**
 * A barra de filtros das listas: a busca sempre à vista e, quando a tela informa os filtros ativos
 * (`filtrosAtivos`), os filtros por categoria num bloco "Filtros" recolhível, que chega fechado e
 * mostra no título os ativos — nome e valor, até dois, e "+N" para os demais. Sem `filtrosAtivos`, os
 * filtros por categoria ficam sempre abertos, como antes.
 */
@Component({
  selector: 'ui-filter-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="filter-bar" role="search" [attr.aria-label]="ariaLabel()">
      <div class="filter-bar__row">
        <div class="input-group">
          <span class="input-group__addon" aria-hidden="true">
            <i class="pi pi-search"></i>
          </span>
          <input
            type="search"
            class="input"
            [placeholder]="searchPlaceholder()"
            [attr.aria-label]="searchAriaLabel() || null"
            [value]="searchValue()"
            (input)="searchValue.set($any($event.target).value)"
          />
        </div>
        <ng-content select="[uiFilterBarActions]" />
      </div>
      @if (recolhivel()) {
        <button
          type="button"
          class="filter-bar__alternar"
          [attr.aria-expanded]="aberto()"
          [attr.aria-controls]="grupoId"
          [attr.aria-label]="rotuloDoAlternar()"
          (click)="aberto.set(!aberto())"
        >
          <span class="filter-bar__seta" aria-hidden="true"></span>
          <span class="filter-bar__titulo">Filtros</span>
          @if (!aberto()) {
            @for (filtro of visiveis(); track filtro.nome) {
              <span class="tag tag--info filter-bar__ativo" aria-hidden="true"
                >{{ filtro.nome }}: {{ filtro.valor }}</span
              >
            }
            @if (excedentes() > 0) {
              <span class="tag filter-bar__ativo" aria-hidden="true">+{{ excedentes() }}</span>
            }
          }
        </button>
      }
      <div
        class="filter-bar__group"
        [id]="grupoId"
        [hidden]="recolhivel() && !aberto()"
        [attr.role]="secondaryRole() || null"
        [attr.aria-label]="secondaryAriaLabel() || null"
      >
        <ng-content select="[uiFilterBarSecondary]" />
      </div>
    </div>
  `,
})
export class FilterBarComponent {
  readonly ariaLabel = input.required<string>();
  readonly searchPlaceholder = input<string>('Buscar...');
  readonly searchAriaLabel = input<string>('');
  readonly searchValue = model<string>('');

  readonly secondaryRole = input<string>();
  readonly secondaryAriaLabel = input<string>();
  /**
   * Os filtros por categoria fora do valor padrão. Informá-los torna os filtros recolhíveis; a tela
   * só lista os que restringem a lista ("Todas" não entra).
   */
  readonly filtrosAtivos = input<readonly UiFiltroAtivo[] | undefined>(undefined);

  protected readonly grupoId = `ui-filter-bar-${(sementeDaBarra += 1)}-filtros`;
  protected readonly aberto = signal(false);
  protected readonly recolhivel = computed(() => this.filtrosAtivos() !== undefined);
  protected readonly visiveis = computed(() =>
    (this.filtrosAtivos() ?? []).slice(0, ETIQUETAS_VISIVEIS),
  );
  protected readonly excedentes = computed(() =>
    Math.max(0, (this.filtrosAtivos() ?? []).length - ETIQUETAS_VISIVEIS),
  );
  /** O que o leitor de tela ouve: o resumo inteiro, inclusive o que ficou no "+N". */
  protected readonly rotuloDoAlternar = computed(() => {
    const ativos = this.filtrosAtivos() ?? [];
    if (ativos.length === 0) return 'Filtros, nenhum ativo';
    const lista = ativos.map((f) => `${f.nome} ${f.valor}`).join(', ');
    return `Filtros, ${ativos.length === 1 ? '1 ativo' : `${ativos.length} ativos`}: ${lista}`;
  });
}
