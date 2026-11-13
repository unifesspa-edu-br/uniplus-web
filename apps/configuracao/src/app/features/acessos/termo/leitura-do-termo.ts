import { inject, signal } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { ProblemI18nService, type ApiResult } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import type { VersaoDoTermoDto } from '@uniplus/shared-data/autorizacao';
import { mensagemDaRecusa } from '../falha-de-servidor';
import { FALHA_INESPERADA_DE_LEITURA } from '../mensagens-de-acesso';

/**
 * A versão do termo que a tela apresenta, lida sob demanda: a vigente, na criação do pedido, ou a
 * fixada no pedido, no aceite. A recusa vira o texto que a tela mostra no lugar do termo.
 *
 * Criar em contexto de injeção.
 */
export class LeituraDoTermo {
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  readonly versao = signal<VersaoDoTermoDto | null>(null);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);

  /** Lê a versão; devolve se ela chegou. */
  async ler(leitura: () => Observable<ApiResult<VersaoDoTermoDto>>): Promise<boolean> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      return this.aplicar(await firstValueFrom(leitura()));
    } catch {
      this.erro.set(FALHA_INESPERADA_DE_LEITURA);
      return false;
    } finally {
      this.carregando.set(false);
    }
  }

  private aplicar(resultado: ApiResult<VersaoDoTermoDto>): boolean {
    if (resultado.ok) this.versao.set(resultado.data);
    else this.erro.set(mensagemDaRecusa(this.problemas, this.notificacoes, resultado.problem));
    return resultado.ok;
  }
}
