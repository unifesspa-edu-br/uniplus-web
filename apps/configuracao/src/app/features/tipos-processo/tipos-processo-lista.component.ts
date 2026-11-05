import {
  ChangeDetectionStrategy,
  Component,
  input,
  model,
  output,
  OutputEmitterRef,
} from '@angular/core';
import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import { TemPermissaoDirective } from '@uniplus/shared-auth/components';
import { TipoProcessoDto } from '@uniplus/shared-data/configuracao';
import {
  EmptyStateComponent,
  FilterBarComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';

@Component({
  selector: 'cfg-tipos-processo-lista',
  imports: [
    TemPermissaoDirective,
    EmptyStateComponent,
    FilterBarComponent,
    IconButtonComponent,
    PagerComponent,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipos-processo-lista.component.html',
})
export class TiposProcessoListaComponent {
  readonly tipos = input.required<readonly TipoProcessoDto[]>();
  readonly carregando = input.required<boolean>();
  readonly ocupada = input.required<boolean>();
  readonly rotuloEmAndamento = input.required<string>();
  readonly erro = input.required<string | null>();
  readonly temFiltro = input.required<boolean>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly descricaoVazia = input.required<string>();
  readonly emAndamento = input.required<string | null>();
  readonly termoBusca = model('');
  readonly cadastrar = output<void>();
  readonly editar = output<TipoProcessoDto>();
  readonly remover = output<TipoProcessoDto>();
  readonly reativar = output<TipoProcessoDto>();
  readonly limpar = output<void>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();
  protected readonly permissaoDeManter = PERMISSAO.configuracao.tiposProcessoManter;
  protected acionar(saida: OutputEmitterRef<void>): void {
    if (!this.ocupada()) saida.emit();
  }
  protected acionarTipo(saida: OutputEmitterRef<TipoProcessoDto>, tipo: TipoProcessoDto): void {
    if (!this.ocupada()) saida.emit(tipo);
  }
}
