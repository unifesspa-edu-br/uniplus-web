import { Injectable, computed, inject, signal } from '@angular/core';
import { ProblemI18nService, useApiResource } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AUTORIZACAO_BASE_PATH,
  type EtapaDaVersao,
  type ItemDaFilaDeVersoesDto,
} from '@uniplus/shared-data/autorizacao';
import { desfechoDaLeitura } from '../desfecho-da-leitura';
import { notificarFalhasDeLeitura } from '../falha-de-servidor';
import { LeituraDosPerfis } from './leitura-dos-perfis';

/** As versões de perfil que aguardam a decisão de uma etapa. */
@Injectable()
export class FilaDeVersoesStore implements LeituraDosPerfis {
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);
  private readonly problemas = inject(ProblemI18nService);
  readonly etapa = signal<EtapaDaVersao | undefined>(undefined);
  private readonly recurso = useApiResource<readonly ItemDaFilaDeVersoesDto[]>(() => {
    const etapa = this.etapa();
    return etapa === undefined
      ? undefined
      : { url: `${this.basePath}/api/autorizacao/versoes-de-perfil`, params: { fila: etapa } };
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

  recarregar(): void {
    this.recurso.reload();
  }

  /** Repete a leitura que falhou; devolve `false` se nenhuma leitura começou. */
  tentarNovamente(): boolean {
    return this.recurso.reload();
  }
}
