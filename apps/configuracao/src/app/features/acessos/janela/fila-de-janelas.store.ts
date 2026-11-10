import { Injectable, computed, inject, signal } from '@angular/core';
import { ProblemI18nService, useApiResource } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AUTORIZACAO_BASE_PATH,
  type EtapaDaVersao,
  type ItemDaFilaDeJanelasDto,
} from '@uniplus/shared-data/autorizacao';
import { desfechoDaLeitura } from '../desfecho-da-leitura';
import { notificarFalhasDeLeitura } from '../falha-de-servidor';

/** As janelas de migração abertas em que a pessoa tem o que decidir numa etapa. */
@Injectable()
export class FilaDeJanelasStore {
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);
  private readonly problemas = inject(ProblemI18nService);
  readonly etapa = signal<EtapaDaVersao | undefined>(undefined);
  private readonly recurso = useApiResource<readonly ItemDaFilaDeJanelasDto[]>(() => {
    const etapa = this.etapa();
    return etapa === undefined
      ? undefined
      : { url: `${this.basePath}/api/autorizacao/janelas-de-migracao`, params: { etapa } };
  });
  private readonly desfecho = desfechoDaLeitura([this.recurso], this.problemas);
  readonly itens = computed(() => this.recurso.data() ?? []);
  readonly carregando = this.recurso.isLoading;
  readonly falha = this.desfecho.falha;
  readonly recusa = this.desfecho.recusa;
  readonly mensagemDeErro = this.desfecho.mensagem;

  constructor() {
    notificarFalhasDeLeitura(this.problemas, inject(NotificationService), [this.recurso.problem]);
  }

  /** Repete a leitura que falhou; devolve `false` se nenhuma leitura começou. */
  tentarNovamente(): boolean {
    return this.recurso.reload();
  }
}
