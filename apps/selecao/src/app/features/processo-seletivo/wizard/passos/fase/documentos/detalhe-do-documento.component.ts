import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ValorEmConsultaComponent } from '@uniplus/shared-ui/components';

import type { DetalheLidoDoDocumento } from '../tipos-da-conferencia';

/** O que a consulta lê de um documento além do que a linha resume. */
@Component({
  selector: 'tr[selDetalheDoDocumento]',
  imports: [ValorEmConsultaComponent],
  templateUrl: './detalhe-do-documento.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalheDoDocumentoComponent {
  readonly detalhe = input.required<DetalheLidoDoDocumento>();
  readonly nomeDoDocumento = input.required<string>();
  readonly colunas = input.required<number>();
}
