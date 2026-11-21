import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RecusaDoCampoComponent } from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { lugarDaRecusaDaPublicacao } from '../../../shared/recusas/lugar-da-recusa-da-publicacao';
import {
  RecusasDaPublicacao,
  SEM_CAMPO,
  type RecusaDaPublicacao,
} from '../../../shared/recusas/recusas-da-publicacao.service';
import { passoPeloRotulo } from '../destino-das-pendencias';

/**
 * As causas (`errors[]`) da última publicação recusada, na ordem em que a API as deu, cada uma com
 * a mensagem, o código e a página que a explica. Elas só aparecem enquanto a resposta que as trouxe
 * é a última: uma publicação aceita, a troca de processo ou a saída do rascunho as retiram. O
 * checklist da tela resume a mesma conferência por assunto, sem chave que o ligue a estas causas.
 *
 * A causa que aponta uma fase ou uma etapa que existe no cronograma tem "Ir ao campo", que abre o
 * passo Cronograma no controle dela; a achada pelos identificadores, nunca pela posição.
 */
@Component({
  selector: 'sel-recusas-da-publicacao',
  imports: [RecusaDoCampoComponent],
  templateUrl: './recusas-da-publicacao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'step-section',
    role: 'region',
    'aria-labelledby': 'revisao-recusas-titulo',
  },
})
export class RecusasDaPublicacaoComponent {
  private readonly store = inject(ProcessoSeletivoStore);
  protected readonly recusasDoServidor = inject(RecusasDaPublicacao);

  protected readonly semCampo = SEM_CAMPO;

  /** Cada causa, com a indicação de que há campo para onde levar a pessoa. */
  protected readonly itens = computed(() => {
    const cronograma = this.store.draft().cronograma;
    return this.recusasDoServidor.recusas().map((recusa) => {
      const lugar = lugarDaRecusaDaPublicacao(recusa, cronograma);
      return { recusa, comCampo: lugar !== null && lugar.tipo !== 'passo' };
    });
  });

  protected irAoCampo(recusa: RecusaDaPublicacao): void {
    this.recusasDoServidor.destino.set(recusa);
    this.store.goTo(passoPeloRotulo('Cronograma').indice);
  }
}
