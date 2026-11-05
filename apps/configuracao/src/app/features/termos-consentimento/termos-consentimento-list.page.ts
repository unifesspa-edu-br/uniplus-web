import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TermosConsentimentoStore } from './termos-consentimento.store';
import { TermosConsentimentoListaComponent } from './termos-consentimento-lista.component';

@Component({
  selector: 'cfg-termos-consentimento-list-page',
  standalone: true,
  imports: [TermosConsentimentoListaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<cfg-termos-consentimento-lista
    [busca]="store.busca()"
    [loading]="store.loading()"
    [termosFiltrados]="store.termos()"
    [prevCursor]="store.prevCursor()"
    [nextCursor]="store.nextCursor()"
    [temFiltroAtivo]="store.temFiltroAtivo()"
    [errorMessage]="store.errorMessage()"
    (buscaAlterada)="store.alterarBusca($event)"
    (limpar)="store.limparFiltros()"
    (tentar)="store.tentarNovamente()"
    (anterior)="store.paginaAnterior()"
    (proximo)="store.proximaPagina()"
  />`,
  host: { class: 'cfg-page' },
  providers: [TermosConsentimentoStore],
})
export class TermosConsentimentoListPage {
  protected readonly store = inject(TermosConsentimentoStore);
}
