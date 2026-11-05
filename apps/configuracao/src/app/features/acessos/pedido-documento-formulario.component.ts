import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { FileUploadComponent } from '@uniplus/shared-ui/components';

@Component({
  selector: 'cfg-pedido-documento-formulario',
  standalone: true,
  imports: [FileUploadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pedido-documento-formulario.component.html',
  styleUrl: './pedido-documento-formulario.component.css',
})
export class PedidoDocumentoFormularioComponent {
  readonly exigeDocumento = input.required<boolean>();
  readonly desabilitado = input.required<boolean>();
  readonly erroDoDocumento = input.required<string | null>();
  readonly arquivo = model.required<File | null>();
}
