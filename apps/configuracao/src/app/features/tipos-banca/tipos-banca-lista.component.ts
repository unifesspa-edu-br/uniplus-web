import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { TipoBancaDto } from '@uniplus/shared-data/configuracao';
import {
  EmptyStateComponent,
  FilterBarComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { devolverFocoDaLista } from '../../shared/foco';

type Acao = 'editar' | 'remover';

@Component({
  selector: 'cfg-tipos-banca-lista',
  standalone: true,
  imports: [
    EmptyStateComponent,
    FilterBarComponent,
    IconButtonComponent,
    PagerComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipos-banca-lista.component.html',
})
export class TiposBancaListaComponent {
  readonly bancas = input.required<readonly TipoBancaDto[]>();
  readonly carregando = input.required<boolean>();
  readonly erro = input.required<string | null>();
  readonly gravando = input.required<boolean>();
  readonly removendo = input.required<boolean>();
  readonly temFiltro = input.required<boolean>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly termoBusca = model.required<string>();
  readonly editar = output<TipoBancaDto>();
  readonly remover = output<TipoBancaDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected readonly indisponivel = computed(() => this.carregando() || this.gravando());

  private readonly foco = devolverFocoDaLista({
    gravando: this.gravando,
    carregando: this.carregando,
    atributoDaLinha: 'data-tipo-banca-id',
    idDoTitulo: 'cfg-tipos-banca-list-title',
  });

  protected acionar(acao: Acao, banca: TipoBancaDto): void {
    if (this.indisponivel()) return;
    this.foco.registrar({ acao, id: banca.id });
    (acao === 'editar' ? this.editar : this.remover).emit(banca);
  }

  protected nomeDaAcao(acao: Acao, codigo: string): string {
    return `${acao === 'editar' ? 'Editar' : 'Remover'} tipo de banca ${codigo}`;
  }
}
