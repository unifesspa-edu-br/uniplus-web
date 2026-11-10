import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import {
  acompanharLeitura,
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { RecusaDaLeituraComponent } from '../../../shared/recusa-da-leitura';
import { DivergenciasDaGovernancaStore } from './divergencias-da-governanca.store';
import { tipoDaDivergencia, valorDaDivergencia } from './rotulos-da-reclassificacao';

const ID_DO_TITULO = 'cfg-divergencias-titulo';

/** As divergências da governança: o que o catálogo e os perfis de governança não dizem igual. */
@Component({
  selector: 'cfg-divergencias-da-governanca-page',
  standalone: true,
  imports: [
    RouterLink,
    DateBrPipe,
    FalhaDeLeituraComponent,
    IndicadorDaLeituraDirective,
    RecusaDaLeituraComponent,
    SpinnerComponent,
  ],
  providers: [DivergenciasDaGovernancaStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-page' },
  templateUrl: './divergencias-da-governanca.page.html',
})
export class DivergenciasDaGovernancaPage {
  protected readonly store = inject(DivergenciasDaGovernancaStore);
  protected readonly idDoTitulo = ID_DO_TITULO;
  protected readonly tipo = tipoDaDivergencia;
  protected readonly valor = valorDaDivergencia;
  protected readonly podeAbrirOPerfil = inject(PermissoesService).tem(
    PERMISSAO.autorizacao.perfisManter,
  );
  protected readonly leitura = acompanharLeitura({
    assunto: 'divergências da governança',
    falha: this.store.falha,
    pendente: this.store.carregando,
    indisponivel: signal(false),
    recusada: computed(() => this.store.recusa() !== null),
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById(ID_DO_TITULO),
  });
}
