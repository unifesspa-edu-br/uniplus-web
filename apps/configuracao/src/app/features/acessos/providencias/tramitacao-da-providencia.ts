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
import { FormControl, Validators } from '@angular/forms';
import {
  ChaveDeSubstituicao,
  ProblemI18nService,
  type ApiResult,
  type ProblemDetails,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { ProvidenciasApi, type ProvidenciaDto } from '@uniplus/shared-data/autorizacao';
import { descartarRecusasDoServidor, marcarRecusaDoServidor } from '../../../shared/formulario';
import { mensagemDaRecusa } from '../falha-de-servidor';
import { FALHA_INESPERADA } from '../mensagens-de-acesso';
import { LIMITE_DO_MOTIVO } from '../motivo-dialog.component';
import { enviarComRetentativa } from './envio-com-retentativa';
import { ProvidenciaDetalheStore } from './providencia-detalhe.store';

/** Responder mantém a concessão; atender a revoga. */
export type AtoSobreAProvidencia = 'responder' | 'atender';

const RAIZ = 'uniplus.autorizacao.';

/** Recusas que mostram a providência desatualizada na tela: ela é relida. */
const RECUSAS_QUE_RELEEM: ReadonlySet<string> = new Set(
  ['ja_respondida', 'ja_atendida', 'concessao_nao_ativa', 'nao_encontrada'].map(
    (codigo) => `${RAIZ}providencia.${codigo}`,
  ),
);

const SUCESSO: Readonly<Record<AtoSobreAProvidencia, string>> = {
  responder: 'Providência respondida',
  atender: 'Providência atendida e concessão revogada',
};

/**
 * A resposta motivada e o atendimento, que revoga a concessão com a confirmação do e-mail do
 * beneficiário, como a revogação comum (UNI-REQ-0376). O conflito retentável se repete uma vez com
 * a mesma chave; repetir o atendimento com a mesma chave devolve o mesmo resultado.
 */
@Injectable()
export class TramitacaoDaProvidencia {
  private readonly store = inject(ProvidenciaDetalheStore);
  private readonly api = inject(ProvidenciasApi);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  /** A página saiu: a resposta que chega depois não navega, não avisa nem mexe em estado. */
  private destruido = false;
  private readonly chave = new ChaveDeSubstituicao();
  readonly motivo = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(LIMITE_DO_MOTIVO)],
  });
  readonly email = new FormControl('', { nonNullable: true });
  readonly aberto = signal<AtoSobreAProvidencia | null>(null);
  readonly tentou = signal(false);
  readonly enviando = signal(false);
  readonly erro = signal<string | null>(null);
  /** A recusa que releu a providência e fechou o diálogo: fica visível na página. */
  readonly aviso = signal<string | null>(null);
  /** A providência em que o diálogo foi aberto: o motivo vale só para ela. */
  private idDaAbertura: string | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destruido = true));
    effect(() => {
      const id = this.store.id();
      untracked(() => this.trocarDeItem(id));
    });
  }

  abrir(ato: AtoSobreAProvidencia): void {
    this.motivo.reset('');
    this.email.reset('');
    this.tentou.set(false);
    this.erro.set(null);
    this.aviso.set(null);
    this.idDaAbertura = this.store.dados()?.id ?? null;
    this.aberto.set(ato);
  }

  fechar(): void {
    if (!this.enviando()) this.aberto.set(null);
  }

  confirmar(): void {
    const ato = this.aberto();
    const providencia = this.store.dados();
    if (ato === null || providencia === null || this.enviando()) return;
    if (!this.aindaElegivel(providencia)) this.aberto.set(null);
    else if (this.conferirCampos(ato)) void this.enviar(ato, providencia.id);
  }

  /** Marca os campos como tentados, limpa as recusas antigas e foca o primeiro inválido. */
  private conferirCampos(ato: AtoSobreAProvidencia): boolean {
    this.tentou.set(true);
    descartarRecusasDoServidor(this.motivo);
    descartarRecusasDoServidor(this.email);
    const valido = this.valido(ato);
    if (!valido) this.focarErro();
    return valido;
  }

  /** Outro item na rota: o diálogo do anterior fecha, e nada dele passa para o novo. */
  private trocarDeItem(id: string | undefined): void {
    if (this.idDaAbertura === null || id === this.idDaAbertura) return;
    this.idDaAbertura = null;
    this.aberto.set(null);
    this.erro.set(null);
    this.aviso.set(null);
  }

  /** A providência ainda é a da abertura, aberta e sem impedimento de quem lê. */
  private aindaElegivel(providencia: ProvidenciaDto): boolean {
    return (
      providencia.id === this.idDaAbertura &&
      providencia.situacao === 'aberta' &&
      !providencia.impedidoDeResponder
    );
  }

  /** O motivo é obrigatório e cabe no limite; o atendimento também pede o e-mail. */
  private valido(ato: AtoSobreAProvidencia): boolean {
    if (this.motivo.value.trim() === '') this.motivo.setErrors({ required: true });
    const semEmail = ato === 'atender' && this.email.value.trim() === '';
    if (semEmail) this.email.setErrors({ required: true });
    return !this.motivo.invalid && !semEmail;
  }

  private async enviar(ato: AtoSobreAProvidencia, id: string): Promise<void> {
    this.enviando.set(true);
    this.erro.set(null);
    try {
      const resultado = await this.gravar(ato, id);
      if (!this.aindaNoItem(id)) return;
      if (resultado.ok) this.concluir(ato);
      else this.recusar(resultado.problem);
    } catch {
      if (this.aindaNoItem(id)) this.erro.set(FALHA_INESPERADA);
    } finally {
      this.enviando.set(false);
    }
  }

  /** A resposta que chega depois de a rota mudar de item não mexe na tela do item novo. */
  private aindaNoItem(id: string): boolean {
    return !this.destruido && this.store.id() === id;
  }

  private gravar(ato: AtoSobreAProvidencia, id: string): Promise<ApiResult<ProvidenciaDto>> {
    const motivo = this.motivo.value.trim();
    if (ato === 'responder') {
      const corpo = { motivo };
      return enviarComRetentativa(this.chave, { id, ato, ...corpo }, (contexto) =>
        this.api.responder(id, corpo, contexto),
      );
    }
    const corpo = { motivo, confirmacaoEmail: this.email.value.trim() };
    return enviarComRetentativa(this.chave, { id, ato, ...corpo }, (contexto) =>
      this.api.atender(id, corpo, contexto),
    );
  }

  private concluir(ato: AtoSobreAProvidencia): void {
    this.aberto.set(null);
    this.notificacoes.success(SUCESSO[ato]);
    this.store.tentarNovamente();
  }

  private recusar(problema: ProblemDetails): void {
    const texto = mensagemDaRecusa(this.problemas, this.notificacoes, problema);
    if (this.marcarCampos(problema)) return;
    if (!RECUSAS_QUE_RELEEM.has(problema.code)) {
      this.erro.set(texto);
      return;
    }
    this.aberto.set(null);
    this.aviso.set(texto);
    this.store.tentarNovamente();
  }

  private marcarCampos(problema: ProblemDetails): boolean {
    let marcado = false;
    for (const erro of problema.errors ?? []) {
      const controle = this.controleDoCampo(erro.field);
      if (controle === null) continue;
      marcarRecusaDoServidor(controle, erro.code, erro.message);
      marcado = true;
    }
    if (marcado) this.focarErro();
    return marcado;
  }

  private controleDoCampo(campo: string): FormControl<string> | null {
    const nome = campo.toLowerCase();
    if (nome === 'motivo') return this.motivo;
    return nome === 'confirmacaoemail' ? this.email : null;
  }

  /**
   * Leva o foco ao primeiro campo inválido do diálogo aberto. Os dois diálogos dividem o motivo, e o
   * fechado também o marca: buscar na página inteira levaria o foco a um campo escondido.
   */
  private focarErro(): void {
    afterNextRender(
      () =>
        this.host.nativeElement
          .querySelector<HTMLElement>('dialog[open] [aria-invalid="true"]')
          ?.focus(),
      { injector: this.injector },
    );
  }
}
