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
import {
  acompanharLeitura,
  AlertComponent,
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { RecusaDaLeituraComponent } from '../../../shared/recusa-da-leitura';
import { EdicaoDosPerfis } from '../edicao-dos-perfis';
import { MotivoDialogComponent } from '../motivo-dialog.component';
import { PerfilFormularioComponent } from '../perfil-formulario.component';
import { AtivacaoDoPerfil } from './ativacao-do-perfil';
import { CancelamentoDaVersao } from './cancelamento-da-versao';
import { DocumentoDaVersaoService } from './documento-da-versao.service';
import { acoesDoPerfil, resumoDoPerfil, situacoesDoPerfil } from './estado-do-perfil';
import { EscritaDoPerfil } from './escrita-do-perfil';
import { LeituraDosPerfis } from './leitura-dos-perfis';
import { PerfilDetalheStore } from './perfil-detalhe.store';
import { PROVEDORES_DE_ESCRITA_DE_PERFIS } from './provedores-de-perfis';
import { ReenvioDoDocumento } from './reenvio-do-documento';
import { RemocaoDePermissoes } from './remocao-de-permissoes';
import { RemocaoDialogComponent } from './remocao-dialog.component';
import { situacaoEncerrada } from './rotulos-da-versao';
import { VersaoEmVigorComponent } from './versao-em-vigor.component';
import { VersaoPendenteComponent } from './versao-pendente.component';
import { devolverFocoAoTitulo } from './foco-ao-titulo';

const ID_DO_TITULO = 'cfg-perfis-titulo';

/** Um perfil: a versão em vigor, a pendente de aprovação e as ações que o estado dele permite. */
@Component({
  selector: 'cfg-perfil-detalhe-page',
  standalone: true,
  imports: [
    RouterLink,
    AlertComponent,
    FalhaDeLeituraComponent,
    IndicadorDaLeituraDirective,
    SpinnerComponent,
    MotivoDialogComponent,
    PerfilFormularioComponent,
    RecusaDaLeituraComponent,
    RemocaoDialogComponent,
    TagComponent,
    VersaoEmVigorComponent,
    VersaoPendenteComponent,
  ],
  providers: [
    PerfilDetalheStore,
    { provide: LeituraDosPerfis, useExisting: PerfilDetalheStore },
    ...PROVEDORES_DE_ESCRITA_DE_PERFIS,
    CancelamentoDaVersao,
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

  protected readonly store = inject(PerfilDetalheStore);
  protected readonly escrita = inject(EscritaDoPerfil);
  protected readonly edicao = inject(EdicaoDosPerfis);
  protected readonly ativacao = inject(AtivacaoDoPerfil);
  protected readonly cancelamento = inject(CancelamentoDaVersao);
  protected readonly remocao = inject(RemocaoDePermissoes);
  protected readonly reenvio = inject(ReenvioDoDocumento);
  private readonly documentos = inject(DocumentoDaVersaoService);
  protected readonly idDoTitulo = ID_DO_TITULO;
  protected readonly perfil = this.store.perfil;
  protected readonly situacoes = computed(() => {
    const perfil = this.perfil();
    return perfil === null ? [] : situacoesDoPerfil(resumoDoPerfil(perfil));
  });
  protected readonly acoes = computed(() => {
    const perfil = this.perfil();
    return perfil === null ? null : acoesDoPerfil(resumoDoPerfil(perfil));
  });
  protected readonly situacaoEncerrada = situacaoEncerrada;
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
  }

  protected proporVersao(): void {
    const perfil = this.perfil();
    if (perfil === null) return;
    this.ativacao.limparAnuncio();
    this.edicao.abrirProposta(perfil);
  }

  protected alternarAtivacao(): void {
    const perfil = this.perfil();
    if (perfil !== null) void this.ativacao.alternar(perfil);
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
