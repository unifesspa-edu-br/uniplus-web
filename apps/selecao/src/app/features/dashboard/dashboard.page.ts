import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '@uniplus/shared-auth/bootstrap';
import { EmptyStateComponent, PageHeaderComponent } from '@uniplus/shared-ui/components';

/**
 * Painel de entrada do backoffice de Seleção.
 *
 * Os indicadores que ocupavam esta tela — processos ativos, inscrições no mês,
 * homologações pendentes, prazos e atividade recente — eram valores escritos no
 * template, incluindo nomes de pessoas. Nenhum tinha endpoint por trás, e
 * apresentá-los como número de produção é pior do que não os apresentar
 * (Story #478, CA-02). Ficam de fora até existir a agregação que os informe.
 *
 * A listagem real dos processos seletivos vive em `/processo-seletivo`, sob o
 * papel `plataforma-admin` — este painel é acessível a todo o backoffice e não
 * pode carregar um recurso que a maioria dos papéis não alcança.
 */
@Component({
  selector: 'sel-dashboard',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './dashboard.page.css',
  template: `
    <ui-page-header
      heading="Painel de Processos"
      description="Visão geral do módulo Seleção."
    />

    <ui-empty-state
      heading="Indicadores ainda indisponíveis"
      description="Os números de processos, inscrições, homologações e prazos dependem de endpoints de agregação que ainda não existem. Nada é exibido aqui até que existam."
    >
      @if (administraPlataforma()) {
        <a class="btn btn--secondary" routerLink="/processo-seletivo">
          Ver processos seletivos
        </a>
      }
    </ui-empty-state>
  `,
})
export class DashboardPage {
  private readonly authService = inject(AuthService);

  /**
   * O atalho só aparece para quem a rota admite — sem isso, um avaliador
   * clicaria em "Ver processos seletivos" para cair em `/acesso-negado`.
   */
  protected readonly administraPlataforma = computed(() =>
    this.authService.roles().includes('plataforma-admin'),
  );
}
