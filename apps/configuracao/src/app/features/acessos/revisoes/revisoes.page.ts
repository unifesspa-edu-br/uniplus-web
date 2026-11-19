import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import {
  acompanharLeitura,
  AlertComponent,
  EmptyStateComponent,
  FalhaDeLeituraComponent,
  PagerComponent,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { RecusaDaLeituraComponent } from '../../../shared/recusa-da-leitura';
import { AberturaDaRevisao } from './abertura-da-revisao';
import { RevisoesStore } from './revisoes.store';
import { OPCOES_DO_FILTRO, itens, situacaoDaRevisao } from './rotulos-da-revisao';

const ID_DO_TITULO = 'cfg-revisoes-titulo';

/** As revisões periódicas de acesso, abertas e encerradas; quem conduz abre uma nova. */
@Component({
  selector: 'cfg-revisoes-page',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    DateBrPipe,
    AlertComponent,
    EmptyStateComponent,
    FalhaDeLeituraComponent,
    PagerComponent,
    RecusaDaLeituraComponent,
    SpinnerComponent,
    TagComponent,
  ],
  providers: [RevisoesStore, AberturaDaRevisao],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-page' },
  templateUrl: './revisoes.page.html',
})
export class RevisoesPage {
  protected readonly store = inject(RevisoesStore);
  protected readonly abertura = inject(AberturaDaRevisao);
  private readonly permissoes = inject(PermissoesService);
  protected readonly idDoTitulo = ID_DO_TITULO;
  protected readonly opcoes = OPCOES_DO_FILTRO;
  protected readonly situacao = situacaoDaRevisao;
  protected readonly itens = itens;
  /** Abrir revisão é de quem a conduz; quem só revê ou consulta lê a lista sem essa ação. */
  protected readonly podeAbrir = computed(() =>
    this.permissoes.tem(PERMISSAO.autorizacao.revisoesConduzir),
  );
  protected readonly leitura = acompanharLeitura({
    assunto: 'lista de revisões',
    falha: this.store.falha,
    pendente: this.store.carregando,
    recusada: computed(() => this.store.recusa() !== null),
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById(ID_DO_TITULO),
  });
}
