import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  acompanharLeitura,
  FalhaDeLeituraComponent,
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
    FalhaDeLeituraComponent,
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
  protected readonly leitura = acompanharLeitura({
    falha: this.store.mensagemDeErro,
    pendente: this.store.carregando,
    indisponivel: this.edicao.gravando,
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById('cfg-tipos-etapa-list-title'),
  });
}
