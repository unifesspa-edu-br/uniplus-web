import { HttpParams } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  ProblemDetails,
  ProblemI18nService,
  STATUS_HTTP,
  useApiResource,
  withVendorMime,
} from '@uniplus/shared-core/http';
import {
  deveRotacionarIdempotencyKey,
  idempotencyKey,
  withIdempotencyKey,
} from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CONFIGURACAO_BASE_PATH,
  FatoCandidatoView,
  FaseCanonicaDto,
  ModeloFormularioView,
  ModelosFormularioApi,
  TermosConsentimentoApi,
  TipoDocumentoDto,
  TipoProcessoDto,
} from '@uniplus/shared-data/configuracao';
import { buscaDeMunicipiosNoGeo } from '@uniplus/shared-data/geo';
import {
  AlertComponent,
  BUSCA_DE_MUNICIPIOS,
  EditorDeDocumentosExigidosComponent,
  EditorDeFormularioComponent,
  FINALIDADES,
  SpinnerComponent,
  TagComponent,
  distribuirRecusas,
  distribuirRecusasDosDocumentos,
  ehRecusaDeDocumento,
  fatosCitaveisPelosTermos,
  fatosOferecidos,
  semDadosBasicos,
  termoDisponivelDe,
  type ConteudoDoFormulario,
  type DocumentoExigidoDoFormulario,
  type OpcaoDoDocumento,
  type RecusasDoDocumento,
  type RecusasDoConteudo,
  type TermoDisponivel,
} from '@uniplus/shared-ui/components';

interface CabecalhoForm {
  nome: FormControl<string>;
  descricao: FormControl<string>;
  tipoProcessoCodigo: FormControl<string>;
}

/**
 * A edição de um modelo de formulário: o nome, o tipo de processo e o conteúdo inteiro, que a
 * gravação substitui de uma vez. A seção dos dados básicos não viaja: a API a repõe.
 */
@Component({
  selector: 'cfg-modelo-formulario-edicao-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AlertComponent,
    EditorDeDocumentosExigidosComponent,
    EditorDeFormularioComponent,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // A condição sobre município — o impedimento do campo de município, inclusive — escolhe o valor
  // pela busca no Geo.
  providers: [{ provide: BUSCA_DE_MUNICIPIOS, useFactory: buscaDeMunicipiosNoGeo }],
  template: `
    <div class="page-header page-header--form">
      <a class="btn btn--tertiary btn--sm btn--rect cfg-voltar" routerLink="/modelos-formulario">
        <i class="pi pi-chevron-left" aria-hidden="true"></i>
        Voltar à lista
      </a>
      <div class="page-header__content">
        <h1 class="page-header__title">{{ modelo()?.nome ?? 'Modelo de formulário' }}</h1>
        @if (modelo(); as m) {
          <p class="page-header__desc">
            <code>{{ m.codigo }}</code> · {{ rotuloDaFinalidade(m.finalidade) }}
            <ui-tag [variant]="m.ativo ? 'success' : 'neutral'">{{
              m.ativo ? 'Ativo' : 'Desativado'
            }}</ui-tag>
          </p>
        }
      </div>
    </div>

    @if (carregando()) {
      <div class="cfg-form__loading" role="status">
        <ui-spinner size="md" /> Carregando o modelo...
      </div>
    } @else if (erroAoCarregar()) {
      <ui-alert variant="danger" heading="Não foi possível carregar o modelo">
        {{ erroAoCarregar() }}
        <div class="cfg-list__retry">
          <button type="button" class="btn btn--secondary btn--sm" (click)="carregar()">
            Tentar novamente
          </button>
        </div>
      </ui-alert>
    } @else if (modelo(); as m) {
      <div #resumo class="cfg-modelo-resumo" tabindex="-1">
        @if (recusasGerais().length > 0) {
          <ui-alert variant="danger" heading="A API recusou a gravação">
            <ul>
              @for (recusa of recusasGerais(); track $index) {
                <li>{{ recusa }}</li>
              }
            </ul>
          </ui-alert>
        }
      </div>

      @if (termosComErro()) {
        <ui-alert variant="warning" heading="Termos de consentimento não carregados">
          Sem a lista de termos não é possível exigir um termo novo nem trocar a versão.
          <div class="cfg-list__retry">
            <button type="button" class="btn btn--secondary btn--sm" (click)="carregarTermos()">
              Tentar novamente
            </button>
          </div>
        </ui-alert>
      }

      @if (catalogoComErro()) {
        <ui-alert variant="warning" heading="Catálogo de fatos não carregado">
          Sem o catálogo não é possível acrescentar campos nem declarar condições.
          <div class="cfg-list__retry">
            <button type="button" class="btn btn--secondary btn--sm" (click)="catalogo.reload()">
              Tentar novamente
            </button>
          </div>
        </ui-alert>
      }

      <form
        [formGroup]="form"
        id="cfg-modelo-edicao"
        class="form-grid cfg-modelo-cabecalho"
        (ngSubmit)="salvar()"
        novalidate
      >
        <label class="field" [class.is-error]="erro('nome')">
          <span class="field__label is-required">Nome</span>
          <input
            class="input"
            type="text"
            formControlName="nome"
            maxlength="200"
            [attr.aria-invalid]="erro('nome') ? 'true' : null"
            [attr.aria-describedby]="erro('nome') ? 'cfg-modelo-ed-nome-erro' : null"
          />
          @if (erro('nome')) {
            <span class="field__error" id="cfg-modelo-ed-nome-erro">{{ erro('nome') }}</span>
          }
        </label>
        <label class="field" [class.is-error]="erro('tipoProcessoCodigo')">
          <span class="field__label">Tipo de processo</span>
          <select
            class="select"
            formControlName="tipoProcessoCodigo"
            [attr.aria-invalid]="erro('tipoProcessoCodigo') ? 'true' : null"
            [attr.aria-describedby]="erro('tipoProcessoCodigo') ? 'cfg-modelo-ed-tipo-erro' : null"
          >
            <option value="">Qualquer tipo de processo</option>
            @for (tipo of tiposDeProcesso(); track tipo.codigo) {
              <option [value]="tipo.codigo">{{ tipo.nome }}</option>
            }
          </select>
          @if (erro('tipoProcessoCodigo')) {
            <span class="field__error" id="cfg-modelo-ed-tipo-erro">{{
              erro('tipoProcessoCodigo')
            }}</span>
          }
        </label>
        <label class="field form-grid__full" [class.is-error]="erro('descricao')">
          <span class="field__label">Descrição</span>
          <textarea
            class="textarea"
            formControlName="descricao"
            rows="2"
            maxlength="1000"
            [attr.aria-invalid]="erro('descricao') ? 'true' : null"
            [attr.aria-describedby]="erro('descricao') ? 'cfg-modelo-ed-descricao-erro' : null"
          ></textarea>
          @if (erro('descricao')) {
            <span class="field__error" id="cfg-modelo-ed-descricao-erro">{{
              erro('descricao')
            }}</span>
          }
        </label>
      </form>

      @if (vocabularioDosDocumentosComErro()) {
        <ui-alert variant="warning" heading="Fases ou tipos de documento não carregados">
          Sem as fases e os tipos de documento não é possível acrescentar documentos exigidos.
          <div class="cfg-list__retry">
            <button
              type="button"
              class="btn btn--secondary btn--sm"
              (click)="recarregarVocabularioDosDocumentos()"
            >
              Tentar novamente
            </button>
          </div>
        </ui-alert>
      }

      @if (conteudo(); as c) {
        <ui-editor-de-formulario
          idBase="cfg-modelo"
          [conteudo]="c"
          [catalogo]="fatos()"
          [finalidade]="m.finalidade"
          [disabled]="salvando()"
          [recusas]="recusas()"
          [termosDisponiveis]="termosDisponiveis()"
          (conteudoChange)="conteudo.set($event)"
        />

        <ui-editor-de-documentos-exigidos
          idBase="cfg-modelo-docs"
          [documentos]="documentosExigidos()"
          [fases]="fases()"
          [tipos]="tiposDeDocumento()"
          [fatos]="fatosDosDocumentos()"
          [citaveis]="fatosCitaveisDosDocumentos()"
          [disabled]="salvando()"
          [recusas]="recusasDosDocumentos().porDocumento"
          [recusasGerais]="recusasDosDocumentos().gerais"
          (documentosChange)="trocarDocumentos($event)"
        />
      }

      <p>
        <a
          class="btn btn--secondary"
          routerLink="/simulador-de-formulario"
          [queryParams]="{ modelo: m.id }"
          target="_blank"
          rel="noopener"
        >
          <i class="pi pi-play" aria-hidden="true"></i>
          Simular o modelo
          <span class="sr-only">(abre em nova aba)</span>
        </a>
        @if (conteudoAlterado()) {
          <span class="field__hint"
            >A simulação usa o modelo gravado: grave as alterações para simulá-las.</span
          >
        }
      </p>

      <div class="cfg-form-footer">
        <a class="btn btn--tertiary btn--rect" routerLink="/modelos-formulario"
          >Voltar sem salvar</a
        >
        <button
          type="submit"
          form="cfg-modelo-edicao"
          class="btn btn--primary"
          [disabled]="salvando()"
        >
          @if (salvando()) {
            <ui-spinner size="sm" />
          }
          {{ salvando() ? 'Salvando...' : 'Salvar modelo' }}
        </button>
      </div>
    }
  `,
  host: { class: 'cfg-page' },
})
export class ModeloFormularioEdicaoPage {
  private readonly api = inject(ModelosFormularioApi);
  private readonly termosApi = inject(TermosConsentimentoApi);
  private readonly route = inject(ActivatedRoute);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  private readonly resumo = viewChild<ElementRef<HTMLElement>>('resumo');

  protected readonly modelo = signal<ModeloFormularioView | null>(null);
  protected readonly conteudo = signal<ConteudoDoFormulario | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erroAoCarregar = signal<string | null>(null);
  protected readonly salvando = signal(false);
  protected readonly recusas = signal<RecusasDoConteudo | null>(null);
  protected readonly recusasGerais = signal<readonly string[]>([]);
  private chaveDaGravacao = idempotencyKey.create();

  protected readonly catalogo = useApiResource<readonly FatoCandidatoView[]>(() => ({
    url: `${this.basePath}/api/configuracao/fatos-candidato`,
    context: withVendorMime('fato-candidato', 1),
  }));

  private readonly fasesCanonicas = useApiResource<readonly FaseCanonicaDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/fases-canonicas`,
    params: new HttpParams().set('limit', '100'),
    context: withVendorMime('fase-canonica', 1),
  }));

  private readonly tiposDocumento = useApiResource<readonly TipoDocumentoDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/tipos-documento`,
    params: new HttpParams().set('limit', '100'),
    context: withVendorMime('tipo-documento', 1),
  }));

  private readonly tipos = useApiResource<readonly TipoProcessoDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/tipos-processo`,
    params: new HttpParams().set('limit', '100'),
    context: withVendorMime('tipo-processo', 1),
  }));

  protected readonly fatos = computed(() => this.catalogo.data() ?? []);
  protected readonly catalogoComErro = computed(
    () => this.catalogo.problem() !== null || this.catalogo.error() !== undefined,
  );
  protected readonly tiposDeProcesso = computed(() => this.tipos.data() ?? []);
  protected readonly fases = computed<readonly OpcaoDoDocumento[]>(() =>
    (this.fasesCanonicas.data() ?? []).map(({ codigo, nome, permiteComplementacao }) => ({
      codigo,
      nome,
      permiteComplementacao,
    })),
  );
  protected readonly tiposDeDocumento = computed<readonly OpcaoDoDocumento[]>(() =>
    (this.tiposDocumento.data() ?? []).map(({ codigo, nome }) => ({ codigo, nome })),
  );
  protected readonly vocabularioDosDocumentosComErro = computed(() =>
    [this.fasesCanonicas, this.tiposDocumento].some(
      (recurso) => recurso.problem() !== null || recurso.error() !== undefined,
    ),
  );
  protected readonly documentosExigidos = computed(() => this.conteudo()?.documentosExigidos ?? []);
  /** Os fatos que o documento pode citar: os mesmos que o termo, pois a API confere ambos da mesma forma. */
  protected readonly fatosCitaveisDosDocumentos = computed(() => {
    const conteudo = this.conteudo();
    return conteudo === null ? new Set<string>() : fatosCitaveisPelosTermos(conteudo);
  });
  /** Os citáveis e os que as condições gravadas já citam, para a condição gravada aparecer na lista. */
  protected readonly fatosDosDocumentos = computed(() =>
    fatosOferecidos(
      this.fatos(),
      this.fatosCitaveisDosDocumentos(),
      this.documentosExigidos().map((documento) => documento.quando),
    ),
  );
  protected readonly recusasDosDocumentos = signal<{
    readonly porDocumento: ReadonlyMap<DocumentoExigidoDoFormulario, RecusasDoDocumento>;
    readonly gerais: readonly string[];
  }>({ porDocumento: new Map(), gerais: [] });
  /** O conteúdo na tela difere do gravado: a simulação, que abre o modelo gravado, não o refletiria. */
  protected readonly conteudoAlterado = computed(
    () => JSON.stringify(this.conteudo()) !== JSON.stringify(this.modelo()?.conteudo ?? null),
  );

  protected readonly form = new FormGroup<CabecalhoForm>({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    descricao: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    tipoProcessoCodigo: new FormControl('', { nonNullable: true }),
  });

  protected readonly termosDisponiveis = signal<readonly TermoDisponivel[]>([]);
  protected readonly termosComErro = signal(false);

  constructor() {
    this.carregar();
    this.carregarTermos();
  }

  /** Os termos com as versões: a lista, colhida por todas as páginas, não as traz, e cada termo é lido por inteiro. */
  protected carregarTermos(): void {
    this.termosComErro.set(false);
    this.termosApi
      .listarComVersoes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((termos) => {
        if (!termos.ok) {
          this.termosComErro.set(true);
          return;
        }
        this.termosDisponiveis.set(termos.data.map(termoDisponivelDe));
      });
  }

  protected recarregarVocabularioDosDocumentos(): void {
    this.fasesCanonicas.reload();
    this.tiposDocumento.reload();
  }

  protected trocarDocumentos(documentos: readonly DocumentoExigidoDoFormulario[]): void {
    const atual = this.conteudo();
    if (atual !== null) this.conteudo.set({ ...atual, documentosExigidos: documentos });
  }

  protected rotuloDaFinalidade(valor: string): string {
    return FINALIDADES.find((finalidade) => finalidade.valor === valor)?.rotulo ?? valor;
  }

  protected carregar(): void {
    this.carregando.set(true);
    this.erroAoCarregar.set(null);
    this.api
      .obter(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        this.carregando.set(false);
        if (!resultado.ok) {
          this.erroAoCarregar.set(this.problemI18n.resolve(resultado.problem).title);
          return;
        }
        this.preencher(resultado.data);
      });
  }

  protected salvar(): void {
    const conteudo = this.conteudo();
    if (this.salvando() || conteudo === null) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const enviado = semDadosBasicos(conteudo);
    const v = this.form.getRawValue();
    this.salvando.set(true);
    // O cabeçalho trava com o editor: a resposta relê o modelo e apagaria o que mudasse durante a gravação.
    this.form.disable();
    this.api
      .atualizar(
        this.id,
        {
          nome: v.nome.trim(),
          descricao: v.descricao.trim() || null,
          tipoProcessoCodigo: v.tipoProcessoCodigo || null,
          conteudo: enviado,
        },
        withIdempotencyKey(this.chaveDaGravacao),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        this.salvando.set(false);
        this.form.enable();
        if (resultado.ok) {
          this.chaveDaGravacao = idempotencyKey.create();
          this.notifications.success('Modelo salvo', this.modelo()?.codigo ?? '');
          // Relê o que a API gravou: ela repõe os dados básicos e pode deslocar a ordem.
          this.carregar();
          return;
        }
        this.aplicarFalha(resultado.problem, enviado);
      });
  }

  protected erro(campo: keyof CabecalhoForm): string | null {
    const controle = this.form.controls[campo];
    if (!(controle.touched || controle.dirty) || controle.errors === null) return null;
    const backend = controle.errors['backend'] as { message: string } | undefined;
    if (backend) return backend.message;
    if (controle.errors['required']) return 'Campo obrigatório.';
    if (controle.errors['maxlength']) return 'Valor acima do tamanho permitido.';
    return 'Valor inválido.';
  }

  private preencher(modelo: ModeloFormularioView): void {
    this.modelo.set(modelo);
    this.conteudo.set(modelo.conteudo);
    this.recusas.set(null);
    this.recusasGerais.set([]);
    this.recusasDosDocumentos.set({ porDocumento: new Map(), gerais: [] });
    this.form.reset({
      nome: modelo.nome,
      descricao: modelo.descricao ?? '',
      tipoProcessoCodigo: modelo.tipoProcessoCodigo ?? '',
    });
  }

  /**
   * A recusa que aponta um item ou uma etapa vai para ele; a do cabeçalho, para o campo; o resto —
   * a do grafo, que só cita o fato na mensagem — para o resumo, que recebe o foco.
   */
  private aplicarFalha(problem: ProblemDetails, enviado: ConteudoDoFormulario): void {
    if (deveRotacionarIdempotencyKey(problem)) {
      this.chaveDaGravacao = idempotencyKey.create();
    }
    const erros = problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO ? (problem.errors ?? []) : [];
    const doConteudo = erros.filter(
      (erro) => campoDoCabecalho(erro.field) === null && !ehRecusaDeDocumento(erro.field),
    );
    const dosDocumentos = erros.filter((erro) => ehRecusaDeDocumento(erro.field));
    for (const erro of erros) {
      const campo = campoDoCabecalho(erro.field);
      if (campo !== null) {
        this.form.controls[campo].setErrors({ backend: { message: erro.message } });
        this.form.controls[campo].markAsTouched();
      }
    }

    const recusas = distribuirRecusas(doConteudo, enviado);
    this.recusas.set(recusas);
    this.recusasDosDocumentos.set(
      distribuirRecusasDosDocumentos(dosDocumentos, enviado.documentosExigidos ?? []),
    );
    this.recusasGerais.set(
      recusas.gerais.length > 0
        ? recusas.gerais
        : erros.length > 0
          ? ['Há recusas nos campos marcados abaixo.']
          : [this.problemI18n.resolve(problem).title],
    );
    if (problem.status >= 500) this.notifications.errorFromProblem(problem);
    afterNextRender(() => this.resumo()?.nativeElement.focus(), { injector: this.injector });
  }
}

/** O campo do cabeçalho que a recusa aponta: as do conteúdo vêm com o caminho dentro dele. */
function campoDoCabecalho(campo: string): keyof CabecalhoForm | null {
  const campos: readonly (keyof CabecalhoForm)[] = ['nome', 'descricao', 'tipoProcessoCodigo'];
  return (
    campos.find((nome) => nome.toLocaleLowerCase('pt-BR') === campo.toLocaleLowerCase('pt-BR')) ??
    null
  );
}
