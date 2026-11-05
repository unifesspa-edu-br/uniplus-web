import {
  Injectable,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  DestroyRef,
  computed,
  inject,
  signal,
  WritableSignal,
} from '@angular/core';
import { Observable } from 'rxjs';
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
  idempotencyKey,
  withIdempotencyKey,
} from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  TipoProcessoDto,
  TiposProcessoApi,
  type AtualizarTipoProcessoCommand,
  type CriarTipoProcessoCommand,
} from '@uniplus/shared-data/configuracao';
import { CODIGO_CADASTRO_FORMATO, CODIGO_CADASTRO_TAMANHO_MAXIMO } from '@uniplus/shared-utils';
import { ligarCodigoDeCadastro } from '../../shared/codigo-de-cadastro';
import { TiposProcessoStore } from './tipos-processo.store';
import { controlNameFromBackendField, nullIfBlank, TipoProcessoForm } from './tipo-processo-form';
/** Limites de tamanho dos campos editáveis (Domain `TipoProcesso`, uniplus-api). */
const NOME_MAX_LENGTH = 200;
const DESCRICAO_MAX_LENGTH = 1000;

/** Vendor code do DomainError `TipoProcesso.CodigoJaExiste` (uniplus-api, 409 Conflict). */
const TIPO_PROCESSO_CODIGO_JA_EXISTE_CODE = 'uniplus.configuracao.tipo_processo.codigo_ja_existe';

type ModoFormulario = 'criar' | 'editar';

@Injectable()
export class EdicaoDosTiposProcesso {
  private readonly api = inject(TiposProcessoApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly store = inject(TiposProcessoStore);
  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly escrita = signal<'salvando' | 'removendo' | 'reativando' | null>(null);
  private readonly aguardandoRecarga = signal(false);
  readonly gravando = computed(() => this.escrita() !== null || this.aguardandoRecarga());
  readonly saving = computed(() => this.escrita() === 'salvando');
  readonly removendo = computed(() => this.escrita() === 'removendo');
  readonly anuncio = signal('');
  readonly tipoEmAndamento = signal<string | null>(null);
  readonly rotuloEmAndamento = signal('');
  readonly formOpen = signal(false);
  readonly confirmOpen = signal(false);
  readonly confirmReativarOpen = signal(false);
  readonly formError = signal<string | null>(null);
  readonly confirmError = signal<string | null>(null);
  readonly confirmReativarError = signal<string | null>(null);
  readonly modo = signal<ModoFormulario>('criar');
  readonly tipoEmEdicaoId = signal<string | null>(null);
  readonly tipoParaRemover = signal<TipoProcessoDto | null>(null);
  readonly tipoParaReativar = signal<TipoProcessoDto | null>(null);
  readonly idempotencyKeyAtual = signal(idempotencyKey.create());
  readonly idempotencyKeyReativar = signal(idempotencyKey.create());
  readonly formHeading = computed(() =>
    this.modo() === 'criar' ? 'Novo tipo de processo' : 'Editar tipo de processo',
  );

  readonly confirmMessage = computed(() => {
    const erro = this.confirmError();
    if (erro !== null) {
      return erro;
    }
    const tipo = this.tipoParaRemover();
    return tipo
      ? `Deseja inativar o tipo de processo ${tipo.codigo}? Ele deixa de ser oferecido na criação ` +
          'de novos Processos Seletivos. Processos já criados que o referenciam não são afetados. ' +
          'Um novo cadastro com o mesmo código continua sendo recusado — mas o tipo pode ser ' +
          'reativado depois.'
      : 'Deseja inativar este tipo de processo?';
  });

  readonly confirmReativarMessage = computed(() => {
    const erro = this.confirmReativarError();
    if (erro !== null) {
      return erro;
    }
    const tipo = this.tipoParaReativar();
    return tipo
      ? `Deseja reativar o tipo de processo ${tipo.codigo}? Ele volta a ser oferecido na criação ` +
          'de novos Processos Seletivos. Processos e versões de configuração já produzidos não são ' +
          'alterados.'
      : 'Deseja reativar este tipo de processo?';
  });

  readonly form: FormGroup<TipoProcessoForm> = new FormGroup<TipoProcessoForm>({
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(CODIGO_CADASTRO_TAMANHO_MAXIMO),
        Validators.pattern(CODIGO_CADASTRO_FORMATO),
      ],
    }),
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(NOME_MAX_LENGTH)],
    }),
    descricao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(DESCRICAO_MAX_LENGTH)],
    }),
  });
  private readonly ligacaoDoCodigo = ligarCodigoDeCadastro(
    this.form.controls,
    () => this.modo() === 'criar',
  );

  abrirCadastro(): void {
    if (this.gravando()) return;
    this.modo.set('criar');
    this.tipoEmEdicaoId.set(null);
    this.ligacaoDoCodigo.reiniciar();
    this.form.reset({ codigo: '', nome: '', descricao: '' });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  abrirEdicao(tipo: TipoProcessoDto): void {
    if (this.gravando()) return;
    this.modo.set('editar');
    this.tipoEmEdicaoId.set(tipo.id);
    this.form.reset({
      codigo: tipo.codigo,
      nome: tipo.nome,
      descricao: tipo.descricao ?? '',
    });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  pedirRemocao(tipo: TipoProcessoDto): void {
    if (this.gravando()) return;
    this.tipoParaRemover.set(tipo);
    this.confirmError.set(null);
    this.confirmOpen.set(true);
  }

  removerConfirmado(): void {
    const tipo = this.tipoParaRemover();
    if (tipo === null) return;
    this.gravar('removendo', this.api.remover(tipo.id), (result) => {
      if (result.ok) {
        this.notifications.success('Tipo de processo inativado', tipo.codigo);
        this.confirmOpen.set(false);
        this.tipoParaRemover.set(null);
        this.recarregar();
      } else {
        this.recusarConfirmacao(result.problem, this.confirmError, this.confirmOpen);
      }
    });
  }

  pedirReativacao(tipo: TipoProcessoDto): void {
    if (this.gravando()) return;
    this.tipoParaReativar.set(tipo);
    this.confirmReativarError.set(null);
    this.idempotencyKeyReativar.set(idempotencyKey.create());
    this.confirmReativarOpen.set(true);
  }

  reativarConfirmado(): void {
    const tipo = this.tipoParaReativar();
    if (tipo === null) return;
    const operacao = this.api.reativar(tipo.id, withIdempotencyKey(this.idempotencyKeyReativar()));
    this.gravar('reativando', operacao, (result) => {
      if (result.ok) {
        this.notifications.success('Tipo de processo reativado', tipo.codigo);
        this.confirmReativarOpen.set(false);
        this.tipoParaReativar.set(null);
        this.recarregar();
      } else {
        if (deveRotacionarIdempotencyKey(result.problem)) {
          this.idempotencyKeyReativar.set(idempotencyKey.create());
        }
        this.recusarConfirmacao(
          result.problem,
          this.confirmReativarError,
          this.confirmReativarOpen,
        );
      }
    });
  }

  salvar(): void {
    if (this.gravando()) return;
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focarPrimeiroCampoInvalido();
      return;
    }
    const chave = withIdempotencyKey(this.idempotencyKeyAtual());
    const operacao: Observable<ApiResult<string | void>> =
      this.modo() === 'criar'
        ? this.api.criar(this.criarCommand(), chave)
        : this.api.atualizar(this.tipoEmEdicaoId() ?? '', this.atualizarCommand(), chave);
    this.gravar('salvando', operacao, (result) => this.handleSalvarResult(result));
  }

  alterarAbertura(aberto: boolean): void {
    if (!this.saving()) this.formOpen.set(aberto);
  }

  private gravar<T>(
    tipo: 'salvando' | 'removendo' | 'reativando',
    operacao: Observable<ApiResult<T>>,
    concluir: (resultado: ApiResult<T>) => void,
  ): void {
    if (this.gravando()) return;
    this.escrita.set(tipo);
    this.rotuloEmAndamento.set(
      tipo === 'salvando'
        ? 'Salvando...'
        : tipo === 'removendo'
          ? 'Inativando...'
          : 'Reativando...',
    );
    const item = tipo === 'removendo' ? this.tipoParaRemover() : this.tipoParaReativar();
    if (tipo === 'salvando') this.tipoEmAndamento.set(this.tipoEmEdicaoId());
    if (tipo !== 'salvando' && item) {
      this.tipoEmAndamento.set(item.id);
      this.anuncio.set(
        `${tipo === 'removendo' ? 'Inativando' : 'Reativando'} o tipo de processo ${item.codigo}.`,
      );
    }
    operacao.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((resultado) => {
      concluir(resultado);
      if (tipo !== 'salvando' && item) this.anunciarResultado(item, resultado.ok);
      this.escrita.set(null);
      if (!this.aguardandoRecarga()) this.tipoEmAndamento.set(null);
    });
  }

  private anunciarResultado(item: TipoProcessoDto, sucesso: boolean): void {
    this.anuncio.set(
      sucesso
        ? `Operação concluída para ${item.codigo}.`
        : `Não foi possível alterar ${item.codigo}.`,
    );
  }

  private recarregar(): void {
    this.aguardandoRecarga.set(true);
    this.store.recarregar();
  }

  private recusarConfirmacao(
    problem: ProblemDetails,
    erro: WritableSignal<string | null>,
    aberto: WritableSignal<boolean>,
  ): void {
    const titulo = this.problemI18n.resolve(problem).title;
    erro.set(titulo);
    aberto.set(true);
    if (problem.status >= 500) this.notifications.errorFromProblem(problem, { title: titulo });
  }

  constructor() {
    let carregou = false;
    effect(() => {
      if (!this.aguardandoRecarga()) {
        carregou = false;
        return;
      }
      if (this.store.carregando()) carregou = true;
      else if (carregou) {
        this.aguardandoRecarga.set(false);
        this.tipoEmAndamento.set(null);
      }
    });
  }

  private handleSalvarResult(result: ApiResult<string | void>): void {
    if (result.ok) {
      this.notifications.success(
        this.modo() === 'criar' ? 'Tipo de processo criado' : 'Tipo de processo atualizado',
      );
      this.formOpen.set(false);
      this.idempotencyKeyAtual.set(idempotencyKey.create());
      this.recarregar();
      return;
    }
    this.aplicarFalha(result.problem);
    this.focarPrimeiroCampoInvalido();
  }

  private focarPrimeiroCampoInvalido(): void {
    afterNextRender(
      () =>
        this.raiz.nativeElement
          .querySelector<HTMLElement>('.field.is-error :is(input, textarea)')
          ?.focus(),
      { injector: this.injector },
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
      return;
    }
    if (problem.code === TIPO_PROCESSO_CODIGO_JA_EXISTE_CODE) {
      this.form.controls.codigo.setErrors({
        backend: { code: problem.code, message: this.problemI18n.resolve(problem).title },
      });
      this.form.controls.codigo.markAsTouched();
      return;
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

  private criarCommand(): CriarTipoProcessoCommand {
    const raw = this.form.getRawValue();
    return {
      codigo: raw.codigo.trim(),
      nome: raw.nome.trim(),
      descricao: nullIfBlank(raw.descricao),
    };
  }

  private atualizarCommand(): AtualizarTipoProcessoCommand {
    const raw = this.form.getRawValue();
    return {
      id: this.tipoEmEdicaoId() ?? '',
      nome: raw.nome.trim(),
      descricao: nullIfBlank(raw.descricao),
    };
  }
}
