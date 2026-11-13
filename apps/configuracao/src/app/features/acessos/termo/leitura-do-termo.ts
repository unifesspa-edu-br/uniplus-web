import { inject, signal } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { ProblemI18nService, type ApiResult } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import type { VersaoDoTermoDto } from '@uniplus/shared-data/autorizacao';
import { mensagemDaRecusa } from '../falha-de-servidor';
import { FALHA_INESPERADA_DE_LEITURA } from '../mensagens-de-acesso';

type Leitura = () => Observable<ApiResult<VersaoDoTermoDto>>;

/**
 * A versão do termo que a tela apresenta, lida sob demanda: a vigente, na criação do pedido, ou a
 * fixada no pedido, no aceite. A recusa vira o texto que a tela mostra no lugar do termo, e a
 * leitura que falhou pode ser repetida. Cada leitura nova descarta a anterior: a versão que estava
 * apresentada sai na hora, e a resposta de uma leitura substituída não é aplicada.
 *
 * Criar em contexto de injeção.
 */
export class LeituraDoTermo {
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  private geracao = 0;
  private ultima: Leitura | null = null;
  readonly versao = signal<VersaoDoTermoDto | null>(null);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);

  /** Lê a versão no lugar da que estava apresentada; devolve se ela chegou. */
  async ler(leitura: Leitura): Promise<boolean> {
    const geracao = this.descartar();
    this.ultima = leitura;
    this.carregando.set(true);
    try {
      const resultado = await firstValueFrom(leitura());
      return geracao === this.geracao && this.aplicar(resultado);
    } catch {
      if (geracao === this.geracao) this.erro.set(FALHA_INESPERADA_DE_LEITURA);
      return false;
    } finally {
      if (geracao === this.geracao) this.carregando.set(false);
    }
  }

  /** Repete a última leitura, depois de uma falha. */
  tentarNovamente(): Promise<boolean> {
    return this.ultima === null ? Promise.resolve(false) : this.ler(this.ultima);
  }

  /** Tira a versão apresentada e invalida a leitura em andamento; devolve a geração nova. */
  descartar(): number {
    this.geracao++;
    this.versao.set(null);
    this.erro.set(null);
    this.carregando.set(false);
    return this.geracao;
  }

  private aplicar(resultado: ApiResult<VersaoDoTermoDto>): boolean {
    if (resultado.ok) this.versao.set(resultado.data);
    else this.erro.set(mensagemDaRecusa(this.problemas, this.notificacoes, resultado.problem));
    return resultado.ok;
  }
}
