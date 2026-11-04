import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';

import { ehEnderecoNavegavel } from '../endereco-navegavel';
import { PreflightDaPublicacaoService } from '../preflight-da-publicacao.service';
import { ConferenciaDaPublicacaoService } from '../servicos/conferencia-da-publicacao.service';

/** A conformidade legal da publicação: as obrigatoriedades reprovadas, com a norma que as reprovou. */
@Component({
  selector: 'section[selConformidadeLegal]',
  imports: [DateBrPipe],
  templateUrl: './conformidade-legal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConformidadeLegalComponent {
  protected readonly preflight = inject(PreflightDaPublicacaoService);
  protected readonly conferencia = inject(ConferenciaDaPublicacaoService);

  protected readonly ehEnderecoNavegavel = ehEnderecoNavegavel;
}
