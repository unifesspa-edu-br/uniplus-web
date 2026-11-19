import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import { TemPermissaoDirective } from '@uniplus/shared-auth/components';
import {
  acompanharLeitura,
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { RecusaDaLeituraComponent } from '../../shared/recusa-da-leitura';
import { ConcessaoDetalheStore } from './concessao-detalhe.store';
import { nomesDeEscopo } from './nomes-de-escopo';
import { SolicitacaoDeProvidencia } from './providencias/solicitacao-de-providencia';
import { SolicitarProvidenciaDialogComponent } from './providencias/solicitar-providencia-dialog.component';
import { situacaoDaConcessao } from './situacao-da-concessao';
import { autorDoEvento, TrilhaDeAcessoComponent } from './trilha-de-acesso.component';

const ID_DO_TITULO = 'cfg-concessao-titulo';

/**
 * Uma concessão, com a revogação e o motivo dela, e a trilha. Quem tem a permissão solicita
 * providência sobre a concessão ativa (UNI-REQ-0375).
 */
@Component({
  selector: 'cfg-concessao-detalhe-page',
  standalone: true,
  imports: [
    RouterLink,
    DateBrPipe,
    FalhaDeLeituraComponent,
    IndicadorDaLeituraDirective,
    RecusaDaLeituraComponent,
    SolicitarProvidenciaDialogComponent,
    SpinnerComponent,
    TagComponent,
    TemPermissaoDirective,
    TrilhaDeAcessoComponent,
  ],
  providers: [ConcessaoDetalheStore, SolicitacaoDeProvidencia],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-page' },
  templateUrl: './concessao-detalhe.page.html',
})
export class ConcessaoDetalhePage {
  /** Vem do parâmetro `:id` da rota. */
  readonly id = input.required<string>();

  protected readonly store = inject(ConcessaoDetalheStore);
  protected readonly escopo = nomesDeEscopo();
  protected readonly idDoTitulo = ID_DO_TITULO;
  protected readonly situacao = situacaoDaConcessao;
  protected readonly pessoa = autorDoEvento;
  protected readonly solicitacao = inject(SolicitacaoDeProvidencia);
  protected readonly permissaoDeSolicitar = PERMISSAO.autorizacao.providenciasSolicitar;
  protected readonly leitura = acompanharLeitura({
    assunto: 'concessão',
    falha: this.store.falha,
    pendente: this.store.carregando,
    recusada: computed(() => this.store.recusa() !== null),
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById(ID_DO_TITULO),
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.store.id.set(id));
    });
  }
}
