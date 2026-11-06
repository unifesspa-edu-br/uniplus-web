import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  acompanharNovaTentativa,
  AlertaNovaTentativaComponent,
  AlertComponent,
} from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { EdicaoDosTiposAto } from './edicao-dos-tipos-ato';
import { TipoAtoFormularioComponent } from './tipo-ato-formulario.component';
import { TiposAtoListaComponent } from './tipos-ato-lista.component';
import { TiposAtoStore } from './tipos-ato.store';

/** Catálogo de tipos de ato: compõe a lista, o formulário e a confirmação de remoção de vigência. */
@Component({
  selector: 'cfg-tipos-ato-page',
  standalone: true,
  imports: [
    AlertaNovaTentativaComponent,
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
  protected readonly novaTentativa = acompanharNovaTentativa({
    pendente: this.pendente,
    falhou: computed(() => this.store.mensagemDeErro() !== null),
    destino: () => document.getElementById('cfg-tipos-ato-list-title'),
  });

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.tentarNovamente());
  }
}
