import { HttpParams } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ApiResult,
  ProblemDetails,
  ProblemI18nService,
  ProblemValidationError,
  idempotencyKey,
  useApiResource,
  withIdempotencyKey,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AtualizarInstituicaoCommand,
  CriarInstituicaoCommand,
  InstituicaoApi,
  InstituicaoDto,
  ORGANIZACAO_BASE_PATH,
  UnidadeDto,
} from '@uniplus/shared-data/organizacao';
import {
  AlertComponent,
  ConfirmDialogComponent,
  DrawerComponent,
  EmptyStateComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import {
  EnderecoFormComponent,
  ehErroDeEndereco,
  enderecoEstruturadoDe,
  enderecoParaCommand,
  type EnderecoEstruturado,
} from '../../shared/endereco';

/** Valor de `TipoUnidade` da Reitoria no roster fechado (`TIPOS_UNIDADE`). */
const TIPO_REITORIA = '1';

/** Tamanho da janela ao buscar as Unidades do tipo Reitoria para o select. */
const PAGE_SIZE = 100;

/**
 * Mensagem do banner de bloqueio quando o backend recusa uma segunda criação
 * (409 singleton — CA-06 / §5.1 da spec).
 */
const SINGLETON_CONFLITO_MSG =
  'Já existe uma instituição cadastrada nesta instância da plataforma. ' +
  'Para criar uma nova, primeiro remova a existente.';

interface InstituicaoForm {
  nome: FormControl<string>;
  sigla: FormControl<string>;
  codigoEmec: FormControl<string>;
  cnpj: FormControl<string>;
  organizacaoAcademica: FormControl<string>;
  categoriaAdministrativa: FormControl<string>;
  mantenedora: FormControl<string>;
  codigoMantenedoraEmec: FormControl<string>;
  situacao: FormControl<string>;
  atoCredenciamento: FormControl<string>;
  atoRecredenciamento: FormControl<string>;
  conceitoInstitucional: FormControl<string>;
  igc: FormControl<string>;
  website: FormControl<string>;
  endereco: FormControl<EnderecoEstruturado | null>;
  unidadeRaizId: FormControl<string>;
}

@Component({
  selector: 'cfg-instituicao-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ConfirmDialogComponent,
    DrawerComponent,
    EmptyStateComponent,
    EnderecoFormComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Instituição</h1>
        <p class="page-header__desc">
          Cabeçalho institucional da plataforma — identificação e-MEC, situação regulatória e
          contato da sede · UNI-REQ-0007.
        </p>
      </div>
    </div>

    <ui-alert
      variant="info"
      heading="Registro único"
      [dynamic]="false"
    >
      Cada instância da plataforma atende uma única instituição. Não é possível criar nem listar
      várias — apenas editar a Instituição existente. A remoção é lógica e só ocorre em
      recadastramento institucional.
    </ui-alert>

    @if (loadError()) {
      <ui-alert variant="danger" heading="Não foi possível carregar a instituição">
        {{ loadError() }}
        <div class="cfg-instituicao__retry">
          <button
            type="button"
            class="btn btn--secondary btn--sm"
            [disabled]="isLoading()"
            (click)="carregar()"
          >
            Tentar novamente
          </button>
        </div>
      </ui-alert>
    } @else if (isLoading()) {
      <section class="panel">
        <div class="cfg-panel-empty">
          <span class="cfg-instituicao__loading"><ui-spinner size="sm" /> Carregando instituição</span>
        </div>
      </section>
    } @else if (instituicao(); as inst) {
      <section class="panel" aria-labelledby="cfg-instituicao-ficha-title">
        <div class="panel-head">
          <div class="panel-head__title">
            <h2 id="cfg-instituicao-ficha-title">{{ inst.nome }}</h2>
            <span class="tag">{{ inst.sigla }}</span>
          </div>
          <button type="button" class="btn btn--primary" (click)="abrirEdicao()">
            <i class="pi pi-pencil btn__icon" aria-hidden="true"></i>
            Editar
          </button>
        </div>

        <div class="cfg-instituicao__ficha">
          <section aria-labelledby="cfg-ficha-identificacao">
            <h3 id="cfg-ficha-identificacao" class="form-section__title">Identificação</h3>
            <dl class="cfg-detail-list">
              <dt>Nome oficial</dt>
              <dd>{{ inst.nome }}</dd>
              <dt>Sigla</dt>
              <dd>{{ inst.sigla }}</dd>
              <dt>Código e-MEC</dt>
              <dd>{{ inst.codigoEmec }}</dd>
              <dt>CNPJ</dt>
              <dd>{{ inst.cnpj || naoInformado }}</dd>
            </dl>
          </section>

          <section aria-labelledby="cfg-ficha-classificacao">
            <h3 id="cfg-ficha-classificacao" class="form-section__title">Classificação e-MEC</h3>
            <dl class="cfg-detail-list">
              <dt>Organização acadêmica</dt>
              <dd>{{ inst.organizacaoAcademica }}</dd>
              <dt>Categoria administrativa</dt>
              <dd>{{ inst.categoriaAdministrativa }}</dd>
            </dl>
          </section>

          <section aria-labelledby="cfg-ficha-mantenedora">
            <h3 id="cfg-ficha-mantenedora" class="form-section__title">Mantenedora</h3>
            <dl class="cfg-detail-list">
              <dt>Mantenedora</dt>
              <dd>{{ inst.mantenedora || naoInformado }}</dd>
              <dt>Código mantenedora e-MEC</dt>
              <dd>{{ inst.codigoMantenedoraEmec || naoInformado }}</dd>
            </dl>
          </section>

          <section aria-labelledby="cfg-ficha-situacao">
            <h3 id="cfg-ficha-situacao" class="form-section__title">Situação regulatória</h3>
            <dl class="cfg-detail-list">
              <dt>Situação</dt>
              <dd>{{ inst.situacao || naoInformado }}</dd>
              <dt>Ato de credenciamento</dt>
              <dd>{{ inst.atoCredenciamento || naoInformado }}</dd>
              <dt>Ato de recredenciamento</dt>
              <dd>{{ inst.atoRecredenciamento || naoInformado }}</dd>
            </dl>
          </section>

          <section aria-labelledby="cfg-ficha-indicadores">
            <h3 id="cfg-ficha-indicadores" class="form-section__title">Indicadores de qualidade</h3>
            <dl class="cfg-detail-list">
              <dt>Conceito institucional (CI)</dt>
              <dd>{{ inst.conceitoInstitucional || naoInformado }}</dd>
              <dt>Índice geral de cursos (IGC)</dt>
              <dd>{{ inst.igc || naoInformado }}</dd>
            </dl>
          </section>

          <section aria-labelledby="cfg-ficha-contato">
            <h3 id="cfg-ficha-contato" class="form-section__title">Contato e localização da sede</h3>
            <dl class="cfg-detail-list">
              <dt>Site institucional</dt>
              <dd>{{ inst.website || naoInformado }}</dd>
              <dt>Cidade da sede</dt>
              <dd>{{ cidadeLabel(inst) }}</dd>
              <dt>CEP</dt>
              <dd>{{ inst.endereco?.cep || naoInformado }}</dd>
              <dt>Endereço da sede</dt>
              <dd>{{ enderecoLinhaLabel(inst) }}</dd>
            </dl>
          </section>

          <section aria-labelledby="cfg-ficha-estrutura">
            <h3 id="cfg-ficha-estrutura" class="form-section__title">Estrutura organizacional</h3>
            <dl class="cfg-detail-list">
              <dt>Unidade raiz (reitoria)</dt>
              <dd>{{ unidadeRaizLabel() || naoInformado }}</dd>
            </dl>
          </section>
        </div>
      </section>
    } @else {
      <section class="panel" aria-labelledby="cfg-instituicao-vazia-title">
        <div class="panel-head">
          <div class="panel-head__title">
            <h2 id="cfg-instituicao-vazia-title">Nenhuma instituição cadastrada</h2>
          </div>
          <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
            <i class="pi pi-plus btn__icon" aria-hidden="true"></i>
            Cadastrar instituição
          </button>
        </div>
        <ui-empty-state
          heading="Cadastre a Instituição da plataforma"
          description="Esta instância ainda não tem uma instituição cadastrada. Cadastre o cabeçalho institucional para vincular editais, comprovantes e a estrutura organizacional."
        >
          <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
            Cadastrar instituição
          </button>
        </ui-empty-state>
      </section>
    }

    <ui-drawer
      class="cfg-form-drawer"
      [(visible)]="drawerAberto"
      [heading]="drawerTitulo()"
      ariaLabel="Formulário da instituição"
      position="right"
    >
      @if (submitError()) {
        <ui-alert variant="danger" heading="Não foi possível salvar">
          {{ submitError() }}
        </ui-alert>
      }

      <form
        [formGroup]="form"
        id="cfg-instituicao-form"
        (ngSubmit)="salvar()"
        novalidate
        class="cfg-form"
      >
        <section aria-labelledby="cfg-form-identificacao">
          <h3 id="cfg-form-identificacao" class="form-section__title">Identificação</h3>
          <div class="form-grid">
            <label class="field field--full" [class.is-error]="erroDoCampo('nome')">
              <span class="field__label is-required">Nome oficial</span>
              <input
                class="input"
                type="text"
                formControlName="nome"
                [attr.aria-invalid]="erroDoCampo('nome') ? 'true' : null"
              />
              <span class="field__hint">Nome conforme ato de criação e cadastro e-MEC.</span>
              @if (erroDoCampo('nome')) {
                <span class="field__error">{{ erroDoCampo('nome') }}</span>
              }
            </label>
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
              <span class="field__label is-required">Código e-MEC</span>
              <input
                class="input"
                type="text"
                inputmode="numeric"
                formControlName="codigoEmec"
                [attr.aria-invalid]="erroDoCampo('codigoEmec') ? 'true' : null"
              />
              <span class="field__hint">
                Chave natural e-MEC da instituição — usada em integrações com INEP e MEC.
              </span>
              @if (erroDoCampo('codigoEmec')) {
                <span class="field__error">{{ erroDoCampo('codigoEmec') }}</span>
              }
            </label>
            <label class="field field--full" [class.is-error]="erroDoCampo('cnpj')">
              <span class="field__label">CNPJ</span>
              <input
                class="input"
                type="text"
                placeholder="NN.NNN.NNN/NNNN-NN"
                formControlName="cnpj"
                [attr.aria-invalid]="erroDoCampo('cnpj') ? 'true' : null"
              />
              <span class="field__hint">CNPJ da pessoa jurídica. Opcional.</span>
              @if (erroDoCampo('cnpj')) {
                <span class="field__error">{{ erroDoCampo('cnpj') }}</span>
              }
            </label>
          </div>
        </section>

        <section aria-labelledby="cfg-form-classificacao">
          <h3 id="cfg-form-classificacao" class="form-section__title">Classificação e-MEC</h3>
          <div class="form-grid">
            <label class="field field--full" [class.is-error]="erroDoCampo('organizacaoAcademica')">
              <span class="field__label is-required">Organização acadêmica</span>
              <input
                class="input"
                type="text"
                list="cfg-organizacao-academica"
                formControlName="organizacaoAcademica"
                [attr.aria-invalid]="erroDoCampo('organizacaoAcademica') ? 'true' : null"
              />
              <datalist id="cfg-organizacao-academica">
                <option value="Universidade"></option>
                <option value="Centro universitário"></option>
                <option value="Faculdade"></option>
                <option value="Instituto federal de educação, ciência e tecnologia"></option>
              </datalist>
              @if (erroDoCampo('organizacaoAcademica')) {
                <span class="field__error">{{ erroDoCampo('organizacaoAcademica') }}</span>
              }
            </label>
            <label
              class="field field--full"
              [class.is-error]="erroDoCampo('categoriaAdministrativa')"
            >
              <span class="field__label is-required">Categoria administrativa</span>
              <input
                class="input"
                type="text"
                list="cfg-categoria-administrativa"
                formControlName="categoriaAdministrativa"
                [attr.aria-invalid]="erroDoCampo('categoriaAdministrativa') ? 'true' : null"
              />
              <datalist id="cfg-categoria-administrativa">
                <option value="Pública Federal"></option>
                <option value="Pública Estadual"></option>
                <option value="Pública Municipal"></option>
                <option value="Privada com fins lucrativos"></option>
                <option value="Privada sem fins lucrativos"></option>
              </datalist>
              @if (erroDoCampo('categoriaAdministrativa')) {
                <span class="field__error">{{ erroDoCampo('categoriaAdministrativa') }}</span>
              }
            </label>
          </div>
        </section>

        <section aria-labelledby="cfg-form-mantenedora">
          <h3 id="cfg-form-mantenedora" class="form-section__title">Mantenedora</h3>
          <div class="form-grid">
            <label class="field field--full" [class.is-error]="erroDoCampo('mantenedora')">
              <span class="field__label">Mantenedora</span>
              <input
                class="input"
                type="text"
                formControlName="mantenedora"
                [attr.aria-invalid]="erroDoCampo('mantenedora') ? 'true' : null"
              />
              @if (erroDoCampo('mantenedora')) {
                <span class="field__error">{{ erroDoCampo('mantenedora') }}</span>
              }
            </label>
            <label class="field field--full" [class.is-error]="erroDoCampo('codigoMantenedoraEmec')">
              <span class="field__label">Código mantenedora e-MEC</span>
              <input
                class="input"
                type="text"
                inputmode="numeric"
                formControlName="codigoMantenedoraEmec"
                [attr.aria-invalid]="erroDoCampo('codigoMantenedoraEmec') ? 'true' : null"
              />
              @if (erroDoCampo('codigoMantenedoraEmec')) {
                <span class="field__error">{{ erroDoCampo('codigoMantenedoraEmec') }}</span>
              }
            </label>
          </div>
        </section>

        <section aria-labelledby="cfg-form-situacao">
          <h3 id="cfg-form-situacao" class="form-section__title">Situação regulatória</h3>
          <div class="form-grid">
            <label class="field field--full" [class.is-error]="erroDoCampo('situacao')">
              <span class="field__label">Situação</span>
              <input
                class="input"
                type="text"
                formControlName="situacao"
                [attr.aria-invalid]="erroDoCampo('situacao') ? 'true' : null"
              />
              <span class="field__hint">Situação regulatória atual junto ao MEC.</span>
              @if (erroDoCampo('situacao')) {
                <span class="field__error">{{ erroDoCampo('situacao') }}</span>
              }
            </label>
            <label class="field field--full" [class.is-error]="erroDoCampo('atoCredenciamento')">
              <span class="field__label">Ato de credenciamento</span>
              <input
                class="input"
                type="text"
                placeholder="Ex.: Lei nº 12.824, de 5 de junho de 2013"
                formControlName="atoCredenciamento"
                [attr.aria-invalid]="erroDoCampo('atoCredenciamento') ? 'true' : null"
              />
              @if (erroDoCampo('atoCredenciamento')) {
                <span class="field__error">{{ erroDoCampo('atoCredenciamento') }}</span>
              }
            </label>
            <label class="field field--full" [class.is-error]="erroDoCampo('atoRecredenciamento')">
              <span class="field__label">Ato de recredenciamento</span>
              <input
                class="input"
                type="text"
                placeholder="Ex.: Portaria MEC nº …"
                formControlName="atoRecredenciamento"
                [attr.aria-invalid]="erroDoCampo('atoRecredenciamento') ? 'true' : null"
              />
              @if (erroDoCampo('atoRecredenciamento')) {
                <span class="field__error">{{ erroDoCampo('atoRecredenciamento') }}</span>
              }
            </label>
          </div>
        </section>

        <section aria-labelledby="cfg-form-indicadores">
          <h3 id="cfg-form-indicadores" class="form-section__title">Indicadores de qualidade</h3>
          <div class="form-grid form-grid--pair">
            <label class="field" [class.is-error]="erroDoCampo('conceitoInstitucional')">
              <span class="field__label">Conceito institucional (CI)</span>
              <input
                class="input"
                type="text"
                inputmode="numeric"
                formControlName="conceitoInstitucional"
                [attr.aria-invalid]="erroDoCampo('conceitoInstitucional') ? 'true' : null"
              />
              <span class="field__hint">Valor e-MEC (1–5).</span>
              @if (erroDoCampo('conceitoInstitucional')) {
                <span class="field__error">{{ erroDoCampo('conceitoInstitucional') }}</span>
              }
            </label>
            <label class="field" [class.is-error]="erroDoCampo('igc')">
              <span class="field__label">Índice geral de cursos (IGC)</span>
              <input
                class="input"
                type="text"
                inputmode="numeric"
                formControlName="igc"
                [attr.aria-invalid]="erroDoCampo('igc') ? 'true' : null"
              />
              @if (erroDoCampo('igc')) {
                <span class="field__error">{{ erroDoCampo('igc') }}</span>
              }
            </label>
          </div>
        </section>

        <section aria-labelledby="cfg-form-contato">
          <h3 id="cfg-form-contato" class="form-section__title">Contato e localização da sede</h3>
          <div class="form-grid">
            <label class="field field--full" [class.is-error]="erroDoCampo('website')">
              <span class="field__label">Site institucional</span>
              <input
                class="input"
                type="url"
                formControlName="website"
                [attr.aria-invalid]="erroDoCampo('website') ? 'true' : null"
              />
              @if (erroDoCampo('website')) {
                <span class="field__error">{{ erroDoCampo('website') }}</span>
              }
            </label>
          </div>
          <cfg-endereco-form
            formControlName="endereco"
            idPrefix="inst-endereco"
            legend="Endereço da sede"
            [erroExterno]="enderecoErro()"
          />
        </section>

        <section aria-labelledby="cfg-form-estrutura">
          <h3 id="cfg-form-estrutura" class="form-section__title">Estrutura organizacional</h3>
          <div class="form-grid">
            <label class="field field--full" [class.is-error]="erroDoCampo('unidadeRaizId')">
              <span class="field__label">Unidade raiz (reitoria)</span>
              <select
                class="select"
                formControlName="unidadeRaizId"
                [attr.aria-invalid]="erroDoCampo('unidadeRaizId') ? 'true' : null"
              >
                <option value="">(Não vinculada)</option>
                @for (reitoria of reitorias(); track reitoria.id) {
                  <option [value]="reitoria.id">{{ reitoria.sigla }} — {{ reitoria.nome }}</option>
                }
              </select>
              <span class="field__hint">
                Aponta para a Unidade viva do tipo Reitoria. Pode ficar sem vínculo durante o
                cadastro inicial da estrutura.
              </span>
              @if (reitoriasComErro()) {
                <span class="field__error">
                  Não foi possível carregar as unidades para seleção.
                  <button type="button" class="cfg-link-button" (click)="recarregarReitorias()">
                    Tentar novamente
                  </button>
                </span>
              }
              @if (erroDoCampo('unidadeRaizId')) {
                <span class="field__error">{{ erroDoCampo('unidadeRaizId') }}</span>
              }
            </label>
          </div>
        </section>
      </form>

      <div class="cfg-form-footer">
        @if (instituicao()) {
          <button
            type="button"
            class="btn btn--danger-ghost btn--rect"
            [disabled]="submitting() || removendo()"
            (click)="pedirRemocao()"
          >
            Remover
          </button>
        }
        <button type="button" class="btn btn--tertiary btn--rect" (click)="drawerAberto.set(false)">
          Cancelar
        </button>
        <button
          type="submit"
          form="cfg-instituicao-form"
          class="btn btn--primary"
          [disabled]="submitting() || removendo() || form.invalid"
        >
          @if (submitting()) {
            <ui-spinner size="sm" />
          }
          {{ submitting() ? 'Salvando...' : 'Salvar instituição' }}
        </button>
      </div>
    </ui-drawer>

    <ui-confirm-dialog
      [(visible)]="dialogRemover"
      heading="Remover instituição"
      message="Você está removendo a Instituição desta plataforma. Esta operação preserva o histórico de auditoria e libera o cadastro de uma nova Instituição. Confirma a remoção?"
      confirmLabel="Remover"
      confirmVariant="danger"
      (confirmed)="removerConfirmado()"
    />
  `,
})
export class InstituicaoPage {
  private readonly api = inject(InstituicaoApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(ORGANIZACAO_BASE_PATH);

  /** Texto exibido em campos opcionais sem valor (acessível a leitor de tela). */
  protected readonly naoInformado = '—';

  protected readonly instituicao = signal<InstituicaoDto | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly loadError = signal<string | null>(null);

  protected readonly drawerAberto = signal(false);
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  /** Erro de coerência cidade↔CEP / campos do endereço (422) exibido inline (CA-06). */
  protected readonly enderecoErro = signal<string | null>(null);
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());

  protected readonly dialogRemover = signal(false);
  protected readonly removendo = signal(false);

  protected readonly drawerTitulo = computed(() =>
    this.instituicao() ? 'Editar instituição' : 'Cadastrar instituição',
  );

  /**
   * Unidades vivas do tipo Reitoria para popular o select de unidade raiz e
   * resolver o nome exibido na ficha de leitura. Carregado de forma reativa via
   * `useApiResource` (GET-only, ADR-0018) — sem acesso direto a `HttpClient` na
   * página (fitness `no-direct-http-in-pages`). Filtro `?tipo=1` (Reitoria).
   */
  private readonly reitoriasResource = useApiResource<readonly UnidadeDto[]>(() => ({
    url: `${this.basePath}/api/organizacao/unidades`,
    params: new HttpParams().set('tipo', TIPO_REITORIA).set('limit', String(PAGE_SIZE)),
    context: withVendorMime('unidade', 1),
  }));

  protected readonly reitorias = computed(() => this.reitoriasResource.data() ?? []);

  private readonly reitoriasPorId = computed(
    () => new Map(this.reitorias().map((reitoria) => [reitoria.id, reitoria] as const)),
  );

  /**
   * Falha ao carregar as reitorias — diferencia "sem reitorias" de "não
   * carregou". Sinaliza com retry no select; não bloqueia o salvamento (o
   * vínculo é opcional).
   */
  protected readonly reitoriasComErro = computed(() => {
    const envelope = this.reitoriasResource.value();
    return (
      (envelope !== undefined && !envelope.ok) || this.reitoriasResource.error() !== undefined
    );
  });

  /** Rótulo da unidade raiz na ficha de leitura (`null` quando não vinculada). */
  protected readonly unidadeRaizLabel = computed<string | null>(() => {
    const id = this.instituicao()?.unidadeRaizId ?? null;
    if (id === null) {
      return null;
    }
    const reitoria = this.reitoriasPorId().get(id);
    return reitoria ? `${reitoria.sigla} — ${reitoria.nome}` : 'Não carregada';
  });

  protected readonly form: FormGroup<InstituicaoForm> = new FormGroup<InstituicaoForm>({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(255)],
    }),
    sigla: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(20)],
    }),
    codigoEmec: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    cnpj: new FormControl('', { nonNullable: true }),
    organizacaoAcademica: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    categoriaAdministrativa: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    mantenedora: new FormControl('', { nonNullable: true }),
    codigoMantenedoraEmec: new FormControl('', { nonNullable: true }),
    situacao: new FormControl('', { nonNullable: true }),
    atoCredenciamento: new FormControl('', { nonNullable: true }),
    atoRecredenciamento: new FormControl('', { nonNullable: true }),
    conceitoInstitucional: new FormControl('', { nonNullable: true }),
    igc: new FormControl('', { nonNullable: true }),
    website: new FormControl('', { nonNullable: true }),
    endereco: new FormControl<EnderecoEstruturado | null>(null),
    unidadeRaizId: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    this.carregar();
  }

  /** (Re)carrega o singleton. 404 = nenhuma viva → modo criação; 5xx = banner. */
  protected carregar(): void {
    if (this.isLoading()) {
      return;
    }
    this.isLoading.set(true);
    this.loadError.set(null);
    this.api
      .obter()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.isLoading.set(false);
        if (result.ok) {
          this.instituicao.set(result.data);
          this.loadError.set(null);
          return;
        }
        if (result.status === 404) {
          // Nenhuma Instituição viva — modo criação (empty-state), sem banner.
          this.instituicao.set(null);
          this.loadError.set(null);
          return;
        }
        this.loadError.set(this.problemI18n.resolve(result.problem).title);
        if (result.problem.status >= 500) {
          this.notifications.errorFromProblem(result.problem);
        }
      });
  }

  protected abrirCadastro(): void {
    this.instituicao.set(null);
    this.form.reset(EMPTY_FORM);
    this.submitError.set(null);
    this.enderecoErro.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.drawerAberto.set(true);
  }

  protected abrirEdicao(): void {
    const inst = this.instituicao();
    if (inst === null) {
      return;
    }
    this.form.reset({
      nome: inst.nome,
      sigla: inst.sigla,
      codigoEmec: inst.codigoEmec,
      cnpj: inst.cnpj ?? '',
      organizacaoAcademica: inst.organizacaoAcademica,
      categoriaAdministrativa: inst.categoriaAdministrativa,
      mantenedora: inst.mantenedora ?? '',
      codigoMantenedoraEmec: inst.codigoMantenedoraEmec ?? '',
      situacao: inst.situacao ?? '',
      atoCredenciamento: inst.atoCredenciamento ?? '',
      atoRecredenciamento: inst.atoRecredenciamento ?? '',
      conceitoInstitucional: inst.conceitoInstitucional ?? '',
      igc: inst.igc ?? '',
      website: inst.website ?? '',
      endereco: enderecoEstruturadoDe(inst.cidade, inst.endereco),
      unidadeRaizId: inst.unidadeRaizId ?? '',
    });
    this.submitError.set(null);
    this.enderecoErro.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.drawerAberto.set(true);
  }

  protected salvar(): void {
    // Bloqueia salvar enquanto uma remoção (soft-delete) está em voo: o drawer
    // continua aberto durante o DELETE, e sem este guard um PUT concorrente
    // correria com a remoção, produzindo UI de sucesso/erro inconsistente.
    if (this.submitting() || this.removendo()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.submitError.set(null);

    const inst = this.instituicao();
    if (inst === null) {
      this.api
        .criar(this.criarCommand(), withIdempotencyKey(this.idempotencyKeyAtual()))
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((result) => this.handleSalvarResult(result));
      return;
    }

    this.api
      .atualizar(
        inst.id,
        this.atualizarCommand(inst.id),
        withIdempotencyKey(this.idempotencyKeyAtual()),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleSalvarResult(result));
  }

  protected pedirRemocao(): void {
    if (this.instituicao() === null) {
      return;
    }
    this.dialogRemover.set(true);
  }

  protected removerConfirmado(): void {
    const inst = this.instituicao();
    if (inst === null || this.removendo()) {
      return;
    }

    this.removendo.set(true);
    this.api
      .remover(inst.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.removendo.set(false);
        if (result.ok) {
          this.notifications.success('Instituição removida', inst.sigla);
          this.dialogRemover.set(false);
          this.drawerAberto.set(false);
          this.instituicao.set(null);
          return;
        }
        // Falha de remoção vai para notificação (o drawer pode já ter fechado).
        this.notifications.errorFromProblem(result.problem, {
          title: this.problemI18n.resolve(result.problem).title,
        });
      });
  }

  protected recarregarReitorias(): void {
    this.reitoriasResource.reload();
  }

  protected erroDoCampo(nome: keyof InstituicaoForm): string | null {
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

  /** Rótulo da cidade da sede na ficha de leitura (CA-03). */
  protected cidadeLabel(inst: InstituicaoDto): string {
    const cidade = inst.endereco?.cidade ?? inst.cidade;
    return cidade ? `${cidade.nome} — ${cidade.uf}` : this.naoInformado;
  }

  /** Linha de endereço estruturado (logradouro, número, complemento, bairro). */
  protected enderecoLinhaLabel(inst: InstituicaoDto): string {
    const endereco = inst.endereco;
    if (endereco === null || endereco === undefined) {
      return this.naoInformado;
    }
    const numeroComplemento = [endereco.numero, endereco.complemento]
      .filter((parte): parte is string => parte !== null && parte.trim().length > 0)
      .join(' — ');
    const partes = [
      endereco.logradouro,
      numeroComplemento.length > 0 ? numeroComplemento : null,
      endereco.bairro,
      endereco.distrito,
    ].filter((parte): parte is string => parte !== null && parte.trim().length > 0);
    return partes.length > 0 ? partes.join(', ') : this.naoInformado;
  }

  private handleSalvarResult(result: ApiResult<string | void>): void {
    this.submitting.set(false);
    if (result.ok) {
      this.notifications.success(
        this.instituicao() ? 'Instituição atualizada' : 'Instituição criada',
      );
      this.drawerAberto.set(false);
      this.enderecoErro.set(null);
      this.idempotencyKeyAtual.set(idempotencyKey.create());
      this.carregar();
      return;
    }
    this.aplicarFalha(result.problem);
  }

  private aplicarFalha(problem: ProblemDetails): void {
    // 1) Validação FluentValidation com errors[] por campo (fallback do backend).
    if (problem.status === 422 && problem.errors && problem.errors.length > 0) {
      this.renovarIdempotencyKey();
      this.aplicarErrosDeValidacao(problem.errors);
      return;
    }
    // 2) Unidade raiz inválida — domain error 422 sem errors[], mapeado por code
    //    ao controle correspondente (CA-08).
    if (problem.code.includes('unidade_raiz')) {
      this.renovarIdempotencyKey();
      const control = this.form.controls.unidadeRaizId;
      control.setErrors({
        backend: { code: problem.code, message: this.problemI18n.resolve(problem).title },
      });
      control.markAsTouched();
      this.submitError.set(null);
      return;
    }
    // 2b) Erro de endereço/coerência cidade↔CEP — inline no componente (CA-06).
    if (ehErroDeEndereco(problem.code)) {
      this.renovarIdempotencyKey();
      this.enderecoErro.set(this.problemI18n.resolve(problem).title);
      this.submitError.set(null);
      return;
    }
    // 3) Conflito singleton (409) — banner de bloqueio, não inline (CA-06).
    if (problem.status === 409 || problem.code === 'uniplus.organizacao.instituicao.ja_existe') {
      this.renovarIdempotencyKey();
      this.submitError.set(SINGLETON_CONFLITO_MSG);
      return;
    }
    // 4) Reuso de Idempotency-Key com body diferente — renova a chave.
    if (problem.code === 'uniplus.idempotency.body_mismatch') {
      this.renovarIdempotencyKey();
    }
    this.submitError.set(this.problemI18n.resolve(problem).title);
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
      // Campos do endereço/cidade não têm controle flat — vão inline no
      // componente de endereço (CA-06) em vez de serem descartados.
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
      this.submitError.set(null);
      return;
    }

    this.submitError.set('Não foi possível mapear os erros de validação. Revise os campos.');
  }

  private criarCommand(): CriarInstituicaoCommand {
    const raw = this.form.getRawValue();
    return {
      codigoEmec: raw.codigoEmec.trim(),
      nome: raw.nome.trim(),
      sigla: raw.sigla.trim(),
      organizacaoAcademica: raw.organizacaoAcademica.trim(),
      categoriaAdministrativa: raw.categoriaAdministrativa.trim(),
      cnpj: nullIfBlank(raw.cnpj),
      mantenedora: nullIfBlank(raw.mantenedora),
      codigoMantenedoraEmec: nullIfBlank(raw.codigoMantenedoraEmec),
      situacao: nullIfBlank(raw.situacao),
      atoCredenciamento: nullIfBlank(raw.atoCredenciamento),
      atoRecredenciamento: nullIfBlank(raw.atoRecredenciamento),
      conceitoInstitucional: nullIfBlank(raw.conceitoInstitucional),
      igc: nullIfBlank(raw.igc),
      website: nullIfBlank(raw.website),
      ...enderecoParaCommand(raw.endereco),
      unidadeRaizId: nullIfBlank(raw.unidadeRaizId),
    };
  }

  private atualizarCommand(id: string): AtualizarInstituicaoCommand {
    return { id, ...this.criarCommand() };
  }
}

const EMPTY_FORM = {
  nome: '',
  sigla: '',
  codigoEmec: '',
  cnpj: '',
  organizacaoAcademica: '',
  categoriaAdministrativa: '',
  mantenedora: '',
  codigoMantenedoraEmec: '',
  situacao: '',
  atoCredenciamento: '',
  atoRecredenciamento: '',
  conceitoInstitucional: '',
  igc: '',
  website: '',
  endereco: null,
  unidadeRaizId: '',
} as const;

const INSTITUICAO_CONTROL_NAMES: ReadonlySet<string> = new Set<keyof InstituicaoForm>([
  'nome',
  'sigla',
  'codigoEmec',
  'cnpj',
  'organizacaoAcademica',
  'categoriaAdministrativa',
  'mantenedora',
  'codigoMantenedoraEmec',
  'situacao',
  'atoCredenciamento',
  'atoRecredenciamento',
  'conceitoInstitucional',
  'igc',
  'website',
  'unidadeRaizId',
]);

function controlNameFromBackendField(field: string): keyof InstituicaoForm | null {
  const normalized =
    field
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/u, '') ?? field;
  const camelCase = normalized.charAt(0).toLocaleLowerCase('pt-BR') + normalized.slice(1);
  return INSTITUICAO_CONTROL_NAMES.has(camelCase) ? (camelCase as keyof InstituicaoForm) : null;
}

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
