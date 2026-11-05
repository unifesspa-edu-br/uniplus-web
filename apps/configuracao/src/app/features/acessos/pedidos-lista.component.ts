import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { FilaDePedidos, PedidoResumoDto } from '@uniplus/shared-data/autorizacao';
import {
  EmptyStateComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { OPCOES_DE_SITUACAO_DO_PEDIDO, situacaoDoPedido } from './rotulos-de-acesso';

@Component({
  selector: 'cfg-pedidos-lista',
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
  templateUrl: './pedidos-lista.component.html',
})
export class PedidosListaComponent {
  readonly pedidos = input.required<readonly PedidoResumoDto[]>();
  readonly nomesDosEscopos = input.required<ReadonlyMap<string, string>>();
  readonly carregando = input.required<boolean>();
  readonly erro = input.required<string | null>();
  readonly situacao = input.required<string>();
  readonly titulo = input.required<string>();
  readonly vazio = input.required<string>();
  readonly filtraPorSituacao = input.required<boolean>();
  readonly origem = input.required<{ origem: FilaDePedidos } | null>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly filtrar = output<string>();
  readonly abrir = output<PedidoResumoDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();
  protected readonly situacoes = OPCOES_DE_SITUACAO_DO_PEDIDO;
  protected readonly rotulo = situacaoDoPedido;

  protected abrirPedido(pedido: PedidoResumoDto): void {
    if (!this.carregando()) this.abrir.emit(pedido);
  }

  protected abrirPeloTeclado(pedido: PedidoResumoDto, evento: Event): void {
    if (evento.target !== evento.currentTarget) return;
    evento.preventDefault();
    this.abrirPedido(pedido);
  }
}
