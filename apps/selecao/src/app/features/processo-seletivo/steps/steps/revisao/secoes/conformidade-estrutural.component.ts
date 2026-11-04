import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { rotuloDaDimensao } from '../grupos-da-revisao';
import { PreflightDaPublicacaoService } from '../preflight-da-publicacao.service';
import { ConferenciaDaPublicacao } from '../servicos/conferencia-da-publicacao.service';

/** O checklist estrutural da publicação, agrupado por dimensão, com o atalho para o passo que resolve cada pendência. */
@Component({
  selector: 'sel-conformidade-estrutural',
  templateUrl: './conformidade-estrutural.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'step-section',
    role: 'region',
    'aria-labelledby': 'revisao-estrutural-titulo',
  },
})
export class ConformidadeEstruturalComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly preflight = inject(PreflightDaPublicacaoService);
  protected readonly conferencia = inject(ConferenciaDaPublicacao);

  protected readonly rotuloDaDimensao = rotuloDaDimensao;
}
