import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { ReferenciaReservaDemograficaDto } from '@uniplus/shared-data/configuracao';
import {
  EmptyStateComponent,
  FilterBarComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { devolverFocoDaLista } from '../../shared/foco';
import type { AndamentoDaEscrita } from '../../shared/escrita';

type Acao = 'editar' | 'remover';

const VERBO_DA_ACAO: Readonly<Record<Acao, string>> = { editar: 'Editar', remover: 'Remover' };

@Component({
  selector: 'cfg-reserva-demografica-lista',
  standalone: true,
  imports: [
    EmptyStateComponent,
    FilterBarComponent,
    IconButtonComponent,
    PagerComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reserva-demografica-lista.component.html',
})
export class ReservaDemograficaListaComponent {
  readonly referencias = input.required<readonly ReferenciaReservaDemograficaDto[]>();
  readonly carregando = input.required<boolean>();
  readonly gravando = input.required<boolean>();
  readonly removendo = input.required<boolean>();
  readonly andamento = input.required<AndamentoDaEscrita | null>();
  readonly erro = input.required<string | null>();
  readonly temFiltro = input.required<boolean>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly termoBusca = model.required<string>();
  readonly cadastrar = output<void>();
  readonly editar = output<ReferenciaReservaDemograficaDto>();
  readonly remover = output<ReferenciaReservaDemograficaDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected readonly indisponivel = computed(() => this.carregando() || this.gravando());

  private readonly foco = devolverFocoDaLista({
    gravando: this.gravando,
    carregando: this.carregando,
    atributoDaLinha: 'data-referencia-id',
    idDoTitulo: 'cfg-reserva-list-title',
    idDoCadastro: 'cfg-reserva-novo',
  });

  protected acionarCadastro(): void {
    this.foco.registrar(null);
    this.cadastrar.emit();
  }

  protected acionar(acao: Acao, referencia: ReferenciaReservaDemograficaDto): void {
    this.foco.registrar({ acao, id: referencia.id });
    (acao === 'editar' ? this.editar : this.remover).emit(referencia);
  }

  protected nomeDaAcao(acao: Acao, censo: string): string {
    return `${VERBO_DA_ACAO[acao]} reserva demográfica do censo ${censo}`;
  }

  protected percentual(valor: number): string {
    return Number.isFinite(valor) ? valor.toFixed(2) : String(valor);
  }
}
