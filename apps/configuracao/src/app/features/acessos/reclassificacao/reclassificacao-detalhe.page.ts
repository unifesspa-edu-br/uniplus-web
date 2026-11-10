import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import type { ConcessaoSuspensaDto, EtapaDaVersao } from '@uniplus/shared-data/autorizacao';
import {
  acompanharLeitura,
  AlertComponent,
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { RecusaDaLeituraComponent } from '../../../shared/recusa-da-leitura';
import { nomesDeEscopo } from '../nomes-de-escopo';
import { DocumentoDaVersaoService } from '../versoes/documento-da-versao.service';
import { EscritaDoPerfil } from '../versoes/escrita-do-perfil';
import { devolverFocoAoTitulo } from '../versoes/foco-ao-titulo';
import { LeituraDosPerfis } from '../versoes/leitura-dos-perfis';
import { ConcessoesSuspensasComponent } from './concessoes-suspensas.component';
import { DecisaoDaReclassificacao } from './decisao-da-reclassificacao';
import { DecisaoDaReclassificacaoComponent } from './decisao-da-reclassificacao.component';
import { ReclassificacaoDetalheStore } from './reclassificacao-detalhe.store';
import { FILA_DA_ETAPA, mudancasDaPermissao } from './rotulos-da-reclassificacao';
import { VersoesEmUsoComponent } from './versoes-em-uso.component';

const ID_DO_TITULO = 'cfg-reclassificacao-titulo';
const { autorizacao } = PERMISSAO;
const BLOQUEIO_DO_NAVEGADOR =
  'O navegador bloqueou a abertura do documento. Libere as janelas e tente de novo.';

/** Uma permissão reclassificada: o que mudou, as versões em uso, as concessões suspensas e a decisão. */
@Component({
  selector: 'cfg-reclassificacao-detalhe-page',
  standalone: true,
  imports: [
    RouterLink,
    DateBrPipe,
    AlertComponent,
    ConcessoesSuspensasComponent,
    DecisaoDaReclassificacaoComponent,
    FalhaDeLeituraComponent,
    IndicadorDaLeituraDirective,
    RecusaDaLeituraComponent,
    SpinnerComponent,
    VersoesEmUsoComponent,
  ],
  providers: [
    ReclassificacaoDetalheStore,
    { provide: LeituraDosPerfis, useExisting: ReclassificacaoDetalheStore },
    EscritaDoPerfil,
    DecisaoDaReclassificacao,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-page' },
  templateUrl: './reclassificacao-detalhe.page.html',
})
export class ReclassificacaoDetalhePage {
  /** Vem do parâmetro `:id` da rota. */
  readonly id = input.required<string>();

  protected readonly store = inject(ReclassificacaoDetalheStore);
  protected readonly decisao = inject(DecisaoDaReclassificacao);
  private readonly escrita = inject(EscritaDoPerfil);
  private readonly permissoes = inject(PermissoesService);
  private readonly documentos = inject(DocumentoDaVersaoService);
  private readonly escopos = nomesDeEscopo();
  private destruida = false;
  protected readonly idDoTitulo = ID_DO_TITULO;
  protected readonly mudancas = mudancasDaPermissao;
  protected readonly avisoDoDocumento = signal<string | null>(null);
  protected readonly nomeDoEscopo = (concessao: ConcessaoSuspensaDto): string =>
    this.escopos.nome(concessao);
  protected readonly etapasDaPessoa = computed<readonly EtapaDaVersao[]>(() => [
    ...(this.permissoes.tem(autorizacao.perfisAprovarFuncional)
      ? (['gestao_de_acessos'] as const)
      : []),
    ...(this.permissoes.tem(autorizacao.perfisAprovarProtecaoDeDados)
      ? (['protecao_de_dados'] as const)
      : []),
  ]);
  protected readonly voltar = computed(
    () => FILA_DA_ETAPA[this.etapasDaPessoa()[0] ?? 'gestao_de_acessos'],
  );
  protected readonly etapaAberta = computed(() =>
    this.etapasDaPessoa().length > 0 && this.store.reclassificacao()?.vigente
      ? this.decisao.etapa()
      : undefined,
  );
  protected readonly selecaoTravada = computed(
    () =>
      this.decisao.alcance() === 'todas' || this.escrita.gravando() || this.store.carregando(),
  );
  protected readonly leitura = acompanharLeitura({
    assunto: 'reclassificação',
    falha: this.store.falha,
    pendente: this.store.carregando,
    indisponivel: this.escrita.gravando,
    recusada: computed(() => this.store.recusa() !== null),
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById(ID_DO_TITULO),
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destruida = true));
    effect(() => {
      const id = this.id();
      untracked(() => this.store.id.set(id));
    });
    devolverFocoAoTitulo(this.escrita.gravando, ID_DO_TITULO);
  }

  protected async abrirDocumento(perfilId: string, versaoId: string): Promise<void> {
    this.avisoDoDocumento.set(null);
    const desfecho = await this.documentos.abrir(perfilId, versaoId, () => !this.destruida);
    if (desfecho === 'bloqueada') this.avisoDoDocumento.set(BLOQUEIO_DO_NAVEGADOR);
    else if (typeof desfecho === 'object') this.avisoDoDocumento.set(desfecho.recusa);
  }
}
