import { Injectable, inject, signal } from '@angular/core';
import { NotificationService } from '@uniplus/shared-core/notifications';
import type { VersaoPendenteDto } from '@uniplus/shared-data/autorizacao';
import { DocumentoDaVersaoService, type FaseDoEnvio } from './documento-da-versao.service';
import { EscritaDoPerfil } from './escrita-do-perfil';

/**
 * O envio do PDF de uma versão pendente cujo documento não seguiu: ainda sem arquivo ou recusado na
 * verificação. Depois de qualquer falha a tela relê a versão, porque o documento pode já ter sido
 * registrado ou confirmado, e a próxima tentativa segue o estado lido.
 */
@Injectable()
export class ReenvioDoDocumento {
  private readonly documento = inject(DocumentoDaVersaoService);
  private readonly escrita = inject(EscritaDoPerfil);
  private readonly notificacoes = inject(NotificationService);
  readonly erro = signal<string | null>(null);
  readonly fase = signal<FaseDoEnvio | null>(null);

  enviar(perfilId: string, versao: VersaoPendenteDto, arquivo: File | null): Promise<void> {
    if (arquivo === null) return Promise.resolve();
    return this.escrita.executar(
      'documento',
      () => this.reenviar(perfilId, versao, arquivo),
      (mensagem) => this.erro.set(mensagem),
    );
  }

  private async reenviar(perfilId: string, versao: VersaoPendenteDto, arquivo: File): Promise<void> {
    this.erro.set(null);
    try {
      const desfecho = await this.documento.reenviar(perfilId, versao, arquivo, (fase) =>
        this.fase.set(fase),
      );
      if (desfecho.ok) this.notificacoes.success('Documento enviado', 'Ele segue para verificação.');
      else this.erro.set(desfecho.mensagem);
    } finally {
      this.fase.set(null);
      this.escrita.recarregar();
    }
  }
}
