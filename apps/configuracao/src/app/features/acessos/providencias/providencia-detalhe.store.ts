import { Injectable, computed, inject, signal } from '@angular/core';
import { ProblemI18nService, useApiResource, withVendorMime } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { AUTORIZACAO_BASE_PATH, type ProvidenciaDto } from '@uniplus/shared-data/autorizacao';
import { desfechoDaLeitura } from '../desfecho-da-leitura';
import { notificarFalhasDeLeitura } from '../falha-de-servidor';

/**
 * Uma providência, com o fundamento e o desfecho. A leitura é registrada pela API: sem o registro
 * ela responde 503, e a tela mostra a falha sem nenhum dado.
 */
@Injectable()
export class ProvidenciaDetalheStore {
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);
  private readonly problemas = inject(ProblemI18nService);
  readonly id = signal<string | undefined>(undefined);
  private readonly leitura = useApiResource<ProvidenciaDto>(() => {
    const id = this.id();
    if (id === undefined) return undefined;
    return {
      url: `${this.basePath}/api/autorizacao/providencias/${encodeURIComponent(id)}`,
      context: withVendorMime('providencia', 1),
    };
  });
  private readonly desfecho = desfechoDaLeitura([this.leitura], this.problemas);
  /** Com falha não há dado à vista, nem o da leitura anterior. */
  readonly dados = computed(() => (this.leitura.value()?.ok === true ? this.leitura.data() : null));
  readonly carregando = this.leitura.isLoading;
  readonly falha = this.desfecho.falha;
  readonly recusa = this.desfecho.recusa;

  constructor() {
    notificarFalhasDeLeitura(this.problemas, inject(NotificationService), [this.leitura.problem]);
  }

  /** Relê a providência; devolve `false` se nenhuma leitura começou. */
  tentarNovamente(): boolean {
    return this.leitura.reload();
  }
}
