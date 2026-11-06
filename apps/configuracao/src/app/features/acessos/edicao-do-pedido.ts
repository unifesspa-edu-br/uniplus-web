import {
  ElementRef,
  Injectable,
  Injector,
  afterNextRender,
  inject,
  signal,
  type Signal,
} from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  ChaveDeSubstituicao,
  ProblemI18nService,
  comChave,
  isApiOk,
  type ProblemDetails,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { PedidosDeConcessaoApi, type PedidoDeConcessaoDto } from '@uniplus/shared-data/autorizacao';
import { AnexoDoPedidoService } from './anexo-do-pedido.service';
import { mensagemDaRecusa } from './falha-de-servidor';
import { FALHA_INESPERADA } from './mensagens-de-acesso';
import { PedidoDetalheStore } from './pedido-detalhe.store';
import { type Acao } from './confirmacoes-do-pedido';
import { LIMITE_DO_MOTIVO } from './motivo-dialog.component';
import { fimDoDia, prazoNoPassado } from './prazo-de-vigencia';
import { marcarRecusaDoServidor } from '../../shared/formulario';

/** Decisões e envio de documentos de um pedido. */
@Injectable()
export class EdicaoDoPedido {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly store = inject(PedidoDetalheStore);
  private readonly api = inject(PedidosDeConcessaoApi);
  private readonly anexos = inject(AnexoDoPedidoService);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  private readonly router = inject(Router);
  readonly chave = new ChaveDeSubstituicao();
  readonly enviando = signal(false);
  /** Uma decisão foi aceita e o pedido ainda será relido; a página devolve o foco ao fim da leitura. */
  readonly decisaoConcluida = signal(false);
  readonly anexando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly erroDaRecusa = signal<string | null>(null);
  readonly erroDoAnexo = signal<string | null>(null);
  readonly confirmando = signal(false);
  readonly recusando = signal(false);
  readonly acaoPendente = signal<Acao>('aprovar');
  readonly motivo = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(LIMITE_DO_MOTIVO)],
  });
  readonly tentouRecusar = signal(false);
  readonly prazo = new FormControl('', { nonNullable: true, validators: [prazoNoPassado] });

  async executar(informaPrazo: boolean): Promise<void> {
    const acao = this.acaoPendente();
    if (acao === 'cancelar') {
      await this.cancelar();
      return;
    }
    const id = this.store.id() ?? '';
    const validaAte =
      acao === 'aprovar' && informaPrazo && this.prazo.value !== ''
        ? fimDoDia(this.prazo.value)
        : null;
    const feito = await this.decidir(() =>
      comChave(this.chave, { acao, id, validaAte }, (contexto) =>
        acao === 'aceitar'
          ? this.api.aceitar(id, contexto)
          : this.api.aprovar(id, contexto, validaAte),
      ),
    );
    if (feito) this.confirmando.set(false);
  }

  pedirConfirmacao(acao: Acao, informaPrazo: boolean, campoPrazo?: HTMLInputElement): void {
    if (this.indisponivel()) return;
    this.erro.set(null);
    if (acao === 'aprovar' && informaPrazo) {
      this.prazo.updateValueAndValidity();
      if (this.prazo.invalid) {
        this.prazo.markAsTouched();
        campoPrazo?.focus();
        return;
      }
    }
    this.acaoPendente.set(acao);
    this.confirmando.set(true);
  }

  abrirRecusa(): void {
    if (this.indisponivel()) return;
    this.erroDaRecusa.set(null);
    this.motivo.reset('');
    this.tentouRecusar.set(false);
    this.recusando.set(true);
  }

  async recusar(podeDecidir: Signal<boolean>): Promise<void> {
    if (this.indisponivel()) return;
    this.erroDaRecusa.set(null);
    this.tentouRecusar.set(true);
    const motivo = this.motivo.value.trim();
    if (!motivo || this.motivo.invalid) {
      if (!motivo) this.motivo.setErrors({ required: true });
      this.focarErroDoMotivo();
      return;
    }
    const id = this.store.id() ?? '';
    this.erroDaRecusa.set(null);
    const feito = await this.decidir(
      () =>
        comChave(this.chave, { motivo, id }, (contexto) => this.api.recusar(id, motivo, contexto)),
      this.erroDaRecusa,
    );
    if (feito) this.recusando.set(false);
    else if (!podeDecidir()) {
      this.erro.set(this.erroDaRecusa());
      this.recusando.set(false);
    }
  }

  async anexar(arquivo: File | null): Promise<void> {
    if (arquivo === null || this.anexando()) return;
    this.anexando.set(true);
    this.erroDoAnexo.set(null);
    try {
      const desfecho = await this.anexos.anexar(this.store.id() ?? '', arquivo, () => undefined);
      if (desfecho.ok) {
        this.notificacoes.success('Documento enviado', 'Ele segue para verificação.');
        this.store.recarregar();
      } else {
        this.erroDoAnexo.set(desfecho.mensagem);
      }
    } catch {
      this.erroDoAnexo.set(FALHA_INESPERADA);
    } finally {
      this.anexando.set(false);
    }
  }

  private async cancelar(): Promise<void> {
    if (this.indisponivel()) return;
    this.enviando.set(true);
    try {
      const resultado = await firstValueFrom(this.api.cancelar(this.store.id() ?? ''));
      if (!isApiOk(resultado)) {
        this.erro.set(this.texto(resultado.problem));
        return;
      }
      this.notificacoes.success('Pedido cancelado');
      this.confirmando.set(false);
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
    if (this.indisponivel()) return false;
    this.enviando.set(true);
    this.erro.set(null);
    try {
      const { resultado } = await enviar();
      if (!resultado.ok) {
        if (destinoDoErro !== this.erroDaRecusa || !this.aplicarErroDoMotivo(resultado.problem)) {
          destinoDoErro.set(this.texto(resultado.problem));
        }
        this.store.recarregar();
        return false;
      }
      this.store.aplicarPedido(resultado.data);
      this.notificacoes.success('Pedido atualizado');
      this.prazo.reset('');
      this.decisaoConcluida.set(true);
      this.store.recarregar();
      return true;
    } catch {
      destinoDoErro.set(FALHA_INESPERADA);
      return false;
    } finally {
      this.enviando.set(false);
    }
  }

  private indisponivel(): boolean {
    return this.enviando() || this.store.carregando() || this.store.erro() !== null;
  }

  private aplicarErroDoMotivo(problema: ProblemDetails): boolean {
    const erro = problema.errors?.find((item) => item.field.toLowerCase() === 'motivo');
    if (!erro) return false;
    marcarRecusaDoServidor(this.motivo, erro.code, erro.message);
    this.tentouRecusar.set(true);
    this.focarErroDoMotivo();
    return true;
  }

  focarErroDoMotivo(): void {
    afterNextRender(
      () =>
        this.host.nativeElement
          .querySelector<HTMLElement>('cfg-motivo-dialog [aria-invalid="true"]')
          ?.focus(),
      { injector: this.injector },
    );
  }

  private texto(problema: ProblemDetails): string {
    return mensagemDaRecusa(this.problemas, this.notificacoes, problema);
  }
}
