import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { TipoDeficienciaDto } from '@uniplus/shared-data/configuracao';
import { EmptyStateComponent, PagerComponent } from '@uniplus/shared-ui/components';

@Component({
  selector: 'cfg-tipos-deficiencia-lista',
  imports: [EmptyStateComponent, PagerComponent],
  templateUrl: './tipos-deficiencia-lista.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TiposDeficienciaListaComponent {
  readonly tipos = input.required<readonly TipoDeficienciaDto[]>();
  readonly carregando = input.required<boolean>();
  readonly ocupado = input.required<boolean>();
  readonly erro = input.required<string | null>();
  readonly temFiltro = input.required<boolean>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly idEmAndamento = input.required<string | null>();
  readonly rotuloEmAndamento = input.required<string>();
  readonly termoBusca = model.required<string>();
  readonly novo = output<void>();
  readonly editar = output<TipoDeficienciaDto>();
  readonly remover = output<TipoDeficienciaDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected buscar(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    if (this.ocupado()) campo.value = this.termoBusca();
    else this.termoBusca.set(campo.value);
  }
  protected limpar(): void {
    if (!this.ocupado()) this.termoBusca.set('');
  }
  protected cadastrar(): void {
    if (!this.ocupado()) this.novo.emit();
  }
  protected editarTipo(tipo: TipoDeficienciaDto): void {
    if (!this.ocupado()) this.editar.emit(tipo);
  }
  protected removerTipo(tipo: TipoDeficienciaDto): void {
    if (!this.ocupado()) this.remover.emit(tipo);
  }
}
