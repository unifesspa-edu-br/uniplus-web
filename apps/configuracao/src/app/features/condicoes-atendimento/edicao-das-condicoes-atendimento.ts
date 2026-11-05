import { Injectable, computed, effect, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import {
  ProblemI18nService,
  ProblemDetails,
  ApiResult,
  ProblemValidationError,
  STATUS_HTTP,
} from '@uniplus/shared-core/http';
import { idempotencyKey, withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AtualizarCondicaoAtendimentoCommand,
  CondicaoAtendimentoDto,
  CondicoesAtendimentoApi,
  CriarCondicaoAtendimentoCommand,
} from '@uniplus/shared-data/configuracao';
import { CondicoesAtendimentoStore } from './condicoes-atendimento.store';

type ModoFormulario = 'criar' | 'editar';

export interface CondicaoAtendimentoForm {
  codigo: FormControl<string>;
  nome: FormControl<string>;
  descricao: FormControl<string>;
}

const CONDICAO_ATENDIMENTO_CODIGO_JA_EXISTE_CODE =
  'uniplus.configuracao.condicao_atendimento.codigo_ja_existe';

const CONDICOES_ATENDIMENTO_CONTROL_NAMES: ReadonlySet<string> = new Set<
  keyof CondicaoAtendimentoForm
>(['codigo', 'nome', 'descricao']);

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function controlNameFromBackendField(field: string): keyof CondicaoAtendimentoForm | null {
  const normalized =
    field
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/u, '') ?? field;
  const camelCase = normalized.charAt(0).toLocaleLowerCase('pt-BR') + normalized.slice(1);
  return CONDICOES_ATENDIMENTO_CONTROL_NAMES.has(camelCase)
    ? (camelCase as keyof CondicaoAtendimentoForm)
    : null;
}

@Injectable()
export class EdicaoDasCondicoesAtendimento {
  private readonly api = inject(CondicoesAtendimentoApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly store = inject(CondicoesAtendimentoStore);
  readonly formOpen = signal(false);
  private readonly escrita = signal<'salvando' | 'removendo' | null>(null);
  readonly recarregando = signal(false);
  readonly linhaEmAndamento = signal<string | null>(null);
  readonly rotuloAndamento = computed(() =>
    this.removendo()
      ? 'Removendo...'
      : this.salvando()
        ? 'Salvando...'
        : this.recarregando()
          ? 'Atualizando...'
          : '',
  );
  readonly salvando = computed(() => this.escrita() === 'salvando');
  readonly removendo = computed(() => this.escrita() === 'removendo');
  private readonly resultadoDaRemocao = signal('');
  readonly anuncioDaRemocao = computed(() => {
    const condicao = this.condicaoParaRemover();
    return this.removendo() && condicao !== null
      ? `Removendo a condição de atendimento ${condicao.nome}.`
      : this.resultadoDaRemocao();
  });
  readonly saving = computed(() => this.escrita() !== null || this.recarregando());
  readonly condicaoParaRemover = signal<CondicaoAtendimentoDto | null>(null);
  readonly confirmOpen = signal(false);
  readonly modo = signal<ModoFormulario>('criar');
  readonly idempotencyKeyAtual = signal(idempotencyKey.create());
  readonly formHeading = computed(() =>
    this.modo() === 'criar' ? 'Nova condição de atendimento' : 'Editar condição de atendimento',
  );
  readonly condicaoEmEdicaoId = signal<string | null>(null);
  readonly form: FormGroup<CondicaoAtendimentoForm> = new FormGroup<CondicaoAtendimentoForm>({
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(255),
        Validators.pattern('^[A-Z][A-Z0-9_]{1,49}$'),
      ],
    }),
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(256)],
    }),
    descricao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(1000)],
    }),
  });
  readonly formError = signal<string | null>(null);

  constructor() {
    let iniciouRecarga = false;
    effect(() => {
      if (!this.recarregando()) {
        iniciouRecarga = false;
        return;
      }
      if (this.store.carregando()) {
        iniciouRecarga = true;
        return;
      }
      if (iniciouRecarga) {
        this.recarregando.set(false);
        this.linhaEmAndamento.set(null);
      }
    });
    this.form
      .get('codigo')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((val) => {
        this.form.get('codigo')?.setValue(val.toUpperCase(), {
          emitEvent: false,
          emitModelToViewChange: false,
        });
      });
  }

  abrirDrawerCriacao(): void {
    if (this.saving()) return;
    this.modo.set('criar');
    this.condicaoEmEdicaoId.set(null);
    this.form.reset({
      codigo: '',
      nome: '',
      descricao: '',
    });
    this.form.controls.codigo.enable();
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  private atualizarCommand(): AtualizarCondicaoAtendimentoCommand {
    return { id: this.condicaoEmEdicaoId() ?? '', ...this.criarCommand() };
  }

  private criarCommand(): CriarCondicaoAtendimentoCommand {
    const raw = this.form.getRawValue();
    return {
      codigo: nullIfBlank(raw.codigo),
      nome: nullIfBlank(raw.nome),
      descricao: nullIfBlank(raw.descricao),
    };
  }

  abrirEdicao(condicaoAtendimento: CondicaoAtendimentoDto): void {
    if (this.saving()) return;
    this.modo.set('editar');
    this.condicaoEmEdicaoId.set(condicaoAtendimento.id);
    this.form.reset({
      codigo: condicaoAtendimento.codigo,
      nome: condicaoAtendimento.nome,
      descricao: condicaoAtendimento.descricao ?? '',
    });
    this.form.controls.codigo.enable();
    if (this.form.controls.codigo.value === 'PCD') {
      this.form.controls.codigo.disable();
    }
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
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

    if (problem.code === CONDICAO_ATENDIMENTO_CODIGO_JA_EXISTE_CODE) {
      this.aplicarCodigoDuplicado(problem);
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

  private aplicarCodigoDuplicado(problem: ProblemDetails): void {
    this.notifications.errorFromProblem(problem);
    this.renovarIdempotencyKey();
    this.form.controls.codigo.setErrors({
      backend: { code: problem.code, message: this.problemI18n.resolve(problem).title },
    });
    this.form.controls.codigo.markAsTouched();
  }

  private handleSalvarResult(result: ApiResult<string | void>): void {
    this.escrita.set(null);
    if (result.ok) {
      this.notifications.success(
        this.modo() === 'criar'
          ? 'Condição de atendimento criada'
          : 'Condição de atendimento atualizada',
      );
      this.formOpen.set(false);
      this.idempotencyKeyAtual.set(idempotencyKey.create());
      this.recarregar();
      return;
    }
    this.linhaEmAndamento.set(null);
    this.aplicarFalha(result.problem);
  }

  private handleRemoverResult(result: ApiResult<void>): void {
    const nome = this.condicaoParaRemover()?.nome ?? '';
    this.escrita.set(null);
    if (result.ok) {
      this.resultadoDaRemocao.set(`Condição de atendimento ${nome} removida.`);
      this.formOpen.set(false);
      this.notifications.success('Condição de atendimento removida');
      this.confirmOpen.set(false);
      this.condicaoParaRemover.set(null);
      this.recarregar();
      return;
    }
    this.resultadoDaRemocao.set(`Não foi possível remover a condição de atendimento ${nome}.`);
    this.linhaEmAndamento.set(null);
    this.notifications.errorFromProblem(result.problem);
  }

  salvar(): void {
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const chave = withIdempotencyKey(this.idempotencyKeyAtual());
    const operacao: Observable<ApiResult<string | void>> =
      this.modo() === 'criar'
        ? this.api.criar(this.criarCommand(), chave)
        : this.api.atualizar(this.condicaoEmEdicaoId() ?? '', this.atualizarCommand(), chave);
    this.gravar('salvando', operacao, (result) => this.handleSalvarResult(result));
  }

  fechar(): void {
    if (!this.salvando()) this.formOpen.set(false);
  }

  private recarregar(): void {
    this.recarregando.set(true);
    this.store.recarregar();
  }

  private gravar<T>(
    tipo: 'salvando' | 'removendo',
    operacao: Observable<ApiResult<T>>,
    concluir: (result: ApiResult<T>) => void,
  ): void {
    if (this.saving()) return;
    this.linhaEmAndamento.set(
      tipo === 'removendo' ? (this.condicaoParaRemover()?.id ?? null) : this.condicaoEmEdicaoId(),
    );
    this.escrita.set(tipo);
    operacao.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(concluir);
  }

  removerConfirmado(): void {
    const condicao = this.condicaoParaRemover();
    if (condicao === null) return;
    this.gravar('removendo', this.api.remover(condicao.id), (result) =>
      this.handleRemoverResult(result),
    );
  }

  abrirRemoverCondicao(condicao: CondicaoAtendimentoDto): void {
    if (this.saving()) return;
    this.condicaoParaRemover.set(condicao);
    this.confirmOpen.set(true);
  }
}
