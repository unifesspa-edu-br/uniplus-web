import { HttpParams } from "@angular/common/http";
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  linkedSignal,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";

import {
  ApiResult,
  Cursor,
  cursorToString,
  extractNextCursor,
  extractPrevCursor,
  idempotencyKey,
  PaginationDirection,
  ProblemDetails,
  ProblemI18nService,
  ProblemValidationError,
  useApiResource,
  withIdempotencyKey,
  withVendorMime,
} from "@uniplus/shared-core/http";
import {NotificationService } from "@uniplus/shared-core/notifications";
import {
  AtualizarTipoDeficienciaCommand,
  CONFIGURACAO_BASE_PATH,
  CriarTipoDeficienciaCommand,
  TipoDeficienciaApi,
  TipoDeficienciaDto,
} from "@uniplus/shared-data/configuracao";
import {
  AlertComponent,
  SkeletonComponent,
  TagComponent,
  EmptyStateComponent,
  DrawerComponent,
  SpinnerComponent,
  DialogComponent,
  FilterBarComponent,
  PagerComponent,
} from "@uniplus/shared-ui/components";
import { debounceTime } from 'rxjs';

type ModoFormulario = "criar" | "editar";

interface TipoDeficienciaForm {
  nome: FormControl<string>;
  descricao: FormControl<string>;
  codigo: FormControl<string>;
}

type PaginaProps = {
 readonly cursor: Cursor;
 readonly direction: PaginationDirection
} | undefined;

/** Vendor code do DomainError `TipoDeficienciaNomeJaExiste` (uniplus-api, 409 Conflict). */
const TIPO_DEFICIENCIA_NOME_JA_EXISTE_CODE = 'uniplus.configuracao.tipo_deficiencia.nome_ja_existe';
/** Vendor code do DomainError `TipoDeficienciaCodigoJaExiste` (uniplus-api, 409 Conflict). */
const TIPO_DEFICIENCIA_CODIGO_JA_EXISTE_CODE = 'uniplus.configuracao.tipo_deficiencia.codigo_ja_existe';
/** Vendor code do DomainError `TipoDeficienciaCodigoObrigatorio` (uniplus-api, 422 Unprocessable Entity). */
const TIPO_DEFICIENCIA_CODIGO_OBRIGATORIO_CODE =
  'uniplus.configuracao.tipo_deficiencia.codigo_obrigatorio';
/** Vendor code do DomainError `TipoDeficienciaCodigoFormatoInvalido` (uniplus-api, 422 Unprocessable Entity). */
const TIPO_DEFICIENCIA_CODIGO_FORMATO_INVALIDO_CODE =
  'uniplus.configuracao.tipo_deficiencia.codigo_formato_invalido';

const TIPO_DEFICIENCIA_CONTROL_NAMES: ReadonlySet<string> = new Set<keyof TipoDeficienciaForm>([
  'nome',
  'descricao',
  'codigo'
]);

function controlNameFromBackendField(field: string): keyof TipoDeficienciaForm | null {
  const normalized =
    field
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/u, '') ?? field;
  const camelCase = normalized.charAt(0).toLocaleLowerCase('pt-BR') + normalized.slice(1);
  return TIPO_DEFICIENCIA_CONTROL_NAMES.has(camelCase) ? (camelCase as keyof TipoDeficienciaForm) : null;
}

/** Tamanho de página ao esgotar o cursor (ADR-0015/0026). */
const PAGE_SIZE = 50;

@Component({
  selector: 'cfg-tipos-deficiencia-list',
  imports: [
    AlertComponent,
    SkeletonComponent,
    TagComponent,
    EmptyStateComponent,
    DrawerComponent,
    SpinnerComponent,
    ReactiveFormsModule,
    DialogComponent,
    FilterBarComponent,
    PagerComponent,
  ],
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Tipo de Deficiência</h1>
        <p class="page-header__desc">
          Tipos de deficiência reconhecidos — cadastro independente, identificado pelo código ·
          UNI-REQ-0012.
        </p>
      </div>
    </div>
    <ui-alert variant="info" heading="Cadastro independente" [dynamic]="false">
      Aqui o tipo de deficiência é um cadastro <strong>simples e independente</strong> — não há
      vínculo com condições ou recursos. A regra de que um tipo de deficiência só é ofertado sob a
      condição <strong>PCD</strong> vale apenas no momento em que um processo seletivo oferta o
      atendimento (Módulo Seleção), não neste cadastro.
    </ui-alert>

    @if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar os tipos de deficiência">
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

    @if (loading() && tiposDeficiencia().length === 0) {
      <ui-skeleton skeletonKind="card" blockSize="10rem" />
      <ui-skeleton skeletonKind="card" blockSize="10rem" />
    }

    <div data-scope class="cfg-unidades-scope">
      <ui-filter-bar
        ariaLabel="Filtrar tipos de deficiência"
        searchPlaceholder="Buscar por código ou nome..."
        searchAriaLabel="Buscar tipos de deficiência"
        [(searchValue)]="termoBusca"
      >
        <button
          uiFilterBarActions
          type="button"
          class="btn btn--tertiary btn--sm btn--rect"
          (click)="limparFiltros()"
        >
          Limpar
        </button>
      </ui-filter-bar>

      <section class="panel" aria-labelledby="cfg-unidades-list-title">
        <div class="panel-head">
          <div class="panel-head__title">
            <h2 id="cfg-unidades-list-title">Tipos de deficiência</h2>
            <span class="list-count" aria-label="Total de tipos de deficiências carregadas">
              {{ tiposDeficienciaFiltrados().length }}
            </span>
          </div>
          <button type="button" class="btn btn--primary" (click)="abrirDrawerCriacao()">
            <i class="pi pi-plus btn__icon" aria-hidden="true"></i>
            Novo tipo
          </button>
        </div>

        @if (tiposDeficienciaFiltrados().length > 0) {
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Nome</th>
                  <th scope="col">Descrição</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span class="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                @for (tipoDeficiencia of tiposDeficienciaFiltrados(); track tipoDeficiencia.id) {
                  <tr>
                    <td data-label="Código">
                      <code>{{ tipoDeficiencia.codigo }}</code>
                    </td>
                    <td data-label="Nome">
                      <div class="table-responsive__primary">
                        {{ tipoDeficiencia.nome }}
                      </div>
                    </td>
                    <td data-label="Descrição">
                      {{ tipoDeficiencia.descricao }}
                    </td>
                    <td data-label="Status">
                      <ui-tag variant="success">Ativa</ui-tag>
                    </td>
                    <td class="table-responsive__actions" data-label="Ações">
                      <button
                        type="button"
                        class="btn btn--tertiary btn--sm btn--rect"
                        [disabled]="loading() || submitting()"
                        (click)="abrirEdicao(tipoDeficiencia)"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        class="btn btn--tertiary btn--sm btn--rect"
                        [disabled]="loading() || submitting()"
                        (click)="abrirInativarTipoDeficiencia(tipoDeficiencia)"
                      >
                        Inativar
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else if (!loading() && !errorMessage()) {
          @if (temFiltro()) {
            <ui-empty-state
              heading="Nenhum tipo de deficiência encontrado"
              description="Ajuste a busca para ver resultados."
            >
              <button type="button" class="btn btn--secondary" (click)="limparFiltros()">
                Limpar filtros
              </button>
            </ui-empty-state>
          } @else {
            <ui-empty-state
              heading="Nenhum tipo de deficiência carregado"
              description="Cadastre um tipo de deficiência para iniciar a estrutura institucional."
            >
              <button type="button" class="btn btn--primary" (click)="abrirDrawerCriacao()">
                Novo tipo
              </button>
            </ui-empty-state>
          }
        }
        @if (prevCursor() !== null || nextCursor() !== null) {
          <ui-pager
            statusText="Navegação por páginas"
            navigationLabel="Paginação de tipo de deficiência"
            [hasPrevious]="prevCursor() !== null"
            [hasNext]="nextCursor() !== null"
            [isDisabled]="loading()"
            (previous)="paginaAnterior()"
            (next)="proximaPagina()"
          />
        }
      </section>
    </div>

    <ui-drawer
      class="cfg-form-drawer"
      [(visible)]="formOpen"
      [heading]="formHeading()"
      ariaLabel="Formulário do tipo de deficiência"
      position="right"
    >
      @if (formError()) {
        <ui-alert variant="danger" heading="Não foi possível salvar">
          {{ formError() }}
        </ui-alert>
      }
      <form
        [formGroup]="form"
        id="cfg-unidade-form"
        (ngSubmit)="salvar()"
        novalidate
        class="cfg-form"
      >
        <section aria-labelledby="cfg-form-identificadores">
          <div class="form-grid">
            <label class="field field--full" [class.is-error]="erroDoCampo('nome')">
              <span class="field__label is-required">Nome</span>
              <input
                class="input"
                type="text"
                placeholder="Ex.: Visual"
                formControlName="nome"
                [attr.aria-invalid]="erroDoCampo('nome') ? 'true' : null"
              />
              <span class="field__hint">
                Rótulo legível do tipo de deficiência — único entre os tipos ativos. Impede
                duplicatas como dois "Visual".
              </span>
              @if (erroDoCampo('nome')) {
                <span class="field__error">{{ erroDoCampo('nome') }}</span>
              }
            </label>
            @let erroCampoCodigo = erroDoCampo('codigo');
            <label class="field field--full" [class.is-error]="erroCampoCodigo">
              <span class="field__label is-required">Código</span>
              <input
                class="input"
                type="text"
                placeholder="Ex.: VISUAL"
                formControlName="codigo"
                style="text-transform: uppercase;"
                [attr.aria-invalid]="erroCampoCodigo ? 'true' : null"
                list="cfg-tipo-deficiencia-sugestoes"
              />
              <datalist id="cfg-tipo-deficiencia-sugestoes">
                @for (
                  tipoDeficienciaCodigoSugestao of tiposDeficienciaCodigoSugestoes();
                  track $index
                ) {
                  <option [value]="tipoDeficienciaCodigoSugestao"></option>
                }
              </datalist>
              <span class="field__hint">
                Identidade do cadastro: caixa alta, começando por letra, com letras, números e
                sublinhado, de 2 a 50 caracteres. Único entre os tipos de deficiência ativos.
                Sugerido a partir do nome e editável antes de salvar.
              </span>
              @if (erroCampoCodigo) {
                <span class="field__error">{{ erroCampoCodigo }}</span>
              }
            </label>
            <label class="field field--full" [class.is-error]="erroDoCampo('descricao')">
              <span class="field__label is-required">Descrição</span>
              <textarea
                class="input"
                type="text"
                placeholder="Ex.: abrangência ou base legal (TEA: Lei 12.764/2012)."
                formControlName="descricao"
                [attr.aria-invalid]="erroDoCampo('descricao') ? 'true' : null"
              ></textarea>
              @if (erroDoCampo('descricao')) {
                <span class="field__error">{{ erroDoCampo('descricao') }}</span>
              }
            </label>
          </div>
        </section>
      </form>

      <div class="cfg-form-footer">
        <button type="button" class="btn btn--tertiary btn--rect" (click)="formOpen.set(false)">
          Cancelar
        </button>
        <button
          type="submit"
          form="cfg-unidade-form"
          class="btn btn--primary"
          [disabled]="saving() || form.invalid"
        >
          @if (saving()) {
            <ui-spinner size="sm" />
          }
          {{ saving() ? 'Salvando...' : modo() === 'criar' ? 'Criar tipo' : 'Salvar tipo' }}
        </button>
      </div>
    </ui-drawer>
    <ui-dialog
      [(visible)]="confirmOpen"
      heading="Inativar tipo de deficiência?"
      (closed)="confirmOpen.set(false)"
    >
      <p>
        Você está prestes a inativar o tipo de deficiência
        <code>{{ tipoDeficienciaParaInativar()?.codigo }}</code>
        — <strong>{{ tipoDeficienciaParaInativar()?.nome }}.</strong>
      </p>
      <p>
        A inativação impede novos editais de utilizá-lo, mas
        <strong>não altera ofertas já congeladas</strong>
        — a cópia por valor de cada processo permanece íntegra.
      </p>
      <div uiDialogFooter>
        <button type="button" class="btn btn--tertiary" (click)="confirmOpen.set(false)">
          Cancelar
        </button>
        <button type="button" class="btn btn--danger" (click)="inativarConfirmado()">
          Confirmar inativação
        </button>
      </div>
    </ui-dialog>
  `,
  host: { class: 'cfg-page' },
})
export class TiposDeficienciaListPage implements OnInit {
  private readonly api = inject(TipoDeficienciaApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  private readonly pagina = signal<PaginaProps>(undefined);
  private readonly lista = useApiResource<readonly TipoDeficienciaDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/tipos-deficiencia`,
    params: this.montarParams(),
    context: withVendorMime('tipo-deficiencia', 1),
  }));
  protected readonly termoBusca = signal('');
  protected readonly loading = this.lista.isLoading;
  private readonly cursores = linkedSignal<
    ApiResult<readonly TipoDeficienciaDto[]> | undefined,
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
  protected readonly tiposDeficiencia = linkedSignal<
    ApiResult<readonly TipoDeficienciaDto[]> | undefined,
    readonly TipoDeficienciaDto[]
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
  // Busca client-side sobre a página carregada: o backend (api#588) só pagina
  // por cursor, sem filtro de texto/código/nome no contrato.
  protected readonly tiposDeficienciaFiltrados = computed(() => {
    const termo = this.termoBusca().trim().toLocaleLowerCase('pt-BR');
    if (termo.length === 0) {
      return this.tiposDeficiencia();
    }
    return this.tiposDeficiencia().filter(
      (tiposDeficiencia) =>
        tiposDeficiencia.nome.toLocaleLowerCase('pt-BR').includes(termo) ||
        tiposDeficiencia.codigo.toLocaleLowerCase('pt-BR').includes(termo),
    );
  });
  protected readonly formHeading = computed(() =>
    this.modo() === 'criar' ? 'Novo tipo de deficiência' : 'Editar tipo de deficiência',
  );
  protected readonly errorMessage = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar tipos de deficiência.' : null;
  });
  readonly modo = signal<ModoFormulario>('criar');
  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  readonly drawerOpen = signal(false);
  readonly submitting = signal(false);
  readonly tipoDeficienciaParaInativar = signal<TipoDeficienciaDto | null>(null);
  readonly confirmOpen = signal(false);
  readonly form = new FormGroup<TipoDeficienciaForm>({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(255)],
    }),
    descricao: new FormControl('', {
      nonNullable: true,
      // `Validators.required` aceita uma string só de espaços, que o `trim()`
      // do payload reduziria a vazio e o backend recusaria com 422; o padrão
      // exige ao menos um caractere significativo.
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(1000)],
    }),
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(50),
        Validators.pattern('^[A-Z][A-Z0-9_]{1,49}$'),
      ],
    }),
  });
  protected readonly formError = signal<string | null>(null);
  readonly tipoDeficienciaEmEdicaoId = signal<string | null>(null);
  protected readonly temFiltro = computed(() => this.termoBusca().trim().length > 0);
  protected readonly tiposDeficienciaCodigoSugestoes = signal<string[]>([]);

  constructor() {
    effect(() => {
      const problem = this.lista.problem();
      if (problem && problem.status >= 500) {
        const titulo = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title: titulo }));
      }
    });
  }

  ngOnInit(): void {
    this.form.valueChanges.pipe(debounceTime(300)).subscribe(({ codigo, nome }) => {
      if (nome) {
        const tipoDeficienciaCodigoFormatado = nome
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')
          .toUpperCase();
        this.tiposDeficienciaCodigoSugestoes.set([tipoDeficienciaCodigoFormatado]);
        if (!this.form.controls.codigo.value && this.form.controls.codigo.pristine) {
          this.form.controls.codigo.patchValue(tipoDeficienciaCodigoFormatado);
        }
      }
      if (codigo) {
        this.form.controls.codigo.setValue(codigo.toLocaleUpperCase(), {
          emitEvent: false,
          emitModelToViewChange: false,
        });
      }
    });
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

  tentarNovamente(): void {
    if (!this.loading()) {
      this.lista.reload();
    }
  }

  limparFiltroBusca(): void {
    this.termoBusca.set('');
  }

  limparFiltros(): void {
    this.limparFiltroBusca();
  }

  abrirDrawerCriacao() {
    this.modo.set('criar');
    this.form.reset({
      nome: '',
      descricao: '',
      codigo: '',
    });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  protected abrirEdicao(tipoDeficiencia: TipoDeficienciaDto): void {
    this.modo.set('editar');
    this.tipoDeficienciaEmEdicaoId.set(tipoDeficiencia.id);
    this.form.reset({
      codigo: tipoDeficiencia.codigo,
      nome: tipoDeficiencia.nome,
      descricao: tipoDeficiencia.descricao ?? '',
    });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.drawerOpen.set(false);
    this.formOpen.set(true);
  }

  abrirInativarTipoDeficiencia(tipoDeficiencia: TipoDeficienciaDto): void {
    this.tipoDeficienciaParaInativar.set(tipoDeficiencia);
    this.confirmOpen.set(true);
  }

  protected salvar(): void {
    if (this.saving()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
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
        this.tipoDeficienciaEmEdicaoId() ?? '',
        this.atualizarCommand(),
        withIdempotencyKey(this.idempotencyKeyAtual()),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleSalvarResult(result));
  }

  private atualizarCommand(): AtualizarTipoDeficienciaCommand {
    return { id: this.tipoDeficienciaEmEdicaoId() ?? '', ...this.criarCommand() };
  }

  protected erroDoCampo(nome: keyof TipoDeficienciaForm): string | null {
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
    if (control.errors['minlength'])
      return `Informe ao menos ${control.errors['minlength']['requiredLength']} caracteres.`;
    if (control.errors['maxlength']) return 'Valor acima do tamanho permitido.';
    if (control.errors['pattern'])
      return 'Formato inválido. Use letras maiúsculas, números e sublinhado, iniciando por letra (ex.: VISUAL, DEFICIENCIA_VISUAL).';
    return 'Valor inválido.';
  }

  private recarregar(): void {
    if (this.pagina() === undefined) {
      this.lista.reload();
    } else {
      this.pagina.set(undefined);
    }
  }

  private criarCommand(): CriarTipoDeficienciaCommand {
    const raw = this.form.getRawValue();
    return {
      codigo: raw.codigo.trim(),
      nome: raw.nome.trim(),
      descricao: raw.descricao.trim(),
    };
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
    const codigoErro = [
      TIPO_DEFICIENCIA_CODIGO_OBRIGATORIO_CODE,
      TIPO_DEFICIENCIA_CODIGO_FORMATO_INVALIDO_CODE,
      TIPO_DEFICIENCIA_CODIGO_JA_EXISTE_CODE,
    ];
    if (codigoErro.includes(problem.code)) {
      this.notifications.errorFromProblem(problem);
      this.renovarIdempotencyKey();
      this.form.controls.codigo.setErrors({
        backend: { code: problem.code, message: this.problemI18n.resolve(problem).title },
      });
      this.form.controls.codigo.markAsTouched();
      return;
    }

    if (problem.code === TIPO_DEFICIENCIA_NOME_JA_EXISTE_CODE) {
      this.notifications.errorFromProblem(problem);
      this.renovarIdempotencyKey();
      this.form.controls.nome.setErrors({
        backend: { code: problem.code, message: this.problemI18n.resolve(problem).title },
      });
      this.form.controls.nome.markAsTouched();
      return;
    }

    if (problem.status === 409 || problem.code === 'uniplus.idempotency.body_mismatch') {
      this.notifications.errorFromProblem(problem);
      this.renovarIdempotencyKey();
    }

    this.formError.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) {
      this.notifications.errorFromProblem(problem);
    }
  }

  private handleSalvarResult(result: ApiResult<string | void>): void {
    this.saving.set(false);
    if (result.ok) {
      this.notifications.success(
        this.modo() === 'criar' ? 'Tipo de deficiência criado' : 'Tipo de deficiência atualizado',
      );
      this.formOpen.set(false);
      this.idempotencyKeyAtual.set(idempotencyKey.create());
      this.recarregar();
      return;
    }
    this.aplicarFalha(result.problem);
  }

  private handleRemoverResult(result: ApiResult<void>): void {
    this.saving.set(false);
    if (result.ok) {
      this.notifications.success('Tipo de deficiência inativado');
      this.formOpen.set(false);
      this.confirmOpen.set(false);
      this.tipoDeficienciaParaInativar.set(null);
      this.recarregar();
      return;
    }
    this.aplicarFalha(result.problem);
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

  protected inativarConfirmado(): void {
    const tipoDeficiencia = this.tipoDeficienciaParaInativar();
    if (tipoDeficiencia === null || this.saving()) {
      return;
    }

    this.api
      .remover(tipoDeficiencia.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleRemoverResult(result));
  }
}
