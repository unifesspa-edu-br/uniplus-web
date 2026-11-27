import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TagComponent } from '@uniplus/shared-ui/components';
import type { ModeloFormularioEdicaoStore } from './modelo-formulario-edicao.store';

/** O título do modelo aberto: nome, código, uso na fase de inscrição e situação. */
@Component({
  selector: 'cfg-modelo-formulario-cabecalho',
  imports: [RouterLink, TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modelo-formulario-cabecalho.component.html',
})
export class ModeloFormularioCabecalhoComponent {
  readonly modelo = input.required<ReturnType<ModeloFormularioEdicaoStore['modelo']>>();
}
