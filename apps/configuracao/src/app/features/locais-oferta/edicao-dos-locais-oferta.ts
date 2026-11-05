import {
  DestroyRef,
  ElementRef,
  Injectable,
  Injector,
  afterNextRender,
  computed,
  effect,
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
import { idempotencyKey, withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AtualizarLocalOfertaCommand,
  CriarLocalOfertaCommand,
  LocaisOfertaApi,
  LocalOfertaDto,
  TIPOS_LOCAL_OFERTA,
  TipoLocalOferta,
} from '@uniplus/shared-data/configuracao';
import { EnderecoEstruturado } from '@uniplus/shared-ui/components';
import {
  cidadeObrigatoriaValidator,
  ehErroDeEndereco,
  enderecoEstruturadoDe,
  enderecoParaCommand,
} from '../../shared/endereco';
import { LocaisOfertaStore } from './locais-oferta.store';

type ModoFormulario = 'criar' | 'editar';
export interface LocalOfertaForm {
  tipo: FormControl<string>;
  codigoEmec: FormControl<string>;
  campusResponsavelId: FormControl<string>;
  endereco: FormControl<EnderecoEstruturado | null>;
}

@Injectable()
export class EdicaoDosLocaisOferta {
  private readonly api = inject(LocaisOfertaApi);
  private readonly leitura = inject(LocaisOfertaStore);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly recarregando = signal(false);
  private viuCarregamento = false;
  private readonly escrita = signal<'salvando' | 'removendo' | null>(null);
  readonly gravando = computed(() => this.escrita() !== null || this.recarregando());
  readonly saving = computed(() => this.escrita() === 'salvando');
  readonly removendo = computed(() => this.escrita() === 'removendo');
  focarEndereco: () => void = () => undefined;
  readonly localAfetadoId = signal<string | null>(null);
  readonly anuncio = signal('');
  readonly andamento = computed(() =>
    this.removendo()
      ? 'Removendo…'
      : this.saving()
        ? 'Salvando…'
        : this.recarregando()
          ? 'Atualizando…'
          : '',
  );
  readonly formOpen = signal(false);
  readonly confirmOpen = signal(false);
  readonly formError = signal<string | null>(null);
  readonly enderecoErro = signal<string | null>(null);
  readonly modo = signal<ModoFormulario>('criar');
  readonly localEmEdicaoId = signal<string | null>(null);
  readonly localParaRemover = signal<LocalOfertaDto | null>(null);
  readonly idempotencyKeyAtual = signal(idempotencyKey.create());

  readonly formHeading = computed(() =>
    this.modo() === 'criar' ? 'Novo local de oferta' : 'Editar local de oferta',
  );

  readonly confirmMessage = computed(() => {
    const local = this.localParaRemover();
    return local
      ? `Deseja remover este local (${TIPOS_LOCAL_OFERTA.find((tipo) => tipo.value === local.tipo)?.label ?? local.tipo})? A remoção é lógica (soft-delete).`
      : 'Deseja remover este local de oferta?';
  });

  readonly form: FormGroup<LocalOfertaForm> = new FormGroup<LocalOfertaForm>({
    tipo: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    codigoEmec: new FormControl('', { nonNullable: true }),
    campusResponsavelId: new FormControl('', { nonNullable: true }),
    endereco: new FormControl<EnderecoEstruturado | null>(null, {
      validators: [cidadeObrigatoriaValidator],
    }),
  });

  constructor() {
    effect(() => {
      if (!this.recarregando()) return;
      if (this.leitura.carregando()) this.viuCarregamento = true;
      else if (this.viuCarregamento) {
        this.viuCarregamento = false;
        this.recarregando.set(false);
        this.localAfetadoId.set(null);
      }
    });
  }

  fechar(): void {
    if (!this.gravando()) this.formOpen.set(false);
  }

  private recarregar(): void {
    this.recarregando.set(true);
    this.leitura.recarregar();
  }

  private focarErro(): void {
    afterNextRender(
      () => {
        const campo = this.host.nativeElement.querySelector<HTMLElement>(
          '#cfg-local-form [aria-invalid="true"]',
        );
        if (campo) campo.focus();
        else if (this.enderecoErro()) this.focarEndereco();
      },
      { injector: this.injector },
    );
  }
  abrirCadastro(): void {
    if (this.gravando()) return;
    this.modo.set('criar');
    this.localEmEdicaoId.set(null);
    this.form.reset({ tipo: '', codigoEmec: '', campusResponsavelId: '', endereco: null });
    this.formError.set(null);
    this.enderecoErro.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  abrirEdicao(local: LocalOfertaDto): void {
    if (this.gravando()) return;
    this.modo.set('editar');
    this.localEmEdicaoId.set(local.id);
    this.form.reset({
      tipo: local.tipo,
      codigoEmec: local.codigoEmec ?? '',
      campusResponsavelId: local.campusResponsavelId ?? '',
      endereco: enderecoEstruturadoDe(local.cidade, local.endereco),
    });
    this.formError.set(null);
    this.enderecoErro.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  pedirRemocao(local: LocalOfertaDto): void {
    if (this.gravando()) return;
    this.localParaRemover.set(local);
    this.confirmOpen.set(true);
  }

  removerConfirmado(): void {
    const local = this.localParaRemover();
    if (local === null || this.gravando()) {
      return;
    }
    this.localAfetadoId.set(local.id);
    this.anuncio.set('Removendo local de oferta.');
    this.escrita.set('removendo');
    this.api
      .remover(local.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.escrita.set(null);
        if (result.ok) {
          this.anuncio.set('Local de oferta removido.');
          this.notifications.success('Local de oferta removido');
          this.confirmOpen.set(false);
          this.localParaRemover.set(null);
          this.recarregar();
          return;
        }
        this.anuncio.set('Não foi possível remover o local de oferta.');
        this.localAfetadoId.set(null);
        this.notifications.errorFromProblem(result.problem, {
          title: this.problemI18n.resolve(result.problem).title,
        });
      });
  }

  salvar(): void {
    if (this.gravando()) {
      return;
    }
    this.formError.set(null);
    this.enderecoErro.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.controls.endereco.hasError('cidadeObrigatoria')) {
        this.enderecoErro.set('Selecione a cidade do endereço (obrigatória para o local).');
      }
      this.focarErro();
      return;
    }
    this.localAfetadoId.set(this.localEmEdicaoId());
    this.escrita.set('salvando');
    this.formError.set(null);

    if (this.modo() === 'criar') {
      this.api
        .criar(this.criarCommand(), withIdempotencyKey(this.idempotencyKeyAtual()))
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((result) => this.handleSalvarResult(result));
      return;
    }

    this.atualizar();
  }

  private atualizar(): void {
    this.api
      .atualizar(
        this.localEmEdicaoId() ?? '',
        this.atualizarCommand(),
        withIdempotencyKey(this.idempotencyKeyAtual()),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleSalvarResult(result));
  }

  erroDoCampo(nome: keyof LocalOfertaForm): string | null {
    const control = this.form.controls[nome];
    const shouldShowError = control.touched || control.dirty;
    if (!shouldShowError || control.errors === null) {
      return null;
    }
    if (control.errors['backend']) {
      const backend = control.errors['backend'] as { code: string; message: string };
      return backend.message;
    }
    if (control.errors['required']) return 'Campo obrigatório.';
    return 'Valor inválido.';
  }

  private handleSalvarResult(result: ApiResult<string | void>): void {
    this.escrita.set(null);
    if (result.ok) {
      this.notifications.success(
        this.modo() === 'criar' ? 'Local de oferta criado' : 'Local de oferta atualizado',
      );
      this.formOpen.set(false);
      this.enderecoErro.set(null);
      this.idempotencyKeyAtual.set(idempotencyKey.create());
      this.recarregar();
      return;
    }
    this.localAfetadoId.set(null);
    this.aplicarFalha(result.problem);
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
    if (ehErroDeEndereco(problem.code)) {
      this.renovarIdempotencyKey();
      this.enderecoErro.set(this.problemI18n.resolve(problem).title);
      this.formError.set(null);
      this.focarErro();
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
    let erroEndereco: string | null = null;
    for (const erro of errors) {
      if (ehErroDeEndereco(erro.field) || ehErroDeEndereco(erro.code)) {
        erroEndereco ??= erro.message;
        aplicouAlgum = true;
        continue;
      }
      const controlName = controlNameFromBackendField(erro.field);
      if (controlName === null) continue;
      const control = this.form.controls[controlName];
      control.setErrors({ backend: { code: erro.code, message: erro.message } });
      control.markAsTouched();
      aplicouAlgum = true;
    }

    this.enderecoErro.set(erroEndereco);

    if (aplicouAlgum) {
      this.focarErro();
      this.formError.set(null);
      return;
    }
    this.formError.set('Não foi possível mapear os erros de validação. Revise os campos.');
  }

  private criarCommand(): CriarLocalOfertaCommand {
    const raw = this.form.getRawValue();
    const { cidadeCodigoIbge, cidadeNome, cidadeUf, endereco } = enderecoParaCommand(raw.endereco);
    return {
      tipo: raw.tipo as TipoLocalOferta,
      codigoEmec: nullIfBlank(raw.codigoEmec),
      campusResponsavelId: nullIfBlank(raw.campusResponsavelId),
      cidadeCodigoIbge,
      cidadeNome,
      cidadeUf,
      endereco,
    };
  }

  private atualizarCommand(): AtualizarLocalOfertaCommand {
    return { id: this.localEmEdicaoId() ?? '', ...this.criarCommand() };
  }
}

const LOCAL_CONTROL_NAMES: ReadonlySet<string> = new Set<keyof LocalOfertaForm>([
  'tipo',
  'codigoEmec',
  'campusResponsavelId',
]);

function controlNameFromBackendField(field: string): keyof LocalOfertaForm | null {
  const normalized =
    field
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/u, '') ?? field;
  const camelCase = normalized.charAt(0).toLocaleLowerCase('pt-BR') + normalized.slice(1);
  return LOCAL_CONTROL_NAMES.has(camelCase) ? (camelCase as keyof LocalOfertaForm) : null;
}

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
