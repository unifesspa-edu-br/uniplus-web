import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import type { UnidadeDto } from '@uniplus/shared-data/organizacao';
import {
  EmptyStateComponent,
  PagerComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { NoDaArvore } from './arvore-de-unidades';
import { limparBusca } from './busca-de-unidades';
import { UnidadesArvoreComponent } from './unidades-arvore.component';
import { UnidadesFiltrosComponent } from './unidades-filtros.component';

/** O painel com a busca, o filtro por tipo, a árvore de unidades, o estado vazio e a paginação. */
@Component({
  selector: 'cfg-unidades-lista',
  imports: [
    EmptyStateComponent,
    PagerComponent,
    SpinnerComponent,
    UnidadesArvoreComponent,
    UnidadesFiltrosComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './unidades-lista.component.html',
})
export class UnidadesListaComponent {
  readonly arvore = input.required<readonly NoDaArvore[]>();
  readonly carregando = input.required<boolean>();
  /** Há escrita em curso, ou a recarga que a segue ainda não terminou. */
  readonly gravando = input.required<boolean>();
  readonly removendo = input.required<boolean>();
  readonly erro = input.required<string | null>();
  readonly temFiltro = input.required<boolean>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly termoBusca = model.required<string>();
  readonly tipoFiltro = model.required<string>();

  readonly cadastrar = output<void>();
  readonly detalhar = output<UnidadeDto>();
  readonly editar = output<UnidadeDto>();
  readonly remover = output<UnidadeDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected readonly indisponivel = computed(() => this.carregando() || this.gravando());

  protected acionarCadastro(): void {
    if (this.indisponivel()) return;
    this.cadastrar.emit();
  }

  protected limparFiltros(): void {
    limparBusca(this.termoBusca, this.tipoFiltro);
  }
}
