import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { BaseLegalDoFadaDto } from '@uniplus/shared-data/configuracao';
import {
  EmptyStateComponent,
  FilterBarComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { devolverFocoDaLista } from '../../shared/foco';

/** O painel com a busca, a tabela de bases legais, o estado vazio e a paginação. */
@Component({
  selector: 'cfg-base-legal-do-fada-lista',
  standalone: true,
  imports: [
    EmptyStateComponent,
    FilterBarComponent,
    IconButtonComponent,
    PagerComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './base-legal-do-fada-lista.component.html',
})
export class BaseLegalDoFadaListaComponent {
  readonly bases = input.required<readonly BaseLegalDoFadaDto[]>();
  readonly carregando = input.required<boolean>();
  /** Há escrita em curso, ou a recarga que a segue ainda não terminou. */
  readonly gravando = input.required<boolean>();
  readonly removendo = input.required<boolean>();
  readonly erro = input.required<string | null>();
  readonly temFiltro = input.required<boolean>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly termoBusca = model.required<string>();
  readonly cadastrar = output<void>();
  readonly editar = output<BaseLegalDoFadaDto>();
  readonly remover = output<BaseLegalDoFadaDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected readonly indisponivel = computed(() => this.carregando() || this.gravando());

  private readonly foco = devolverFocoDaLista({
    gravando: this.gravando,
    carregando: this.carregando,
    atributoDaLinha: 'data-base-legal-id',
    idDoTitulo: 'cfg-base-legal-list-title',
    idDoCadastro: 'cfg-base-legal-novo',
  });

  protected acionarCadastro(): void {
    if (this.indisponivel()) return;
    this.foco.registrar(null);
    this.cadastrar.emit();
  }

  protected acionarEditar(base: BaseLegalDoFadaDto): void {
    this.foco.registrar({ acao: 'editar', id: base.id });
    this.editar.emit(base);
  }

  /** O nome começa por "Remover ": é o prefixo que a devolução de foco procura na linha. */
  protected acionarRemover(base: BaseLegalDoFadaDto): void {
    this.foco.registrar({ acao: 'remover', id: base.id });
    this.remover.emit(base);
  }
}
