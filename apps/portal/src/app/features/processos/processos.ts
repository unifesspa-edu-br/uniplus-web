import { ChangeDetectionStrategy, Component, ElementRef, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { RELOGIO } from '@uniplus/shared-core/relogio';
import type { CertameNaVitrineDto } from '@uniplus/shared-data/selecao';
import {
  EmptyStateComponent,
  FalhaDeLeituraComponent,
  FilterBarComponent,
  FilterChipsComponent,
  IndicadorDaLeituraDirective,
  ListFooterComponent,
  PageHeaderComponent,
  SegmentedComponent,
  SpinnerComponent,
  acompanharLeitura,
} from '@uniplus/shared-ui/components';

import { CertameEmCardComponent } from './certame-em-card.component';
import { CertameEmLinhaComponent } from './certame-em-linha.component';
import { ComoFuncionaComponent } from './como-funciona.component';
import { DestaqueDoCertameComponent } from './destaque-do-certame.component';
import { PublicacoesDaVitrine } from './publicacoes-da-vitrine';
import { aberturaDoCertame } from './situacao-do-certame';
import { VisaoDosCertames, OPCOES_DE_VISAO } from './visao-dos-certames';
import { VitrineDeCertames } from './vitrine-de-certames';

/**
 * Vitrine pública de certames — a lista vem do módulo Seleção e as publicações e o "Ver edital" de
 * cada certame vêm da página pública dele na Portal API
 * (`GET /api/portal/certames/{identificador}`). A página compõe a vitrine, a visão (lista ou cards) e
 * as publicações; quem lê e pagina é `VitrineDeCertames`.
 */
@Component({
  selector: 'ptl-processos',
  standalone: true,
  imports: [
    RouterOutlet,
    CertameEmCardComponent,
    CertameEmLinhaComponent,
    ComoFuncionaComponent,
    DestaqueDoCertameComponent,
    EmptyStateComponent,
    FalhaDeLeituraComponent,
    FilterBarComponent,
    FilterChipsComponent,
    IndicadorDaLeituraDirective,
    ListFooterComponent,
    PageHeaderComponent,
    SegmentedComponent,
    SpinnerComponent,
  ],
  providers: [VitrineDeCertames, VisaoDosCertames, PublicacoesDaVitrine],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './processos.css',
  templateUrl: './processos.html',
})
export class ProcessosComponent {
  private readonly relogio = inject(RELOGIO);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly vitrine = inject(VitrineDeCertames);
  protected readonly visao = inject(VisaoDosCertames);
  protected readonly publicacoes = inject(PublicacoesDaVitrine);
  protected readonly opcoesDeVisao = OPCOES_DE_VISAO;
  protected readonly leitura = acompanharLeitura({
    falha: this.vitrine.erro,
    pendente: this.vitrine.carregando,
    recarregar: () => this.vitrine.recarregar(),
    destino: () => this.host.nativeElement.querySelector('h1'),
  });

  protected aberturaDe(certame: CertameNaVitrineDto): string | null {
    return aberturaDoCertame(certame, this.relogio());
  }
}
