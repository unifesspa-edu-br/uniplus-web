import { Injectable, computed, inject, signal } from '@angular/core';
import { ProblemI18nService, useApiResource, withVendorMime } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AUTORIZACAO_BASE_PATH,
  type ConcessaoDto,
  type EventoDaTrilhaDto,
} from '@uniplus/shared-data/autorizacao';
import { desfechoDaLeitura } from './desfecho-da-leitura';
import { notificarFalhasDeLeitura } from './falha-de-servidor';

/** Uma concessão com a trilha: lidas juntas, a falha de qualquer uma é a falha da tela. */
@Injectable()
export class ConcessaoDetalheStore {
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);
  private readonly problemas = inject(ProblemI18nService);
  readonly id = signal<string | undefined>(undefined);
  private readonly concessao = useApiResource<ConcessaoDto>(() => this.leitura('', 'concessao'));
  private readonly consultaDaTrilha = useApiResource<readonly EventoDaTrilhaDto[]>(() =>
    this.leitura('/trilha', 'trilha-da-concessao'),
  );
  private readonly desfecho = desfechoDaLeitura(
    [this.concessao, this.consultaDaTrilha],
    this.problemas,
  );
  /**
   * A concessão só aparece quando as duas leituras responderam com sucesso: nem antes de a trilha
   * chegar, nem com falha em qualquer uma delas.
   */
  readonly dados = computed(() =>
    this.concessao.value()?.ok === true && this.consultaDaTrilha.value()?.ok === true
      ? this.concessao.data()
      : null,
  );
  readonly trilha = computed(() => this.consultaDaTrilha.data() ?? []);
  readonly carregando = computed(
    () => this.concessao.isLoading() || this.consultaDaTrilha.isLoading(),
  );
  readonly falha = this.desfecho.falha;
  readonly recusa = this.desfecho.recusa;

  constructor() {
    notificarFalhasDeLeitura(this.problemas, inject(NotificationService), [
      this.concessao.problem,
      this.consultaDaTrilha.problem,
    ]);
  }

  /** Repete as duas leituras; devolve `false` se nenhuma começou. */
  tentarNovamente(): boolean {
    const daConcessao = this.concessao.reload();
    return this.consultaDaTrilha.reload() || daConcessao;
  }

  private leitura(sufixo: string, recurso: string) {
    const id = this.id();
    if (id === undefined) return undefined;
    return {
      url: `${this.basePath}/api/autorizacao/concessoes/${encodeURIComponent(id)}${sufixo}`,
      context: withVendorMime(recurso, 1),
    };
  }
}
