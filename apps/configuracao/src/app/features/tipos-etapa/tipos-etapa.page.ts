import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  acompanharNovaTentativa,
  AlertaNovaTentativaComponent,
  AlertComponent,
} from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { EdicaoDosTiposEtapa } from './edicao-dos-tipos-etapa';
import { TipoEtapaFormularioComponent } from './tipo-etapa-formulario.component';
import { TiposEtapaListaComponent } from './tipos-etapa-lista.component';
import { TiposEtapaStore } from './tipos-etapa.store';

@Component({
  selector: 'cfg-tipos-etapa-page',
  standalone: true,
  imports: [
    AlertaNovaTentativaComponent,
    AlertComponent,
    TiposEtapaListaComponent,
    TipoEtapaFormularioComponent,
    ConfirmacaoDeRemocaoComponent,
  ],
  providers: [TiposEtapaStore, EdicaoDosTiposEtapa],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipos-etapa.page.html',
  host: { class: 'cfg-page' },
})
export class TiposEtapaPage {
  protected readonly store = inject(TiposEtapaStore);
  protected readonly edicao = inject(EdicaoDosTiposEtapa);
  protected readonly pendente = computed(() => this.store.carregando() || this.edicao.gravando());
  protected readonly novaTentativa = acompanharNovaTentativa({
    pendente: this.pendente,
    falhou: computed(() => this.store.mensagemDeErro() !== null),
    destino: () => document.getElementById('cfg-tipos-etapa-list-title'),
  });

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.tentarNovamente());
  }
}
