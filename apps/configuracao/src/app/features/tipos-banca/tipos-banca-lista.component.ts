import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { TipoBancaDto } from '@uniplus/shared-data/configuracao';
import {
  EmptyStateComponent,
  FilterBarComponent,
  PagerComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
@Component({
  selector: 'cfg-tipos-banca-lista',
  standalone: true,
  imports: [EmptyStateComponent, FilterBarComponent, PagerComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipos-banca-lista.component.html',
})
export class TiposBancaListaComponent {
  readonly bancas = input.required<readonly TipoBancaDto[]>();
  readonly carregando = input.required<boolean>();
  readonly erro = input.required<string | null>();
  readonly removendo = input.required<boolean>();
  readonly anuncioDaRemocao = input.required<string>();
  readonly temFiltro = input.required<boolean>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly termoBusca = model.required<string>();
  readonly editar = output<TipoBancaDto>();
  readonly remover = output<TipoBancaDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected acionarEdicao(banca: TipoBancaDto): void {
    if (!this.carregando() && !this.removendo()) this.editar.emit(banca);
  }

  protected acionarRemocao(banca: TipoBancaDto): void {
    if (!this.carregando() && !this.removendo()) this.remover.emit(banca);
  }
}
