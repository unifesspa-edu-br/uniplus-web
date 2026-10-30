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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PERMISSAO, PermissoesService, UserContextService } from '@uniplus/shared-auth/bootstrap';
import {
  ChaveDeSubstituicao,
  ProblemI18nService,
  comChave,
  isApiOk,
  type ProblemDetails,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  PedidosDeConcessaoApi,
  type EventoDaTrilhaDto,
  type PedidoDeConcessaoDto,
} from '@uniplus/shared-data/autorizacao';
import {
  AlertComponent,
  ConfirmDialogComponent,
  FileUploadComponent,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { ehOBeneficiario } from './beneficiario-do-pedido';
import { AnexoDoPedidoService } from './anexo-do-pedido.service';
import { FALHA_INESPERADA, textoDaRecusa } from './mensagens-de-acesso';
import { MotivoDialogComponent } from './motivo-dialog.component';
import { nomesDeEscopo } from './nomes-de-escopo';
import { origemDaFila } from './origens-do-pedido';
import { autorDoEvento, TrilhaDeAcessoComponent } from './trilha-de-acesso.component';
import {
  etapa,
  motivoDaDispensa,
  sensibilidade,
  situacaoDoAnexo,
  situacaoDoPedido,
  tipoDeEvento,
} from './rotulos-de-acesso';

const ENCERRADOS: readonly string[] = ['aprovado', 'recusado', 'cancelado'];

type Acao = 'aprovar' | 'recusar' | 'aceitar' | 'cancelar';

/** Um pedido de concessão: partes, anexos, decisões e trilha, com as ações de cada papel. */
@Component({
  selector: 'cfg-pedido-detalhe-page',
  standalone: true,
  imports: [
    RouterLink,
    AlertComponent,
    ConfirmDialogComponent,
    FileUploadComponent,
    MotivoDialogComponent,
    SpinnerComponent,
    TagComponent,
    TrilhaDeAcessoComponent,
    DateBrPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-page' },
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Pedido de acesso</h1>
        <p class="page-header__desc">
          <a [routerLink]="origem.rota">{{ origem.voltar }}</a>
        </p>
      </div>
    </div>

    @if (erro()) {
      <ui-alert variant="danger" heading="Não foi possível concluir">{{ erro() }}</ui-alert>
    }

    @if (carregando()) {
      <p role="status"><ui-spinner size="sm" /> Carregando o pedido…</p>
    }

    @if (pedido(); as p) {
      @if (aguardandoDocumento()) {
        <ui-alert variant="warning" heading="Falta o documento de designação">
          @if (ehSolicitante()) {
            Anexe o PDF do documento de designação em Documentos, abaixo. O pedido só segue para
            aprovação depois que o documento for verificado.
          } @else {
            O pedido espera o solicitante anexar o documento de designação.
          }
        </ui-alert>
      }
      <section class="panel" aria-labelledby="cfg-pedido-resumo">
        <div class="panel-head">
          <h2 id="cfg-pedido-resumo" class="panel-head__title">Resumo</h2>
          <ui-tag [variant]="rotuloDaSituacao().variante">{{ rotuloDaSituacao().texto }}</ui-tag>
        </div>
        <dl class="cfg-descricao panel-body">
          <dt>Perfil</dt>
          <dd>{{ p.perfil.nome }}</dd>
          <dt>Escopo</dt>
          <dd>{{ escopo.nome(p.escopo) }}</dd>
          <dt>Beneficiário</dt>
          <dd>{{ p.beneficiario.nome ?? p.beneficiario.email }}</dd>
          <dt>E-mail do beneficiário</dt>
          <dd>{{ p.beneficiario.email }}</dd>
          <dt>Pedido em</dt>
          <dd>{{ p.criadoEm | dateBr: 'datetime' }}</dd>
          @if (p.etapaAtual) {
            <dt>Etapa atual</dt>
            <dd>{{ etapaAtual() }}</dd>
          }
          <dt>Justificativa</dt>
          <dd>{{ p.justificativa }}</dd>
        </dl>

        <div class="cfg-acoes panel-body">
          @if (podeAceitar()) {
            <button type="button" class="btn btn--primary" (click)="pedirConfirmacao('aceitar')">
              Aceitar o pedido
            </button>
          }
          @if (podeDecidir()) {
            <button type="button" class="btn btn--primary" (click)="pedirConfirmacao('aprovar')">
              Aprovar
            </button>
            <button type="button" class="btn btn--danger" (click)="abrirRecusa()">Recusar</button>
          }
          @if (aguardandoDocumento() && podeAnexar()) {
            <button type="button" class="btn btn--primary" (click)="irParaOAnexo()">
              Anexar o documento
            </button>
          }
          @if (podeCancelar()) {
            <button type="button" class="btn btn--tertiary" (click)="pedirConfirmacao('cancelar')">
              Cancelar o pedido
            </button>
          }
        </div>
      </section>

      <section class="panel" aria-labelledby="cfg-pedido-anexos">
        <div class="panel-head">
          <h2 id="cfg-pedido-anexos">Documentos</h2>
        </div>
        <div class="panel-body cfg-bloco">
          @if (p.anexos.length === 0) {
            <p class="cfg-muted">Nenhum documento anexado.</p>
          } @else {
            <ul class="cfg-lista">
              @for (anexo of p.anexos; track anexo.id) {
                <li>
                  Documento enviado em
                  {{ anexo.enviadoEm ? (anexo.enviadoEm | dateBr: 'datetime') : '—' }} ·
                  {{ rotuloDoAnexo(anexo.situacao) }}
                  @if (anexo.situacao === 'verificado') {
                    <button
                      type="button"
                      class="btn btn--tertiary btn--sm"
                      (click)="abrirAnexo(anexo.id)"
                    >
                      Abrir documento
                    </button>
                  }
                </li>
              }
            </ul>
          }
          @if (podeAnexar()) {
            <ui-file-upload
              fieldLabel="Anexar documento"
              acceptedFileTypes=".pdf"
              acceptLabel="PDF de até 10 MB"
              [allowedMimeTypes]="['application/pdf']"
              [maxSizeMb]="10"
              [disabled]="anexando()"
              [mensagemExterna]="erroDoAnexo()"
              (selectedFileChange)="anexar($event)"
            />
            @if (anexando()) {
              <p role="status"><ui-spinner size="sm" /> Enviando o documento…</p>
            }
          }
        </div>
      </section>

      <section class="panel" aria-labelledby="cfg-pedido-decisoes">
        <div class="panel-head">
          <h2 id="cfg-pedido-decisoes">Decisões</h2>
        </div>
        <div class="panel-body">
          @if (p.decisoes.length === 0) {
            <p class="cfg-muted">Nenhuma decisão registrada.</p>
          } @else {
            <ul class="cfg-lista">
              @for (decisao of p.decisoes; track $index) {
                <li class="cfg-lista__coluna">
                  <strong>{{ etapaDe(decisao.etapa) }}</strong>
                  <span>
                    {{ rotuloDaDecisao(decisao.resultado) }} em
                    {{ decisao.instante | dateBr: 'datetime' }} por {{ autorDe(decisao.decisor) }}
                  </span>
                  <span class="cfg-muted">
                    Sensibilidade avaliada: {{ sensibilidadeDe(decisao.sensibilidadeAvaliada) }}
                  </span>
                  @if (decisao.motivo) {
                    <span>Motivo: {{ decisao.motivo }}</span>
                  }
                  @if (decisao.dispensa) {
                    <span>Segunda aprovação dispensada: {{ dispensaDe(decisao.dispensa) }}</span>
                  }
                </li>
              }
            </ul>
          }
        </div>
      </section>

      <section class="panel" aria-labelledby="cfg-pedido-trilha">
        <div class="panel-head">
          <h2 id="cfg-pedido-trilha">Trilha</h2>
        </div>
        <cfg-trilha-de-acesso [eventos]="trilha()" legenda="Trilha do pedido" />
      </section>
    }

    <ui-confirm-dialog
      [(visible)]="confirmando"
      [heading]="confirmacao().titulo"
      [message]="confirmacao().mensagem"
      [confirmLabel]="confirmacao().rotulo"
      [confirmVariant]="acaoPendente() === 'cancelar' ? 'danger' : 'primary'"
      (confirmed)="executar()"
    />

    <cfg-motivo-dialog
      [(visible)]="recusando"
      heading="Recusar o pedido"
      confirmLabel="Recusar pedido"
      ajuda="O motivo fica na trilha e explica ao solicitante por que o acesso não foi concedido."
      [erro]="erroDaRecusa()"
      [enviando]="enviando()"
      (confirmado)="recusar($event)"
    />
  `,
})
export class PedidoDetalhePage {
  /** Vem do parâmetro `:id` da rota. */
  readonly id = input.required<string>();

  private readonly api = inject(PedidosDeConcessaoApi);
  private readonly anexos = inject(AnexoDoPedidoService);
  private readonly permissoes = inject(PermissoesService);
  private readonly usuario = inject(UserContextService);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  private readonly router = inject(Router);

  /** A lista de onde a pessoa veio; o retorno não a manda para os próprios pedidos se ela veio de outra. */
  protected readonly origem = origemDaFila(
    inject(ActivatedRoute).snapshot.queryParamMap.get('origem'),
  );
  private readonly destruido = signal(false);
  private readonly chave = new ChaveDeSubstituicao();

  protected readonly escopo = nomesDeEscopo();
  protected readonly pedido = signal<PedidoDeConcessaoDto | null>(null);
  protected readonly trilha = signal<readonly EventoDaTrilhaDto[]>([]);
  protected readonly carregando = signal(false);
  private ultimaCarga = 0;
  protected readonly enviando = signal(false);
  protected readonly anexando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly erroDaRecusa = signal<string | null>(null);
  protected readonly erroDoAnexo = signal<string | null>(null);
  protected readonly confirmando = signal(false);
  protected readonly recusando = signal(false);
  protected readonly acaoPendente = signal<Acao>('aprovar');

  protected readonly rotuloDaSituacao = computed(() =>
    situacaoDoPedido(this.pedido()?.situacao ?? ''),
  );
  protected readonly etapaAtual = computed(() => etapa(this.pedido()?.etapaAtual ?? null));

  protected readonly confirmacao = computed(() => CONFIRMACOES[this.acaoPendente()]);

  private readonly encerrado = computed(() => ENCERRADOS.includes(this.pedido()?.situacao ?? ''));
  protected readonly aguardandoDocumento = computed(
    () => this.pedido()?.situacao === 'aguardando_documento',
  );
  protected readonly ehSolicitante = computed(
    () => this.pedido()?.solicitante.sub === this.usuario.user()?.id,
  );
  private readonly ehBeneficiario = computed(() => {
    const beneficiario = this.pedido()?.beneficiario;
    const eu = this.usuario.user();
    return beneficiario !== undefined && eu !== null && ehOBeneficiario(beneficiario, eu);
  });
  private readonly semDecisao = computed(() => (this.pedido()?.decisoes.length ?? 0) === 0);

  /**
   * A API recusa só quem aprovou como gestor e agora decidiria como proteção de dados: a aprovação do gestor
   * que o perfil alterado devolveu ao gestor não impede ninguém de decidir de novo na etapa dele.
   */
  private readonly jaAprovouComoGestor = computed(() => {
    const eu = this.usuario.user()?.id;
    return (this.pedido()?.decisoes ?? []).some(
      (decisao) =>
        decisao.etapa === 'gestor' &&
        decisao.resultado === 'aprovado' &&
        decisao.decisor.sub === eu,
    );
  });

  protected readonly podeAceitar = computed(
    () => this.pedido()?.situacao === 'aguardando_beneficiario' && this.ehBeneficiario(),
  );
  protected readonly podeCancelar = computed(
    () => !this.encerrado() && this.ehSolicitante() && this.semDecisao(),
  );
  protected readonly podeAnexar = this.podeCancelar;
  protected readonly podeDecidir = computed(() => {
    const etapaAtual = this.pedido()?.etapaAtual;
    if (this.ehSolicitante() || this.ehBeneficiario()) return false;
    if (etapaAtual === 'protecao_de_dados' && this.jaAprovouComoGestor()) return false;
    return (
      (etapaAtual === 'gestor' &&
        this.permissoes.tem(PERMISSAO.autorizacao.pedidosAprovarFuncional)) ||
      (etapaAtual === 'protecao_de_dados' &&
        this.permissoes.tem(PERMISSAO.autorizacao.pedidosAprovarProtecaoDeDados))
    );
  });

  protected readonly rotuloDoAnexo = situacaoDoAnexo;
  protected readonly etapaDe = etapa;
  protected readonly sensibilidadeDe = sensibilidade;
  protected readonly autorDe = autorDoEvento;
  protected readonly dispensaDe = motivoDaDispensa;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.destruido.set(true));
    // O roteador reaproveita a página quando só o `:id` muda: cada id carrega o seu pedido.
    effect(() => {
      this.id();
      untracked(() => {
        this.pedido.set(null);
        this.trilha.set([]);
        this.erro.set(null);
        this.chave.renovar();
        void this.carregar();
      });
    });
  }

  protected rotuloDaDecisao(resultado: string): string {
    return tipoDeEvento(resultado);
  }

  protected pedirConfirmacao(acao: Acao): void {
    this.acaoPendente.set(acao);
    this.confirmando.set(true);
  }

  protected async executar(): Promise<void> {
    const acao = this.acaoPendente();
    if (acao === 'cancelar') {
      await this.cancelar();
      return;
    }
    const id = this.id();
    await this.decidir(() =>
      comChave(this.chave, { acao, id }, (contexto) =>
        acao === 'aceitar' ? this.api.aceitar(id, contexto) : this.api.aprovar(id, contexto),
      ),
    );
  }

  protected abrirRecusa(): void {
    this.erroDaRecusa.set(null);
    this.recusando.set(true);
  }

  protected async recusar(motivo: string): Promise<void> {
    const id = this.id();
    this.erroDaRecusa.set(null);
    const feito = await this.decidir(
      () =>
        comChave(this.chave, { motivo, id }, (contexto) => this.api.recusar(id, motivo, contexto)),
      this.erroDaRecusa,
    );
    if (feito) {
      this.recusando.set(false);
    } else if (!this.podeDecidir()) {
      // Sem a etapa, o diálogo não tem o que corrigir: a explicação vai para o alerta da página.
      this.erro.set(this.erroDaRecusa());
      this.recusando.set(false);
    }
  }

  protected irParaOAnexo(): void {
    const zona = document.querySelector<HTMLElement>(
      '[aria-labelledby="cfg-pedido-anexos"] .uni-uploader__drop',
    );
    zona?.scrollIntoView({ block: 'center' });
    zona?.focus();
  }

  protected async anexar(arquivo: File | null): Promise<void> {
    if (arquivo === null || this.anexando()) return;
    this.anexando.set(true);
    this.erroDoAnexo.set(null);
    try {
      const desfecho = await this.anexos.anexar(this.id(), arquivo, () => undefined);
      if (desfecho.ok) {
        this.notificacoes.success('Documento enviado', 'Ele segue para verificação.');
        await this.carregar();
      } else {
        this.erroDoAnexo.set(desfecho.mensagem);
      }
    } catch {
      this.erroDoAnexo.set(FALHA_INESPERADA);
    } finally {
      this.anexando.set(false);
    }
  }

  protected async abrirAnexo(anexoId: string): Promise<void> {
    const desfecho = await this.anexos.abrir(this.id(), anexoId, () => !this.destruido());
    if (desfecho === 'bloqueada') {
      this.erro.set(
        'O navegador bloqueou a abertura do documento. Libere as janelas e tente de novo.',
      );
    } else if (typeof desfecho === 'object') {
      this.erro.set(desfecho.recusa);
    }
  }

  private async cancelar(): Promise<void> {
    if (this.enviando()) return;
    this.enviando.set(true);
    try {
      const resultado = await firstValueFrom(this.api.cancelar(this.id()));
      if (!isApiOk(resultado)) {
        this.erro.set(this.texto(resultado.problem));
        return;
      }
      this.notificacoes.success('Pedido cancelado');
      await this.router.navigate(['/acessos/pedidos']);
    } catch {
      this.erro.set(FALHA_INESPERADA);
    } finally {
      this.enviando.set(false);
    }
  }

  /** Executa uma decisão sobre o pedido e recarrega o que a API devolveu. */
  private async decidir(
    enviar: () => ReturnType<typeof comChave<PedidoDeConcessaoDto>>,
    destinoDoErro = this.erro,
  ): Promise<boolean> {
    if (this.enviando()) return false;
    this.enviando.set(true);
    this.erro.set(null);
    try {
      const { resultado } = await enviar();
      if (!resultado.ok) {
        destinoDoErro.set(this.texto(resultado.problem));
        // A recusa pode vir de o pedido ter mudado de etapa: a tela volta a mostrar o que a API tem.
        await this.carregar();
        return false;
      }
      this.notificacoes.success('Pedido atualizado');
      await this.carregar();
      return true;
    } catch {
      destinoDoErro.set(FALHA_INESPERADA);
      return false;
    } finally {
      this.enviando.set(false);
    }
  }

  private async carregar(): Promise<void> {
    const chamada = ++this.ultimaCarga;
    const atual = () => chamada === this.ultimaCarga;
    this.carregando.set(true);
    const id = this.id();
    try {
      const [pedido, trilha] = await Promise.all([
        firstValueFrom(this.api.obter(id)),
        firstValueFrom(this.api.trilha(id)),
      ]);
      if (!atual()) return;
      if (!pedido.ok) {
        this.pedido.set(null);
        this.erro.set(this.texto(pedido.problem));
        return;
      }
      this.pedido.set(pedido.data);
      this.trilha.set(trilha.ok ? trilha.data : []);
    } catch {
      if (atual()) this.erro.set(FALHA_INESPERADA);
    } finally {
      if (atual()) this.carregando.set(false);
    }
  }

  private texto(problema: ProblemDetails): string {
    return textoDaRecusa(this.problemas.resolve(problema));
  }
}

interface Confirmacao {
  readonly titulo: string;
  readonly mensagem: string;
  readonly rotulo: string;
}

const CONFIRMACOES: Readonly<Record<Acao, Confirmacao>> = {
  aprovar: {
    titulo: 'Aprovar o pedido',
    mensagem:
      'Confirma a aprovação desta etapa? A decisão fica registrada na trilha com o seu nome.',
    rotulo: 'Aprovar',
  },
  aceitar: {
    titulo: 'Aceitar o pedido',
    mensagem: 'Confirma que você é o beneficiário e quer receber este acesso?',
    rotulo: 'Aceitar',
  },
  cancelar: {
    titulo: 'Cancelar o pedido',
    mensagem: 'O pedido sai das filas dos aprovadores. Deseja cancelá-lo?',
    rotulo: 'Cancelar pedido',
  },
  recusar: { titulo: 'Recusar o pedido', mensagem: '', rotulo: 'Recusar' },
};
