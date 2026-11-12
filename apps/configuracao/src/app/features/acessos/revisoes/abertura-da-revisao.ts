import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { RevisoesApi } from '@uniplus/shared-data/autorizacao';
import { mensagemDaRecusa } from '../falha-de-servidor';
import { FALHA_INESPERADA } from '../mensagens-de-acesso';
import { ChavesPorComando } from '../versoes/chaves-por-comando';

/** A abertura de uma revisão: uma por vez em andamento, e a tela segue para o detalhe dela. */
@Injectable()
export class AberturaDaRevisao {
  private readonly api = inject(RevisoesApi);
  private readonly router = inject(Router);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  private readonly chaves = new ChavesPorComando();
  readonly abrindo = signal(false);
  readonly erro = signal<string | null>(null);

  async abrir(): Promise<void> {
    if (this.abrindo()) return;
    this.abrindo.set(true);
    this.erro.set(null);
    try {
      await this.enviar();
    } catch {
      this.erro.set(FALHA_INESPERADA);
    } finally {
      this.abrindo.set(false);
    }
  }

  private async enviar(): Promise<void> {
    const { resultado } = await this.chaves.enviar('abrir', null, (c) => this.api.abrir(c));
    if (!resultado.ok) {
      this.erro.set(mensagemDaRecusa(this.problemas, this.notificacoes, resultado.problem));
      return;
    }
    this.notificacoes.success('Revisão de acessos aberta');
    await this.router.navigate(['/acessos/revisoes', resultado.data.id]);
  }
}
