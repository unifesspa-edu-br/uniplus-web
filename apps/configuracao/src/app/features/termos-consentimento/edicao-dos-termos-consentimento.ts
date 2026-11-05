import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ApiResult,
  ProblemDetails,
  ProblemI18nService,
  ProblemValidationError,
  STATUS_HTTP,
} from '@uniplus/shared-core/http';
import { idempotencyKey, withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CriarTermoConsentimentoCommand,
  EditarRascunhoTermoConsentimentoCommand,
  TermosConsentimentoApi,
} from '@uniplus/shared-data/configuracao';
import { TermoConsentimentoStore } from './termo-consentimento.store';
import {
  AcaoTermo,
  criarFormulario,
  criarFormularioRascunho,
  nullIfBlank,
  ultimaChaveDoCaminho,
} from './termo-consentimento-form';

@Injectable()
export class EdicaoDosTermosConsentimento {
  private readonly api = inject(TermosConsentimentoApi);
  private readonly store = inject(TermoConsentimentoStore);
  private readonly router = inject(Router);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly id = this.store.id;
  private readonly termo = this.store.termo;
  readonly criarForm = criarFormulario();
  readonly rascunhoForm = criarFormularioRascunho();
  readonly formError = signal<string | null>(null);
  readonly acaoErro = signal<string | null>(null);
  readonly tentouSalvar = signal(false);
  readonly criando = signal(false);
  readonly acaoEmAndamento = signal<AcaoTermo | null>(null);
  readonly processando = computed(
    () => this.criando() || this.acaoEmAndamento() !== null || this.store.atualizando(),
  );
  readonly confirmRemoverAberto = signal(false);
  private readonly idempotencyKeyAtual = signal(idempotencyKey.create());
  readonly podeRevisar = computed(() => {
    const t = this.termo();
    return (
      t !== null &&
      (t.textoRascunho ?? '').trim().length > 0 &&
      (t.baseLegalRascunho ?? '').trim().length > 0
    );
  });
  readonly podePromover = computed(() => this.termo()?.revisado === true);
  readonly podeRemover = computed(
    () => this.termo() !== null && this.termo()?.versoes.length === 0,
  );

  constructor() {
    effect(() => {
      const termo = this.store.leituraParaFormulario();
      if (!termo) return;
      this.rascunhoForm.patchValue(
        {
          texto: termo.textoRascunho ?? '',
          baseLegal: termo.baseLegalRascunho ?? '',
          formaAceite: termo.formaAceiteRascunho,
        },
        { emitEvent: false },
      );
      this.rascunhoForm.markAsPristine();
    });
  }

  criar(): void {
    if (this.processando()) return;
    this.formError.set(null);
    this.limparRecusas(false);
    this.tentouSalvar.set(true);
    if (this.criarForm.invalid) {
      this.criarForm.markAllAsTouched();
      return;
    }
    this.criando.set(true);
    this.formError.set(null);
    const raw = this.criarForm.getRawValue();
    const command: CriarTermoConsentimentoCommand = {
      nome: nullIfBlank(raw.nome),
      textoRascunho: nullIfBlank(raw.texto),
      baseLegalRascunho: nullIfBlank(raw.baseLegal),
      formaAceiteRascunho: raw.formaAceite,
    };
    this.api
      .criar(command, withIdempotencyKey(this.idempotencyKeyAtual()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.tratarCriacao(result, raw.nome));
  }

  salvarRascunho(): void {
    const id = this.id();
    if (id === null || this.termo() === null || this.processando()) return;
    this.acaoErro.set(null);
    this.limparRecusas(true);
    this.tentouSalvar.set(true);
    if (this.rascunhoForm.invalid) {
      this.rascunhoForm.markAllAsTouched();
      return;
    }
    this.store.invalidar();
    this.acaoEmAndamento.set('rascunho');
    this.acaoErro.set(null);
    const raw = this.rascunhoForm.getRawValue();
    const command: EditarRascunhoTermoConsentimentoCommand = {
      id,
      textoRascunho: nullIfBlank(raw.texto),
      baseLegalRascunho: nullIfBlank(raw.baseLegal),
      formaAceiteRascunho: raw.formaAceite,
    };
    this.api
      .editarRascunho(id, command, withIdempotencyKey(this.idempotencyKeyAtual()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.tratarMutacao('rascunho', result, 'Rascunho salvo'));
  }

  marcarRevisado(): void {
    const id = this.id();
    if (id === null || this.processando() || !this.podeRevisar()) return;
    this.store.invalidar();
    this.acaoEmAndamento.set('revisar');
    this.acaoErro.set(null);
    this.api
      .revisar(id, withIdempotencyKey(this.idempotencyKeyAtual()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.tratarMutacao('revisar', result, 'Termo marcado como revisado'));
  }

  promoverVersao(): void {
    const id = this.id();
    if (id === null || this.processando() || !this.podePromover()) return;
    this.store.invalidar();
    this.acaoEmAndamento.set('promover');
    this.acaoErro.set(null);
    this.api
      .promover(id, withIdempotencyKey(this.idempotencyKeyAtual()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.tratarMutacao('promover', result, 'Nova versão promovida'));
  }

  pedirRemocao(): void {
    if (this.processando() || !this.podeRemover()) return;
    this.acaoErro.set(null);
    this.confirmRemoverAberto.set(true);
  }

  removerConfirmado(): void {
    const id = this.id();
    if (id === null || this.processando() || !this.podeRemover()) return;
    this.store.invalidar();
    this.acaoEmAndamento.set('remover');
    this.acaoErro.set(null);
    this.api
      .remover(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.acaoEmAndamento.set(null);
        if (result.ok) {
          this.confirmRemoverAberto.set(false);
          this.notifications.success('Termo removido', this.termo()?.nome);
          void this.router.navigate(['/termos-consentimento']);
          return;
        }
        this.aplicarFalhaMutacao(result.problem);
      });
  }

  recarregarTermo(): void {
    const id = this.id();
    if (id === null || this.processando()) return;
    this.acaoErro.set(null);
    this.store.recarregar();
  }

  private tratarCriacao(result: ApiResult<string>, nome: string): void {
    this.criando.set(false);
    if (result.ok) {
      this.notifications.success('Termo criado', nome);
      this.idempotencyKeyAtual.set(idempotencyKey.create());
      void this.router.navigate(['/termos-consentimento', result.data]);
      return;
    }
    this.aplicarFalhaCriacao(result.problem);
  }

  private tratarMutacao(acao: AcaoTermo, result: ApiResult<void>, mensagemSucesso: string): void {
    if (result.ok) {
      this.store.atualizar();
      this.acaoEmAndamento.set(null);
      this.notifications.success(mensagemSucesso);
      this.idempotencyKeyAtual.set(idempotencyKey.create());
      if (acao === 'rascunho') {
        this.rascunhoForm.markAsPristine();
      }
      return;
    }
    this.aplicarFalhaMutacao(result.problem);
    this.acaoEmAndamento.set(null);
  }

  private aplicarFalhaCriacao(problem: ProblemDetails): void {
    this.renovarIdempotencyKeySeNecessario(problem);
    if (
      problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO &&
      problem.errors &&
      problem.errors.length > 0
    ) {
      this.aplicarErrosDeValidacao(problem.errors);
      return;
    }
    this.formError.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) {
      this.notifications.errorFromProblem(problem);
    }
  }

  private aplicarFalhaMutacao(problem: ProblemDetails): void {
    this.renovarIdempotencyKeySeNecessario(problem);
    if (
      problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO &&
      problem.errors?.length &&
      this.acaoEmAndamento() === 'rascunho'
    ) {
      this.aplicarErrosDeValidacao(problem.errors, true);
      return;
    }
    this.acaoErro.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) {
      this.notifications.errorFromProblem(problem);
    }
  }

  private renovarIdempotencyKeySeNecessario(problem: ProblemDetails): void {
    if (
      problem.status === STATUS_HTTP.CONFLITO ||
      problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO ||
      problem.code === 'uniplus.idempotency.body_mismatch'
    ) {
      this.renovarIdempotencyKey();
    }
  }

  private renovarIdempotencyKey(): void {
    this.idempotencyKeyAtual.set(idempotencyKey.create());
  }

  private aplicarErrosDeValidacao(
    errors: ReadonlyArray<ProblemValidationError>,
    rascunho = false,
  ): void {
    let aplicouAlgum = false;
    for (const erro of errors) {
      const control = this.controlDoCampoCriacao(erro.field, rascunho);
      if (control === null) continue;
      control.setErrors({ backend: { code: erro.code, message: erro.message } });
      control.markAsTouched();
      aplicouAlgum = true;
    }
    (rascunho ? this.acaoErro : this.formError).set(
      aplicouAlgum ? null : 'Não foi possível mapear os erros de validação. Revise os campos.',
    );
    if (aplicouAlgum)
      setTimeout(() => this.document.querySelector<HTMLElement>('form .ng-invalid')?.focus());
  }

  private limparRecusas(rascunho: boolean): void {
    const form = rascunho ? this.rascunhoForm : this.criarForm;
    Object.values(form.controls).forEach((controle) => {
      if (controle.hasError('backend')) controle.updateValueAndValidity();
    });
  }

  private controlDoCampoCriacao(field: string, rascunho: boolean): FormControl<string> | null {
    const form = rascunho ? this.rascunhoForm : this.criarForm;
    switch (ultimaChaveDoCaminho(field)) {
      case 'nome':
        return rascunho ? null : this.criarForm.controls.nome;
      case 'textoRascunho':
        return form.controls.texto;
      case 'baseLegalRascunho':
        return form.controls.baseLegal;
      case 'formaAceiteRascunho':
        return form.controls.formaAceite;
      default:
        return null;
    }
  }
}
