import { Injectable, computed, inject, signal } from '@angular/core';
import { ProblemI18nService, useApiResource } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { AUTORIZACAO_BASE_PATH, type JanelaDeMigracaoDto } from '@uniplus/shared-data/autorizacao';
import { desfechoDaLeitura } from '../desfecho-da-leitura';
import { notificarFalhasDeLeitura } from '../falha-de-servidor';
import { LeituraDosPerfis } from '../versoes/leitura-dos-perfis';
import { separarItens } from './itens-da-janela';

/** A janela de migração mais recente do perfil, com a situação de cada concessão. */
@Injectable()
export class JanelaDaMigracaoStore implements LeituraDosPerfis {
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);
  private readonly problemas = inject(ProblemI18nService);
  readonly perfilId = signal<string | undefined>(undefined);
  private readonly recurso = useApiResource<JanelaDeMigracaoDto>(() => {
    const id = this.perfilId();
    return id === undefined
      ? undefined
      : { url: `${this.basePath}/api/autorizacao/perfis/${encodeURIComponent(id)}/janela` };
  });
  private readonly desfecho = desfechoDaLeitura([this.recurso], this.problemas);
  readonly janela = this.recurso.data;
  readonly itens = computed(() => {
    const janela = this.janela();
    return janela === null ? null : separarItens(janela);
  });
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
