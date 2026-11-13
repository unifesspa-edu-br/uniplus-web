import {
  DestroyRef,
  ElementRef,
  Injectable,
  Injector,
  afterNextRender,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormControl, FormGroup, Validators, type AbstractControl } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ChaveDeSubstituicao,
  ProblemI18nService,
  type ApiResult,
  type ProblemDetails,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  ProvidenciasApi,
  type ProvidenciaDto,
  type SolicitarProvidenciaRequest,
  type TipoDaProvidencia,
} from '@uniplus/shared-data/autorizacao';
import { descartarRecusasDoServidor, marcarRecusaDoServidor } from '../../../shared/formulario';
import { ConcessaoDetalheStore } from '../concessao-detalhe.store';
import { mensagemDaRecusa } from '../falha-de-servidor';
import { FALHA_INESPERADA } from '../mensagens-de-acesso';
import { enviarComRetentativa } from './envio-com-retentativa';

/** O fundamento tem de 10 a 2000 caracteres depois de aparado, contados como a pessoa os vê. */
export const FUNDAMENTO_MINIMO = 10;
export const FUNDAMENTO_MAXIMO = 2000;

export function tamanhoDoFundamento(texto: string): number {
  return [...texto.trim()].length;
}

function fundamentoNoTamanho(controle: AbstractControl<string>) {
  const tamanho = tamanhoDoFundamento(controle.value);
  if (tamanho === 0) return { required: true };
  return tamanho < FUNDAMENTO_MINIMO || tamanho > FUNDAMENTO_MAXIMO ? { tamanho: true } : null;
}

/**
 * Solicitar providência a partir da concessão: o tipo, retirada ou revisão, e o fundamento
 * (UNI-REQ-0375). Gravada, a tela vai para o detalhe da providência, que a pessoa acompanha.
 */
@Injectable()
export class SolicitacaoDeProvidencia {
  private readonly api = inject(ProvidenciasApi);
  private readonly concessao = inject(ConcessaoDetalheStore);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  /** A página saiu: a resposta que chega depois não navega, não avisa nem mexe em estado. */
  private destruido = false;
  private readonly chave = new ChaveDeSubstituicao();
  readonly form = new FormGroup({
    tipo: new FormControl<TipoDaProvidencia | ''>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    fundamento: new FormControl('', { nonNullable: true, validators: [fundamentoNoTamanho] }),
  });
  readonly aberto = signal(false);
  readonly tentou = signal(false);
  readonly enviando = signal(false);
  readonly erro = signal<string | null>(null);
  /** A concessão em que o diálogo abriu: a providência é pedida só sobre ela. */
  private concessaoDaAbertura: string | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destruido = true));
    effect(() => {
      const id = this.concessao.id();
      untracked(() => this.trocarDeConcessao(id));
    });
  }

  abrir(concessaoId: string): void {
    this.form.reset();
    this.tentou.set(false);
    this.erro.set(null);
    this.concessaoDaAbertura = concessaoId;
    this.aberto.set(true);
  }

  /** Outra concessão na rota (o Voltar do navegador, um link): o diálogo da anterior fecha e esvazia. */
  private trocarDeConcessao(id: string | undefined): void {
    if (this.concessaoDaAbertura === null || id === this.concessaoDaAbertura) return;
    this.concessaoDaAbertura = null;
    this.aberto.set(false);
    this.form.reset();
    this.tentou.set(false);
    this.erro.set(null);
  }

  fechar(): void {
    if (!this.enviando()) this.aberto.set(false);
  }

  confirmar(): void {
    const concessaoId = this.concessaoDaAbertura;
    if (concessaoId === null || this.enviando()) return;
    this.tentou.set(true);
    descartarRecusasDoServidor(this.form.controls.tipo);
    descartarRecusasDoServidor(this.form.controls.fundamento);
    if (this.form.invalid) this.focarErro();
    else void this.enviar(this.corpo(concessaoId));
  }

  private corpo(concessaoId: string): SolicitarProvidenciaRequest {
    const { tipo, fundamento } = this.form.getRawValue();
    return { concessaoId, tipo: tipo as TipoDaProvidencia, fundamento: fundamento.trim() };
  }

  private async enviar(corpo: SolicitarProvidenciaRequest): Promise<void> {
    this.enviando.set(true);
    this.erro.set(null);
    try {
      const resultado = await enviarComRetentativa(this.chave, corpo, (contexto) =>
        this.api.solicitar(corpo, contexto),
      );
      if (this.naMesmaConcessao(corpo)) this.desfecho(resultado);
    } catch {
      if (this.naMesmaConcessao(corpo)) this.erro.set(FALHA_INESPERADA);
    } finally {
      this.enviando.set(false);
    }
  }

  /** A resposta que chega depois de a rota mudar de concessão não mexe na tela da nova. */
  private naMesmaConcessao(corpo: SolicitarProvidenciaRequest): boolean {
    return !this.destruido && this.concessao.id() === corpo.concessaoId;
  }

  private desfecho(resultado: ApiResult<ProvidenciaDto>): void {
    if (resultado.ok) this.concluir(resultado.data.id);
    else this.recusar(resultado.problem);
  }

  private concluir(id: string): void {
    this.aberto.set(false);
    this.notificacoes.success('Providência solicitada');
    void this.router.navigate(['/acessos/providencias', id]);
  }

  /** O lote de 422 vai a cada campo de uma vez; o resto fica no alerta do diálogo. */
  private recusar(problema: ProblemDetails): void {
    const texto = mensagemDaRecusa(this.problemas, this.notificacoes, problema);
    let marcado = false;
    for (const erro of problema.errors ?? []) {
      const nome = erro.field.toLowerCase();
      if (nome !== 'tipo' && nome !== 'fundamento') continue;
      marcarRecusaDoServidor(this.form.controls[nome], erro.code, erro.message);
      marcado = true;
    }
    if (marcado) this.focarErro();
    else this.erro.set(texto);
  }

  private focarErro(): void {
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      { injector: this.injector },
    );
  }
}
