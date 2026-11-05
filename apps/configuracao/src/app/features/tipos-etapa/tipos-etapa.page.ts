import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AlertComponent, ConfirmDialogComponent } from '@uniplus/shared-ui/components';
import { EdicaoDosTiposEtapa } from './edicao-dos-tipos-etapa';
import { TiposEtapaStore } from './tipos-etapa.store';
import { TiposEtapaListaComponent } from './tipos-etapa-lista.component';
import { TipoEtapaFormularioComponent } from './tipo-etapa-formulario.component';

@Component({
  selector: 'cfg-tipos-etapa-page',
  standalone: true,
  imports: [
    AlertComponent,
    ConfirmDialogComponent,
    TiposEtapaListaComponent,
    TipoEtapaFormularioComponent,
  ],
  providers: [TiposEtapaStore, EdicaoDosTiposEtapa],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipos-etapa.page.html',
  host: { class: 'cfg-page' },
})
export class TiposEtapaPage {
  protected readonly edicao = inject(EdicaoDosTiposEtapa);
  protected readonly store = inject(TiposEtapaStore);
  protected tentarNovamente(): void {
    if (!this.edicao.saving() && !this.edicao.removendo()) this.store.tentarNovamente();
  }
}
