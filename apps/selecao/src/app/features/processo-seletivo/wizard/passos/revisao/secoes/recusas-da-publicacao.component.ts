import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RecusaDoCampoComponent } from '@uniplus/shared-ui/components';

import {
  RecusasDaPublicacao,
  SEM_CAMPO,
} from '../../../shared/recusas/recusas-da-publicacao.service';

/**
 * As causas (`errors[]`) da última publicação recusada, na ordem em que a API as deu, cada uma com
 * a mensagem, o código e a página que a explica. Elas só aparecem enquanto a resposta que as trouxe
 * é a última: uma publicação aceita, a troca de processo ou a saída do rascunho as retiram. O
 * checklist da tela resume a mesma conferência por assunto, sem chave que o ligue a estas causas.
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
  protected readonly recusasDoServidor = inject(RecusasDaPublicacao);

  protected readonly semCampo = SEM_CAMPO;
}
