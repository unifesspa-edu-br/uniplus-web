import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { rotuloDaDimensao } from '../grupos-da-revisao';
import { PreflightDaPublicacaoService } from '../preflight-da-publicacao.service';
import { ConferenciaDaPublicacaoService } from '../servicos/conferencia-da-publicacao.service';

/** O checklist estrutural da publicação, agrupado por dimensão, com o atalho para o passo que resolve cada pendência. */
@Component({
  selector: 'sel-conformidade-estrutural',
  templateUrl: './conformidade-estrutural.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // O elemento nasce inline; como bloco, a seção mantém a margem de `.step-section`.
  host: {
    class: 'step-section',
    role: 'region',
    'aria-labelledby': 'revisao-estrutural-titulo',
    style: 'display: block',
  },
})
export class ConformidadeEstruturalComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly preflight = inject(PreflightDaPublicacaoService);
  protected readonly conferencia = inject(ConferenciaDaPublicacaoService);

  protected readonly rotuloDaDimensao = rotuloDaDimensao;
}
