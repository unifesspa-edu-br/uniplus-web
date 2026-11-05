import {
  Injectable,
  ElementRef,
  Injector,
  afterNextRender,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  ApiResult,
  ProblemDetails,
  ProblemI18nService,
  ProblemValidationError,
  STATUS_HTTP,
} from '@uniplus/shared-core/http';
import {
  deveRotacionarIdempotencyKey,
  IDEMPOTENCY_PROBLEM_CODES,
  idempotencyKey,
  withIdempotencyKey,
} from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AtualizarReferenciaReservaDemograficaCommand,
  CriarReferenciaReservaDemograficaCommand,
  ReferenciaReservaDemograficaDto,
  ReservaDemograficaApi,
} from '@uniplus/shared-data/configuracao';
import { mensagemDoCampo } from './reserva-demografica-formulario-mensagem';
import { ReservaDemograficaStore } from './reserva-demografica.store';

const RESERVA_DEMOGRAFICA_CENSO_JA_EXISTE_CODE =
  'uniplus.configuracao.referencia_reserva_demografica.censo_ja_existe';

type ModoFormulario = 'criar' | 'editar';

export interface ReservaForm {
  censoReferencia: FormControl<string>;
  ppiPercentual: FormControl<number | null>;
  quilombolaPercentual: FormControl<number | null>;
  pcdPercentual: FormControl<number | null>;
  baseLegal: FormControl<string>;
}

const PERCENTUAL_VALIDATORS = [Validators.required, Validators.min(0), Validators.max(100)];

/** Coordena o formulário e a remoção das referências demográficas. */
@Injectable()
export class EdicaoDasReservasDemograficas {
  private readonly api = inject(ReservaDemograficaApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly store = inject(ReservaDemograficaStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  private readonly escrita = signal<'salvando' | 'removendo' | null>(null);
  readonly gravando = computed(() => this.escrita() !== null || this.store.recarregando());
  readonly salvando = computed(() => this.escrita() === 'salvando');
  readonly removendo = computed(() => this.escrita() === 'removendo');
  readonly saving = this.gravando;
  readonly anuncioDaRemocao = signal('');
  readonly anuncioFormulario = signal('');
  readonly erroRemocao = signal<string | null>(null);
  readonly idAfetado = signal<string | null>(null);
  readonly andamento = computed(() =>
    this.removendo()
      ? 'Removendo...'
      : this.salvando()
        ? 'Salvando...'
        : this.store.recarregando()
          ? 'Atualizando...'
          : '',
  );
  alterarConfirmacao(valor: boolean): void {
    if (!this.gravando()) this.confirmOpen.set(valor);
  }

  readonly formOpen = signal(false);
  readonly confirmOpen = signal(false);
  readonly formError = signal<string | null>(null);
  readonly modo = signal<ModoFormulario>('criar');
  readonly idEmEdicao = signal<string | null>(null);
  readonly refParaRemover = signal<ReferenciaReservaDemograficaDto | null>(null);
  readonly mensagemRemocao = computed(() => {
    const ref = this.refParaRemover();

    if (ref === null) {
      return 'Confirma a remoção desta referência demográfica?';
    }

    return `Deseja remover a referência demográfica do Censo ${ref.censoReferencia}? A referência é removida (soft-delete) e mantida na trilha de auditoria. Edições e remoções não afetam processos já publicados — cópias congeladas em quadros de vagas (snapshot) permanecem.`;
  });
  readonly idempotencyKeyAtual = signal(idempotencyKey.create());
  readonly formHeading = computed(() =>
    this.modo() === 'criar' ? 'Novo censo' : 'Editar referência demográfica',
  );

  readonly form: FormGroup<ReservaForm> = new FormGroup<ReservaForm>({
    censoReferencia: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(20)],
    }),
    ppiPercentual: new FormControl<number | null>(null, { validators: PERCENTUAL_VALIDATORS }),
    quilombolaPercentual: new FormControl<number | null>(null, {
      validators: PERCENTUAL_VALIDATORS,
    }),
    pcdPercentual: new FormControl<number | null>(null, { validators: PERCENTUAL_VALIDATORS }),
    baseLegal: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(255)],
    }),
  });

  abrirCadastro(): void {
    if (this.gravando()) return;
    this.idAfetado.set(null);
    this.modo.set('criar');
    this.idEmEdicao.set(null);
    this.form.enable({ emitEvent: false });
    this.form.reset({
      censoReferencia: '',
      ppiPercentual: null,
      quilombolaPercentual: null,
      pcdPercentual: null,
      baseLegal: 'Lei 12.711/2012, art. 10, III',
    });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  abrirEdicao(ref: ReferenciaReservaDemograficaDto): void {
    if (this.gravando()) return;
    this.idAfetado.set(ref.id);
    this.modo.set('editar');
    this.idEmEdicao.set(ref.id);
    this.form.reset({
      censoReferencia: ref.censoReferencia,
      ppiPercentual: ref.ppiPercentual,
      quilombolaPercentual: ref.quilombolaPercentual,
      pcdPercentual: ref.pcdPercentual,
      baseLegal: ref.baseLegal,
    });
    this.form.controls.censoReferencia.disable({ emitEvent: false });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  /** Unicidade de Censo entre as referências ativas carregadas (feedback no blur). */
  verificarCensoDuplicado(): void {
    const control = this.form.controls.censoReferencia;
    const censo = control.value.trim();
    const duplicado =
      censo.length > 0 &&
      this.store
        .referencias()
        .some((ref) => ref.censoReferencia === censo && ref.id !== this.idEmEdicao());
    if (duplicado) {
      control.setErrors({ duplicado: true });
      control.markAsTouched();
      return;
    }
    if (control.hasError('duplicado')) {
      control.setErrors(null);
      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  pedirRemocao(ref: ReferenciaReservaDemograficaDto): void {
    if (this.gravando()) return;
    this.erroRemocao.set(null);
    this.idAfetado.set(ref.id);
    this.refParaRemover.set(ref);
    this.confirmOpen.set(true);
  }

  removerConfirmado(): void {
    const ref = this.refParaRemover();
    if (ref === null || this.gravando()) {
      return;
    }
    this.anuncioDaRemocao.set(`Removendo a referência do Censo ${ref.censoReferencia}.`);
    this.escrita.set('removendo');
    this.api
      .remover(ref.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.concluirRemocao(ref, result));
  }

  private concluirRemocao(ref: ReferenciaReservaDemograficaDto, result: ApiResult<void>): void {
    this.escrita.set(null);
    if (result.ok) {
      this.anuncioDaRemocao.set(`Referência do Censo ${ref.censoReferencia} removida.`);
      this.notifications.success('Referência removida', ref.censoReferencia);
      this.confirmOpen.set(false);
      this.refParaRemover.set(null);
      this.store.recarregar();
      return;
    }
    const motivo = this.problemI18n.resolve(result.problem).title;
    this.erroRemocao.set(motivo);
    this.anuncioDaRemocao.set(`Não foi possível remover: ${motivo}`);
    this.notifications.errorFromProblem(result.problem, {
      title: 'Não foi possível remover a referência demográfica',
    });
  }

  salvar(): void {
    if (this.gravando()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focarErro();
      return;
    }
    this.anuncioFormulario.set('Salvando referência.');
    this.escrita.set('salvando');
    this.formError.set(null);

    if (this.modo() === 'criar') {
      this.api
        .criar(this.criarCommand(), withIdempotencyKey(this.idempotencyKeyAtual()))
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((result) => this.handleSalvarResult(result));
      return;
    }

    this.api
      .atualizar(
        this.idEmEdicao() ?? '',
        this.atualizarCommand(),
        withIdempotencyKey(this.idempotencyKeyAtual()),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleSalvarResult(result));
  }

  erroDoCampo(nome: keyof ReservaForm): string | null {
    return mensagemDoCampo(this.form, nome);
  }

  private handleSalvarResult(result: ApiResult<string | void>): void {
    this.escrita.set(null);
    if (result.ok) {
      this.notifications.success(
        this.modo() === 'criar' ? 'Referência criada' : 'Referência atualizada',
      );
      this.formOpen.set(false);
      this.idempotencyKeyAtual.set(idempotencyKey.create());
      this.store.recarregar();
      return;
    }
    this.aplicarFalha(result.problem);
    this.anuncioFormulario.set(
      this.formError() ??
        result.problem.errors?.map((erro) => erro.message).join(' ') ??
        this.problemI18n.resolve(result.problem).title,
    );
  }

  private aplicarFalha(problem: ProblemDetails): void {
    if (deveRotacionarIdempotencyKey(problem)) {
      this.renovarIdempotencyKey();
    }

    if (
      problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO &&
      problem.errors &&
      problem.errors.length > 0
    ) {
      this.aplicarErrosDeValidacao(problem.errors);
      this.focarErro();
      return;
    }

    if (problem.code === RESERVA_DEMOGRAFICA_CENSO_JA_EXISTE_CODE && this.modo() === 'criar') {
      this.recusarCensoDuplicado(problem);
      return;
    }

    if (
      problem.status === STATUS_HTTP.CONFLITO ||
      problem.code === IDEMPOTENCY_PROBLEM_CODES.BODY_MISMATCH
    ) {
      this.notifications.errorFromProblem(problem);
    }

    this.formError.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) {
      this.notifications.errorFromProblem(problem);
    }
  }

  private recusarCensoDuplicado(problem: ProblemDetails): void {
    this.notifications.errorFromProblem(problem);
    const control = this.form.controls.censoReferencia;
    control.setErrors({
      backend: { code: problem.code, message: this.problemI18n.resolve(problem).title },
    });
    control.markAsTouched();
    this.formError.set(null);
    this.focarErro();
  }

  private renovarIdempotencyKey(): void {
    this.idempotencyKeyAtual.set(idempotencyKey.create());
  }

  private aplicarErrosDeValidacao(errors: ReadonlyArray<ProblemValidationError>): void {
    let aplicouAlgum = false;
    for (const erro of errors) {
      const controlName = controlNameFromBackendField(erro.field);
      if (controlName === null) continue;
      const control = this.form.controls[controlName];
      control.setErrors({ backend: { code: erro.code, message: erro.message } });
      control.markAsTouched();
      aplicouAlgum = true;
    }
    if (aplicouAlgum) {
      this.formError.set(null);
      return;
    }
    this.formError.set('Não foi possível mapear os erros de validação. Revise os campos.');
  }

  private criarCommand(): CriarReferenciaReservaDemograficaCommand {
    const raw = this.form.getRawValue();
    return {
      censoReferencia: nullIfBlank(raw.censoReferencia),
      ppiPercentual: raw.ppiPercentual ?? 0,
      quilombolaPercentual: raw.quilombolaPercentual ?? 0,
      pcdPercentual: raw.pcdPercentual ?? 0,
      baseLegal: nullIfBlank(raw.baseLegal),
    };
  }

  private atualizarCommand(): AtualizarReferenciaReservaDemograficaCommand {
    return { id: this.idEmEdicao() ?? '', ...this.criarCommand() };
  }
  fechar(): void {
    if (!this.gravando()) this.formOpen.set(false);
  }

  private focarErro(): void {
    afterNextRender(
      () =>
        this.host.nativeElement
          .querySelector<HTMLElement>('#cfg-reserva-form [aria-invalid="true"]')
          ?.focus(),
      { injector: this.injector },
    );
  }
}

const RESERVA_CONTROL_NAMES: ReadonlySet<string> = new Set<keyof ReservaForm>([
  'censoReferencia',
  'ppiPercentual',
  'quilombolaPercentual',
  'pcdPercentual',
  'baseLegal',
]);

function controlNameFromBackendField(field: string): keyof ReservaForm | null {
  const normalized =
    field
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/u, '') ?? field;
  const camelCase = normalized.charAt(0).toLocaleLowerCase('pt-BR') + normalized.slice(1);
  return RESERVA_CONTROL_NAMES.has(camelCase) ? (camelCase as keyof ReservaForm) : null;
}

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
