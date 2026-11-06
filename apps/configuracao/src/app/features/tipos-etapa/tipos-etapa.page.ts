import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { focarAposNovaTentativa } from '../../shared/foco';
import { EdicaoDosTiposEtapa } from './edicao-dos-tipos-etapa';
import { TipoEtapaFormularioComponent } from './tipo-etapa-formulario.component';
import { TiposEtapaListaComponent } from './tipos-etapa-lista.component';
import { TiposEtapaStore } from './tipos-etapa.store';

@Component({
  selector: 'cfg-tipos-etapa-page',
  standalone: true,
  imports: [
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
  private readonly novaTentativa = focarAposNovaTentativa(
    this.pendente,
    computed(() => this.store.mensagemDeErro() !== null),
    () => document.getElementById('cfg-tipos-etapa-list-title'),
  );

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.tentarNovamente());
  }
}
