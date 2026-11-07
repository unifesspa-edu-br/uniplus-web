import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  acompanharLeitura,
  FalhaDeLeituraComponent,
  AlertComponent,
} from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { EdicaoDasReservasDemograficas } from './edicao-das-reservas-demograficas';
import { ReservaDemograficaFormularioComponent } from './reserva-demografica-formulario.component';
import { ReservaDemograficaListaComponent } from './reserva-demografica-lista.component';
import { ReservaDemograficaStore } from './reserva-demografica.store';

@Component({
  selector: 'cfg-reserva-demografica-page',
  standalone: true,
  imports: [
    FalhaDeLeituraComponent,
    AlertComponent,
    ReservaDemograficaListaComponent,
    ReservaDemograficaFormularioComponent,
    ConfirmacaoDeRemocaoComponent,
  ],
  providers: [ReservaDemograficaStore, EdicaoDasReservasDemograficas],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reserva-demografica-list.page.html',
  host: { class: 'cfg-page' },
})
export class ReservaDemograficaListPage {
  protected readonly store = inject(ReservaDemograficaStore);
  protected readonly edicao = inject(EdicaoDasReservasDemograficas);
  protected readonly leitura = acompanharLeitura({
    falha: this.store.mensagemDeErro,
    pendente: this.store.carregando,
    indisponivel: this.edicao.gravando,
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById('cfg-reserva-list-title'),
  });
}
