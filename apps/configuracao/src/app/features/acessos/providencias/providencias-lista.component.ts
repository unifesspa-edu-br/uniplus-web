import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  FiltroDaSituacaoDaProvidencia,
  ProvidenciaResumoDto,
} from '@uniplus/shared-data/autorizacao';
import {
  EmptyStateComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { autorDoEvento } from '../trilha-de-acesso.component';
import {
  FILTROS_DA_FILA,
  situacaoDaProvidencia,
  tipoDaProvidencia,
} from './rotulos-da-providencia';

/** A fila das providências: a mais antiga primeiro, sem o fundamento, que só sai no detalhe. */
@Component({
  selector: 'cfg-providencias-lista',
  standalone: true,
  imports: [
    FormsModule,
    EmptyStateComponent,
    IconButtonComponent,
    PagerComponent,
    SpinnerComponent,
    TagComponent,
    DateBrPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './providencias-lista.component.html',
})
export class ProvidenciasListaComponent {
  readonly providencias = input.required<readonly ProvidenciaResumoDto[]>();
  readonly carregando = input.required<boolean>();
  readonly erro = input.required<string | null>();
  readonly situacao = input.required<FiltroDaSituacaoDaProvidencia>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly filtrar = output<FiltroDaSituacaoDaProvidencia>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected readonly filtros = FILTROS_DA_FILA;
  protected readonly situacaoDe = situacaoDaProvidencia;
  protected readonly tipoDe = tipoDaProvidencia;
  protected readonly pessoa = autorDoEvento;
}
