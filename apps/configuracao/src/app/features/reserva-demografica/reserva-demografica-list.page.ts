import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { focarAposNovaTentativa } from '../../shared/foco';
import { EdicaoDasReservasDemograficas } from './edicao-das-reservas-demograficas';
import { ReservaDemograficaFormularioComponent } from './reserva-demografica-formulario.component';
import { ReservaDemograficaListaComponent } from './reserva-demografica-lista.component';
import { ReservaDemograficaStore } from './reserva-demografica.store';

@Component({
  selector: 'cfg-reserva-demografica-page',
  standalone: true,
  imports: [
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
  private readonly novaTentativa = focarAposNovaTentativa(
    this.pendente,
    computed(() => this.store.mensagemDeErro() !== null),
    () => document.getElementById('cfg-reserva-list-title'),
  );

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.tentarNovamente());
  }
}
