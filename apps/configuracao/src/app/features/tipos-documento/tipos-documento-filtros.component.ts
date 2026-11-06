import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import {
  FilterBarComponent,
  FilterChipsComponent,
  type UiFilterChipOption,
  type UiFiltroAtivo,
} from '@uniplus/shared-ui/components';

/** A busca por código ou nome e o filtro por categoria da lista de tipos de documento. */
@Component({
  selector: 'cfg-tipos-documento-filtros',
  imports: [FilterBarComponent, FilterChipsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-filtros' },
  template: `
    <ui-filter-bar
      [attr.inert]="inerte() ? '' : null"
      [filtrosAtivos]="filtrosAtivos()"
      ariaLabel="Filtrar tipos de documento"
      searchPlaceholder="Buscar por código ou nome…"
      searchAriaLabel="Buscar tipo de documento"
      [(searchValue)]="termoBusca"
    >
      <ng-container uiFilterBarSecondary>
        <span class="u-eyebrow">Categoria</span>
        <ui-filter-chips
          [options]="categorias()"
          [(selected)]="categoria"
          ariaLabel="Filtrar por categoria"
        />
      </ng-container>
    </ui-filter-bar>
  `,
})
export class TiposDocumentoFiltrosComponent {
  readonly categorias = input.required<readonly UiFilterChipOption[]>();
  readonly filtrosAtivos = input.required<readonly UiFiltroAtivo[]>();
  /** Enquanto uma escrita corre, a barra não recebe ação. */
  readonly inerte = input.required<boolean>();
  readonly termoBusca = model.required<string>();
  readonly categoria = model.required<string>();
}
