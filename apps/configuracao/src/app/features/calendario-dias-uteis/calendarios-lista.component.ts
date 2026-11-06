import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CalendarioDiasUteisResumoDto } from '@uniplus/shared-data/configuracao';
import {
  EmptyStateComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { devolverFocoDaLista } from '../../shared/foco';
import type { AndamentoDaEscrita } from './edicao-dos-calendarios';

@Component({
  selector: 'cfg-calendarios-lista',
  standalone: true,
  imports: [
    RouterLink,
    DateBrPipe,
    EmptyStateComponent,
    IconButtonComponent,
    PagerComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendarios-lista.component.html',
})
export class CalendariosListaComponent {
  readonly calendarios = input.required<readonly CalendarioDiasUteisResumoDto[]>();
  readonly carregando = input.required<boolean>();
  readonly gravando = input.required<boolean>();
  readonly removendo = input.required<boolean>();
  readonly andamento = input.required<AndamentoDaEscrita | null>();
  readonly erro = input.required<string | null>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly remover = output<CalendarioDiasUteisResumoDto>();
  readonly marcarVigente = output<CalendarioDiasUteisResumoDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected readonly indisponivel = computed(() => this.carregando() || this.gravando());
  protected readonly dicaDoVigente = 'Marque outro dataset como vigente';
  protected readonly dicaDaRemocaoDoVigente =
    'Marque outro dataset como vigente antes de remover este';

  private readonly foco = devolverFocoDaLista({
    gravando: this.gravando,
    carregando: this.carregando,
    atributoDaLinha: 'data-calendario-id',
    idDoTitulo: 'cfg-calendario-dias-uteis-list-title',
  });

  protected acionarRemover(calendario: CalendarioDiasUteisResumoDto): void {
    this.foco.registrar({ acao: 'remover', id: calendario.id });
    this.remover.emit(calendario);
  }

  /** O nome da ação não começa por "Ativar " nem "Desativar ": a devolução de foco leva ao título. */
  protected acionarMarcarVigente(calendario: CalendarioDiasUteisResumoDto): void {
    this.foco.registrar({ acao: 'situacao', id: calendario.id });
    this.marcarVigente.emit(calendario);
  }

  /** O link indisponível não navega, mas segue focável, como o botão de ícone. */
  protected recusarSeIndisponivel(evento: Event): void {
    if (this.gravando()) {
      evento.preventDefault();
    }
  }
}
