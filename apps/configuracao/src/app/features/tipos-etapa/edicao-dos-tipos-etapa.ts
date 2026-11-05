import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
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
import {
  TipoEtapaDto,
  TiposEtapaApi,
  type AtualizarTipoEtapaCommand,
  type CriarTipoEtapaCommand,
} from '@uniplus/shared-data/configuracao';
import { TiposEtapaStore } from './tipos-etapa.store';

/** Vendor code do DomainError `TipoEtapa.CodigoJaExiste` (409 Conflict). */
const TIPO_ETAPA_CODIGO_JA_EXISTE_CODE = 'uniplus.configuracao.tipo_etapa.codigo_ja_existe';

type ModoFormulario = 'criar' | 'editar';

export interface EtapaForm {
  codigo: FormControl<string>;
  nome: FormControl<string>;
  admitePontuacao: FormControl<boolean>;
  admiteEliminacao: FormControl<boolean>;
  descricao: FormControl<string>;
}

const ETAPA_CONTROL_NAMES: ReadonlySet<string> = new Set<keyof EtapaForm>([
  'codigo',
  'nome',
  'admitePontuacao',
  'admiteEliminacao',
  'descricao',
]);

@Injectable()
export class EdicaoDosTiposEtapa {
  private readonly api = inject(TiposEtapaApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly store = inject(TiposEtapaStore);

  private readonly escrita = signal<'salvando' | 'removendo' | 'recarregando' | null>(null);
  readonly saving = computed(() => this.escrita() === 'salvando');
  readonly removendo = computed(() => this.escrita() === 'removendo');
  private readonly resultadoDaRemocao = signal('');
  readonly anuncioDaRemocao = computed(() =>
    this.removendo()
      ? `Inativando o tipo de etapa ${this.tipoParaRemover()?.codigo}.`
      : this.resultadoDaRemocao(),
  );
  readonly gravando = computed(() => this.escrita() !== null);
  readonly idEmAndamento = signal<string | null>(null);
  readonly rotuloAndamento = computed(() =>
    this.removendo() ? 'Inativando...' : this.saving() ? 'Salvando...' : 'Atualizando...',
  );
  private resultadoAnterior = this.store.resultado();

  constructor() {
    effect(() => {
      const resultado = this.store.resultado();
      if (
        this.escrita() === 'recarregando' &&
        resultado?.ok &&
        resultado !== this.resultadoAnterior
      ) {
        this.escrita.set(null);
        this.idEmAndamento.set(null);
      }
    });
  }

  readonly formOpen = signal(false);
  readonly confirmOpen = signal(false);
  readonly formError = signal<string | null>(null);
  readonly modo = signal<ModoFormulario>('criar');
  readonly tipoEmEdicaoId = signal<string | null>(null);
  readonly tipoParaRemover = signal<TipoEtapaDto | null>(null);
  readonly idempotencyKeyAtual = signal(idempotencyKey.create());
  readonly formHeading = computed(() =>
    this.modo() === 'criar' ? 'Novo tipo de etapa' : 'Editar tipo de etapa',
  );

  readonly confirmMessage = computed(() => {
    const tipo = this.tipoParaRemover();
    return tipo
      ? `Deseja inativar o tipo de etapa ${tipo.codigo}? A inativação impede que novos processos declarem etapas desse tipo, e não altera as etapas já gravadas — elas congelaram a própria cópia.`
      : 'Deseja inativar este tipo de etapa?';
  });

  readonly form: FormGroup<EtapaForm> = new FormGroup<EtapaForm>({
    codigo: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    admitePontuacao: new FormControl(true, { nonNullable: true }),
    admiteEliminacao: new FormControl(true, { nonNullable: true }),
    descricao: new FormControl('', { nonNullable: true }),
  });

  abrirCadastro(): void {
    if (this.gravando()) return;
    this.modo.set('criar');
    this.tipoEmEdicaoId.set(null);
    this.form.reset({
      codigo: '',
      nome: '',
      admitePontuacao: true,
      admiteEliminacao: true,
      descricao: '',
    });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  abrirEdicao(tipo: TipoEtapaDto): void {
    if (this.gravando()) return;
    this.modo.set('editar');
    this.tipoEmEdicaoId.set(tipo.id);
    this.form.reset({
      codigo: tipo.codigo,
      nome: tipo.nome,
      admitePontuacao: tipo.admitePontuacao,
      admiteEliminacao: tipo.admiteEliminacao,
      descricao: tipo.descricao ?? '',
    });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  pedirRemocao(tipo: TipoEtapaDto): void {
    if (this.gravando()) return;
    this.tipoParaRemover.set(tipo);
    this.confirmOpen.set(true);
  }

  removerConfirmado(): void {
    const tipo = this.tipoParaRemover();
    if (tipo === null || this.gravando()) {
      return;
    }
    this.idEmAndamento.set(tipo.id);
    this.escrita.set('removendo');
    this.api
      .remover(tipo.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result.ok) {
          this.resultadoDaRemocao.set(`Tipo de etapa ${tipo.codigo} inativado.`);
          this.notifications.success('Tipo de etapa inativado', tipo.codigo);
          this.confirmOpen.set(false);
          this.tipoParaRemover.set(null);
          this.recarregar();
          return;
        }
        this.resultadoDaRemocao.set(`Não foi possível inativar o tipo de etapa ${tipo.codigo}.`);
        this.escrita.set(null);
        this.notifications.errorFromProblem(result.problem, {
          title: this.problemI18n.resolve(result.problem).title,
        });
      });
  }

  salvar(): void {
    if (this.gravando()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.idEmAndamento.set(this.tipoEmEdicaoId());
    this.escrita.set('salvando');
    this.formError.set(null);

    const modoDoEnvio = this.modo();

    if (modoDoEnvio === 'criar') {
      this.api
        .criar(this.criarCommand(), withIdempotencyKey(this.idempotencyKeyAtual()))
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((result) => this.concluirSalvamento(result, modoDoEnvio));
      return;
    }

    this.api
      .atualizar(
        this.tipoEmEdicaoId() ?? '',
        this.atualizarCommand(),
        withIdempotencyKey(this.idempotencyKeyAtual()),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.concluirSalvamento(result, modoDoEnvio));
  }

  fechar(): void {
    if (!this.gravando()) this.formOpen.set(false);
  }

  private concluirSalvamento(result: ApiResult<string | void>, modo: ModoFormulario): void {
    if (!result.ok) {
      this.aplicarFalha(result.problem);
      this.escrita.set(null);
      return;
    }
    this.notifications.success(
      modo === 'criar' ? 'Tipo de etapa criado' : 'Tipo de etapa atualizado',
    );
    this.formOpen.set(false);
    this.renovarIdempotencyKey();
    this.recarregar();
  }

  private recarregar(): void {
    this.resultadoAnterior = this.store.resultado();
    this.escrita.set('recarregando');
    this.store.recarregar();
  }

  private aplicarFalha(problem: ProblemDetails): void {
    if (
      problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO &&
      problem.errors &&
      problem.errors.length > 0
    ) {
      this.renovarIdempotencyKey();
      this.aplicarErrosDeValidacao(problem.errors);
      return;
    }
    // Código já reservado é DomainError único (409, sem `errors[]` — esse array só existe no
    // pipeline de validação de payload), então o vínculo com o campo é feito aqui.
    if (problem.code === TIPO_ETAPA_CODIGO_JA_EXISTE_CODE) {
      this.renovarIdempotencyKey();
      this.form.controls.codigo.setErrors({
        backend: { code: problem.code, message: this.problemI18n.resolve(problem).title },
      });
      this.form.controls.codigo.markAsTouched();
      return;
    }
    if (
      problem.status === STATUS_HTTP.CONFLITO ||
      problem.code === 'uniplus.idempotency.body_mismatch'
    ) {
      this.renovarIdempotencyKey();
    }
    this.formError.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) {
      this.notifications.errorFromProblem(problem);
    }
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

  private criarCommand(): CriarTipoEtapaCommand {
    const raw = this.form.getRawValue();
    return {
      codigo: raw.codigo.trim(),
      nome: raw.nome.trim(),
      admitePontuacao: raw.admitePontuacao,
      admiteEliminacao: raw.admiteEliminacao,
      descricao: nullIfBlank(raw.descricao),
    };
  }

  private atualizarCommand(): AtualizarTipoEtapaCommand {
    const raw = this.form.getRawValue();
    return {
      id: this.tipoEmEdicaoId() ?? '',
      nome: raw.nome.trim(),
      admitePontuacao: raw.admitePontuacao,
      admiteEliminacao: raw.admiteEliminacao,
      descricao: nullIfBlank(raw.descricao),
    };
  }
}

function controlNameFromBackendField(field: string): keyof EtapaForm | null {
  const normalized =
    field
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/u, '') ?? field;
  const camelCase = normalized.charAt(0).toLocaleLowerCase('pt-BR') + normalized.slice(1);
  return ETAPA_CONTROL_NAMES.has(camelCase) ? (camelCase as keyof EtapaForm) : null;
}

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
