import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { TipoEtapaDto } from '@uniplus/shared-data/configuracao';
import {
  EmptyStateComponent,
  FilterBarComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { devolverFocoDaLista } from '../../shared/foco';
import type { AndamentoDaEscrita } from '../../shared/escrita';

@Component({
  selector: 'cfg-tipos-etapa-lista',
  standalone: true,
  imports: [
    EmptyStateComponent,
    FilterBarComponent,
    IconButtonComponent,
    PagerComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipos-etapa-lista.component.html',
})
export class TiposEtapaListaComponent {
  readonly tipos = input.required<readonly TipoEtapaDto[]>();
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
  readonly editar = output<TipoEtapaDto>();
  readonly remover = output<TipoEtapaDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected readonly indisponivel = computed(() => this.carregando() || this.gravando());

  private readonly foco = devolverFocoDaLista({
    gravando: this.gravando,
    carregando: this.carregando,
    atributoDaLinha: 'data-tipo-etapa-id',
    idDoTitulo: 'cfg-tipos-etapa-list-title',
    idDoCadastro: 'cfg-tipos-etapa-novo',
  });

  protected acionarCadastro(): void {
    if (this.indisponivel()) return;
    this.foco.registrar(null);
    this.cadastrar.emit();
  }

  protected acionarEditar(tipo: TipoEtapaDto): void {
    this.foco.registrar({ acao: 'editar', id: tipo.id });
    this.editar.emit(tipo);
  }

  /** O nome começa por "Remover ": é o prefixo que a devolução de foco procura na linha. */
  protected acionarRemover(tipo: TipoEtapaDto): void {
    this.foco.registrar({ acao: 'remover', id: tipo.id });
    this.remover.emit(tipo);
  }

  protected resumoDoQueAdmite(tipo: TipoEtapaDto): string {
    if (tipo.admitePontuacao && tipo.admiteEliminacao) return 'Compor a nota final e eliminar';
    return tipo.admitePontuacao ? 'Só compor a nota final' : 'Só eliminar';
  }
}
