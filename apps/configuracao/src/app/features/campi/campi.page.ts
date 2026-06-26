import { HttpParams } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ApiResult,
  Cursor,
  PaginationDirection,
  ProblemDetails,
  ProblemI18nService,
  ProblemValidationError,
  cursorToString,
  extractNextCursor,
  extractPrevCursor,
  idempotencyKey,
  useApiResource,
  withIdempotencyKey,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AtualizarCampusCommand,
  CONFIGURACAO_BASE_PATH,
  CampiApi,
  CampusDto,
  CriarCampusCommand,
} from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  ConfirmDialogComponent,
  DrawerComponent,
  EmptyStateComponent,
  PagerComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import {
  EnderecoFormComponent,
  cidadeObrigatoriaValidator,
  ehErroDeEndereco,
  enderecoEstruturadoDe,
  enderecoParaCommand,
  type EnderecoEstruturado,
} from '../../shared/endereco';

/** Tamanho da janela de cada página (cursor pagination, ADR-0026). */
const PAGE_SIZE = 50;

type ModoFormulario = 'criar' | 'editar';

interface CampusForm {
  sigla: FormControl<string>;
  nome: FormControl<string>;
  codigoEmec: FormControl<string>;
  endereco: FormControl<EnderecoEstruturado | null>;
}

@Component({
  selector: 'cfg-campi-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ConfirmDialogComponent,
    DrawerComponent,
    EmptyStateComponent,
    EnderecoFormComponent,
    PagerComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Campi</h1>
        <p class="page-header__desc">
          Campi da instituição com endereço estruturado (referência ao Geo) · UNI-REQ-0009.
        </p>
      </div>
    </div>

    @if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar os campi">
        {{ errorMessage() }}
        <div class="cfg-campi__retry">
          <button
            type="button"
            class="btn btn--secondary btn--sm"
            [disabled]="loading()"
            (click)="tentarNovamente()"
          >
            Tentar novamente
          </button>
        </div>
      </ui-alert>
    }

    <section class="panel" aria-labelledby="cfg-campi-list-title">
      <div class="panel-head">
        <div class="panel-head__title">
          <h2 id="cfg-campi-list-title">Campi</h2>
          @if (loading()) {
            <span class="cfg-campi__loading"><ui-spinner size="sm" /> Carregando</span>
          }
        </div>
        <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
          <i class="pi pi-plus btn__icon" aria-hidden="true"></i>
          Novo campus
        </button>
      </div>

      @if (campi().length > 0) {
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th scope="col">Sigla</th>
                <th scope="col">Nome</th>
                <th scope="col">Cidade</th>
                <th scope="col">Código e-MEC</th>
                <th scope="col"><span class="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              @for (campus of campi(); track campus.id) {
                <tr>
                  <td data-label="Sigla"><code>{{ campus.sigla }}</code></td>
                  <td data-label="Nome">{{ campus.nome }}</td>
                  <td data-label="Cidade">{{ cidadeLabel(campus) }}</td>
                  <td data-label="Código e-MEC">{{ campus.codigoEmec || '—' }}</td>
                  <td class="table-responsive__actions" data-label="Ações">
                    <button
                      type="button"
                      class="btn btn--tertiary btn--sm btn--rect"
                      [disabled]="loading()"
                      (click)="abrirEdicao(campus)"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      class="btn btn--tertiary btn--sm btn--rect"
                      [disabled]="loading()"
                      (click)="pedirRemocao(campus)"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (!loading() && !errorMessage()) {
        <ui-empty-state
          heading="Nenhum campus cadastrado"
          description="Cadastre o primeiro campus para vincular cursos e ofertas."
        >
          <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
            Novo campus
          </button>
        </ui-empty-state>
      }

      @if (prevCursor() !== null || nextCursor() !== null) {
        <ui-pager
          statusText="Navegação por páginas"
          navigationLabel="Paginação de campi"
          [hasPrevious]="prevCursor() !== null"
          [hasNext]="nextCursor() !== null"
          [isDisabled]="loading()"
          (previous)="paginaAnterior()"
          (next)="proximaPagina()"
        />
      }
    </section>

    <ui-drawer
      class="cfg-form-drawer"
      [(visible)]="formOpen"
      [heading]="formHeading()"
      ariaLabel="Formulário de campus"
      position="right"
    >
      @if (formError()) {
        <ui-alert variant="danger" heading="Não foi possível salvar">{{ formError() }}</ui-alert>
      }

      <form [formGroup]="form" id="cfg-campus-form" (ngSubmit)="salvar()" novalidate class="cfg-form">
        <section aria-labelledby="cfg-campus-identificacao">
          <h3 id="cfg-campus-identificacao" class="form-section__title">Identificação</h3>
          <div class="form-grid">
            <label class="field" [class.is-error]="erroDoCampo('sigla')">
              <span class="field__label is-required">Sigla</span>
              <input
                class="input"
                type="text"
                formControlName="sigla"
                [attr.aria-invalid]="erroDoCampo('sigla') ? 'true' : null"
              />
              @if (erroDoCampo('sigla')) {
                <span class="field__error">{{ erroDoCampo('sigla') }}</span>
              }
            </label>
            <label class="field" [class.is-error]="erroDoCampo('codigoEmec')">
              <span class="field__label">Código e-MEC</span>
              <input
                class="input"
                type="text"
                inputmode="numeric"
                formControlName="codigoEmec"
                [attr.aria-invalid]="erroDoCampo('codigoEmec') ? 'true' : null"
              />
              @if (erroDoCampo('codigoEmec')) {
                <span class="field__error">{{ erroDoCampo('codigoEmec') }}</span>
              }
            </label>
            <label class="field field--full" [class.is-error]="erroDoCampo('nome')">
              <span class="field__label is-required">Nome</span>
              <input
                class="input"
                type="text"
                formControlName="nome"
                [attr.aria-invalid]="erroDoCampo('nome') ? 'true' : null"
              />
              @if (erroDoCampo('nome')) {
                <span class="field__error">{{ erroDoCampo('nome') }}</span>
              }
            </label>
          </div>
        </section>

        <cfg-endereco-form
          formControlName="endereco"
          idPrefix="campus-endereco"
          legend="Endereço do campus"
          [erroExterno]="enderecoErro()"
        />
      </form>

      <div class="cfg-form-footer">
        <button type="button" class="btn btn--tertiary btn--rect" (click)="formOpen.set(false)">
          Cancelar
        </button>
        <button
          type="submit"
          form="cfg-campus-form"
          class="btn btn--primary"
          [disabled]="saving()"
        >
          @if (saving()) {
            <ui-spinner size="sm" />
          }
          {{ saving() ? 'Salvando...' : modo() === 'criar' ? 'Criar campus' : 'Salvar campus' }}
        </button>
      </div>
    </ui-drawer>

    <ui-confirm-dialog
      [(visible)]="confirmOpen"
      heading="Remover campus"
      [message]="confirmMessage()"
      confirmLabel="Remover"
      confirmVariant="danger"
      (confirmed)="removerConfirmado()"
    />
  `,
})
export class CampiPage {
  private readonly api = inject(CampiApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  protected readonly saving = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly confirmOpen = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly enderecoErro = signal<string | null>(null);
  protected readonly modo = signal<ModoFormulario>('criar');
  protected readonly campusEmEdicaoId = signal<string | null>(null);
  protected readonly campusParaRemover = signal<CampusDto | null>(null);
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());

  private readonly pagina = signal<
    { readonly cursor: Cursor; readonly direction: PaginationDirection } | undefined
  >(undefined);

  private readonly lista = useApiResource<readonly CampusDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/campi`,
    params: this.montarParams(),
    context: withVendorMime('campus', 1),
  }));

  protected readonly loading = this.lista.isLoading;

  private readonly cursores = linkedSignal<
    ApiResult<readonly CampusDto[]> | undefined,
    { readonly prev: Cursor | null; readonly next: Cursor | null }
  >({
    source: () => this.lista.value(),
    computation: (envelope, previous) => {
      const atual = previous?.value ?? { prev: null, next: null };
      if (envelope === undefined) {
        return atual;
      }
      const primeiraPagina = untracked(() => this.pagina() === undefined);
      if (!envelope.ok) {
        return primeiraPagina ? { prev: null, next: null } : atual;
      }
      const link = untracked(() => this.lista.headers()?.get('Link') ?? null);
      return { prev: extractPrevCursor(link), next: extractNextCursor(link) };
    },
  });

  protected readonly prevCursor = computed(() => this.cursores().prev);
  protected readonly nextCursor = computed(() => this.cursores().next);

  protected readonly campi = linkedSignal<
    ApiResult<readonly CampusDto[]> | undefined,
    readonly CampusDto[]
  >({
    source: () => this.lista.value(),
    computation: (envelope, previous) => {
      const atual = previous?.value ?? [];
      if (envelope === undefined) {
        return atual;
      }
      const primeiraPagina = untracked(() => this.pagina() === undefined);
      if (!envelope.ok) {
        return primeiraPagina ? [] : atual;
      }
      return [...envelope.data];
    },
  });

  protected readonly errorMessage = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar campi.' : null;
  });

  protected readonly formHeading = computed(() =>
    this.modo() === 'criar' ? 'Novo campus' : 'Editar campus',
  );

  protected readonly confirmMessage = computed(() => {
    const campus = this.campusParaRemover();
    return campus
      ? `Deseja remover ${campus.sigla}? A remoção é lógica (soft-delete) e preserva o histórico.`
      : 'Deseja remover este campus?';
  });

  protected readonly form: FormGroup<CampusForm> = new FormGroup<CampusForm>({
    sigla: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)],
    }),
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(250)],
    }),
    codigoEmec: new FormControl('', { nonNullable: true }),
    endereco: new FormControl<EnderecoEstruturado | null>(null, {
      validators: [cidadeObrigatoriaValidator],
    }),
  });

  constructor() {
    effect(() => {
      const problem = this.lista.problem();
      if (problem && problem.status >= 500) {
        const titulo = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title: titulo }));
      }
    });
  }

  protected cidadeLabel(campus: CampusDto): string {
    const cidade = campus.endereco?.cidade ?? campus.cidade;
    return cidade ? `${cidade.nome} — ${cidade.uf}` : '—';
  }

  protected proximaPagina(): void {
    const proximo = this.nextCursor();
    if (proximo !== null && !this.loading()) {
      this.pagina.set({ cursor: proximo, direction: 'next' });
    }
  }

  protected paginaAnterior(): void {
    const anterior = this.prevCursor();
    if (anterior !== null && !this.loading()) {
      this.pagina.set({ cursor: anterior, direction: 'prev' });
    }
  }

  protected tentarNovamente(): void {
    if (!this.loading()) {
      this.lista.reload();
    }
  }

  protected abrirCadastro(): void {
    this.modo.set('criar');
    this.campusEmEdicaoId.set(null);
    this.form.reset({ sigla: '', nome: '', codigoEmec: '', endereco: null });
    this.formError.set(null);
    this.enderecoErro.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  protected abrirEdicao(campus: CampusDto): void {
    this.modo.set('editar');
    this.campusEmEdicaoId.set(campus.id);
    this.form.reset({
      sigla: campus.sigla,
      nome: campus.nome,
      codigoEmec: campus.codigoEmec ?? '',
      endereco: enderecoEstruturadoDe(campus.cidade, campus.endereco),
    });
    this.formError.set(null);
    this.enderecoErro.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  protected pedirRemocao(campus: CampusDto): void {
    this.campusParaRemover.set(campus);
    this.confirmOpen.set(true);
  }

  protected removerConfirmado(): void {
    const campus = this.campusParaRemover();
    if (campus === null || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.api
      .remover(campus.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.saving.set(false);
        if (result.ok) {
          this.notifications.success('Campus removido', campus.sigla);
          this.confirmOpen.set(false);
          this.campusParaRemover.set(null);
          this.recarregar();
          return;
        }
        this.notifications.errorFromProblem(result.problem, {
          title: this.problemI18n.resolve(result.problem).title,
        });
      });
  }

  protected salvar(): void {
    if (this.saving()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.controls.endereco.hasError('cidadeObrigatoria')) {
        this.enderecoErro.set('Selecione a cidade do endereço (obrigatória para o campus).');
      }
      return;
    }
    this.saving.set(true);
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
        this.campusEmEdicaoId() ?? '',
        this.atualizarCommand(),
        withIdempotencyKey(this.idempotencyKeyAtual()),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleSalvarResult(result));
  }

  protected erroDoCampo(nome: keyof CampusForm): string | null {
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
    if (control.errors['maxlength']) return 'Valor acima do tamanho permitido.';
    return 'Valor inválido.';
  }

  private montarParams(): HttpParams {
    const pagina = this.pagina();
    if (pagina === undefined) {
      return new HttpParams().set('limit', String(PAGE_SIZE));
    }
    return new HttpParams()
      .set('cursor', cursorToString(pagina.cursor))
      .set('direction', pagina.direction);
  }

  private recarregar(): void {
    if (this.pagina() === undefined) {
      this.lista.reload();
    } else {
      this.pagina.set(undefined);
    }
  }

  private handleSalvarResult(result: ApiResult<string | void>): void {
    this.saving.set(false);
    if (result.ok) {
      this.notifications.success(this.modo() === 'criar' ? 'Campus criado' : 'Campus atualizado');
      this.formOpen.set(false);
      this.enderecoErro.set(null);
      this.idempotencyKeyAtual.set(idempotencyKey.create());
      this.recarregar();
      return;
    }
    this.aplicarFalha(result.problem);
  }

  private aplicarFalha(problem: ProblemDetails): void {
    if (problem.status === 422 && problem.errors && problem.errors.length > 0) {
      this.renovarIdempotencyKey();
      this.aplicarErrosDeValidacao(problem.errors);
      return;
    }
    if (ehErroDeEndereco(problem.code)) {
      this.renovarIdempotencyKey();
      this.enderecoErro.set(this.problemI18n.resolve(problem).title);
      this.formError.set(null);
      return;
    }
    if (problem.status === 409 || problem.code === 'uniplus.idempotency.body_mismatch') {
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
      this.formError.set(null);
      return;
    }
    this.formError.set('Não foi possível mapear os erros de validação. Revise os campos.');
  }

  private criarCommand(): CriarCampusCommand {
    const raw = this.form.getRawValue();
    // A cidade é obrigatória (validator cidadeObrigatoria) — o `?? ''` só satisfaz
    // o tipo não-nulo do command; em runtime o submit já está bloqueado sem cidade.
    const { cidadeCodigoIbge, cidadeNome, cidadeUf, endereco } = enderecoParaCommand(raw.endereco);
    return {
      sigla: raw.sigla.trim(),
      nome: raw.nome.trim(),
      codigoEmec: nullIfBlank(raw.codigoEmec),
      cidadeCodigoIbge: cidadeCodigoIbge ?? '',
      cidadeNome: cidadeNome ?? '',
      cidadeUf: cidadeUf ?? '',
      endereco,
    };
  }

  private atualizarCommand(): AtualizarCampusCommand {
    return { id: this.campusEmEdicaoId() ?? '', ...this.criarCommand() };
  }
}

const CAMPUS_CONTROL_NAMES: ReadonlySet<string> = new Set<keyof CampusForm>([
  'sigla',
  'nome',
  'codigoEmec',
]);

function controlNameFromBackendField(field: string): keyof CampusForm | null {
  const normalized =
    field
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/u, '') ?? field;
  const camelCase = normalized.charAt(0).toLocaleLowerCase('pt-BR') + normalized.slice(1);
  return CAMPUS_CONTROL_NAMES.has(camelCase) ? (camelCase as keyof CampusForm) : null;
}

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
