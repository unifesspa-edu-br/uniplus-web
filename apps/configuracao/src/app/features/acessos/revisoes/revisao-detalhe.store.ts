import { Injectable, inject, signal } from '@angular/core';
import { ProblemI18nService, useApiResource, withVendorMime } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { AUTORIZACAO_BASE_PATH, type RevisaoDeAcessosDto } from '@uniplus/shared-data/autorizacao';
import { desfechoDaLeitura } from '../desfecho-da-leitura';
import { notificarFalhasDeLeitura } from '../falha-de-servidor';
import { LeituraDosPerfis } from '../versoes/leitura-dos-perfis';

/** A revisão aberta na tela, com os itens; cada decisão a relê, e o `decide` do pendente vem recalculado. */
@Injectable()
export class RevisaoDetalheStore implements LeituraDosPerfis {
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);
  private readonly problemas = inject(ProblemI18nService);
  readonly id = signal<string | undefined>(undefined);
  private readonly recurso = useApiResource<RevisaoDeAcessosDto>(() => {
    const id = this.id();
    return id === undefined
      ? undefined
      : {
          url: `${this.basePath}/api/autorizacao/revisoes/${encodeURIComponent(id)}`,
          context: withVendorMime('revisao-de-acessos', 1),
        };
  });
  private readonly desfecho = desfechoDaLeitura([this.recurso], this.problemas);
  readonly revisao = this.recurso.data;
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
