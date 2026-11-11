import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import {
  acompanharLeitura,
  AlertComponent,
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import type { EtapaDaVersao } from '@uniplus/shared-data/autorizacao';
import { RecusaDaLeituraComponent } from '../../../shared/recusa-da-leitura';
import { etapa } from '../rotulos-de-acesso';
import { EdicaoDosPerfis } from '../edicao-dos-perfis';
import { MotivoDialogComponent } from '../motivo-dialog.component';
import { PerfilFormularioComponent } from '../perfil-formulario.component';
import {
  avisoDaVersaoDoLink,
  encerradaForaDoAvisoDoLink,
  TITULO_DO_AVISO_DA_VERSAO,
} from './aviso-da-versao-do-link';
import { CancelamentoDaVersao } from './cancelamento-da-versao';
import { ContencaoDoPerfil } from './contencao-do-perfil';
import type { AcaoDaContencao } from './textos-da-contencao';
import { destacarAVersaoPendente } from './destaque-da-versao';
import { DocumentoDaVersaoService } from './documento-da-versao.service';
import {
  acoesDoPerfil,
  resumoDoDetalhe,
  situacoesDoPerfil,
  type PermissoesDaContencao,
} from './estado-do-perfil';
import { EscritaDoPerfil } from './escrita-do-perfil';
import { JanelaAbertaComponent } from './janela-aberta.component';
import { LeituraDosPerfis } from './leitura-dos-perfis';
import { PerfilDetalheStore } from './perfil-detalhe.store';
import { PROVEDORES_DE_ESCRITA_DE_PERFIS } from './provedores-de-perfis';
import { ReenvioDoDocumento } from './reenvio-do-documento';
import { RemocaoDePermissoes } from './remocao-de-permissoes';
import { RemocaoDialogComponent } from './remocao-dialog.component';
import { situacaoEncerrada } from './rotulos-da-versao';
import { SituacaoDoPerfilComponent } from './situacao-do-perfil.component';
import { SuspensaoDoPerfilComponent } from './suspensao-do-perfil.component';
import { TrilhaDaContencaoComponent } from './trilha-da-contencao.component';
import { VersaoEmVigorComponent } from './versao-em-vigor.component';
import { VersaoPendenteComponent } from './versao-pendente.component';
import { devolverFocoAoTitulo } from './foco-ao-titulo';

const ID_DO_TITULO = 'cfg-perfis-titulo';
const ACAO_DE_RETOMADA: Readonly<Record<EtapaDaVersao, AcaoDaContencao>> = {
  gestao_de_acessos: 'retomar_gestao_de_acessos',
  protecao_de_dados: 'retomar_protecao_de_dados',
};

/** Um perfil: a versão em vigor, a pendente de aprovação e as ações que o estado dele permite. */
@Component({
  selector: 'cfg-perfil-detalhe-page',
  standalone: true,
  imports: [
    RouterLink,
    AlertComponent,
    FalhaDeLeituraComponent,
    IndicadorDaLeituraDirective,
    JanelaAbertaComponent,
    SpinnerComponent,
    MotivoDialogComponent,
    PerfilFormularioComponent,
    RecusaDaLeituraComponent,
    RemocaoDialogComponent,
    SituacaoDoPerfilComponent,
    SuspensaoDoPerfilComponent,
    TrilhaDaContencaoComponent,
    VersaoEmVigorComponent,
    VersaoPendenteComponent,
  ],
  providers: [
    PerfilDetalheStore,
    { provide: LeituraDosPerfis, useExisting: PerfilDetalheStore },
    ...PROVEDORES_DE_ESCRITA_DE_PERFIS,
    CancelamentoDaVersao,
    ContencaoDoPerfil,
    RemocaoDePermissoes,
    ReenvioDoDocumento,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-page' },
  templateUrl: './perfil-detalhe.page.html',
})
export class PerfilDetalhePage {
  /** Vem do parâmetro `:id` da rota. */
  readonly id = input.required<string>();

  /** Vem do parâmetro `:versaoId` da rota do link da versão; ausente na rota do perfil. */
  readonly versaoId = input<string>();

  protected readonly store = inject(PerfilDetalheStore);
  protected readonly escrita = inject(EscritaDoPerfil);
  protected readonly edicao = inject(EdicaoDosPerfis);
  protected readonly contencao = inject(ContencaoDoPerfil);
  protected readonly cancelamento = inject(CancelamentoDaVersao);
  protected readonly remocao = inject(RemocaoDePermissoes);
  protected readonly reenvio = inject(ReenvioDoDocumento);
  private readonly documentos = inject(DocumentoDaVersaoService);
  protected readonly idDoTitulo = ID_DO_TITULO;
  protected readonly perfil = this.store.perfil;
  protected readonly situacoes = computed(() => {
    const perfil = this.perfil();
    return perfil === null ? [] : situacoesDoPerfil(resumoDoDetalhe(perfil));
  });
  protected readonly tituloDoAvisoDaVersao = TITULO_DO_AVISO_DA_VERSAO;
  protected readonly avisoDaVersao = computed(() => {
    const perfil = this.perfil();
    return perfil === null ? null : avisoDaVersaoDoLink(perfil, this.versaoId());
  });
  protected readonly avisoDaUltimaEncerrada = computed(() => {
    const perfil = this.perfil();
    return perfil === null ? null : encerradaForaDoAvisoDoLink(perfil, this.versaoId());
  });
  private readonly permissoes = inject(PermissoesService);
  private readonly permissoesDaContencao = computed<PermissoesDaContencao>(() => ({
    gestaoDeAcessos: this.permissoes.tem(PERMISSAO.autorizacao.perfisManter),
    protecaoDeDados: this.permissoes.tem(PERMISSAO.autorizacao.perfisAprovarProtecaoDeDados),
  }));
  protected readonly podeVerATrilha = computed(
    () =>
      this.permissoesDaContencao().gestaoDeAcessos || this.permissoesDaContencao().protecaoDeDados,
  );
  protected readonly acoes = computed(() => {
    const perfil = this.perfil();
    return perfil === null
      ? null
      : acoesDoPerfil(resumoDoDetalhe(perfil), this.permissoesDaContencao());
  });
  protected readonly situacaoEncerrada = situacaoEncerrada;
  protected readonly acaoDeRetomada = ACAO_DE_RETOMADA;
  protected readonly rotuloDaEtapa = (codigo: EtapaDaVersao): string => etapa(codigo).toLowerCase();
  protected readonly leitura = acompanharLeitura({
    assunto: 'perfil',
    falha: this.store.falha,
    pendente: this.store.carregando,
    indisponivel: this.escrita.gravando,
    recusada: computed(() => this.store.recusa() !== null),
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById(ID_DO_TITULO),
  });
  private destruida = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destruida = true));
    effect(() => {
      const id = this.id();
      untracked(() => this.store.id.set(id));
    });
    devolverFocoAoTitulo(this.escrita.gravando, ID_DO_TITULO);
    destacarAVersaoPendente(this.versaoPendenteDoLink);
  }

  private readonly versaoPendenteDoLink = computed(() => {
    const versaoId = this.versaoId();
    return versaoId !== undefined && this.perfil()?.versaoPendente?.versaoId === versaoId
      ? versaoId
      : null;
  });
  protected readonly pendenteEhADoLink = computed(() => this.versaoPendenteDoLink() !== null);

  protected proporVersao(): void {
    const perfil = this.perfil();
    if (perfil === null) return;
    this.edicao.abrirProposta(perfil);
  }

  protected confirmarContencao(): void {
    void this.contencao.confirmar(this.id());
  }

  protected async abrirDocumento(versaoId: string): Promise<void> {
    this.escrita.erroDaAcao.set(null);
    const desfecho = await this.documentos.abrir(this.id(), versaoId, () => !this.destruida);
    if (desfecho === 'bloqueada') {
      this.escrita.erroDaAcao.set(
        'O navegador bloqueou a abertura do documento. Libere as janelas e tente de novo.',
      );
    } else if (typeof desfecho === 'object') {
      this.escrita.erroDaAcao.set(desfecho.recusa);
    }
  }

  protected enviarDocumento(arquivo: File | null): void {
    const versao = this.perfil()?.versaoPendente;
    if (versao) void this.reenvio.enviar(this.id(), versao, arquivo);
  }

  protected cancelarVersao(): void {
    const versao = this.perfil()?.versaoPendente;
    if (versao) void this.cancelamento.confirmar(this.id(), versao.versaoId);
  }
}
