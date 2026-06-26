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
  AtualizarReferenciaReservaDemograficaCommand,
  CONFIGURACAO_BASE_PATH,
  CriarReferenciaReservaDemograficaCommand,
  ReferenciaReservaDemograficaDto,
  ReservaDemograficaApi,
} from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  ConfirmDialogComponent,
  DrawerComponent,
  EmptyStateComponent,
  PagerComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';

/** Tamanho da janela de cada página (cursor pagination, ADR-0026). */
const PAGE_SIZE = 100;

type ModoFormulario = 'criar' | 'editar';

interface ReservaForm {
  censoReferencia: FormControl<string>;
  ppiPercentual: FormControl<number | null>;
  quilombolaPercentual: FormControl<number | null>;
  pcdPercentual: FormControl<number | null>;
  baseLegal: FormControl<string>;
}

const PERCENTUAL_VALIDATORS = [Validators.required, Validators.min(0), Validators.max(100)];

@Component({
  selector: 'cfg-reserva-demografica-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ConfirmDialogComponent,
    DrawerComponent,
    EmptyStateComponent,
    PagerComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Reserva demográfica</h1>
        <p class="page-header__desc">
          Percentuais por Censo do IBGE que dimensionam as sub-reservas da Lei 12.711/2012 ·
          UNI-REQ-0065.
        </p>
      </div>
    </div>

    <ui-alert variant="info" heading="Configuração viva — congelamento por snapshot" [dynamic]="false">
      Cada linha registra os percentuais de um Censo. Quando um processo adota a regra de
      distribuição da Lei 12.711, os percentuais e o Censo são copiados por valor para o snapshot do
      edital (ADR-0061). Por isso editar ou inativar uma referência não impacta editais já
      publicados, e a inativação não fica bloqueada. Processos SiSU não usam esta configuração.
      Base legal: Lei 12.711/2012, art. 10, III (atualizada pela Lei 14.723/2023).
    </ui-alert>

    @if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar as referências">
        {{ errorMessage() }}
        <div class="cfg-reserva__retry">
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

    <div data-scope class="cfg-reserva-scope">
      <div class="filter-bar" role="search" aria-label="Filtrar referências demográficas">
        <div class="filter-bar__row">
          <div class="input-group">
            <span class="input-group__addon" aria-hidden="true"><i class="pi pi-search"></i></span>
            <input
              type="search"
              class="input"
              placeholder="Buscar por Censo..."
              aria-label="Buscar por Censo"
              [value]="busca()"
              (input)="busca.set(inputValue($event))"
            />
          </div>
          <button type="button" class="btn btn--tertiary btn--sm btn--rect" (click)="busca.set('')">
            Limpar
          </button>
        </div>
      </div>

      <section class="panel" aria-labelledby="cfg-reserva-list-title">
        <div class="panel-head">
          <div class="panel-head__title">
            <h2 id="cfg-reserva-list-title">Referências</h2>
            <span class="list-count" aria-label="Total de referências carregadas">
              {{ referenciasFiltradas().length }}
            </span>
            @if (loading()) {
              <span class="cfg-reserva__loading"><ui-spinner size="sm" /> Carregando</span>
            }
          </div>
          <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
            <i class="pi pi-plus btn__icon" aria-hidden="true"></i>
            Novo censo
          </button>
        </div>

        @if (referenciasFiltradas().length > 0) {
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th scope="col">Censo</th>
                  <th scope="col">PPI %</th>
                  <th scope="col">Quilombola %</th>
                  <th scope="col">PcD %</th>
                  <th scope="col">Base legal</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span class="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                @for (ref of referenciasFiltradas(); track ref.id) {
                  <tr>
                    <td data-label="Censo"><code>{{ ref.censoReferencia }}</code></td>
                    <td data-label="PPI %" class="cfg-num">{{ pct(ref.ppiPercentual) }}</td>
                    <td data-label="Quilombola %" class="cfg-num">{{ pct(ref.quilombolaPercentual) }}</td>
                    <td data-label="PcD %" class="cfg-num">{{ pct(ref.pcdPercentual) }}</td>
                    <td data-label="Base legal">{{ ref.baseLegal }}</td>
                    <td data-label="Status"><span class="tag tag--success">Ativa</span></td>
                    <td class="table-responsive__actions" data-label="Ações">
                      <button
                        type="button"
                        class="btn btn--tertiary btn--sm btn--rect"
                        [disabled]="loading()"
                        (click)="abrirEdicao(ref)"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        class="btn btn--tertiary btn--sm btn--rect"
                        [disabled]="loading()"
                        (click)="pedirRemocao(ref)"
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
          @if (busca().trim().length > 0) {
            <ui-empty-state
              heading="Nenhuma referência encontrada"
              description="Ajuste a busca por Censo para ver resultados."
            >
              <button type="button" class="btn btn--secondary" (click)="busca.set('')">
                Limpar filtros
              </button>
            </ui-empty-state>
          } @else {
            <ui-empty-state
              heading="Nenhuma referência cadastrada"
              description="Cadastre os percentuais do primeiro Censo para habilitar a distribuição por reserva."
            >
              <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
                Novo censo
              </button>
            </ui-empty-state>
          }
        }

        @if (prevCursor() !== null || nextCursor() !== null) {
          <ui-pager
            statusText="Navegação por páginas"
            navigationLabel="Paginação de referências demográficas"
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
      ariaLabel="Formulário de referência demográfica"
      position="right"
    >
      @if (formError()) {
        <ui-alert variant="danger" heading="Não foi possível salvar">{{ formError() }}</ui-alert>
      }

      <form [formGroup]="form" id="cfg-reserva-form" (ngSubmit)="salvar()" novalidate class="cfg-form">
        <section aria-labelledby="cfg-reserva-dados">
          <h3 id="cfg-reserva-dados" class="form-section__title">Dados do Censo</h3>
          <div class="form-grid">
            <label class="field field--full" [class.is-error]="erroDoCampo('censoReferencia')">
              <span class="field__label is-required">Censo de referência</span>
              <input
                class="input"
                type="text"
                inputmode="numeric"
                formControlName="censoReferencia"
                [readonly]="modo() === 'editar'"
                [attr.aria-invalid]="erroDoCampo('censoReferencia') ? 'true' : null"
                (blur)="verificarCensoDuplicado()"
              />
              <span class="field__hint">
                Chave de negócio — uma linha por Censo, única entre as referências ativas. Não pode
                ser alterada após a criação.
              </span>
              @if (erroDoCampo('censoReferencia')) {
                <span class="field__error">{{ erroDoCampo('censoReferencia') }}</span>
              }
            </label>

            <div class="form-grid--pair">
              <label class="field" [class.is-error]="erroDoCampo('ppiPercentual')">
                <span class="field__label is-required">PPI %</span>
                <input
                  class="input"
                  type="number"
                  inputmode="decimal"
                  min="0"
                  max="100"
                  step="0.01"
                  formControlName="ppiPercentual"
                  [attr.aria-invalid]="erroDoCampo('ppiPercentual') ? 'true' : null"
                />
                <span class="field__hint">Pretos, pardos e indígenas (art. 10, III, "a"). 0 a 100.</span>
                @if (erroDoCampo('ppiPercentual')) {
                  <span class="field__error">{{ erroDoCampo('ppiPercentual') }}</span>
                }
              </label>
              <label class="field" [class.is-error]="erroDoCampo('quilombolaPercentual')">
                <span class="field__label is-required">Quilombola %</span>
                <input
                  class="input"
                  type="number"
                  inputmode="decimal"
                  min="0"
                  max="100"
                  step="0.01"
                  formControlName="quilombolaPercentual"
                  [attr.aria-invalid]="erroDoCampo('quilombolaPercentual') ? 'true' : null"
                />
                <span class="field__hint">Quilombolas (art. 10, III, "b"). 0 a 100.</span>
                @if (erroDoCampo('quilombolaPercentual')) {
                  <span class="field__error">{{ erroDoCampo('quilombolaPercentual') }}</span>
                }
              </label>
            </div>

            <label class="field field--full" [class.is-error]="erroDoCampo('pcdPercentual')">
              <span class="field__label is-required">PcD %</span>
              <input
                class="input"
                type="number"
                inputmode="decimal"
                min="0"
                max="100"
                step="0.01"
                formControlName="pcdPercentual"
                [attr.aria-invalid]="erroDoCampo('pcdPercentual') ? 'true' : null"
              />
              <span class="field__hint">
                Pessoas com deficiência / Grupo de Washington (art. 10, III, "c", p.u.). 0 a 100.
              </span>
              @if (erroDoCampo('pcdPercentual')) {
                <span class="field__error">{{ erroDoCampo('pcdPercentual') }}</span>
              }
            </label>

            <label class="field field--full" [class.is-error]="erroDoCampo('baseLegal')">
              <span class="field__label is-required">Base legal</span>
              <input
                class="input"
                type="text"
                placeholder="Lei 12.711/2012, art. 10, III"
                formControlName="baseLegal"
                [attr.aria-invalid]="erroDoCampo('baseLegal') ? 'true' : null"
              />
              <span class="field__hint">Dispositivo exato (lei + artigo/parágrafo) que fundamenta os percentuais.</span>
              @if (erroDoCampo('baseLegal')) {
                <span class="field__error">{{ erroDoCampo('baseLegal') }}</span>
              }
            </label>
          </div>
        </section>
      </form>

      <div class="cfg-form-footer">
        <button type="button" class="btn btn--tertiary btn--rect" (click)="formOpen.set(false)">
          Cancelar
        </button>
        <button type="submit" form="cfg-reserva-form" class="btn btn--primary" [disabled]="saving()">
          @if (saving()) {
            <ui-spinner size="sm" />
          }
          {{ saving() ? 'Salvando...' : modo() === 'criar' ? 'Criar referência' : 'Salvar referência' }}
        </button>
      </div>
    </ui-drawer>

    <ui-confirm-dialog
      [(visible)]="confirmOpen"
      heading="Inativar referência demográfica"
      message="A referência é inativada (soft-delete) e mantida na trilha de auditoria. Edições e inativações não afetam processos já publicados — cópias congeladas em quadros de vagas (snapshot) permanecem. Confirma?"
      confirmLabel="Inativar"
      confirmVariant="danger"
      (confirmed)="removerConfirmado()"
    />
  `,
})
export class ReservaDemograficaListPage {
  private readonly api = inject(ReservaDemograficaApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  protected readonly saving = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly confirmOpen = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly modo = signal<ModoFormulario>('criar');
  protected readonly idEmEdicao = signal<string | null>(null);
  protected readonly refParaRemover = signal<ReferenciaReservaDemograficaDto | null>(null);
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());
  protected readonly busca = signal('');

  private readonly pagina = signal<
    { readonly cursor: Cursor; readonly direction: PaginationDirection } | undefined
  >(undefined);

  private readonly lista = useApiResource<readonly ReferenciaReservaDemograficaDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/referencias-reserva-demografica`,
    params: this.montarParams(),
    context: withVendorMime('referencia-reserva-demografica', 1),
  }));

  protected readonly loading = this.lista.isLoading;

  private readonly cursores = linkedSignal<
    ApiResult<readonly ReferenciaReservaDemograficaDto[]> | undefined,
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

  protected readonly referencias = linkedSignal<
    ApiResult<readonly ReferenciaReservaDemograficaDto[]> | undefined,
    readonly ReferenciaReservaDemograficaDto[]
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

  /** Filtro client-side por Censo (volume pequeno — uma linha por Censo). */
  protected readonly referenciasFiltradas = computed(() => {
    const termo = this.busca().trim().toLocaleLowerCase('pt-BR');
    if (termo.length === 0) {
      return this.referencias();
    }
    return this.referencias().filter((ref) =>
      ref.censoReferencia.toLocaleLowerCase('pt-BR').includes(termo),
    );
  });

  protected readonly errorMessage = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar referências.' : null;
  });

  protected readonly formHeading = computed(() =>
    this.modo() === 'criar' ? 'Novo censo' : 'Editar referência demográfica',
  );

  protected readonly form: FormGroup<ReservaForm> = new FormGroup<ReservaForm>({
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

  constructor() {
    effect(() => {
      const problem = this.lista.problem();
      if (problem && problem.status >= 500) {
        const titulo = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title: titulo }));
      }
    });
  }

  /** Formata o percentual (contrato `number | string`) com 2 casas. */
  protected pct(valor: number | string): string {
    const numero = typeof valor === 'string' ? Number(valor) : valor;
    return Number.isFinite(numero) ? numero.toFixed(2) : String(valor);
  }

  protected inputValue(event: Event): string {
    return event.target instanceof HTMLInputElement ? event.target.value : '';
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

  protected abrirEdicao(ref: ReferenciaReservaDemograficaDto): void {
    this.modo.set('editar');
    this.idEmEdicao.set(ref.id);
    this.form.reset({
      censoReferencia: ref.censoReferencia,
      ppiPercentual: Number(ref.ppiPercentual),
      quilombolaPercentual: Number(ref.quilombolaPercentual),
      pcdPercentual: Number(ref.pcdPercentual),
      baseLegal: ref.baseLegal,
    });
    // censoReferencia é imutável (chave de negócio) — exibido read-only e fora do command.
    this.form.controls.censoReferencia.disable({ emitEvent: false });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  /** Unicidade de Censo entre as referências ativas carregadas (feedback no blur). */
  protected verificarCensoDuplicado(): void {
    const control = this.form.controls.censoReferencia;
    const censo = control.value.trim();
    const duplicado =
      censo.length > 0 &&
      this.referencias().some(
        (ref) => ref.censoReferencia === censo && ref.id !== this.idEmEdicao(),
      );
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

  protected pedirRemocao(ref: ReferenciaReservaDemograficaDto): void {
    this.refParaRemover.set(ref);
    this.confirmOpen.set(true);
  }

  protected removerConfirmado(): void {
    const ref = this.refParaRemover();
    if (ref === null || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.api
      .remover(ref.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.saving.set(false);
        if (result.ok) {
          this.notifications.success('Referência inativada', ref.censoReferencia);
          this.confirmOpen.set(false);
          this.refParaRemover.set(null);
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
        this.idEmEdicao() ?? '',
        this.atualizarCommand(),
        withIdempotencyKey(this.idempotencyKeyAtual()),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleSalvarResult(result));
  }

  protected erroDoCampo(nome: keyof ReservaForm): string | null {
    const control = this.form.controls[nome];
    const shouldShowError = control.touched || control.dirty;
    if (!shouldShowError || control.errors === null) {
      return null;
    }
    if (control.errors['backend']) {
      const backend = control.errors['backend'] as { code: string; message: string };
      return backend.message;
    }
    if (control.errors['duplicado']) return 'Censo de referência já cadastrado.';
    if (control.errors['required']) return 'Campo obrigatório.';
    if (control.errors['min'] || control.errors['max']) return 'Informe um valor entre 0 e 100.';
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
      this.notifications.success(
        this.modo() === 'criar' ? 'Referência criada' : 'Referência atualizada',
      );
      this.formOpen.set(false);
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
    // Conflito de unicidade de Censo (409) — inline no campo censoReferencia.
    if (problem.status === 409 || problem.code.includes('censo') || problem.code.includes('duplic')) {
      this.renovarIdempotencyKey();
      const control = this.form.controls.censoReferencia;
      control.setErrors({ backend: { code: problem.code, message: 'Censo de referência já cadastrado.' } });
      control.markAsTouched();
      this.formError.set(null);
      return;
    }
    if (problem.code === 'uniplus.idempotency.body_mismatch') {
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

  private criarCommand(): CriarReferenciaReservaDemograficaCommand {
    const raw = this.form.getRawValue();
    return {
      censoReferencia: raw.censoReferencia.trim(),
      ppiPercentual: raw.ppiPercentual ?? 0,
      quilombolaPercentual: raw.quilombolaPercentual ?? 0,
      pcdPercentual: raw.pcdPercentual ?? 0,
      baseLegal: raw.baseLegal.trim(),
    };
  }

  private atualizarCommand(): AtualizarReferenciaReservaDemograficaCommand {
    // censoReferencia é imutável: reenvia o valor original (o command exige o campo).
    return { id: this.idEmEdicao() ?? '', ...this.criarCommand() };
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
