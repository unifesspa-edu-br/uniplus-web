import { Injectable, inject, signal } from '@angular/core';
import { ProblemI18nService, useApiResource } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { AUTORIZACAO_BASE_PATH, type ReclassificacaoDto } from '@uniplus/shared-data/autorizacao';
import { desfechoDaLeitura } from '../desfecho-da-leitura';
import { notificarFalhasDeLeitura } from '../falha-de-servidor';
import { LeituraDosPerfis } from '../versoes/leitura-dos-perfis';

/** A reclassificação aberta, com as versões em uso e as concessões que ela suspendeu. */
@Injectable()
export class ReclassificacaoDetalheStore implements LeituraDosPerfis {
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);
  private readonly problemas = inject(ProblemI18nService);
  readonly id = signal<string | undefined>(undefined);
  private readonly recurso = useApiResource<ReclassificacaoDto>(() => {
    const id = this.id();
    return id === undefined
      ? undefined
      : { url: `${this.basePath}/api/autorizacao/reclassificacoes/${encodeURIComponent(id)}` };
  });
  private readonly desfecho = desfechoDaLeitura([this.recurso], this.problemas);
  readonly reclassificacao = this.recurso.data;
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
