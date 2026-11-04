import { Injectable, inject, linkedSignal } from '@angular/core';

import { DetalheDaInscricao } from './detalhe-da-inscricao.service';

/** A recusa ao abrir um arquivo, junto do arquivo a que se refere. */
export interface RecusaAoAbrir {
  readonly arquivoId: string;
  readonly mensagem: string;
}

/**
 * A abertura dos arquivos da inscrição, uma por vez: enquanto um arquivo é pedido, nenhum outro
 * parte. O pedido em curso e a recusa valem só para a inscrição aberta; trocar de inscrição os zera.
 * Provida pela página.
 */
@Injectable()
export class AberturaDeArquivo {
  private readonly detalhe = inject(DetalheDaInscricao);

  /** O arquivo cujo acesso está sendo pedido, ou `null`. */
  readonly abrindo = linkedSignal<string | null>(() => {
    this.detalhe.inscricaoId();
    return null;
  });

  readonly recusa = linkedSignal<RecusaAoAbrir | null>(() => {
    this.detalhe.inscricaoId();
    return null;
  });

  /** Tem de rodar dentro do clique: a aba do arquivo nasce antes do primeiro `await`. */
  async abrir(arquivoId: string): Promise<void> {
    if (this.abrindo() !== null) return;
    this.recusa.set(null);
    this.abrindo.set(arquivoId);
    try {
      const desfecho = await this.detalhe.abrirArquivo(arquivoId);
      if (desfecho.situacao === 'recusado') {
        this.recusa.set({ arquivoId, mensagem: desfecho.mensagem });
      }
    } finally {
      // Na troca de inscrição `abrindo` já foi zerado e pode ser de outro pedido.
      if (this.abrindo() === arquivoId) this.abrindo.set(null);
    }
  }
}
