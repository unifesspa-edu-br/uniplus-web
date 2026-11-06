import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { AprovacaoDaProtecaoDto } from '@uniplus/shared-data/configuracao';
import { AlertComponent } from '@uniplus/shared-ui/components';
import {
  AvisoDeNovaAprovacaoComponent,
  CLASSIFICACOES_DE_PROTECAO,
  rotuloDe,
} from '../../shared/protecao-do-catalogo';

/** O que a proteção de dados diz do tipo em edição: a decisão que pede ajuste e o aviso de nova aprovação. */
@Component({
  selector: 'cfg-tipo-documento-avisos',
  imports: [AlertComponent, AvisoDeNovaAprovacaoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (decisao(); as decidida) {
      <ui-alert variant="info" [heading]="tituloDaDecisao()">
        @if (decidida.situacao === 'AJUSTE_RECOMENDADO') {
          A classificação recomendada é
          {{ rotulo(classificacoes, decidida.classificacaoRecomendada) }}.
        }
        @if (decidida.justificativa) {
          <span class="cfg-justificativa">Justificativa: {{ decidida.justificativa }}</span>
        }
        Ajuste a proteção de dados abaixo e salve{{
          decidida.situacao === 'AJUSTE_RECOMENDADO'
            ? ', ou feche e use "Aceitar recomendação" no detalhe'
            : ''
        }}.
      </ui-alert>
    }
    @if (avisaNovaAprovacao()) {
      <cfg-aviso-de-nova-aprovacao />
    }
  `,
})
export class TipoDocumentoAvisosComponent {
  readonly decisao = input.required<AprovacaoDaProtecaoDto | null>();
  readonly avisaNovaAprovacao = input.required<boolean>();

  protected readonly classificacoes = CLASSIFICACOES_DE_PROTECAO;
  protected readonly rotulo = rotuloDe;
  protected readonly tituloDaDecisao = computed(() =>
    this.decisao()?.situacao === 'REPROVADA'
      ? 'Reprovado pela proteção de dados'
      : 'Ajuste recomendado pela proteção de dados',
  );
}
