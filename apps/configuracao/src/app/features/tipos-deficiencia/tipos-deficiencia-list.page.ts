import { HttpParams } from "@angular/common/http";
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";

import {
  ApiResult,
  Cursor,
  cursorToString,
  deveRotacionarIdempotencyKey,
  extractNextCursor,
  extractPrevCursor,
  IDEMPOTENCY_PROBLEM_CODES,
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

const TIPO_DEFICIENCIA_CONTROL_NAMES: ReadonlySet<string> = new Set<keyof TipoDeficienciaForm>([
  'nome',
  'descricao',
  'codigo',
]);

/**
 * Conflitos de unicidade (409) que pertencem a um campo do formulário. Só eles
 * precisam do vendor code literal: violação de unicidade não é erro de validação
 * de campo, então o corpo não traz `errors[]` e não há outra chave que diga a
 * qual campo o conflito se refere. Todo erro que chega em `errors[]` é ancorado
 * pelo `field` que o próprio contrato manda — sem repetir código aqui.
 */
const CAMPO_POR_CONFLITO: ReadonlyMap<string, keyof TipoDeficienciaForm> = new Map([
  ['uniplus.configuracao.tipo_deficiencia.codigo_ja_existe', 'codigo' as const],
  ['uniplus.configuracao.tipo_deficiencia.nome_ja_existe', 'nome' as const],
]);

/** Tamanho máximo do código aceito pelo backend (`CodigoTipoDeficiencia`). */
const CODIGO_TAMANHO_MAXIMO = 50;

/**
 * Deriva do nome um código no formato fechado que o backend exige: sem
 * diacríticos, em caixa alta, com não-alfanuméricos colapsados em sublinhado e as
 * pontas aparadas. Devolve string vazia quando não sobra nada aproveitável.
 */
export function sugerirCodigoDeTipoDeficiencia(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-zA-Z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .toLocaleUpperCase('pt-BR')
    .slice(0, CODIGO_TAMANHO_MAXIMO);
}

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
        id="cfg-tipo-deficiencia-form"
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
                [attr.aria-describedby]="
                  erroDoCampo('nome')
                    ? 'cfg-td-nome-dica cfg-td-nome-erro'
                    : 'cfg-td-nome-dica'
                "
              />
              <span class="field__hint" id="cfg-td-nome-dica">
                Rótulo legível do tipo de deficiência — único entre os tipos ativos. Impede
                duplicatas como dois "Visual".
              </span>
              @if (erroDoCampo('nome')) {
                <span class="field__error" id="cfg-td-nome-erro">{{ erroDoCampo('nome') }}</span>
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
                [attr.aria-describedby]="
                  erroCampoCodigo ? 'cfg-td-codigo-dica cfg-td-codigo-erro' : 'cfg-td-codigo-dica'
                "
              />
              <span class="field__hint" id="cfg-td-codigo-dica">
                Identidade do cadastro: caixa alta, começando por letra, com letras, números e
                sublinhado, de 2 a 50 caracteres. Único entre os tipos de deficiência ativos.
                Sugerido a partir do nome e editável antes de salvar.
              </span>
              @if (erroCampoCodigo) {
                <span class="field__error" id="cfg-td-codigo-erro">{{ erroCampoCodigo }}</span>
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
                [attr.aria-describedby]="erroDoCampo('descricao') ? 'cfg-td-descricao-erro' : null"
              ></textarea>
              @if (erroDoCampo('descricao')) {
                <span class="field__error" id="cfg-td-descricao-erro">{{
                  erroDoCampo('descricao')
                }}</span>
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
          form="cfg-tipo-deficiencia-form"
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
export class TiposDeficienciaListPage {
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
  /** Classificação de permanência do registro em edição — lida, não editável aqui. */
  private readonly permanenteEmEdicao = signal<boolean | null>(null);
  /** Último código escrito pela sugestão — distingue o que ela pôs do que o operador digitou. */
  private ultimaSugestaoAplicada = '';
  protected readonly temFiltro = computed(() => this.termoBusca().trim().length > 0);

  constructor() {
    effect(() => {
      const problem = this.lista.problem();
      if (problem && problem.status >= 500) {
        const titulo = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title: titulo }));
      }
    });

    this.form.controls.nome.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((nome) => this.sincronizarSugestaoDeCodigo(nome));

    this.form.controls.codigo.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((codigo) => this.normalizarCaixaDoCodigo(codigo));
  }

  /**
   * Mantém a sugestão de código alinhada ao nome. O campo só é escrito na criação
   * e enquanto o que está nele é obra da própria sugestão — assim ela acompanha o
   * nome enquanto ele é digitado, mas para no instante em que o operador troca o
   * código por outro. Na edição de um tipo já salvo, nunca escreve: o código
   * vigente é do registro.
   */
  private sincronizarSugestaoDeCodigo(nome: string): void {
    if (this.modo() !== 'criar') {
      return;
    }
    const codigoAtual = this.form.controls.codigo.value;
    if (codigoAtual !== '' && codigoAtual !== this.ultimaSugestaoAplicada) {
      return;
    }
    const sugestao = sugerirCodigoDeTipoDeficiencia(nome);
    this.ultimaSugestaoAplicada = sugestao;
    this.form.controls.codigo.setValue(sugestao, { emitEvent: false });
  }

  /**
   * O backend só aceita código em caixa alta. O modelo é normalizado sem reescrever
   * a view (`emitModelToViewChange: false`) para não reposicionar o cursor; a
   * apresentação em caixa alta fica por conta do `text-transform` do campo.
   */
  private normalizarCaixaDoCodigo(codigo: string): void {
    const emCaixaAlta = codigo.toLocaleUpperCase('pt-BR');
    if (emCaixaAlta === codigo) {
      return;
    }
    this.form.controls.codigo.setValue(emCaixaAlta, {
      emitEvent: false,
      emitModelToViewChange: false,
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
    this.ultimaSugestaoAplicada = '';
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
    this.permanenteEmEdicao.set(tipoDeficiencia.permanente);
    this.ultimaSugestaoAplicada = '';
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

  /**
   * O PUT substitui o registro inteiro: campo omitido é campo apagado. Como esta
   * tela não edita a classificação de permanência, ela reenvia o valor lido para
   * não zerá-la em toda atualização de nome, código ou descrição.
   */
  private atualizarCommand(): AtualizarTipoDeficienciaCommand {
    return {
      id: this.tipoDeficienciaEmEdicaoId() ?? '',
      ...this.criarCommand(),
      permanente: this.permanenteEmEdicao(),
    };
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
    // O `pattern` significa coisas diferentes por campo: formato fechado no código,
    // "não pode ser só espaços" na descrição.
    if (control.errors['pattern']) {
      return nome === 'codigo'
        ? 'Formato inválido. Use letras maiúsculas, números e sublinhado, iniciando por letra (ex.: VISUAL, DEFICIENCIA_VISUAL).'
        : 'Informe um texto — apenas espaços não valem.';
    }
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
    if (deveRotacionarIdempotencyKey(problem)) {
      this.renovarIdempotencyKey();
    }

    // A validação do backend acumula toda violação de campo em `errors[]` e só
    // repete a primeira na raiz do problema (ADR-0125). Percorrer o array é o que
    // ancora cada erro no seu campo; ler apenas `problem.code` marcaria um campo
    // e deixaria os demais sem indicação.
    if (problem.errors && problem.errors.length > 0) {
      this.notifications.errorFromProblem(problem);
      this.aplicarErrosDeValidacao(problem.errors);
      return;
    }

    const campoDoConflito = CAMPO_POR_CONFLITO.get(problem.code);
    if (campoDoConflito) {
      this.notifications.errorFromProblem(problem);
      const control = this.form.controls[campoDoConflito];
      control.setErrors({
        backend: { code: problem.code, message: this.problemI18n.resolve(problem).title },
      });
      control.markAsTouched();
      return;
    }

    if (problem.status === 409 || problem.code === IDEMPOTENCY_PROBLEM_CODES.BODY_MISMATCH) {
      this.notifications.errorFromProblem(problem);
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
