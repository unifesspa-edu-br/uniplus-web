import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { acompanharLeitura, FalhaDeLeituraComponent } from '@uniplus/shared-ui/components';
import { RecusaDaLeituraComponent } from '../../../shared/recusa-da-leitura';
import { ProvidenciasListaComponent } from './providencias-lista.component';
import { ProvidenciasStore } from './providencias.store';

const ID_DO_TITULO = 'cfg-providencias-titulo';

/**
 * A fila das providências sobre concessões, a primeira de quem administra concessões: as abertas
 * no topo, a mais antiga primeiro (UNI-REQ-0375).
 */
@Component({
  selector: 'cfg-providencias-page',
  standalone: true,
  imports: [
    RouterLink,
    FalhaDeLeituraComponent,
    ProvidenciasListaComponent,
    RecusaDaLeituraComponent,
  ],
  providers: [ProvidenciasStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-page' },
  templateUrl: './providencias.page.html',
})
export class ProvidenciasPage {
  protected readonly store = inject(ProvidenciasStore);
  protected readonly leitura = acompanharLeitura({
    assunto: 'providências',
    falha: this.store.falha,
    pendente: this.store.carregando,
    recusada: computed(() => this.store.recusa() !== null),
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById(ID_DO_TITULO),
  });
}
