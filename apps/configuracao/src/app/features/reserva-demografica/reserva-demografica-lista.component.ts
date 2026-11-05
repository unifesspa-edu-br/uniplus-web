import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ReferenciaReservaDemograficaDto } from '@uniplus/shared-data/configuracao';
import {
  EmptyStateComponent,
  PagerComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';

@Component({
  selector: 'cfg-reserva-demografica-lista',
  standalone: true,
  imports: [EmptyStateComponent, PagerComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reserva-demografica-lista.component.html',
})
export class ReservaDemograficaListaComponent {
  readonly referenciasFiltradas = input.required<readonly ReferenciaReservaDemograficaDto[]>();
  readonly busca = input.required<string>();
  readonly loading = input.required<boolean>();
  readonly bloqueado = input.required<boolean>();
  readonly errorMessage = input.required<string | null>();
  readonly prevCursor = input.required<unknown | null>();
  readonly nextCursor = input.required<unknown | null>();
  readonly idAfetado = input<string | null>(null);
  readonly andamento = input('');
  readonly alterarBusca = output<string>();
  readonly cadastrar = output<void>();
  readonly editar = output<ReferenciaReservaDemograficaDto>();
  readonly remover = output<ReferenciaReservaDemograficaDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();
  protected mudarBusca(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    if (this.bloqueado()) {
      campo.value = this.busca();
      return;
    }
    this.alterarBusca.emit(campo.value);
  }
  protected pct(valor: number): string {
    return Number.isFinite(valor) ? valor.toFixed(2) : String(valor);
  }
}
