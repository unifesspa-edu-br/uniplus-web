import { Injectable, computed, inject, signal } from '@angular/core';
import { ProblemI18nService, useApiResource, withVendorMime } from '@uniplus/shared-core/http';
import {
  AUTORIZACAO_BASE_PATH,
  type EventoDaTrilhaDto,
  type PedidoDeConcessaoDto,
} from '@uniplus/shared-data/autorizacao';
import { FALHA_INESPERADA, textoDaRecusa } from './mensagens-de-acesso';

@Injectable()
export class PedidoDetalheStore {
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);
  private readonly problemas = inject(ProblemI18nService);
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
  readonly pedido = this.pedidoResource.data;
  readonly trilha = computed(() => this.trilhaResource.data() ?? []);
  readonly carregando = computed(
    () => this.pedidoResource.isLoading() || this.trilhaResource.isLoading(),
  );
  readonly erro = computed(() => {
    const problema = this.pedidoResource.problem();
    return problema
      ? textoDaRecusa(this.problemas.resolve(problema))
      : this.pedidoResource.error() || this.trilhaResource.error()
        ? FALHA_INESPERADA
        : null;
  });
  recarregar(): void {
    this.pedidoResource.reload();
    this.trilhaResource.reload();
  }
}
