import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CertameNaVitrineDto } from '@uniplus/shared-data/selecao';
import { TagComponent } from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';

import { rotuloDaSituacao, varianteDaSituacao } from './situacao-do-certame';

/** O certame em destaque no topo da vitrine, que convida a se inscrever. */
@Component({
  selector: 'ptl-destaque-do-certame',
  standalone: true,
  imports: [RouterLink, DateBrPipe, TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './destaque-do-certame.component.html',
  styleUrl: './destaque-do-certame.component.css',
})
export class DestaqueDoCertameComponent {
  readonly certame = input.required<CertameNaVitrineDto>();

  protected readonly rotuloDaSituacao = rotuloDaSituacao;
  protected readonly varianteDaSituacao = varianteDaSituacao;
}
