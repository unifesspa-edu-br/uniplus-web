import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RecursoAcessibilidadeDto } from '@uniplus/shared-data/configuracao';
import { EmptyStateComponent, PagerComponent } from '@uniplus/shared-ui/components';

@Component({
  selector: 'cfg-recursos-acessibilidade-lista',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyStateComponent, PagerComponent],
  templateUrl: './recursos-acessibilidade-lista.component.html',
})
export class RecursosAcessibilidadeListaComponent {
  readonly recursosFiltrados = input.required<readonly RecursoAcessibilidadeDto[]>();
  readonly termoBusca = input.required<string>();
  readonly loading = input.required<boolean>();
  readonly saving = input.required<boolean>();
  readonly removendo = input.required<boolean>();
  readonly recursoEmOperacaoId = input<string | null>(null);
  readonly errorMessage = input.required<string | null>();
  readonly prevCursor = input.required<boolean>();
  readonly nextCursor = input.required<boolean>();
  readonly buscaAlterada = output<string>();
  readonly cadastrar = output<void>();
  readonly editar = output<RecursoAcessibilidadeDto>();
  readonly remover = output<RecursoAcessibilidadeDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();
  protected readonly indisponivel = computed(() => this.loading() || this.saving());
  protected readonly temFiltro = computed(() => this.termoBusca().trim().length > 0);
  protected alterarBusca(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    if (this.indisponivel()) campo.value = this.termoBusca();
    else this.buscaAlterada.emit(campo.value);
  }
  protected limpar(): void {
    if (!this.indisponivel()) this.buscaAlterada.emit('');
  }
  protected cadastrarRecurso(): void {
    if (!this.indisponivel()) this.cadastrar.emit();
  }
  protected editarRecurso(recurso: RecursoAcessibilidadeDto): void {
    if (!this.indisponivel()) this.editar.emit(recurso);
  }
  protected removerRecurso(recurso: RecursoAcessibilidadeDto): void {
    if (!this.indisponivel()) this.remover.emit(recurso);
  }
}
