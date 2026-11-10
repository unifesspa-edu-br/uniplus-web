import { Injectable, inject, signal } from '@angular/core';
import { ChaveDeSubstituicao, ProblemI18nService, comChave } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { VersoesDoPerfilApi } from '@uniplus/shared-data/autorizacao';
import { mensagemDaRecusa } from '../falha-de-servidor';
import { CampoDoMotivo } from './campo-do-motivo';
import { EscritaDoPerfil } from './escrita-do-perfil';

/** O cancelamento da versão pendente: o motivo fica na trilha e a versão sai da fila de aprovação. */
@Injectable()
export class CancelamentoDaVersao {
  private readonly api = inject(VersoesDoPerfilApi);
  private readonly escrita = inject(EscritaDoPerfil);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  private readonly campo = new CampoDoMotivo();
  private readonly chave = new ChaveDeSubstituicao();
  readonly aberto = signal(false);
  readonly erro = signal<string | null>(null);
  readonly tentou = this.campo.tentou;
  readonly motivo = this.campo.controle;
  readonly pedidoDeFoco = this.campo.pedidoDeFoco;

  abrir(): void {
    if (this.escrita.gravando()) return;
    this.campo.reiniciar();
    this.erro.set(null);
    this.aberto.set(true);
  }

  confirmar(perfilId: string, versaoId: string): Promise<void> {
    const motivo = this.campo.exigir();
    if (motivo === null) return Promise.resolve();
    return this.escrita.executar(
      'cancelamento',
      () => this.cancelar(perfilId, versaoId, motivo),
      (mensagem) => this.erro.set(mensagem),
    );
  }

  private async cancelar(perfilId: string, versaoId: string, motivo: string): Promise<void> {
    this.erro.set(null);
    const { resultado } = await comChave(this.chave, { perfilId, versaoId, motivo }, (contexto) =>
      this.api.cancelar(perfilId, versaoId, motivo, contexto),
    );
    if (!resultado.ok) {
      if (!this.campo.recusar(resultado.problem)) {
        this.erro.set(mensagemDaRecusa(this.problemas, this.notificacoes, resultado.problem));
      }
      return;
    }
    this.aberto.set(false);
    this.notificacoes.success('Versão pendente cancelada');
    this.escrita.recarregar();
  }
}
