import { EdicaoDoPedido } from './edicao-do-pedido';
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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PERMISSAO, PermissoesService, UserContextService } from '@uniplus/shared-auth/bootstrap';
import { AlertComponent, DialogComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { ehOBeneficiario } from './beneficiario-do-pedido';
import { AnexoDoPedidoService } from './anexo-do-pedido.service';
import { MotivoDialogComponent } from './motivo-dialog.component';
import { PedidoDetalheStore } from './pedido-detalhe.store';
import { origemDaFila } from './origens-do-pedido';
import { diaDoInstante, diaNoPassado } from './prazo-de-vigencia';
import { PedidoResumoComponent } from './pedido-resumo.component';
import { PedidoDocumentosComponent } from './pedido-documentos.component';
import { PedidoHistoricoComponent } from './pedido-historico.component';

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
  ],
  providers: [PedidoDetalheStore, EdicaoDoPedido],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-page' },
  templateUrl: './pedido-detalhe.page.html',
})
export class PedidoDetalhePage {
  /** Vem do parâmetro `:id` da rota. */
  readonly id = input.required<string>();

  private readonly store = inject(PedidoDetalheStore);
  private readonly edicao = inject(EdicaoDoPedido);
  private readonly anexos = inject(AnexoDoPedidoService);
  private readonly permissoes = inject(PermissoesService);
  private readonly usuario = inject(UserContextService);

  /** A lista de onde a pessoa veio; o retorno não a manda para os próprios pedidos se ela veio de outra. */
  protected readonly origem = origemDaFila(
    inject(ActivatedRoute).snapshot.queryParamMap.get('origem'),
  );
  private readonly destruido = signal(false);
  private readonly chave = this.edicao.chave;

  protected readonly pedido = this.store.pedido;
  protected readonly trilha = this.store.trilha;
  protected readonly carregando = this.store.carregando;
  protected readonly enviando = this.edicao.enviando;
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
    effect(() => {
      const id = this.id();
      untracked(() => {
        this.store.id.set(id);
        this.erro.set(null);
        this.prazo.reset('');
        this.chave.renovar();
      });
    });
    effect(() => {
      const pedido = this.store.pedido();
      const erro = this.store.erro();
      untracked(() => {
        if (erro) this.erro.set(erro);
        if (pedido && this.recusando() && this.erroDaRecusa() && !this.podeDecidir()) {
          this.erro.set(this.erroDaRecusa());
          this.recusando.set(false);
        }
        if (pedido && this.prazo.pristine) {
          const sugerido = diaDoInstante(pedido.validaAteSugerida);
          this.prazo.setValue(diaNoPassado(sugerido) ? '' : sugerido);
        }
      });
    });
  }

  protected pedirConfirmacao(acao: Acao, campo?: HTMLInputElement): void {
    this.edicao.pedirConfirmacao(acao, this.informaPrazo(), campo);
  }

  protected executar(): Promise<void> {
    return this.edicao.executar(this.informaPrazo());
  }

  protected abrirRecusa(): void {
    this.edicao.abrirRecusa();
  }

  protected recusar(): Promise<void> {
    return this.edicao.recusar(this.podeDecidir);
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
