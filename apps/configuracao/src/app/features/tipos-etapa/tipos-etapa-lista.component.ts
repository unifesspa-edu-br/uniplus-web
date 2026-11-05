import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TipoEtapaDto } from '@uniplus/shared-data/configuracao';
import {
  EmptyStateComponent,
  PagerComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';

@Component({
  selector: 'cfg-tipos-etapa-lista',
  standalone: true,
  imports: [EmptyStateComponent, PagerComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipos-etapa-lista.component.html',
})
export class TiposEtapaListaComponent {
  readonly tipos = input.required<readonly TipoEtapaDto[]>();
  readonly carregando = input.required<boolean>();
  readonly indisponivel = input.required<boolean>();
  readonly erro = input.required<string | null>();
  readonly temFiltro = input.required<boolean>();
  readonly termoBusca = input.required<string>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly idEmAndamento = input.required<string | null>();
  readonly rotuloAndamento = input.required<string>();
  readonly buscaAlterada = output<string>();
  readonly cadastrar = output<void>();
  readonly editar = output<TipoEtapaDto>();
  readonly remover = output<TipoEtapaDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();
  protected readonly bloqueado = computed(() => this.carregando() || this.indisponivel());
  protected aoBuscar(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    if (this.bloqueado()) {
      campo.value = this.termoBusca();
      return;
    }
    this.alterarBusca(campo.value);
  }
  protected alterarBusca(valor: string): void {
    if (!this.bloqueado()) this.buscaAlterada.emit(valor);
  }
  protected limpar(): void {
    this.alterarBusca('');
  }
  protected acionarCadastro(): void {
    if (!this.bloqueado()) this.cadastrar.emit();
  }
  protected acionarEditar(tipo: TipoEtapaDto): void {
    if (!this.bloqueado()) this.editar.emit(tipo);
  }
  protected acionarRemover(tipo: TipoEtapaDto): void {
    if (!this.bloqueado()) this.remover.emit(tipo);
  }
  protected acionarAnterior(): void {
    if (!this.bloqueado()) this.anterior.emit();
  }
  protected acionarProximo(): void {
    if (!this.bloqueado()) this.proximo.emit();
  }
  protected resumoDoQueAdmite(tipo: TipoEtapaDto): string {
    if (tipo.admitePontuacao && tipo.admiteEliminacao) return 'Compor a nota final e eliminar';
    return tipo.admitePontuacao ? 'Só compor a nota final' : 'Só eliminar';
  }
}
