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
  API_MAX_PAGE_SIZE,
  ApiResult,
  Cursor,
  PaginationDirection,
  ProblemDetails,
  ProblemI18nService,
  ProblemValidationError,
  ResolucaoDeVinculo,
  cursorToString,
  extractNextCursor,
  extractPrevCursor,
  idempotencyKey,
  lookupCompleto,
  resolverVinculo,
  useApiResource,
  withIdempotencyKey,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AtualizarLocalOfertaCommand,
  CONFIGURACAO_BASE_PATH,
  CampiApi,
  CampusDto,
  CriarLocalOfertaCommand,
  LocaisOfertaApi,
  LocalOfertaDto,
  TIPOS_LOCAL_OFERTA,
  TipoLocalOferta,
} from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  ConfirmDialogComponent,
  DrawerComponent,
  EmptyStateComponent,
  LookupAlertComponent,
  LookupLabelComponent,
  PagerComponent,
  SpinnerComponent,
  type UiLookupFalho,
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

const rotularCampus = (campus: CampusDto): string => `${campus.sigla} — ${campus.nome}`;

type ModoFormulario = 'criar' | 'editar';

interface LocalOfertaForm {
  tipo: FormControl<string>;
  codigoEmec: FormControl<string>;
  campusResponsavelId: FormControl<string>;
  endereco: FormControl<EnderecoEstruturado | null>;
}

@Component({
  selector: 'cfg-locais-oferta-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ConfirmDialogComponent,
    DrawerComponent,
    EmptyStateComponent,
    EnderecoFormComponent,
    LookupAlertComponent,
    LookupLabelComponent,
    PagerComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Locais de oferta</h1>
        <p class="page-header__desc">
          Locais de oferta (polos, campi fora de sede, convênios) com endereço estruturado ·
          UNI-REQ-0010.
        </p>
      </div>
    </div>

    @if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar os locais de oferta">
        {{ errorMessage() }}
        <div class="cfg-locais__retry">
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

    <section class="panel" aria-labelledby="cfg-locais-list-title">
      <div class="panel-head">
        <div class="panel-head__title">
          <h2 id="cfg-locais-list-title">Locais de oferta</h2>
          @if (loading()) {
            <span class="cfg-locais__loading"><ui-spinner size="sm" /> Carregando</span>
          }
        </div>
        <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
          <i class="pi pi-plus btn__icon" aria-hidden="true"></i>
          Novo local de oferta
        </button>
      </div>

      <ui-lookup-alert [falhas]="lookupsComFalha()" />

      @if (locais().length > 0) {
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th scope="col">Tipo</th>
                <th scope="col">Cidade</th>
                <th scope="col">Campus responsável</th>
                <th scope="col">Código e-MEC</th>
                <th scope="col"><span class="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              @for (local of locais(); track local.id) {
                <tr>
                  <td data-label="Tipo">
                    <span class="tag">{{ tipoLabel(local.tipo) }}</span>
                  </td>
                  <td data-label="Cidade">{{ cidadeLabel(local) }}</td>
                  <td data-label="Campus responsável">
                    @if (local.campusResponsavelId === null) {
                      —
                    } @else {
                      <ui-lookup-label [resolucao]="campusDoLocal(local.campusResponsavelId)" />
                    }
                  </td>
                  <td data-label="Código e-MEC">{{ local.codigoEmec || '—' }}</td>
                  <td class="table-responsive__actions" data-label="Ações">
                    <button
                      type="button"
                      class="btn btn--tertiary btn--sm btn--rect"
                      [disabled]="loading()"
                      (click)="abrirEdicao(local)"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      class="btn btn--tertiary btn--sm btn--rect"
                      [disabled]="loading()"
                      (click)="pedirRemocao(local)"
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
          heading="Nenhum local de oferta cadastrado"
          description="Cadastre polos, campi fora de sede e convênios de interiorização."
        >
          <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
            Novo local de oferta
          </button>
        </ui-empty-state>
      }

      @if (prevCursor() !== null || nextCursor() !== null) {
        <ui-pager
          statusText="Navegação por páginas"
          navigationLabel="Paginação de locais de oferta"
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
      ariaLabel="Formulário de local de oferta"
      position="right"
    >
      @if (formError()) {
        <ui-alert variant="danger" heading="Não foi possível salvar">{{ formError() }}</ui-alert>
      }

      <form
        [formGroup]="form"
        id="cfg-local-form"
        (ngSubmit)="salvar()"
        novalidate
        class="cfg-form"
      >
        <section aria-labelledby="cfg-local-classificacao">
          <h3 id="cfg-local-classificacao" class="form-section__title">Classificação</h3>
          <div class="form-grid">
            <label class="field" [class.is-error]="erroDoCampo('tipo')">
              <span class="field__label is-required">Tipo</span>
              <select
                class="select"
                formControlName="tipo"
                [attr.aria-invalid]="erroDoCampo('tipo') ? 'true' : null"
              >
                <option value="" disabled>Selecione o tipo</option>
                @for (opcao of tipoOptions; track opcao.value) {
                  <option [value]="opcao.value">{{ opcao.label }}</option>
                }
              </select>
              @if (erroDoCampo('tipo')) {
                <span class="field__error">{{ erroDoCampo('tipo') }}</span>
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
            <label class="field field--full">
              <span class="field__label">Campus responsável</span>
              <select class="select" formControlName="campusResponsavelId">
                <option value="">(Sem campus responsável)</option>
                @for (campus of campi.opcoes(); track campus.id) {
                  <option [value]="campus.id">{{ campus.sigla }} — {{ campus.nome }}</option>
                }
              </select>
              <span class="field__hint">Vínculo opcional ao campus que administra este local.</span>
              @if (campi.comErro()) {
                <span class="field__error">
                  Não foi possível carregar os campi para seleção.
                  <button type="button" class="cfg-link-button" (click)="campi.recarregar()">
                    Tentar novamente
                  </button>
                </span>
              }
            </label>
          </div>
        </section>

        <cfg-endereco-form
          formControlName="endereco"
          idPrefix="local-endereco"
          legend="Endereço do local de oferta"
          [erroExterno]="enderecoErro()"
        />
      </form>

      <div class="cfg-form-footer">
        <button type="button" class="btn btn--tertiary btn--rect" (click)="formOpen.set(false)">
          Cancelar
        </button>
        <button type="submit" form="cfg-local-form" class="btn btn--primary" [disabled]="saving()">
          @if (saving()) {
            <ui-spinner size="sm" />
          }
          {{ saving() ? 'Salvando...' : modo() === 'criar' ? 'Criar local' : 'Salvar local' }}
        </button>
      </div>
    </ui-drawer>

    <ui-confirm-dialog
      [(visible)]="confirmOpen"
      heading="Remover local de oferta"
      [message]="confirmMessage()"
      confirmLabel="Remover"
      confirmVariant="danger"
      (confirmed)="removerConfirmado()"
    />
  `,
  host: { class: 'cfg-page' },
})
export class LocaisOfertaPage {
  private readonly api = inject(LocaisOfertaApi);
  private readonly campiApi = inject(CampiApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  protected readonly tipoOptions = TIPOS_LOCAL_OFERTA;

  protected readonly saving = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly confirmOpen = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly enderecoErro = signal<string | null>(null);
  protected readonly modo = signal<ModoFormulario>('criar');
  protected readonly localEmEdicaoId = signal<string | null>(null);
  protected readonly localParaRemover = signal<LocalOfertaDto | null>(null);
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());

  private readonly pagina = signal<
    { readonly cursor: Cursor; readonly direction: PaginationDirection } | undefined
  >(undefined);

  private readonly lista = useApiResource<readonly LocalOfertaDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/locais-oferta`,
    params: this.montarParams(),
    context: withVendorMime('local-oferta', 1),
  }));

  protected readonly loading = this.lista.isLoading;

  // Lookup de campi para o select de responsável — lazy (ativado ao abrir o form).
  // Percorre todas as páginas por cursor em vez de truncar em API_MAX_PAGE_SIZE:
  // um select de FK não pode esconder opções silenciosamente.
  private readonly carregarCampi = signal(false);
  private campiIniciado = false;
  protected readonly campi = lookupCompleto(
    (cursor) => this.campiApi.listar({ cursor, direction: 'next', limit: API_MAX_PAGE_SIZE }),
    this.destroyRef,
  );
  private readonly campiPorId = computed(
    () => new Map(this.campi.opcoes().map((campus) => [campus.id, campus] as const)),
  );

  protected readonly lookupsComFalha = computed<readonly UiLookupFalho[]>(() =>
    this.campi.comErro() ? [{ nome: 'campi', recarregar: () => this.campi.recarregar() }] : [],
  );

  private readonly cursores = linkedSignal<
    ApiResult<readonly LocalOfertaDto[]> | undefined,
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

  protected readonly locais = linkedSignal<
    ApiResult<readonly LocalOfertaDto[]> | undefined,
    readonly LocalOfertaDto[]
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
    return this.lista.error() ? 'Erro inesperado ao carregar locais de oferta.' : null;
  });

  protected readonly formHeading = computed(() =>
    this.modo() === 'criar' ? 'Novo local de oferta' : 'Editar local de oferta',
  );

  protected readonly confirmMessage = computed(() => {
    const local = this.localParaRemover();
    return local
      ? `Deseja remover este local (${this.tipoLabel(local.tipo)})? A remoção é lógica (soft-delete).`
      : 'Deseja remover este local de oferta?';
  });

  protected readonly form: FormGroup<LocalOfertaForm> = new FormGroup<LocalOfertaForm>({
    tipo: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    codigoEmec: new FormControl('', { nonNullable: true }),
    campusResponsavelId: new FormControl('', { nonNullable: true }),
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

    // Ativa o lookup de campi assim que a lista trouxer algum local vinculado,
    // para a coluna "Campus responsável" exibir a sigla/nome em vez do genérico
    // "Vinculado" já na carga inicial (mantém o lazy quando não há vínculo). #412.
    effect(() => {
      const temVinculo = this.locais().some((local) => local.campusResponsavelId !== null);
      if (temVinculo && !this.carregarCampi()) {
        untracked(() => this.carregarCampi.set(true));
      }
    });

    // `carregarCampi` só liga o lookup; `campiIniciado` evita refazer a busca a
    // cada reabertura do drawer (abrirCadastro/abrirEdicao religam o sinal).
    effect(() => {
      if (this.carregarCampi() && !this.campiIniciado) {
        this.campiIniciado = true;
        untracked(() => this.campi.recarregar());
      }
    });
  }

  protected tipoLabel(tipo: TipoLocalOferta): string {
    return TIPOS_LOCAL_OFERTA.find((t) => t.value === tipo)?.label ?? tipo;
  }

  protected cidadeLabel(local: LocalOfertaDto): string {
    const cidade = local.endereco?.cidade ?? local.cidade;
    return cidade ? `${cidade.nome} — ${cidade.uf}` : '—';
  }

  /**
   * Estado da resolução do Campus responsável — o que a listagem exibe.
   * Distingue carregando, catálogo recusado e id fora do catálogo, que o
   * rótulo único ("Vinculado") colapsava num texto de aparência normal (#579).
   * O vínculo ausente (`null`) não chega aqui: é opcional e a tabela já o
   * mostra como "—".
   */
  protected campusDoLocal(id: string): ResolucaoDeVinculo {
    return resolverVinculo(this.campi, this.campiPorId().get(id), rotularCampus);
  }

  // No campo do drawer o campus já foi escolhido a partir do catálogo
  // carregado, então só o rótulo interessa.
  protected campusLabel(id: string | null): string {
    if (id === null) {
      return '—';
    }
    const { estado, rotulo } = this.campusDoLocal(id);
    return estado === 'resolvido' ? rotulo : 'Vinculado';
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
    this.localEmEdicaoId.set(null);
    this.form.reset({ tipo: '', codigoEmec: '', campusResponsavelId: '', endereco: null });
    this.formError.set(null);
    this.enderecoErro.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.carregarCampi.set(true);
    this.formOpen.set(true);
  }

  protected abrirEdicao(local: LocalOfertaDto): void {
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
    this.carregarCampi.set(true);
    this.formOpen.set(true);
  }

  protected pedirRemocao(local: LocalOfertaDto): void {
    this.localParaRemover.set(local);
    this.confirmOpen.set(true);
  }

  protected removerConfirmado(): void {
    const local = this.localParaRemover();
    if (local === null || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.api
      .remover(local.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.saving.set(false);
        if (result.ok) {
          this.notifications.success('Local de oferta removido');
          this.confirmOpen.set(false);
          this.localParaRemover.set(null);
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
        this.enderecoErro.set('Selecione a cidade do endereço (obrigatória para o local).');
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
        this.localEmEdicaoId() ?? '',
        this.atualizarCommand(),
        withIdempotencyKey(this.idempotencyKeyAtual()),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleSalvarResult(result));
  }

  protected erroDoCampo(nome: keyof LocalOfertaForm): string | null {
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
        this.modo() === 'criar' ? 'Local de oferta criado' : 'Local de oferta atualizado',
      );
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

  private criarCommand(): CriarLocalOfertaCommand {
    const raw = this.form.getRawValue();
    const { cidadeCodigoIbge, cidadeNome, cidadeUf, endereco } = enderecoParaCommand(raw.endereco);
    return {
      tipo: raw.tipo as TipoLocalOferta,
      codigoEmec: nullIfBlank(raw.codigoEmec),
      campusResponsavelId: nullIfBlank(raw.campusResponsavelId),
      cidadeCodigoIbge: cidadeCodigoIbge ?? '',
      cidadeNome: cidadeNome ?? '',
      cidadeUf: cidadeUf ?? '',
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
