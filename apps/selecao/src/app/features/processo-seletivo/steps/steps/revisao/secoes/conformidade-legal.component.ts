import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';

import { ehEnderecoNavegavel } from '../endereco-navegavel';
import { PreflightDaPublicacaoService } from '../preflight-da-publicacao.service';
import { ConferenciaDaPublicacao } from '../servicos/conferencia-da-publicacao.service';

/** A conformidade legal da publicação: as obrigatoriedades reprovadas, com a norma que as reprovou. */
@Component({
  selector: 'sel-conformidade-legal',
  imports: [DateBrPipe],
  templateUrl: './conformidade-legal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'step-section',
    role: 'region',
    'aria-labelledby': 'revisao-legal-titulo',
  },
})
export class ConformidadeLegalComponent {
  protected readonly preflight = inject(PreflightDaPublicacaoService);
  protected readonly conferencia = inject(ConferenciaDaPublicacao);

  protected readonly ehEnderecoNavegavel = ehEnderecoNavegavel;
}
