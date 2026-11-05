import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { PedidoDeConcessaoDto } from '@uniplus/shared-data/autorizacao';
import { FileUploadComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { situacaoDoAnexo } from './rotulos-de-acesso';

@Component({
  selector: 'cfg-pedido-documentos',
  standalone: true,
  imports: [FileUploadComponent, SpinnerComponent, DateBrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pedido-documentos.component.html',
})
export class PedidoDocumentosComponent {
  readonly pedido = input.required<PedidoDeConcessaoDto>();
  readonly podeAnexar = input.required<boolean>();
  readonly anexando = input.required<boolean>();
  readonly erroDoAnexo = input.required<string | null>();
  readonly abrir = output<string>();
  readonly arquivoSelecionado = output<File | null>();
  protected readonly rotuloDoAnexo = situacaoDoAnexo;
}
