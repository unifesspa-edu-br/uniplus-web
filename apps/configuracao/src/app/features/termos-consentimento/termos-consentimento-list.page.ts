import { ChangeDetectionStrategy, Component, afterNextRender, inject } from '@angular/core';
import { acompanharLeitura, FalhaDeLeituraComponent } from '@uniplus/shared-ui/components';
import { focoEstaLivre } from '../../shared/foco';
import { TermosConsentimentoStore } from './termos-consentimento.store';
import { TermosConsentimentoListaComponent } from './termos-consentimento-lista.component';

const ID_DO_TITULO = 'cfg-termos-consentimento-title';

@Component({
  selector: 'cfg-termos-consentimento-list-page',
  standalone: true,
  imports: [FalhaDeLeituraComponent, TermosConsentimentoListaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './termos-consentimento-list.page.html',
  host: { class: 'cfg-page' },
  providers: [TermosConsentimentoStore],
})
export class TermosConsentimentoListPage {
  protected readonly store = inject(TermosConsentimentoStore);
  protected readonly leitura = acompanharLeitura({
    falha: this.store.errorMessage,
    pendente: this.store.loading,
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById(ID_DO_TITULO),
  });

  constructor() {
    // Quem chega aqui por uma ação que fechou a página anterior (remover o termo, voltar à lista)
    // fica sem foco; quem veio por um link do menu ou outro controle ainda o tem.
    afterNextRender(() => {
      if (focoEstaLivre()) document.getElementById(ID_DO_TITULO)?.focus();
    });
  }
}
