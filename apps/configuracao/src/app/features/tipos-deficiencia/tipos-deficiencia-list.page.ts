import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { focarAposNovaTentativa } from '../../shared/foco';
import { EdicaoDosTiposDeficiencia } from './edicao-dos-tipos-deficiencia';
import { TipoDeficienciaFormularioComponent } from './tipo-deficiencia-formulario.component';
import { TiposDeficienciaListaComponent } from './tipos-deficiencia-lista.component';
import { TiposDeficienciaStore } from './tipos-deficiencia.store';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'cfg-tipos-deficiencia-list',
  providers: [TiposDeficienciaStore, EdicaoDosTiposDeficiencia],
  imports: [
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
  private readonly novaTentativa = focarAposNovaTentativa(
    this.pendente,
    computed(() => this.store.mensagemDeErro() !== null),
    () => document.getElementById('cfg-tipos-deficiencia-list-title'),
  );

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.tentarNovamente());
  }
}
