import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { focarAposNovaTentativa } from '../../shared/foco';
import { TiposBancaListaComponent } from './tipos-banca-lista.component';
import { TipoBancaFormularioComponent } from './tipo-banca-formulario.component';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { TiposBancaStore } from './tipos-banca.store';
import { EdicaoDosTiposBanca } from './edicao-dos-tipos-banca';

@Component({
  selector: 'cfg-tipos-banca-page',
  standalone: true,
  imports: [
    AlertComponent,
    TiposBancaListaComponent,
    TipoBancaFormularioComponent,
    ConfirmacaoDeRemocaoComponent,
  ],
  providers: [TiposBancaStore, EdicaoDosTiposBanca],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipos-banca.page.html',
  host: { class: 'cfg-page' },
})
export class TiposBancaPage {
  protected readonly store = inject(TiposBancaStore);
  protected readonly edicao = inject(EdicaoDosTiposBanca);
  protected readonly pendente = computed(() => this.store.carregando() || this.edicao.gravando());
  private readonly novaTentativa = focarAposNovaTentativa(
    this.pendente,
    computed(() => this.store.mensagemDeErro() !== null),
    () => document.getElementById('cfg-tipos-banca-list-title'),
  );

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.tentarNovamente());
  }
}
