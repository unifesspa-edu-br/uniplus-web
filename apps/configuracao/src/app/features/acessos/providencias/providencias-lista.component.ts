import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  SituacaoDaProvidenciaCodigo,
  ProvidenciaResumoDto,
} from '@uniplus/shared-data/autorizacao';
import {
  EmptyStateComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
  TagDoCodigoComponent,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { autorDoEvento } from '../trilha-de-acesso.component';
import { FILTROS_DA_FILA, VARIANTES_DA_SITUACAO } from './rotulos-da-providencia';

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
    TagDoCodigoComponent,
    DateBrPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './providencias-lista.component.html',
})
export class ProvidenciasListaComponent {
  readonly providencias = input.required<readonly ProvidenciaResumoDto[]>();
  readonly carregando = input.required<boolean>();
  readonly erro = input.required<string | null>();
  readonly situacao = input.required<SituacaoDaProvidenciaCodigo | 'todas'>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly filtrar = output<SituacaoDaProvidenciaCodigo | 'todas'>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected readonly filtros = FILTROS_DA_FILA;
  protected readonly variantes = VARIANTES_DA_SITUACAO;
  protected readonly pessoa = autorDoEvento;
}
