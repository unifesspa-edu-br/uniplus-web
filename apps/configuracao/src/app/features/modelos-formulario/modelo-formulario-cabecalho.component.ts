import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FINALIDADES, TagComponent } from '@uniplus/shared-ui/components';
import type { ModeloFormularioEdicaoStore } from './modelo-formulario-edicao.store';

/** O título do modelo aberto: nome, código, finalidade e situação. */
@Component({
  selector: 'cfg-modelo-formulario-cabecalho',
  imports: [RouterLink, TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modelo-formulario-cabecalho.component.html',
})
export class ModeloFormularioCabecalhoComponent {
  readonly modelo = input.required<ReturnType<ModeloFormularioEdicaoStore['modelo']>>();

  rotuloDaFinalidade(valor: string): string {
    return FINALIDADES.find((f) => f.valor === valor)?.rotulo ?? valor;
  }
}
