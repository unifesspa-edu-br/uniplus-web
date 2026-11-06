import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { focarAposNovaTentativa } from '../../shared/foco';
import { EdicaoDosTiposAto } from './edicao-dos-tipos-ato';
import { TipoAtoFormularioComponent } from './tipo-ato-formulario.component';
import { TiposAtoListaComponent } from './tipos-ato-lista.component';
import { TiposAtoStore } from './tipos-ato.store';

/** Catálogo de tipos de ato: compõe a lista, o formulário e a confirmação de remoção de vigência. */
@Component({
  selector: 'cfg-tipos-ato-page',
  standalone: true,
  imports: [
    AlertComponent,
    TiposAtoListaComponent,
    TipoAtoFormularioComponent,
    ConfirmacaoDeRemocaoComponent,
  ],
  providers: [TiposAtoStore, EdicaoDosTiposAto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipos-ato.page.html',
  host: { class: 'cfg-page' },
})
export class TiposAtoPage {
  protected readonly store = inject(TiposAtoStore);
  protected readonly edicao = inject(EdicaoDosTiposAto);
  protected readonly pendente = computed(() => this.store.carregando() || this.edicao.gravando());
  private readonly novaTentativa = focarAposNovaTentativa(
    this.pendente,
    computed(() => this.store.mensagemDeErro() !== null),
    () => document.getElementById('cfg-tipos-ato-list-title'),
  );

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.tentarNovamente());
  }
}
