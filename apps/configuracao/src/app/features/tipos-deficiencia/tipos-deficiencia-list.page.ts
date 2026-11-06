import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  acompanharNovaTentativa,
  AlertaNovaTentativaComponent,
  AlertComponent,
} from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { EdicaoDosTiposDeficiencia } from './edicao-dos-tipos-deficiencia';
import { TipoDeficienciaFormularioComponent } from './tipo-deficiencia-formulario.component';
import { TiposDeficienciaListaComponent } from './tipos-deficiencia-lista.component';
import { TiposDeficienciaStore } from './tipos-deficiencia.store';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'cfg-tipos-deficiencia-list',
  providers: [TiposDeficienciaStore, EdicaoDosTiposDeficiencia],
  imports: [
    AlertaNovaTentativaComponent,
    AlertComponent,
    TiposDeficienciaListaComponent,
    TipoDeficienciaFormularioComponent,
    ConfirmacaoDeRemocaoComponent,
  ],
  templateUrl: './tipos-deficiencia-list.page.html',
  host: { class: 'cfg-page' },
})
export class TiposDeficienciaListPage {
  protected readonly store = inject(TiposDeficienciaStore);
  protected readonly edicao = inject(EdicaoDosTiposDeficiencia);
  protected readonly pendente = computed(() => this.store.carregando() || this.edicao.gravando());
  protected readonly novaTentativa = acompanharNovaTentativa({
    pendente: this.pendente,
    falhou: computed(() => this.store.mensagemDeErro() !== null),
    destino: () => document.getElementById('cfg-tipos-deficiencia-list-title'),
  });

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.tentarNovamente());
  }
}
