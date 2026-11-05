import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { EventoDaTrilhaDto, PedidoDeConcessaoDto } from '@uniplus/shared-data/autorizacao';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { autorDoEvento, TrilhaDeAcessoComponent } from './trilha-de-acesso.component';
import { etapa, motivoDaDispensa, sensibilidade, tipoDeEvento } from './rotulos-de-acesso';

@Component({
  selector: 'cfg-pedido-historico',
  standalone: true,
  imports: [DateBrPipe, TrilhaDeAcessoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pedido-historico.component.html',
  styleUrl: './pedido-historico.component.css',
})
export class PedidoHistoricoComponent {
  readonly pedido = input.required<PedidoDeConcessaoDto>();
  readonly trilha = input.required<readonly EventoDaTrilhaDto[]>();
  protected readonly etapaDe = etapa;
  protected readonly sensibilidadeDe = sensibilidade;
  protected readonly autorDe = autorDoEvento;
  protected readonly dispensaDe = motivoDaDispensa;
  protected readonly rotuloDaDecisao = tipoDeEvento;
}
