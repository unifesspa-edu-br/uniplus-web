import { Injectable, computed, inject, signal } from '@angular/core';
import { ProblemI18nService, useApiResource } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AUTORIZACAO_BASE_PATH,
  type RegistroDaContencaoDto,
} from '@uniplus/shared-data/autorizacao';
import { desfechoDaLeitura } from '../desfecho-da-leitura';
import { notificarFalhasDeLeitura } from '../falha-de-servidor';
import { registrosComoEventos } from './trilha-da-contencao';

/** A trilha da contenção do perfil aberto: suspensão, decisões de etapa, retomada, desativação e reativação. */
@Injectable()
export class TrilhaDaContencaoStore {
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);
  private readonly problemas = inject(ProblemI18nService);
  private readonly id = signal<string | undefined>(undefined);
  private readonly recurso = useApiResource<readonly RegistroDaContencaoDto[]>(() => {
    const id = this.id();
    return id === undefined
      ? undefined
      : { url: `${this.basePath}/api/autorizacao/perfis/${encodeURIComponent(id)}/contencao` };
  });
  private readonly desfecho = desfechoDaLeitura([this.recurso], this.problemas);
  readonly eventos = computed(() => registrosComoEventos(this.recurso.data() ?? []));
  readonly carregando = this.recurso.isLoading;
  readonly falha = this.desfecho.falha;
  readonly recusa = this.desfecho.recusa;

  constructor() {
    notificarFalhasDeLeitura(this.problemas, inject(NotificationService), [this.recurso.problem]);
  }

  /** Lê a trilha do perfil; relê quando é o mesmo perfil, porque a contenção pode ter mudado. */
  atualizar(perfilId: string): void {
    if (this.id() === perfilId) this.recurso.reload();
    else this.id.set(perfilId);
  }

  tentarNovamente(): boolean {
    return this.recurso.reload();
  }
}
