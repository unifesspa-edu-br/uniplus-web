import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  acompanharLeitura,
  FalhaDeLeituraComponent,
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
    FalhaDeLeituraComponent,
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
  protected readonly leitura = acompanharLeitura({
    falha: this.store.mensagemDeErro,
    pendente: this.store.carregando,
    indisponivel: this.edicao.gravando,
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById('cfg-tipos-deficiencia-list-title'),
  });
}
