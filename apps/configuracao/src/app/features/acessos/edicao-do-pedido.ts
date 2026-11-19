import { Injectable, inject, signal, type Signal, type WritableSignal } from '@angular/core';
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
import { AnexoDoPedidoService, type DesfechoDoAnexo } from './anexo-do-pedido.service';
import { mensagemDaRecusa } from './falha-de-servidor';
import { FALHA_INESPERADA } from './mensagens-de-acesso';
import { PedidoDetalheStore } from './pedido-detalhe.store';
import { TermoDoPedido } from './termo/termo-do-pedido';
import { type Acao } from './confirmacoes-do-pedido';
import { LIMITE_DO_MOTIVO } from './motivo-dialog.component';
import { fimDoDia, prazoNoPassado } from './prazo-de-vigencia';
import { descartarRecusasDoServidor, marcarRecusaDoServidor } from '../../shared/formulario';

type EnvioDaDecisao = ReturnType<typeof comChave<PedidoDeConcessaoDto>>;

/** Decisões e envio de documentos de um pedido. */
@Injectable()
export class EdicaoDoPedido {
  private readonly store = inject(PedidoDetalheStore);
  private readonly api = inject(PedidosDeConcessaoApi);
  private readonly anexos = inject(AnexoDoPedidoService);
  private readonly termo = inject(TermoDoPedido);
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
  /** Cresce a cada pedido de foco no campo do motivo; o diálogo o atende. */
  readonly pedidoDeFoco = signal(0);
  readonly prazo = new FormControl('', { nonNullable: true, validators: [prazoNoPassado] });

  async executar(informaPrazo: boolean): Promise<void> {
    const acao = this.acaoPendente();
    if (acao === 'cancelar') {
      await this.cancelar();
      return;
    }
    const validaAte = acao === 'aprovar' ? this.prazoDaAprovacao(informaPrazo) : null;
    const feito = await this.decidir(() => this.enviarDecisao(acao, validaAte));
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
    const motivo = this.motivoDaRecusa();
    if (motivo === null) return;
    const feito = await this.decidir(() => this.enviarRecusa(motivo), this.erroDaRecusa);
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
      this.aoAnexar(await this.anexos.anexar(this.store.id() ?? '', arquivo, () => undefined));
    } catch {
      this.erroDoAnexo.set(FALHA_INESPERADA);
    } finally {
      this.anexando.set(false);
    }
  }

  focarErroDoMotivo(): void {
    this.pedidoDeFoco.update((n) => n + 1);
  }

  /** O fim do dia do prazo escolhido, quando a etapa admite prazo e ele foi preenchido. */
  private prazoDaAprovacao(informaPrazo: boolean): string | null {
    return informaPrazo && this.prazo.value !== '' ? fimDoDia(this.prazo.value) : null;
  }

  private enviarDecisao(acao: Acao, validaAte: string | null): EnvioDaDecisao {
    const id = this.store.id() ?? '';
    const termo = acao === 'aceitar' ? this.termo.versaoApresentada() : null;
    return comChave(this.chave, { acao, id, validaAte, termo }, (contexto) =>
      acao === 'aceitar'
        ? this.api.aceitar(id, contexto, termo)
        : this.api.aprovar(id, contexto, validaAte),
    );
  }

  /** O motivo digitado, já validado; sem motivo válido, marca o campo e devolve `null`. */
  private motivoDaRecusa(): string | null {
    this.tentouRecusar.set(true);
    descartarRecusasDoServidor(this.motivo);
    const motivo = this.motivo.value.trim();
    if (motivo && this.motivo.valid) return motivo;
    if (!motivo) this.motivo.setErrors({ required: true });
    this.focarErroDoMotivo();
    return null;
  }

  private enviarRecusa(motivo: string): EnvioDaDecisao {
    const id = this.store.id() ?? '';
    return comChave(this.chave, { motivo, id }, (contexto) =>
      this.api.recusar(id, motivo, contexto),
    );
  }

  private aoAnexar(desfecho: DesfechoDoAnexo): void {
    if (!desfecho.ok) {
      this.erroDoAnexo.set(desfecho.mensagem);
      return;
    }
    this.notificacoes.success('Documento enviado', 'Ele segue para verificação.');
    this.store.recarregar();
  }

  private async cancelar(): Promise<void> {
    if (this.indisponivel()) return;
    await this.enquantoEnvia(async () => {
      try {
        const resultado = await firstValueFrom(this.api.cancelar(this.store.id() ?? ''));
        if (isApiOk(resultado)) await this.aoCancelar();
        else this.erro.set(this.texto(resultado.problem));
      } catch {
        this.erro.set(FALHA_INESPERADA);
      }
    });
  }

  private async aoCancelar(): Promise<void> {
    this.notificacoes.success('Pedido cancelado');
    this.confirmando.set(false);
    await this.router.navigate(['/acessos/pedidos']);
  }

  /** Executa uma decisão sobre o pedido e recarrega o que a API devolveu. */
  private async decidir(enviar: () => EnvioDaDecisao, destinoDoErro = this.erro): Promise<boolean> {
    if (this.indisponivel()) return false;
    this.erro.set(null);
    return this.enquantoEnvia(async () => {
      try {
        const { resultado } = await enviar();
        if (resultado.ok) this.aoDecidir(resultado.data);
        else this.aoRecusarADecisao(resultado.problem, destinoDoErro);
        return resultado.ok;
      } catch {
        destinoDoErro.set(FALHA_INESPERADA);
        return false;
      }
    });
  }

  /** Marca o envio em andamento enquanto a escrita dura, para a tela bloquear outra decisão. */
  private async enquantoEnvia<T>(escrita: () => Promise<T>): Promise<T> {
    this.enviando.set(true);
    try {
      return await escrita();
    } finally {
      this.enviando.set(false);
    }
  }

  private aoDecidir(pedido: PedidoDeConcessaoDto): void {
    this.store.aplicarPedido(pedido);
    this.notificacoes.success('Pedido atualizado');
    this.prazo.reset('');
    this.decisaoConcluida.set(true);
    this.store.recarregar();
  }

  /** O erro do motivo vai ao campo do diálogo de recusa; o resto, ao destino da decisão. */
  private aoRecusarADecisao(
    problema: ProblemDetails,
    destino: WritableSignal<string | null>,
  ): void {
    if (destino !== this.erroDaRecusa || !this.aplicarErroDoMotivo(problema)) {
      destino.set(this.texto(problema));
    }
    this.store.recarregar();
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

  private texto(problema: ProblemDetails): string {
    return mensagemDaRecusa(this.problemas, this.notificacoes, problema);
  }
}
