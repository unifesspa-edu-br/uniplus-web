import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { TagComponent } from '../tag/tag';
import {
  rotuloDaSituacaoDaInscricao,
  varianteDaSituacaoDaInscricao,
} from './situacao-da-inscricao';
import { ValorApresentadoComponent } from './valor-apresentado';
import type { ValorExibido } from './valor-da-resposta';

/**
 * O valor de uma resposta de inscrição já lido pelo tipo (`valorExibido`): o endereço sai em linhas,
 * a situação em etiqueta e o resto pelo `ui-valor-apresentado`.
 */
@Component({
  selector: 'ui-resposta-exibida',
  standalone: true,
  imports: [TagComponent, ValorApresentadoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let valor = exibido();
    @if ('linhas' in valor) {
      @for (linha of valor.linhas; track $index) {
        <span class="resposta__linha">{{ linha }}</span>
      }
    } @else if ('situacao' in valor) {
      <ui-tag [variant]="varianteDaSituacaoDaInscricao(valor.situacao)">{{
        rotuloDaSituacaoDaInscricao(valor.situacao)
      }}</ui-tag>
    } @else {
      <ui-valor-apresentado [valor]="valor.valor" />
    }
  `,
  styles: `
    .resposta__linha {
      display: block;
      overflow-wrap: anywhere;
    }
  `,
})
export class RespostaExibidaComponent {
  readonly exibido = input.required<ValorExibido>();

  protected readonly rotuloDaSituacaoDaInscricao = rotuloDaSituacaoDaInscricao;
  protected readonly varianteDaSituacaoDaInscricao = varianteDaSituacaoDaInscricao;
}
