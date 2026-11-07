import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CertameNaVitrineDto } from '@uniplus/shared-data/selecao';
import { TagComponent } from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';

import { CertamePublicacoesComponent } from '../publicacoes/certame-publicacoes';
import type { PublicacoesDoItem } from './publicacoes-da-vitrine';
import {
  recebeInscricao,
  rotuloDaSituacao,
  vagasFormatadas,
  varianteDaSituacao,
} from './situacao-do-certame';

/** Um certame da vitrine na visão em cards: os mesmos dados da linha, num `article`. */
@Component({
  selector: 'ptl-certame-em-card',
  standalone: true,
  imports: [RouterLink, DateBrPipe, TagComponent, CertamePublicacoesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'card', role: 'article' },
  templateUrl: './certame-em-card.component.html',
  styleUrl: './certame-compartilhado.css',
})
export class CertameEmCardComponent {
  readonly certame = input.required<CertameNaVitrineDto>();
  /** Quando as inscrições abrem, se ainda vão abrir; `null` nos demais casos. */
  readonly abertura = input<string | null>(null);
  readonly publicacoes = input<PublicacoesDoItem | undefined>(undefined);
  /** A pessoa pediu para ler de novo as publicações que falharam. */
  readonly recarregarPublicacoes = output<void>();

  protected readonly rotuloDaSituacao = rotuloDaSituacao;
  protected readonly varianteDaSituacao = varianteDaSituacao;
  protected readonly vagasFormatadas = vagasFormatadas;
  protected readonly recebeInscricao = recebeInscricao;
}
