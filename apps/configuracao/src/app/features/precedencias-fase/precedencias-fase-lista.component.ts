import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { PrecedenciaFaseDto } from '@uniplus/shared-data/configuracao';
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
  selector: 'cfg-precedencias-fase-lista',
  standalone: true,
  imports: [
    EmptyStateComponent,
    FilterBarComponent,
    IconButtonComponent,
    PagerComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './precedencias-fase-lista.component.html',
})
export class PrecedenciasFaseListaComponent {
  readonly arestas = input.required<readonly PrecedenciaFaseDto[]>();
  /** O nome de cada fase pelo código; vazio quando o cadastro de fases não está disponível. */
  readonly nomesDasFases = input.required<ReadonlyMap<string, string>>();
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
  readonly editar = output<PrecedenciaFaseDto>();
  readonly remover = output<PrecedenciaFaseDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected readonly indisponivel = computed(() => this.carregando() || this.gravando());

  private readonly foco = devolverFocoDaLista({
    gravando: this.gravando,
    carregando: this.carregando,
    atributoDaLinha: 'data-aresta-id',
    idDoTitulo: 'cfg-precedencias-fase-list-title',
    idDoCadastro: 'cfg-precedencias-fase-nova',
  });

  protected acionarCadastro(): void {
    if (this.indisponivel()) return;
    this.foco.registrar(null);
    this.cadastrar.emit();
  }

  protected acionarEditar(aresta: PrecedenciaFaseDto): void {
    this.foco.registrar({ acao: 'editar', id: aresta.id });
    this.editar.emit(aresta);
  }

  /** O nome começa por "Remover ": é o prefixo que a devolução de foco procura na linha. */
  protected acionarRemover(aresta: PrecedenciaFaseDto): void {
    this.foco.registrar({ acao: 'remover', id: aresta.id });
    this.remover.emit(aresta);
  }

  protected nomeDaFase(codigo: string): string {
    return this.nomesDasFases().get(codigo) ?? '';
  }
}
