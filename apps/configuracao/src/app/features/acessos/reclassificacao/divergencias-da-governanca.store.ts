import { Injectable, computed, inject } from '@angular/core';
import { ProblemI18nService, useApiResource } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AUTORIZACAO_BASE_PATH,
  type DivergenciaDaGovernancaDto,
} from '@uniplus/shared-data/autorizacao';
import { desfechoDaLeitura } from '../desfecho-da-leitura';
import { notificarFalhasDeLeitura } from '../falha-de-servidor';

/** As diferenças entre o catálogo de permissões e o que os perfis de governança têm. */
@Injectable()
export class DivergenciasDaGovernancaStore {
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);
  private readonly problemas = inject(ProblemI18nService);
  private readonly recurso = useApiResource<readonly DivergenciaDaGovernancaDto[]>(() => ({
    url: `${this.basePath}/api/autorizacao/governanca/divergencias`,
  }));
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
