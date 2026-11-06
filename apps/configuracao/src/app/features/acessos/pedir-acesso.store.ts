import { HttpParams } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  API_MAX_PAGE_SIZE,
  type Cursor,
  ProblemI18nService,
  extractNextCursor,
  useApiResource,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { AUTORIZACAO_BASE_PATH, type PerfilParaPedidoDto } from '@uniplus/shared-data/autorizacao';
import { notificarFalhasDeLeitura } from './falha-de-servidor';
import { FALHA_INESPERADA, textoDaRecusa } from './mensagens-de-acesso';

@Injectable()
export class PedirAcessoStore {
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  private readonly cursor = signal<Cursor | undefined>(undefined);
  private readonly acumulados = signal<readonly PerfilParaPedidoDto[]>([]);
  private readonly consulta = useApiResource<readonly PerfilParaPedidoDto[]>(() => {
    let params = new HttpParams().set('direction', 'next').set('limit', API_MAX_PAGE_SIZE);
    const cursor = this.cursor();
    if (cursor) params = params.set('cursor', cursor);
    return {
      url: `${this.basePath}/api/autorizacao/perfis-para-pedido`,
      params,
      context: withVendorMime('perfil-para-pedido', 1),
    };
  });
  readonly perfis = signal<readonly PerfilParaPedidoDto[]>([]);
  readonly carregandoPerfis = this.consulta.isLoading;
  readonly perfisIndisponiveis = computed(() => {
    const problema = this.consulta.problem();
    return problema
      ? textoDaRecusa(this.problemas.resolve(problema))
      : this.consulta.error()
        ? FALHA_INESPERADA
        : null;
  });
  recarregarPerfis(): void {
    this.consulta.reload();
  }

  constructor() {
    notificarFalhasDeLeitura(this.problemas, this.notificacoes, [this.consulta.problem]);
    effect(() => {
      const resultado = this.consulta.value();
      if (!resultado?.ok) return;
      untracked(() => {
        const itens = [...this.acumulados(), ...resultado.data];
        const proximo = extractNextCursor(resultado.headers.get('Link'));
        if (proximo) {
          this.acumulados.set(itens);
          this.cursor.set(proximo);
        } else this.perfis.set(itens);
      });
    });
  }
}
