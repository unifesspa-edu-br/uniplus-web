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

/**
 * Um certame da vitrine na visão em lista: situação, prazos, vagas, o link do edital e o botão de
 * inscrição. É o `li` da lista, e por isso o seletor é de atributo: o HTML exige `li` filho de `ul`.
 */
@Component({
  selector: 'li[ptlCertameEmLinha]',
  standalone: true,
  imports: [RouterLink, DateBrPipe, TagComponent, CertamePublicacoesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'edital-row' },
  templateUrl: './certame-em-linha.component.html',
  styleUrls: ['./certame-compartilhado.css', './certame-em-linha.component.css'],
})
export class CertameEmLinhaComponent {
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
