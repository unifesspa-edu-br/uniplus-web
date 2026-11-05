import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { PerfilDto } from '@uniplus/shared-data/autorizacao';
import {
  EmptyStateComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { sensibilidade } from './rotulos-de-acesso';

@Component({
  selector: 'cfg-perfis-lista',
  standalone: true,
  imports: [
    EmptyStateComponent,
    IconButtonComponent,
    PagerComponent,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './perfis-lista.component.html',
})
export class PerfisListaComponent {
  readonly perfis = input.required<readonly PerfilDto[]>();
  readonly carregando = input.required<boolean>();
  readonly erro = input.required<string | null>();
  readonly gravando = input.required<boolean>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly editar = output<PerfilDto>();
  readonly alternarAtivacao = output<PerfilDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();
  protected readonly sensibilidadeDe = sensibilidade;
}
