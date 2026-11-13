import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { PainelDeProcessosComponent } from '../acompanhamento/painel-de-processos/painel-de-processos.component';
import { ConsultaDoPainel } from '../acompanhamento/painel-de-processos/consulta-do-painel';

/**
 * Painel de entrada do backoffice de Seleção: lista os processos seletivos que a API permite ler
 * e abre o acompanhamento de um deles.
 *
 * A seleção do que é visível é do servidor, antes da paginação; esta página não filtra nem
 * reordena a coleção, não consulta o detalhe de cada processo e não depende da permissão de
 * indicadores. Quantitativos, situações operacionais e prazos não fazem parte do painel básico.
 */
@Component({
  selector: 'sel-dashboard',
  standalone: true,
  imports: [PainelDeProcessosComponent],
  providers: [ConsultaDoPainel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './dashboard.page.css',
  template: `
    <sel-painel-de-processos
      [processos]="consulta.itens()"
      [carregando]="consulta.carregando()"
      [falha]="consulta.falha()"
      [restricao]="consulta.restricao()"
      [tamanhoDePagina]="consulta.limite()"
      [temAnterior]="consulta.temAnterior()"
      [temProxima]="consulta.temProxima()"
      (abrir)="abrir($event)"
      (paginaAnterior)="consulta.paginaAnterior()"
      (proximaPagina)="consulta.proximaPagina()"
      (tamanhoDePaginaChange)="consulta.trocarTamanho($event)"
      (tentarNovamente)="consulta.tentarNovamente()"
      (atualizarLista)="consulta.atualizarLista()"
    />
  `,
})
export class DashboardPage {
  protected readonly consulta = inject(ConsultaDoPainel);
  private readonly router = inject(Router);

  protected abrir(id: string): void {
    void this.router.navigate(['/acompanhamento/processos', id]);
  }
}
