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
import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import type { ItemDaJanelaDto } from '@uniplus/shared-data/autorizacao';
import {
  acompanharLeitura,
  AlertComponent,
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { RecusaDaLeituraComponent } from '../../../shared/recusa-da-leitura';
import { nomesDeEscopo } from '../nomes-de-escopo';
import { EscritaDoPerfil } from '../versoes/escrita-do-perfil';
import { devolverFocoAoTitulo } from '../versoes/foco-ao-titulo';
import { LeituraDosPerfis } from '../versoes/leitura-dos-perfis';
import { DecisaoDaRetida } from './decisao-da-retida';
import { EnvioNaJanela } from './envio-na-janela';
import { JanelaDaMigracaoStore } from './janela-da-migracao.store';
import { LoteDaMigracao } from './lote-da-migracao';
import { LoteDaMigracaoComponent } from './lote-da-migracao.component';
import { PrazoDaJanelaComponent } from './prazo-da-janela.component';
import { RetidasDaJanelaComponent } from './retidas-da-janela.component';
import { TabelaDaJanelaComponent } from './tabela-da-janela.component';

const ID_DO_TITULO = 'cfg-janela-titulo';
const { autorizacao } = PERMISSAO;

/** A janela de migração de um perfil: o lote, as retidas, a proteção de dados, o encerramento e o prazo. */
@Component({
  selector: 'cfg-janela-da-migracao-page',
  standalone: true,
  imports: [
    RouterLink,
    AlertComponent,
    FalhaDeLeituraComponent,
    IndicadorDaLeituraDirective,
    LoteDaMigracaoComponent,
    PrazoDaJanelaComponent,
    RecusaDaLeituraComponent,
    RetidasDaJanelaComponent,
    SpinnerComponent,
    TabelaDaJanelaComponent,
  ],
  providers: [
    JanelaDaMigracaoStore,
    { provide: LeituraDosPerfis, useExisting: JanelaDaMigracaoStore },
    EscritaDoPerfil,
    EnvioNaJanela,
    LoteDaMigracao,
    DecisaoDaRetida,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-page' },
  templateUrl: './janela-da-migracao.page.html',
})
export class JanelaDaMigracaoPage {
  /** Vem do parâmetro `:id` da rota: o perfil. */
  readonly id = input.required<string>();

  protected readonly store = inject(JanelaDaMigracaoStore);
  protected readonly envio = inject(EnvioNaJanela);
  private readonly escrita = inject(EscritaDoPerfil);
  private readonly permissoes = inject(PermissoesService);
  protected readonly idDoTitulo = ID_DO_TITULO;
  protected readonly escopos = nomesDeEscopo();
  protected readonly nomeDoEscopo = (item: ItemDaJanelaDto): string => this.escopos.nome(item);
  protected readonly podeComoGestao = computed(() =>
    this.permissoes.tem(autorizacao.perfisAprovarFuncional),
  );
  protected readonly podeComoProtecaoDeDados = computed(() =>
    this.permissoes.tem(autorizacao.perfisAprovarProtecaoDeDados),
  );
  protected readonly podeVerOPerfil = computed(() => this.permissoes.tem(autorizacao.perfisManter));
  protected readonly leitura = acompanharLeitura({
    assunto: 'janela de migração',
    falha: this.store.falha,
    pendente: this.store.carregando,
    indisponivel: this.escrita.gravando,
    recusada: computed(() => this.store.recusa() !== null),
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById(ID_DO_TITULO),
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.store.perfilId.set(id));
    });
    devolverFocoAoTitulo(this.escrita.gravando, ID_DO_TITULO);
  }
}
