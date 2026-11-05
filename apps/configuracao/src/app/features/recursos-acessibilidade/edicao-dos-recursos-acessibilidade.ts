import { computed, DestroyRef, effect, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  ApiResult,
  ProblemDetails,
  ProblemI18nService,
  ProblemValidationError,
  STATUS_HTTP,
} from '@uniplus/shared-core/http';
import { idempotencyKey, withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CODIGO_CADASTRO_FORMATO, CODIGO_CADASTRO_TAMANHO_MAXIMO } from '@uniplus/shared-utils';
import {
  AtualizarRecursoAcessibilidadeCommand,
  CriarRecursoAcessibilidadeCommand,
  RecursoAcessibilidadeApi,
  RecursoAcessibilidadeDto,
} from '@uniplus/shared-data/configuracao';
import { ligarCodigoDeCadastro } from '../../shared/codigo-de-cadastro';
import { controlNameFromBackendField, nullIfBlank } from '../../shared/formulario';
import { RecursosAcessibilidadeStore } from './recursos-acessibilidade.store';

type ModoFormulario = 'criar' | 'editar';

export interface RecursoAcessibilidadeForm {
  nome: FormControl<string>;
  codigo: FormControl<string>;
  descricao: FormControl<string>;
}

const RECURSO_ACESSIBILIDADE_CONTROL_NAMES: ReadonlySet<string> = new Set<
  keyof RecursoAcessibilidadeForm
>(['nome', 'codigo', 'descricao']);

/**
 * Conflitos de unicidade (409) que pertencem a um campo do formulário: o corpo não traz
 * `errors[]`, então só o vendor code diz a qual campo o conflito se refere.
 */
const CAMPO_POR_CONFLITO: ReadonlyMap<string, keyof RecursoAcessibilidadeForm> = new Map([
  ['uniplus.configuracao.recurso_acessibilidade.codigo_ja_existe', 'codigo' as const],
  ['uniplus.configuracao.recurso_acessibilidade.nome_ja_existe', 'nome' as const],
]);

@Injectable()
export class EdicaoDosRecursosAcessibilidade {
  private readonly api = inject(RecursoAcessibilidadeApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  readonly idempotencyKeyAtual = signal(idempotencyKey.create());
  private readonly store = inject(RecursosAcessibilidadeStore);
  readonly modo = signal<ModoFormulario>('criar');
  readonly formOpen = signal(false);
  private readonly escrita = signal<'salvando' | 'removendo' | null>(null);
  readonly saving = computed(() => this.escrita() !== null);
  readonly salvando = computed(() => this.escrita() === 'salvando');
  readonly removendo = computed(() => this.escrita() === 'removendo');
  readonly anuncioDaRemocao = signal('');
  private recargaIniciada = false;
  private readonly aguardandoRecarga = signal(false);
  readonly recursoParaRemover = signal<RecursoAcessibilidadeDto | null>(null);
  readonly confirmOpen = signal(false);

  readonly form = new FormGroup<RecursoAcessibilidadeForm>({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(255)],
    }),
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(CODIGO_CADASTRO_TAMANHO_MAXIMO),
        Validators.pattern(CODIGO_CADASTRO_FORMATO),
      ],
    }),
    descricao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(1000)],
    }),
  });
  private readonly ligacaoDoCodigo = ligarCodigoDeCadastro(
    this.form.controls,
    () => this.modo() === 'criar',
  );
  readonly formError = signal<string | null>(null);
  readonly recursosAcessibilidadeEmEdicaoId = signal<string | null>(null);
  readonly formHeading = computed(() =>
    this.modo() === 'criar' ? 'Novo recurso de acessibilidade' : 'Editar recurso de acessibilidade',
  );

  constructor() {
    effect(() => {
      const carregando = this.store.carregando();
      if (!this.aguardandoRecarga()) return;
      if (this.recargaIniciada && !carregando) {
        this.recargaIniciada = false;
        this.aguardandoRecarga.set(false);
        this.escrita.set(null);
      }
      if (carregando) this.recargaIniciada = true;
    });
  }

  fechar(): void {
    if (!this.saving()) this.formOpen.set(false);
  }

  abrirDrawerCriacao() {
    if (this.saving()) return;
    this.modo.set('criar');
    this.recursosAcessibilidadeEmEdicaoId.set(null);
    this.ligacaoDoCodigo.reiniciar();
    this.form.reset({
      nome: '',
      codigo: '',
      descricao: '',
    });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  abrirRemoverRecurso(recurso: RecursoAcessibilidadeDto): void {
    if (this.saving()) return;
    this.recursoParaRemover.set(recurso);
    this.confirmOpen.set(true);
  }

  abrirEdicao(recurso: RecursoAcessibilidadeDto): void {
    if (this.saving()) return;
    this.modo.set('editar');
    this.recursosAcessibilidadeEmEdicaoId.set(recurso.id);
    this.ligacaoDoCodigo.reiniciar();
    this.form.reset({
      nome: recurso.nome,
      codigo: recurso.codigo,
      descricao: recurso.descricao ?? '',
    });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  private criarCommand(): CriarRecursoAcessibilidadeCommand {
    const raw = this.form.getRawValue();
    return {
      codigo: raw.codigo.trim(),
      nome: nullIfBlank(raw.nome),
      descricao: nullIfBlank(raw.descricao),
    };
  }

  salvar(): void {
    if (this.saving()) {
      return;
    }
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.escrita.set('salvando');

    if (this.modo() === 'criar') {
      this.api
        .criar(this.criarCommand(), withIdempotencyKey(this.idempotencyKeyAtual()))
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((result) => this.handleSalvarResult(result));
      return;
    }

    this.api
      .atualizar(
        this.recursosAcessibilidadeEmEdicaoId() ?? '',
        this.atualizarCommand(),
        withIdempotencyKey(this.idempotencyKeyAtual()),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleSalvarResult(result));
  }

  private atualizarCommand(): AtualizarRecursoAcessibilidadeCommand {
    return { id: this.recursosAcessibilidadeEmEdicaoId() ?? '', ...this.criarCommand() };
  }

  private renovarIdempotencyKey(): void {
    this.idempotencyKeyAtual.set(idempotencyKey.create());
  }

  private aplicarErrosDeValidacao(errors: ReadonlyArray<ProblemValidationError>): void {
    let aplicouAlgum = false;
    for (const erro of errors) {
      const controlName = controlNameFromBackendField<keyof RecursoAcessibilidadeForm>(
        erro.field,
        RECURSO_ACESSIBILIDADE_CONTROL_NAMES,
      );
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

  private aplicarFalha(problem: ProblemDetails): void {
    if (
      problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO &&
      problem.errors &&
      problem.errors.length > 0
    ) {
      this.notifications.errorFromProblem(problem);
      this.renovarIdempotencyKey();
      this.aplicarErrosDeValidacao(problem.errors);
      return;
    }

    if (this.aplicarConflitoDeCampo(problem)) {
      return;
    }
    if (
      problem.status === STATUS_HTTP.CONFLITO ||
      problem.code === 'uniplus.idempotency.body_mismatch'
    ) {
      this.notifications.errorFromProblem(problem);
      this.renovarIdempotencyKey();
    }
    this.formError.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) {
      this.notifications.errorFromProblem(problem);
    }
  }

  private aplicarConflitoDeCampo(problem: ProblemDetails): boolean {
    const campo = CAMPO_POR_CONFLITO.get(problem.code);
    if (!campo) {
      return false;
    }
    this.renovarIdempotencyKey();
    const control = this.form.controls[campo];
    control.setErrors({
      backend: { code: problem.code, message: this.problemI18n.resolve(problem).title },
    });
    control.markAsTouched();
    this.notifications.errorFromProblem(problem);
    return true;
  }

  private handleSalvarResult(result: ApiResult<string | void>): void {
    if (result.ok) {
      this.notifications.success(
        this.modo() === 'criar'
          ? 'Recurso de acessibilidade criado'
          : 'Recurso de acessibilidade atualizado',
      );
      this.formOpen.set(false);
      this.idempotencyKeyAtual.set(idempotencyKey.create());
      this.aguardandoRecarga.set(true);
      this.store.recarregar();
      return;
    }
    this.escrita.set(null);
    this.aplicarFalha(result.problem);
  }

  private handleRemoverResult(result: ApiResult<void>): void {
    const nome = this.recursoParaRemover()?.nome ?? '';
    if (result.ok) {
      this.anuncioDaRemocao.set(`Recurso de acessibilidade ${nome} removido.`);
      this.notifications.success('Recurso de acessibilidade removido');
      this.formOpen.set(false);
      this.confirmOpen.set(false);
      this.aguardandoRecarga.set(true);
      this.store.recarregar();
      return;
    }
    this.anuncioDaRemocao.set(`Não foi possível remover o recurso de acessibilidade ${nome}.`);
    this.escrita.set(null);
    this.notifications.errorFromProblem(result.problem);
  }

  removerConfirmado(): void {
    const recurso = this.recursoParaRemover();
    if (recurso === null || this.saving()) {
      return;
    }
    this.escrita.set('removendo');
    this.anuncioDaRemocao.set(`Removendo o recurso de acessibilidade ${recurso.nome}.`);
    this.api
      .remover(recurso.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleRemoverResult(result));
  }
}
