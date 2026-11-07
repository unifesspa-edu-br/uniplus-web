import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  acompanharLeitura,
  FalhaDeLeituraComponent,
  AlertComponent,
} from '@uniplus/shared-ui/components';
import { TiposBancaListaComponent } from './tipos-banca-lista.component';
import { TipoBancaFormularioComponent } from './tipo-banca-formulario.component';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { TiposBancaStore } from './tipos-banca.store';
import { EdicaoDosTiposBanca } from './edicao-dos-tipos-banca';

@Component({
  selector: 'cfg-tipos-banca-page',
  standalone: true,
  imports: [
    FalhaDeLeituraComponent,
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
  protected readonly leitura = acompanharLeitura({
    falha: this.store.mensagemDeErro,
    pendente: this.store.carregando,
    indisponivel: this.edicao.gravando,
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById('cfg-tipos-banca-list-title'),
  });
}
