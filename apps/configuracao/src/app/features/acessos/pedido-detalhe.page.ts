import { EdicaoDoPedido } from './edicao-do-pedido';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PERMISSAO, PermissoesService, UserContextService } from '@uniplus/shared-auth/bootstrap';
import {
  acompanharLeitura,
  AlertComponent,
  DialogComponent,
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { focoEstaLivre } from '../../shared/foco';
import { ehOBeneficiario } from './beneficiario-do-pedido';
import { AnexoDoPedidoService } from './anexo-do-pedido.service';
import { MotivoDialogComponent } from './motivo-dialog.component';
import { PedidoDetalheStore } from './pedido-detalhe.store';
import { origemDaFila } from './origens-do-pedido';
import { diaDoInstante, diaNoPassado } from './prazo-de-vigencia';
import { nomesDeEscopo } from './nomes-de-escopo';
import { PedidoResumoComponent } from './pedido-resumo.component';
import { PedidoDocumentosComponent } from './pedido-documentos.component';
import { PedidoHistoricoComponent } from './pedido-historico.component';
import { RecusaDaLeituraComponent } from '../../shared/recusa-da-leitura';

const ENCERRADOS: readonly string[] = ['aprovado', 'recusado', 'cancelado'];

import { CONFIRMACOES, type Acao } from './confirmacoes-do-pedido';

/** Um pedido de concessão: partes, anexos, decisões e trilha, com as ações de cada papel. */
@Component({
  selector: 'cfg-pedido-detalhe-page',
  standalone: true,
  imports: [
    RouterLink,
    AlertComponent,
    DialogComponent,
    MotivoDialogComponent,
    SpinnerComponent,
    PedidoResumoComponent,
    PedidoDocumentosComponent,
    PedidoHistoricoComponent,
    FalhaDeLeituraComponent,
    IndicadorDaLeituraDirective,
    RecusaDaLeituraComponent,
  ],
  providers: [PedidoDetalheStore, EdicaoDoPedido],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-page' },
  templateUrl: './pedido-detalhe.page.html',
})
export class PedidoDetalhePage {
  /** Vem do parâmetro `:id` da rota. */
  readonly id = input.required<string>();

  protected readonly store = inject(PedidoDetalheStore);
  private readonly edicao = inject(EdicaoDoPedido);
  private readonly anexos = inject(AnexoDoPedidoService);
  private readonly permissoes = inject(PermissoesService);
  private readonly usuario = inject(UserContextService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /** A lista de onde a pessoa veio; o retorno não a manda para os próprios pedidos se ela veio de outra. */
  protected readonly origem = origemDaFila(
    inject(ActivatedRoute).snapshot.queryParamMap.get('origem'),
  );
  private readonly destruido = signal(false);
  /**
   * O botão que tinha o foco (o de uma decisão, o de um diálogo) saiu da tela: o foco volta ao título
   * quando a leitura que se segue termina.
   */
  private focoDevidoAoTitulo = false;
  private readonly chave = this.edicao.chave;
  protected readonly leitura = acompanharLeitura({
    falha: this.store.falha,
    pendente: this.store.carregando,
    recusada: computed(() => this.store.recusa() !== null),
    recarregar: () => this.store.recarregar(),
    destino: () => this.host.nativeElement.querySelector<HTMLElement>('#cfg-pedido-titulo'),
  });

  protected readonly escopo = nomesDeEscopo();
  protected readonly pedido = this.store.pedido;
  protected readonly trilha = this.store.trilha;
  protected readonly carregando = this.store.carregando;
  protected readonly erroDeCarga = this.store.erro;
  protected readonly decisaoIndisponivel = computed(
    () => this.enviando() || this.erroDeCarga() !== null,
  );
  protected readonly enviando = computed(() => this.edicao.enviando() || this.store.carregando());
  protected readonly anexando = this.edicao.anexando;
  protected readonly erro = this.edicao.erro;
  protected readonly erroDaRecusa = this.edicao.erroDaRecusa;
  protected readonly erroDoAnexo = this.edicao.erroDoAnexo;
  protected readonly confirmando = this.edicao.confirmando;
  protected readonly motivo = this.edicao.motivo;
  protected readonly tentouRecusar = this.edicao.tentouRecusar;
  protected readonly recusando = this.edicao.recusando;
  protected readonly acaoPendente = this.edicao.acaoPendente;
  protected readonly prazo = this.edicao.prazo;
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

  /** O prazo se define na aprovação do gestor; a proteção de dados só vê o que ele definiu. */
  protected readonly informaPrazo = computed(
    () =>
      this.podeDecidir() &&
      this.pedido()?.etapaAtual === 'gestor' &&
      this.pedido()?.admitePrazo === true,
  );

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

  constructor() {
    inject(DestroyRef).onDestroy(() => this.destruido.set(true));
    this.acompanharId();
    effect(() => {
      const pedido = this.store.pedido();
      const erro = this.store.erro();
      untracked(() => {
        if (erro) this.aoFalharACarga();
        if (pedido && this.prazo.pristine) {
          const sugerido = diaDoInstante(pedido.validaAteSugerida);
          this.prazo.setValue(diaNoPassado(sugerido) ? '' : sugerido);
        }
      });
    });
    effect(() => {
      const carregando = this.store.carregando();
      const erro = this.store.erro();
      const pedido = this.store.pedido();
      this.podeDecidir();
      this.podeAceitar();
      this.podeCancelar();
      if (!carregando && !erro && pedido) {
        untracked(() => {
          this.reavaliarDialogos();
          this.devolverFocoAoTitulo();
        });
      }
    });
  }

  /**
   * Terminada a carga que seguiu uma decisão, o botão que tinha o foco saiu da tela: o foco vai ao
   * título, se ninguém o tomou.
   */
  private devolverFocoAoTitulo(): void {
    if (!this.focoDevidoAoTitulo && !this.edicao.decisaoConcluida()) return;
    this.focoDevidoAoTitulo = false;
    this.edicao.decisaoConcluida.set(false);
    afterNextRender(
      () => {
        if (focoEstaLivre()) {
          this.host.nativeElement.querySelector<HTMLElement>('#cfg-pedido-titulo')?.focus();
        }
      },
      { injector: this.injector },
    );
  }

  /**
   * A carga falhou: o que o pedido permitia deixa de valer e os diálogos fecham. Se um deles
   * estava aberto, o foco vai ao aviso da falha, que o diálogo fechado deixou sem dono.
   */
  private aoFalharACarga(): void {
    const haviaDialogo = this.confirmando() || this.recusando();
    this.focoDevidoAoTitulo = false;
    this.edicao.decisaoConcluida.set(false);
    this.confirmando.set(false);
    this.recusando.set(false);
    if (!haviaDialogo) return;
    afterNextRender(
      () => {
        const host = this.host.nativeElement;
        const alvo =
          host.querySelector<HTMLElement>('#tentar-pedido') ??
          host.querySelector<HTMLElement>('#cfg-pedido-titulo');
        alvo?.focus();
      },
      { injector: this.injector },
    );
  }

  private acompanharId(): void {
    effect(() => {
      const id = this.id();
      untracked(() => {
        this.store.id.set(id);
        this.erro.set(null);
        this.prazo.reset('');
        this.chave.renovar();
      });
    });
  }

  private reavaliarDialogos(): void {
    if (this.recusando()) {
      if (this.erroDaRecusa() && !this.podeDecidir()) {
        this.erro.set(this.erroDaRecusa());
        this.recusando.set(false);
        this.focoDevidoAoTitulo = true;
      } else if (this.motivo.hasError('backend')) {
        this.edicao.focarErroDoMotivo();
      }
    }
    if (this.confirmando() && !this.acaoPermitida(this.acaoPendente())) {
      this.confirmando.set(false);
      this.focoDevidoAoTitulo = true;
    }
  }

  protected pedirConfirmacao(acao: Acao, campo?: HTMLInputElement): void {
    if (this.acaoPermitida(acao)) this.edicao.pedirConfirmacao(acao, this.informaPrazo(), campo);
  }

  protected executar(): Promise<void> {
    return this.acaoPermitida(this.acaoPendente())
      ? this.edicao.executar(this.informaPrazo())
      : Promise.resolve();
  }

  protected abrirRecusa(): void {
    if (this.acaoPermitida('aprovar')) this.edicao.abrirRecusa();
  }

  protected recusar(): Promise<void> {
    return this.acaoPermitida('aprovar')
      ? this.edicao.recusar(this.podeDecidir)
      : Promise.resolve();
  }

  private acaoPermitida(acao: Acao): boolean {
    if (this.store.carregando() || this.store.erro()) return false;
    if (acao === 'aprovar') return this.podeDecidir();
    return acao === 'aceitar' ? this.podeAceitar() : this.podeCancelar();
  }

  protected irParaOAnexo(): void {
    const zona = document.querySelector<HTMLElement>(
      '[aria-labelledby="cfg-pedido-anexos"] .uni-uploader__drop',
    );
    zona?.scrollIntoView({ block: 'center' });
    zona?.focus();
  }

  protected anexar(arquivo: File | null): Promise<void> {
    return this.edicao.anexar(arquivo);
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
}
