import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  acompanharNovaTentativa,
  AlertaNovaTentativaComponent,
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
    AlertaNovaTentativaComponent,
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
  protected readonly pendente = computed(() => this.store.carregando() || this.edicao.gravando());
  protected readonly novaTentativa = acompanharNovaTentativa({
    pendente: this.pendente,
    falhou: computed(() => this.store.mensagemDeErro() !== null),
    destino: () => document.getElementById('cfg-reserva-list-title'),
  });

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.tentarNovamente());
  }
}
