import { HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, linkedSignal, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ApiResult,
  Cursor,
  CursorPagina,
  ProblemDetails,
  ProblemI18nService,
  STATUS_HTTP,
  cursorToString,
  deveRotacionarIdempotencyKey,
  ehCursorDePaginacaoExpirado,
  extractNextCursor,
  extractPrevCursor,
  idempotencyKey,
  useApiResource,
  useCursorObsoletoRecovery,
  withIdempotencyKey,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CONFIGURACAO_BASE_PATH,
  ModeloFormularioView,
  ModelosFormularioApi,
  TipoProcessoDto,
} from '@uniplus/shared-data/configuracao';
import { CODIGO_CADASTRO_FORMATO, CODIGO_CADASTRO_TAMANHO_MAXIMO, sugerirCodigoDeCadastro } from '@uniplus/shared-utils';
import {
  AlertComponent,
  DrawerComponent,
  EmptyStateComponent,
  FINALIDADES,
  FilterBarComponent,
  FilterChipsComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
  TagComponent,
  conteudoInicial,
  type UiFilterChipOption,
} from '@uniplus/shared-ui/components';

const PAGE_SIZE = 50;

/** O código do modelo já existe — código de modelo nunca se reutiliza. */
const CODIGO_JA_EXISTE = 'uniplus.configuracao.modelo_formulario.codigo_ja_existe';

interface CriacaoForm {
  codigo: FormControl<string>;
  nome: FormControl<string>;
  descricao: FormControl<string>;
  finalidade: FormControl<string>;
  tipoProcessoCodigo: FormControl<string>;
}

type CampoDaCriacao = keyof CriacaoForm;

/**
 * Os modelos de formulário (ADR-0136, UNI-REQ-0144): a lista por tipo de processo e finalidade, a
 * criação no drawer — que leva à edição do conteúdo — e a ativação. O processo escolhe um modelo
 * e recebe uma cópia; mudar o modelo depois não muda o processo.
 */
@Component({
  selector: 'cfg-modelos-formulario-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    DrawerComponent,
    EmptyStateComponent,
    FilterBarComponent,
    FilterChipsComponent,
    IconButtonComponent,
    PagerComponent,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Modelo de Formulário</h1>
        <p class="page-header__desc">
          Formulários prontos por tipo de processo e finalidade. O processo parte de um modelo e recebe uma
          cópia, que edita à vontade; mudar o modelo depois não muda o processo. UNI-REQ-0144.
        </p>
      </div>
    </div>

    @if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar os modelos">
        {{ errorMessage() }}
        <div class="cfg-list__retry">
          <button type="button" class="btn btn--secondary btn--sm" [disabled]="loading()" (click)="tentarNovamente()">
            Tentar novamente
          </button>
        </div>
      </ui-alert>
    }

    <ui-filter-bar
      ariaLabel="Filtrar modelos de formulário"
      searchPlaceholder="Buscar por código ou nome…"
      searchAriaLabel="Buscar modelo de formulário"
      [(searchValue)]="termoBusca"
    >
      <ng-container uiFilterBarSecondary>
        <span class="u-eyebrow">Finalidade</span>
        <ui-filter-chips [options]="finalidadeChips" [(selected)]="filtroFinalidade" ariaLabel="Filtrar por finalidade" />
        <span class="u-eyebrow">Situação</span>
        <ui-filter-chips [options]="situacaoChips" [(selected)]="filtroSituacao" ariaLabel="Filtrar por situação" />
        <label class="field">
          <span class="u-eyebrow">Tipo de processo</span>
          <select class="select" [value]="filtroTipo()" (change)="filtroTipo.set(valorDe($event))">
            <option value="">Todos</option>
            @for (tipo of tiposDeProcesso(); track tipo.codigo) {
              <option [value]="tipo.codigo">{{ tipo.nome }}</option>
            }
          </select>
        </label>
      </ng-container>
    </ui-filter-bar>

    <section class="panel" aria-labelledby="cfg-modelos-list-title">
      <div class="panel-head">
        <div class="panel-head__title">
          <h2 id="cfg-modelos-list-title">Modelos de formulário</h2>
          @if (loading()) {
            <span class="cfg-list__loading"><ui-spinner size="sm" /> Carregando</span>
          }
        </div>
        <button type="button" class="btn btn--primary" (click)="abrirCriacao()">
          <i class="pi pi-plus btn__icon" aria-hidden="true"></i>
          Novo modelo
        </button>
      </div>

      @if (modelosBuscados().length > 0) {
        <div class="table-responsive">
          <table>
            <caption class="sr-only">Modelos de formulário, com finalidade, tipo de processo e situação</caption>
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Nome</th>
                <th scope="col">Finalidade</th>
                <th scope="col">Tipo de processo</th>
                <th scope="col">Situação</th>
                <th scope="col"><span class="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              @for (modelo of modelosBuscados(); track modelo.id) {
                <tr>
                  <td data-label="Código"><code>{{ modelo.codigo }}</code></td>
                  <td data-label="Nome">{{ modelo.nome }}</td>
                  <td data-label="Finalidade">{{ rotuloDaFinalidade(modelo.finalidade) }}</td>
                  <td data-label="Tipo de processo">{{ rotuloDoTipo(modelo.tipoProcessoCodigo) }}</td>
                  <td data-label="Situação">
                    <ui-tag [variant]="modelo.ativo ? 'success' : 'neutral'">{{ modelo.ativo ? 'Ativo' : 'Desativado' }}</ui-tag>
                  </td>
                  <td class="table-responsive__actions" data-label="Ações">
                    <ui-icon-button
                      icon="pi-pencil"
                      [accessibleName]="'Editar o modelo ' + modelo.codigo"
                      tooltip="Editar modelo"
                      [link]="[modelo.id]"
                    />
                    @if (modelo.ativo) {
                      <ui-icon-button
                        icon="pi-eye-slash"
                        [accessibleName]="'Desativar o modelo ' + modelo.codigo"
                        tooltip="Desativar: deixa de ser oferecido a processos novos"
                        [isDisabled]="emAndamento() !== null"
                        (triggered)="desativar(modelo)"
                      />
                    } @else {
                      <ui-icon-button
                        icon="pi-eye"
                        [accessibleName]="'Ativar o modelo ' + modelo.codigo"
                        tooltip="Ativar: volta a ser oferecido a processos novos"
                        [isDisabled]="emAndamento() !== null"
                        (triggered)="ativar(modelo)"
                      />
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (!loading() && !errorMessage()) {
        <ui-empty-state heading="Nenhum modelo encontrado" description="Ajuste a busca ou os filtros, ou crie o primeiro modelo." />
      }

      @if (prevCursor() !== null || nextCursor() !== null) {
        <ui-pager
          statusText="Navegação por páginas"
          navigationLabel="Paginação de modelos de formulário"
          [hasPrevious]="prevCursor() !== null"
          [hasNext]="nextCursor() !== null"
          [isDisabled]="loading()"
          (previous)="paginaAnterior()"
          (next)="proximaPagina()"
        />
      }
    </section>

    <ui-drawer class="cfg-form-drawer" [(visible)]="drawerAberto" heading="Novo modelo de formulário" ariaLabel="Novo modelo de formulário" position="right">
      @if (drawerAberto()) {
        <form [formGroup]="form" id="cfg-modelo-criacao" class="cfg-form" (ngSubmit)="criar()" novalidate>
          <ui-alert variant="info" heading="O modelo nasce desativado" [dynamic]="false">
            Monte o formulário com calma: o modelo só é oferecido a processos novos depois de ativado na
            lista.
          </ui-alert>
          @if (erroDaCriacao()) {
            <ui-alert variant="danger" heading="Não foi possível criar o modelo">{{ erroDaCriacao() }}</ui-alert>
          }

          <label class="field" [class.is-error]="erro('nome')">
            <span class="field__label is-required">Nome</span>
            <input class="input" type="text" formControlName="nome" maxlength="200" [attr.aria-invalid]="erro('nome') ? 'true' : null" [attr.aria-describedby]="erro('nome') ? 'cfg-modelo-nome-erro' : null" />
            @if (erro('nome')) {
              <span class="field__error" id="cfg-modelo-nome-erro">{{ erro('nome') }}</span>
            }
          </label>

          <label class="field" [class.is-error]="erro('codigo')">
            <span class="field__label is-required">Código</span>
            <input class="input cfg-input-uppercase" type="text" formControlName="codigo" [attr.aria-invalid]="erro('codigo') ? 'true' : null" aria-describedby="cfg-modelo-codigo-nota cfg-modelo-codigo-erro" />
            <span class="field__hint" id="cfg-modelo-codigo-nota">Caixa alta, com letras, números e sublinhado. Não muda depois de criado.</span>
            @if (erro('codigo')) {
              <span class="field__error" id="cfg-modelo-codigo-erro">{{ erro('codigo') }}</span>
            }
          </label>

          <label class="field" [class.is-error]="erro('finalidade')">
            <span class="field__label is-required">Finalidade</span>
            <select class="select" formControlName="finalidade" [attr.aria-invalid]="erro('finalidade') ? 'true' : null" [attr.aria-describedby]="erro('finalidade') ? 'cfg-modelo-finalidade-erro' : null">
              <option value="">Escolha a finalidade</option>
              @for (finalidade of finalidades; track finalidade.valor) {
                <option [value]="finalidade.valor">{{ finalidade.rotulo }}</option>
              }
            </select>
            @if (erro('finalidade')) {
              <span class="field__error" id="cfg-modelo-finalidade-erro">{{ erro('finalidade') }}</span>
            }
          </label>

          <label class="field" [class.is-error]="erro('tipoProcessoCodigo')">
            <span class="field__label">Tipo de processo</span>
            <select class="select" formControlName="tipoProcessoCodigo" [attr.aria-invalid]="erro('tipoProcessoCodigo') ? 'true' : null" aria-describedby="cfg-modelo-tipo-nota cfg-modelo-tipo-erro">
              <option value="">Qualquer tipo de processo</option>
              @for (tipo of tiposDeProcesso(); track tipo.codigo) {
                <option [value]="tipo.codigo">{{ tipo.nome }}</option>
              }
            </select>
            <span class="field__hint" id="cfg-modelo-tipo-nota">O modelo só é oferecido a processos do tipo escolhido.</span>
            @if (erro('tipoProcessoCodigo')) {
              <span class="field__error" id="cfg-modelo-tipo-erro">{{ erro('tipoProcessoCodigo') }}</span>
            }
          </label>

          <label class="field" [class.is-error]="erro('descricao')">
            <span class="field__label">Descrição</span>
            <textarea class="textarea" formControlName="descricao" rows="3" maxlength="1000" [attr.aria-invalid]="erro('descricao') ? 'true' : null" [attr.aria-describedby]="erro('descricao') ? 'cfg-modelo-descricao-erro' : null"></textarea>
            @if (erro('descricao')) {
              <span class="field__error" id="cfg-modelo-descricao-erro">{{ erro('descricao') }}</span>
            }
          </label>
        </form>

        <div class="cfg-form-footer">
          <button type="button" class="btn btn--tertiary btn--rect" (click)="drawerAberto.set(false)">Cancelar</button>
          <button type="submit" form="cfg-modelo-criacao" class="btn btn--primary" [disabled]="salvando()">
            @if (salvando()) {
              <ui-spinner size="sm" />
            }
            {{ salvando() ? 'Criando...' : 'Criar e montar o formulário' }}
          </button>
        </div>
      }
    </ui-drawer>
  `,
  host: { class: 'cfg-page' },
})
export class ModelosFormularioPage {
  private readonly api = inject(ModelosFormularioApi);
  private readonly router = inject(Router);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  protected readonly finalidades = FINALIDADES;
  protected readonly finalidadeChips: readonly UiFilterChipOption[] = [
    { value: '', label: 'Todas' },
    ...FINALIDADES.map((finalidade) => ({ value: finalidade.valor, label: finalidade.rotulo })),
  ];
  protected readonly situacaoChips: readonly UiFilterChipOption[] = [
    { value: 'true', label: 'Ativos' },
    { value: 'false', label: 'Desativados' },
    { value: '', label: 'Todos' },
  ];

  protected readonly termoBusca = signal('');
  protected readonly filtroFinalidade = signal('');
  protected readonly filtroSituacao = signal('');
  protected readonly filtroTipo = signal('');
  /** O cursor pertence ao filtro com que foi emitido: trocar o filtro volta à primeira página. */
  private readonly pagina = linkedSignal<string, CursorPagina | undefined>({
    source: () => JSON.stringify([this.filtroFinalidade(), this.filtroSituacao(), this.filtroTipo()]),
    computation: () => undefined,
  });

  protected readonly drawerAberto = signal(false);
  protected readonly salvando = signal(false);
  protected readonly erroDaCriacao = signal<string | null>(null);
  /** O modelo cuja ativação ou desativação está em curso. */
  protected readonly emAndamento = signal<string | null>(null);
  private chaveDaCriacao = idempotencyKey.create();
  private ultimaSugestao = '';

  private readonly lista = useApiResource<readonly ModeloFormularioView[]>(() => ({
    url: `${this.basePath}/api/configuracao/admin/modelos-formulario`,
    params: this.montarParams(),
    context: withVendorMime('modelo-formulario', 1),
  }));

  private readonly tipos = useApiResource<readonly TipoProcessoDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/tipos-processo`,
    params: new HttpParams().set('limit', '100'),
    context: withVendorMime('tipo-processo', 1),
  }));

  private readonly recuperandoDeCursorObsoleto = useCursorObsoletoRecovery({
    problem: this.lista.problem,
    pagina: this.pagina,
    reiniciarPagina: () => this.pagina.set(undefined),
    aoRecuperar: (problem) =>
      this.notifications.info(
        problem && ehCursorDePaginacaoExpirado(problem)
          ? 'A listagem ficou aberta tempo demais e a consulta expirou.'
          : 'A paginação foi reiniciada porque a consulta mudou.',
        'Recarregamos a listagem do começo.',
      ),
  });

  protected readonly loading = this.lista.isLoading;
  protected readonly tiposDeProcesso = computed(() => this.tipos.data() ?? []);

  private readonly cursores = linkedSignal<
    ApiResult<readonly ModeloFormularioView[]> | undefined,
    { readonly prev: Cursor | null; readonly next: Cursor | null }
  >({
    source: () => this.lista.value(),
    computation: (envelope, previous) => {
      const atual = previous?.value ?? { prev: null, next: null };
      if (envelope === undefined) return atual;
      // A falha na primeira página do filtro novo não pode deixar o cursor do filtro anterior no paginador.
      if (!envelope.ok) return untracked(() => this.pagina() === undefined) ? { prev: null, next: null } : atual;
      const link = untracked(() => this.lista.headers()?.get('Link') ?? null);
      return { prev: extractPrevCursor(link), next: extractNextCursor(link) };
    },
  });

  protected readonly prevCursor = computed(() => this.cursores().prev);
  protected readonly nextCursor = computed(() => this.cursores().next);

  // Busca sobre a página carregada: a API filtra por finalidade, tipo e situação, não por texto.
  protected readonly modelosBuscados = computed(() => {
    const termo = this.termoBusca().trim().toLocaleLowerCase('pt-BR');
    const modelos = this.lista.data() ?? [];
    return termo.length === 0
      ? modelos
      : modelos.filter(
          (modelo) => modelo.codigo.toLocaleLowerCase('pt-BR').includes(termo) || modelo.nome.toLocaleLowerCase('pt-BR').includes(termo),
        );
  });

  protected readonly errorMessage = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem && this.recuperandoDeCursorObsoleto()) return null;
    if (problem) return this.problemI18n.resolve(problem).title;
    return this.lista.error() ? 'Erro inesperado ao carregar os modelos.' : null;
  });

  protected readonly form = new FormGroup<CriacaoForm>({
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(CODIGO_CADASTRO_TAMANHO_MAXIMO), Validators.pattern(CODIGO_CADASTRO_FORMATO)],
    }),
    nome: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    descricao: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    finalidade: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    tipoProcessoCodigo: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    this.form.controls.nome.valueChanges.pipe(takeUntilDestroyed()).subscribe((nome) => this.sugerirCodigo(nome));
    this.form.controls.codigo.valueChanges.pipe(takeUntilDestroyed()).subscribe((codigo) => this.normalizarCaixaDoCodigo(codigo));
  }

  protected valorDe(evento: Event): string {
    return (evento.target as HTMLSelectElement).value;
  }

  protected rotuloDaFinalidade(valor: string): string {
    return FINALIDADES.find((finalidade) => finalidade.valor === valor)?.rotulo ?? valor;
  }

  protected rotuloDoTipo(codigo: string | null): string {
    if (codigo === null) return 'Qualquer tipo';
    return this.tiposDeProcesso().find((tipo) => tipo.codigo === codigo)?.nome ?? codigo;
  }

  protected abrirCriacao(): void {
    this.form.reset();
    this.erroDaCriacao.set(null);
    this.ultimaSugestao = '';
    this.chaveDaCriacao = idempotencyKey.create();
    this.drawerAberto.set(true);
  }

  protected criar(): void {
    if (this.salvando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.salvando.set(true);
    this.erroDaCriacao.set(null);
    const v = this.form.getRawValue();
    this.api
      .criar(
        {
          codigo: v.codigo.trim(),
          nome: v.nome.trim(),
          descricao: v.descricao.trim() || null,
          finalidade: v.finalidade,
          tipoProcessoCodigo: v.tipoProcessoCodigo || null,
          conteudo: conteudoInicial(),
        },
        withIdempotencyKey(this.chaveDaCriacao),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        this.salvando.set(false);
        if (resultado.ok) {
          this.notifications.success('Modelo criado', v.codigo);
          this.drawerAberto.set(false);
          void this.router.navigate(['/modelos-formulario', resultado.data]);
          return;
        }
        this.aplicarFalha(resultado.problem);
      });
  }

  protected desativar(modelo: ModeloFormularioView): void {
    this.emAndamento.set(modelo.id);
    this.api
      .desativar(modelo.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => this.aoTrocarSituacao(resultado, 'Modelo desativado', modelo));
  }

  protected ativar(modelo: ModeloFormularioView): void {
    this.emAndamento.set(modelo.id);
    this.api
      .ativar(modelo.id, withIdempotencyKey(idempotencyKey.create()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => this.aoTrocarSituacao(resultado, 'Modelo ativado', modelo));
  }

  protected erro(campo: CampoDaCriacao): string | null {
    const controle = this.form.controls[campo];
    if (!(controle.touched || controle.dirty) || controle.errors === null) return null;
    const backend = controle.errors['backend'] as { message: string } | undefined;
    if (backend) return backend.message;
    if (controle.errors['required']) return 'Campo obrigatório.';
    if (controle.errors['pattern']) return 'Use caixa alta, começando por letra, com letras, números e sublinhado.';
    if (controle.errors['maxlength']) return 'Valor acima do tamanho permitido.';
    return 'Valor inválido.';
  }

  protected tentarNovamente(): void {
    if (!this.loading()) this.lista.reload();
  }

  protected proximaPagina(): void {
    const proximo = this.nextCursor();
    if (proximo !== null && !this.loading()) this.pagina.set({ cursor: proximo, direction: 'next' });
  }

  protected paginaAnterior(): void {
    const anterior = this.prevCursor();
    if (anterior !== null && !this.loading()) this.pagina.set({ cursor: anterior, direction: 'prev' });
  }

  private aoTrocarSituacao(resultado: ApiResult<void>, mensagem: string, modelo: ModeloFormularioView): void {
    this.emAndamento.set(null);
    if (resultado.ok) {
      this.notifications.success(mensagem, modelo.codigo);
      this.lista.reload();
      return;
    }
    this.notifications.errorFromProblem(resultado.problem, { title: this.problemI18n.resolve(resultado.problem).title });
  }

  private montarParams(): HttpParams {
    let params = new HttpParams();
    if (this.filtroFinalidade() !== '') params = params.set('finalidade', this.filtroFinalidade());
    if (this.filtroSituacao() !== '') params = params.set('ativo', this.filtroSituacao());
    if (this.filtroTipo() !== '') params = params.set('tipoProcesso', this.filtroTipo());
    const pagina = this.pagina();
    return pagina === undefined
      ? params.set('limit', String(PAGE_SIZE))
      : params.set('cursor', cursorToString(pagina.cursor)).set('direction', pagina.direction);
  }

  private aplicarFalha(problem: ProblemDetails): void {
    if (deveRotacionarIdempotencyKey(problem)) {
      this.chaveDaCriacao = idempotencyKey.create();
    }
    if (problem.code === CODIGO_JA_EXISTE) {
      this.marcarCampo('codigo', this.problemI18n.resolve(problem).title);
      return;
    }
    if (problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO && (problem.errors?.length ?? 0) > 0) {
      let aplicou = false;
      for (const erro of problem.errors ?? []) {
        const campo = campoDaRecusa(erro.field);
        if (campo !== null) {
          this.marcarCampo(campo, erro.message);
          aplicou = true;
        }
      }
      if (aplicou) return;
    }
    this.erroDaCriacao.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) this.notifications.errorFromProblem(problem);
  }

  private marcarCampo(campo: CampoDaCriacao, mensagem: string): void {
    const controle = this.form.controls[campo];
    controle.setErrors({ backend: { message: mensagem } });
    controle.markAsTouched();
  }

  /** A API só aceita código em caixa alta; a caixa alta na tela é do estilo do campo. */
  private normalizarCaixaDoCodigo(codigo: string): void {
    const emCaixaAlta = codigo.toLocaleUpperCase('pt-BR');
    if (emCaixaAlta !== codigo) {
      this.form.controls.codigo.setValue(emCaixaAlta, { emitEvent: false, emitModelToViewChange: false });
    }
  }

  /** A sugestão de código acompanha o nome até o administrador escrever outro código. */
  private sugerirCodigo(nome: string): void {
    const atual = this.form.controls.codigo.value;
    if (atual !== '' && atual !== this.ultimaSugestao) return;
    this.ultimaSugestao = sugerirCodigoDeCadastro(nome);
    this.form.controls.codigo.setValue(this.ultimaSugestao, { emitEvent: false });
  }
}

/** O campo do drawer a que a recusa se refere, pelo último segmento; nulo quando é do conteúdo. */
function campoDaRecusa(campo: string): CampoDaCriacao | null {
  const ultimo = (campo.split('.').at(-1) ?? campo).replace(/^./u, (letra) => letra.toLocaleLowerCase('pt-BR'));
  const campos: readonly CampoDaCriacao[] = ['codigo', 'nome', 'descricao', 'finalidade', 'tipoProcessoCodigo'];
  return campos.includes(ultimo as CampoDaCriacao) && !/conteudo/iu.test(campo) ? (ultimo as CampoDaCriacao) : null;
}
