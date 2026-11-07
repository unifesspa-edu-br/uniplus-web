import { Injectable, computed, inject, linkedSignal, signal } from '@angular/core';
import { ProblemI18nService, useApiResource, withVendorMime } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AUTORIZACAO_BASE_PATH,
  type EventoDaTrilhaDto,
  type PedidoDeConcessaoDto,
} from '@uniplus/shared-data/autorizacao';
import { desfechoDaLeitura } from './desfecho-da-leitura';
import { notificarFalhasDeLeitura } from './falha-de-servidor';

@Injectable()
export class PedidoDetalheStore {
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  readonly id = signal<string | undefined>(undefined);
  private readonly pedidoResource = useApiResource<PedidoDeConcessaoDto>(() => {
    const id = this.id();
    return id === undefined
      ? undefined
      : {
          url: `${this.basePath}/api/autorizacao/pedidos-de-concessao/${encodeURIComponent(id)}`,
          context: withVendorMime('pedido-de-concessao', 1),
        };
  });
  private readonly trilhaResource = useApiResource<readonly EventoDaTrilhaDto[]>(() => {
    const id = this.id();
    return id === undefined
      ? undefined
      : {
          url: `${this.basePath}/api/autorizacao/pedidos-de-concessao/${encodeURIComponent(id)}/trilha`,
          context: withVendorMime('trilha-do-pedido', 1),
        };
  });
  readonly pedido = linkedSignal(() => this.pedidoResource.data());

  constructor() {
    notificarFalhasDeLeitura(this.problemas, this.notificacoes, [
      this.pedidoResource.problem,
      this.trilhaResource.problem,
    ]);
  }

  aplicarPedido(pedido: PedidoDeConcessaoDto): void {
    this.pedido.set(pedido);
  }
  readonly trilha = computed(() => this.trilhaResource.data() ?? []);
  readonly carregando = computed(
    () => this.pedidoResource.isLoading() || this.trilhaResource.isLoading(),
  );
  private readonly desfecho = desfechoDaLeitura(
    [this.pedidoResource, this.trilhaResource],
    this.problemas,
  );
  /** A falha de qualquer das duas leituras que uma nova tentativa pode resolver. */
  readonly falha = this.desfecho.falha;
  readonly recusa = this.desfecho.recusa;
  private readonly desfechoDoPedido = desfechoDaLeitura([this.pedidoResource], this.problemas);
  private readonly desfechoDaTrilha = desfechoDaLeitura([this.trilhaResource], this.problemas);
  /** O pedido não existe ou não é acessível. */
  readonly recusaDoPedido = this.desfechoDoPedido.recusa;
  /** Só a trilha foi recusada: o pedido está na tela, e o aviso não pode falar dele. */
  readonly recusaDaTrilha = computed(() =>
    this.recusaDoPedido() === null ? this.desfechoDaTrilha.recusa() : null,
  );
  readonly erro = this.desfecho.mensagem;

  /** Relê o pedido e a trilha; devolve `false` se nenhuma leitura começou. */
  recarregar(): boolean {
    const pedido = this.pedidoResource.reload();
    const trilha = this.trilhaResource.reload();
    return pedido || trilha;
  }
}
