import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AlertComponent, ConfirmDialogComponent } from '@uniplus/shared-ui/components';
import { TiposBancaListaComponent } from './tipos-banca-lista.component';
import { TipoBancaFormularioComponent } from './tipo-banca-formulario.component';
import { TiposBancaStore } from './tipos-banca.store';
import { EdicaoDosTiposBanca } from './edicao-dos-tipos-banca';

@Component({
  selector: 'cfg-tipos-banca-page',
  standalone: true,
  imports: [
    AlertComponent,
    ConfirmDialogComponent,
    TiposBancaListaComponent,
    TipoBancaFormularioComponent,
  ],
  providers: [TiposBancaStore, EdicaoDosTiposBanca],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipos-banca.page.html',
  host: { class: 'cfg-page' },
})
export class TiposBancaPage {
  protected readonly store = inject(TiposBancaStore);
  protected readonly edicao = inject(EdicaoDosTiposBanca);
}
