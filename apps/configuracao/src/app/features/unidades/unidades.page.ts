import { HttpParams } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
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
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
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
import { GeoApi, type CidadeResumoDto } from '@uniplus/shared-data/geo';
import {
  AtualizarUnidadeCommand,
  CriarUnidadeCommand,
  ORGANIZACAO_BASE_PATH,
  TIPOS_UNIDADE,
  TipoUnidade,
  UnidadeDto,
  UnidadesApi,
} from '@uniplus/shared-data/organizacao';
import { type CidadeRef, ehErroDeEndereco } from '../../shared/endereco';
import {
  AlertComponent,
  ConfirmDialogComponent,
  DrawerComponent,
  EmptyStateComponent,
  FilterBarComponent,
  FilterChipsComponent,
  PagerComponent,
  SpinnerComponent,
  type UiFilterChipOption,
} from '@uniplus/shared-ui/components';

/** Tamanho da janela de cada página (cursor pagination, ADR-0026). */
const PAGE_SIZE = 100;

/** Tamanho da janela do seletor de cidade (cursor pagination, ADR-0026). */
const CIDADES_LIMIT = 20;

/**
 * Debounce da busca textual — uma request por rajada de digitação, não por
 * tecla (critério de aceite #397). Angular 22 trará `debounced()`; no 21.x o
 * padrão oficial é a interop `toObservable → debounceTime → toSignal`.
 */
const BUSCA_DEBOUNCE_MS = 300;

/**
 * Ordinal numérico do enum `TipoUnidade` no backend (`TipoUnidade.cs`) —
 * usado só pelo filtro `?tipo=` da listagem. Esse query param é bindado pelo
 * controller como `int[]` bruto (`UnidadesController.Listar`), independente
 * do enum string (`JsonStringEnumConverter` camelCase) que o corpo JSON de
 * `Criar/AtualizarUnidadeCommand` usa — não decorre de `TIPOS_UNIDADE.value`
 * porque o enum string não expõe ordinal em runtime.
 */
const TIPO_UNIDADE_FILTRO_ORDINAL: Readonly<Record<TipoUnidade, number>> = {
  [TipoUnidade.nenhum]: 0,
  [TipoUnidade.reitoria]: 1,
  [TipoUnidade.proReitoria]: 2,
  [TipoUnidade.centro]: 3,
  [TipoUnidade.instituto]: 4,
  [TipoUnidade.faculdade]: 5,
  [TipoUnidade.departamento]: 6,
  [TipoUnidade.coordenacao]: 7,
  [TipoUnidade.diretoria]: 8,
  [TipoUnidade.divisao]: 9,
  [TipoUnidade.nucleo]: 10,
  [TipoUnidade.outro]: 11,
};

interface UnidadeForm {
  nome: FormControl<string>;
  alias: FormControl<string>;
  slug: FormControl<string>;
  sigla: FormControl<string>;
  codigo: FormControl<string>;
  unidadeSuperiorId: FormControl<string>;
  tipo: FormControl<string>;
  unidadeAcademica: FormControl<boolean>;
  vigenciaInicio: FormControl<string>;
  vigenciaFim: FormControl<string>;
  motivoMudancaIdentificador: FormControl<string>;
}

interface UnidadeTreeNode {
  readonly unidade: UnidadeDto;
  readonly children: readonly UnidadeTreeNode[];
}

type ModoFormulario = 'criar' | 'editar';

const BACKEND_FIELD_TO_CONTROL = {
  Alias: 'alias',
  Codigo: 'codigo',
  Código: 'codigo',
  MotivoMudancaIdentificador: 'motivoMudancaIdentificador',
  MotivoMudançaIdentificador: 'motivoMudancaIdentificador',
  Nome: 'nome',
  Sigla: 'sigla',
  Slug: 'slug',
  Tipo: 'tipo',
  UnidadeAcademica: 'unidadeAcademica',
  UnidadeAcadêmica: 'unidadeAcademica',
  UnidadeSuperiorId: 'unidadeSuperiorId',
  VigenciaFim: 'vigenciaFim',
  VigênciaFim: 'vigenciaFim',
  VigenciaInicio: 'vigenciaInicio',
  VigênciaInicio: 'vigenciaInicio',
} satisfies Record<string, keyof UnidadeForm>;

@Component({
  selector: 'cfg-unidades-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ConfirmDialogComponent,
    DrawerComponent,
    EmptyStateComponent,
    FilterBarComponent,
    FilterChipsComponent,
    NgTemplateOutlet,
    PagerComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Unidade</h1>
        <p class="page-header__desc">
          Estrutura organizacional hierárquica da Unifesspa — identidade rica com histórico de
          identificadores · UNI-REQ-0008.
        </p>
      </div>
    </div>

    <ui-alert
      variant="info"
      heading="Hierarquia de unidades — 11 tipos em domínio fechado"
      [dynamic]="false"
    >
      Cada unidade pode ter uma unidade superior do mesmo banco, sem ciclos. Sigla, Slug e Código
      são únicos entre as unidades vivas; o Alias é livre. A remoção é bloqueada se a unidade for
      superior de outra unidade viva ou a raiz da Instituição; referências por snapshot em outros
      módulos não bloqueiam.
    </ui-alert>

    @if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar unidades">
        {{ errorMessage() }}
        <div class="cfg-unidades__retry">
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

    <div data-scope class="cfg-unidades-scope">
      <ui-filter-bar
        ariaLabel="Filtrar unidades"
        searchPlaceholder="Buscar por sigla ou nome..."
        searchAriaLabel="Buscar unidade"
        [(searchValue)]="busca"
      >
        <button
          uiFilterBarActions
          type="button"
          class="btn btn--tertiary btn--sm btn--rect"
          (click)="limparFiltros()"
        >
          Limpar
        </button>
        <ng-container uiFilterBarSecondary>
          <span class="u-eyebrow">Tipo</span>
          <ui-filter-chips
            [options]="tipoChips"
            [(selected)]="tipoFiltro"
            ariaLabel="Filtrar por tipo"
          />
        </ng-container>
      </ui-filter-bar>

      <section class="panel" aria-labelledby="cfg-unidades-tree-title">
        <div class="panel-head">
          <div class="panel-head__title">
            <h2 id="cfg-unidades-tree-title">Hierarquia</h2>
          </div>
          @if (loading()) {
            <span class="cfg-unidades__loading"><ui-spinner size="sm" /> Carregando</span>
          }
        </div>

        @if (arvore().length === 0) {
          <div class="cfg-panel-empty">
            <p class="cfg-muted">Sem relações carregadas.</p>
          </div>
        } @else {
          <nav class="unit-tree" aria-label="Hierarquia de unidades da Unifesspa">
            @for (node of arvore(); track node.unidade.id) {
              <ng-container
                [ngTemplateOutlet]="treeNode"
                [ngTemplateOutletContext]="{ $implicit: node }"
              />
            }
          </nav>
        }
      </section>

      <section class="panel" aria-labelledby="cfg-unidades-list-title">
        <div class="panel-head">
          <div class="panel-head__title">
            <h2 id="cfg-unidades-list-title">Unidades</h2>
            <span class="list-count" aria-label="Total de unidades carregadas">
              {{ unidades().length }}
            </span>
          </div>
          <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
            <i class="pi pi-plus btn__icon" aria-hidden="true"></i>
            Nova unidade
          </button>
        </div>

        @if (unidades().length > 0) {
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th scope="col">Sigla</th>
                  <th scope="col">Nome</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Unidade superior</th>
                  <th scope="col"><span class="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                @for (unidade of unidades(); track unidade.id) {
                  <tr>
                    <td data-label="Sigla">
                      <code>{{ unidade.sigla }}</code>
                    </td>
                    <td data-label="Nome">
                      <button
                        type="button"
                        class="cfg-link-button table-responsive__primary"
                        [disabled]="recarregandoLista()"
                        (click)="abrirDetalhe(unidade)"
                      >
                        {{ unidade.nome }}
                      </button>
                      @if (unidade.alias) {
                        <div class="table-responsive__meta">Alias: {{ unidade.alias }}</div>
                      }
                    </td>
                    <td data-label="Tipo">
                      <span class="tag">{{ unidade.tipo }}</span>
                    </td>
                    <td data-label="Unidade superior">
                      {{ unidadeSuperiorLabel(unidade.unidadeSuperiorId) }}
                    </td>
                    <td class="table-responsive__actions" data-label="Ações">
                      <button
                        type="button"
                        class="btn btn--tertiary btn--sm btn--rect"
                        [disabled]="recarregandoLista()"
                        (click)="abrirEdicao(unidade)"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        class="btn btn--tertiary btn--sm btn--rect"
                        [disabled]="recarregandoLista()"
                        (click)="pedirRemocao(unidade)"
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
          @if (temFiltro()) {
            <ui-empty-state
              heading="Nenhuma unidade encontrada"
              description="Ajuste a busca ou o filtro de tipo para ver resultados."
            >
              <button type="button" class="btn btn--secondary" (click)="limparFiltros()">
                Limpar filtros
              </button>
            </ui-empty-state>
          } @else {
            <ui-empty-state
              heading="Nenhuma unidade carregada"
              description="Cadastre a primeira unidade para iniciar a estrutura institucional."
            >
              <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
                Nova unidade
              </button>
            </ui-empty-state>
          }
        }

        @if (prevCursor() !== null || nextCursor() !== null) {
          <ui-pager
            statusText="Navegação por páginas"
            navigationLabel="Paginação de unidades"
            [hasPrevious]="prevCursor() !== null"
            [hasNext]="nextCursor() !== null"
            [isDisabled]="loading()"
            (previous)="paginaAnterior()"
            (next)="proximaPagina()"
          />
        }
      </section>
    </div>

    <ng-template #treeNode let-node>
      <div class="unit-node">
        <div class="unit-node__row">
          <span class="unit-node__icon" aria-hidden="true">
            <i class="pi pi-sitemap"></i>
          </span>
          <button
            type="button"
            class="unit-node__name"
            [disabled]="recarregandoLista()"
            (click)="abrirDetalhe(node.unidade)"
          >
            {{ node.unidade.sigla }}
          </button>
          <span class="unit-node__type">{{ node.unidade.nome }}</span>
          <div class="unit-node__actions">
            <button
              type="button"
              class="btn btn--tertiary btn--sm btn--rect"
              [attr.aria-label]="'Editar ' + node.unidade.sigla"
              [disabled]="recarregandoLista()"
              (click)="abrirEdicao(node.unidade)"
            >
              Editar
            </button>
          </div>
        </div>
        @if (node.children.length > 0) {
          <div class="unit-node__children">
            @for (child of node.children; track child.unidade.id) {
              <ng-container
                [ngTemplateOutlet]="treeNode"
                [ngTemplateOutletContext]="{ $implicit: child }"
              />
            }
          </div>
        }
      </div>
    </ng-template>

    <ui-drawer
      class="cfg-form-drawer"
      [(visible)]="drawerOpen"
      heading="Detalhes da unidade"
      ariaLabel="Detalhes da unidade selecionada"
      position="right"
    >
      @if (unidadeSelecionada(); as unidade) {
        <dl class="cfg-detail-list">
          <dt>Nome</dt>
          <dd>{{ unidade.nome }}</dd>
          <dt>Sigla</dt>
          <dd>{{ unidade.sigla }}</dd>
          <dt>Código</dt>
          <dd>{{ unidade.codigo }}</dd>
          <dt>Slug</dt>
          <dd>{{ unidade.slug }}</dd>
          <dt>Tipo</dt>
          <dd>{{ unidade.tipo }}</dd>
          <dt>Unidade superior</dt>
          <dd>{{ unidadeSuperiorLabel(unidade.unidadeSuperiorId) }}</dd>
          <dt>Unidade acadêmica</dt>
          <dd>{{ unidade.unidadeAcademica ? 'Sim' : 'Não' }}</dd>
          <dt>Cidade</dt>
          <dd>{{ cidadeLabel(unidade) }}</dd>
          <dt>Vigência</dt>
          <dd>{{ vigenciaLabel(unidade) }}</dd>
        </dl>
        <div class="cfg-drawer-actions">
          <button
            type="button"
            class="btn btn--tertiary btn--rect"
            [disabled]="recarregandoLista()"
            (click)="abrirEdicao(unidade)"
          >
            Editar
          </button>
          <button
            type="button"
            class="btn btn--danger btn--rect"
            [disabled]="recarregandoLista()"
            (click)="pedirRemocao(unidade)"
          >
            Remover
          </button>
        </div>
      }
    </ui-drawer>

    <ui-drawer
      class="cfg-form-drawer"
      [(visible)]="formOpen"
      [heading]="formHeading()"
      ariaLabel="Formulário de unidade"
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
          <h3 id="cfg-form-identificadores" class="form-section__title">Identificadores</h3>
          <ui-alert variant="info" [dynamic]="false">
            Sigla, Slug e Código são únicos entre as unidades vivas. Alias é livre e não-único.
            Mudar qualquer identificador registra o valor anterior no histórico.
          </ui-alert>

          <div class="form-grid">
            <label class="field" [class.is-error]="erroDoCampo('sigla')">
              <span class="field__label is-required">Sigla</span>
              <input
                class="input"
                type="text"
                placeholder="Ex.: CEPS"
                formControlName="sigla"
                [attr.aria-invalid]="erroDoCampo('sigla') ? 'true' : null"
              />
              <span class="field__hint"
                >Sigla institucional corrente. Única entre as unidades vivas.</span
              >
              @if (erroDoCampo('sigla')) {
                <span class="field__error">{{ erroDoCampo('sigla') }}</span>
              }
            </label>
            <label class="field" [class.is-error]="erroDoCampo('slug')">
              <span class="field__label is-required">Slug</span>
              <input
                class="input"
                type="text"
                placeholder="ex.: ceps"
                formControlName="slug"
                [attr.aria-invalid]="erroDoCampo('slug') ? 'true' : null"
              />
              <span class="field__hint">
                Kebab-case, 3–64 caracteres, usado em caminhos de URL e integração.
              </span>
              @if (erroDoCampo('slug')) {
                <span class="field__error">{{ erroDoCampo('slug') }}</span>
              }
            </label>
            <label class="field" [class.is-error]="erroDoCampo('codigo')">
              <span class="field__label is-required">Código</span>
              <input
                class="input"
                type="text"
                placeholder="Ex.: 1234"
                formControlName="codigo"
                [attr.aria-invalid]="erroDoCampo('codigo') ? 'true' : null"
              />
              <span class="field__hint"
                >Código nos sistemas da Unifesspa. Único entre as unidades vivas.</span
              >
              @if (erroDoCampo('codigo')) {
                <span class="field__error">{{ erroDoCampo('codigo') }}</span>
              }
            </label>
            <label class="field">
              <span class="field__label">Alias</span>
              <input class="input" type="text" placeholder="Ex.: PROEG" formControlName="alias" />
              <span class="field__hint"> Nome popular de agrupamento. Não é único. </span>
            </label>
            <label class="field field--full" [class.is-error]="erroDoCampo('nome')">
              <span class="field__label is-required">Nome completo</span>
              <input
                class="input"
                type="text"
                placeholder="Nome formal conforme portaria"
                formControlName="nome"
                [attr.aria-invalid]="erroDoCampo('nome') ? 'true' : null"
              />
              @if (erroDoCampo('nome')) {
                <span class="field__error">{{ erroDoCampo('nome') }}</span>
              }
            </label>
          </div>
        </section>

        <section aria-labelledby="cfg-form-hierarquia">
          <h3 id="cfg-form-hierarquia" class="form-section__title">Classificação e hierarquia</h3>
          <div class="form-grid">
            <label class="field field--full" [class.is-error]="tipoNaoReconhecido()">
              <span class="field__label is-required">Tipo</span>
              <select
                class="select"
                formControlName="tipo"
                [attr.aria-invalid]="tipoNaoReconhecido() ? 'true' : null"
              >
                @if (tipoNaoReconhecido()) {
                  <option value="" disabled>Selecione o tipo</option>
                }
                @for (tipo of tipoOptions; track tipo.value) {
                  <option [value]="tipo.value">{{ tipo.label }}</option>
                }
              </select>
              @if (tipoNaoReconhecido()) {
                <span class="field__error">
                  Tipo atual não reconhecido — selecione um tipo válido para salvar.
                </span>
              }
            </label>
            <div class="field field--full">
              <span class="field__label">Unidade superior</span>
              <input
                type="search"
                class="input"
                placeholder="Buscar por sigla ou nome..."
                aria-label="Buscar unidade superior"
                [value]="buscaPai()"
                (input)="buscaPai.set(inputValue($event))"
              />
              <select
                class="select"
                formControlName="unidadeSuperiorId"
                aria-label="Unidade superior"
              >
                <option value="">Raiz — sem superior</option>
                @for (unidade of opcoesUnidadeSuperior(); track unidade.id) {
                  <option [value]="unidade.id" [disabled]="unidade.id === unidadeEmEdicaoId()">
                    {{ unidade.sigla }} — {{ unidade.nome }}
                  </option>
                }
              </select>
              <span class="field__hint">
                Digite para buscar entre todas as unidades. Não pode formar ciclo na hierarquia.
              </span>
              @if (opcoesSuperiorComErro()) {
                <span class="field__error">
                  Não foi possível carregar as unidades para seleção.
                  <button
                    type="button"
                    class="cfg-link-button"
                    (click)="recarregarOpcoesSuperior()"
                  >
                    Tentar novamente
                  </button>
                </span>
              }
            </div>
            <label class="checkbox cfg-form__checkbox">
              <input type="checkbox" formControlName="unidadeAcademica" />
              <span class="checkbox__box" aria-hidden="true"></span>
              <span>Unidade acadêmica</span>
            </label>
          </div>
        </section>

        <section aria-labelledby="cfg-form-localizacao">
          <h3 id="cfg-form-localizacao" class="form-section__title">Localização</h3>
          <div class="form-grid">
            <div class="field field--full" [class.is-error]="cidadeErro() !== null">
              <label class="field__label" for="cfg-unidade-cidade-busca">Cidade</label>
              @if (cidadeSelecionada(); as cidade) {
                <div class="input-group">
                  <input
                    id="cfg-unidade-cidade-busca"
                    class="input"
                    readonly
                    [attr.aria-invalid]="cidadeErro() !== null || null"
                    [attr.aria-describedby]="cidadeDescribedBy(false)"
                    [value]="cidade.nome + ' — ' + cidade.uf"
                  />
                  <button
                    type="button"
                    class="btn btn--tertiary"
                    (click)="limparCidade()"
                  >
                    Trocar cidade
                  </button>
                </div>
              } @else {
                <input
                  id="cfg-unidade-cidade-busca"
                  class="input"
                  type="search"
                  autocomplete="off"
                  placeholder="Digite ao menos 3 letras da cidade"
                  [attr.aria-busy]="buscandoCidades() || null"
                  [attr.aria-invalid]="cidadeErro() !== null || null"
                  [attr.aria-describedby]="cidadeDescribedBy(true)"
                  [value]="buscaCidade()"
                  (input)="buscaCidade.set(inputValue($event))"
                />
                @if (buscandoCidades()) {
                  <p class="field__hint" role="status" aria-live="polite">Consultando a API Geo…</p>
                }
                @if (buscaCidadeErro(); as erro) {
                  <div class="field__error" id="cfg-unidade-cidade-busca-erro" role="alert">
                    <p>{{ erro }}</p>
                  </div>
                }
                @if (cidadeOpcoes().length > 0) {
                  <ul class="localidade-opcoes" aria-label="Cidades encontradas">
                    @for (opcao of cidadeOpcoes(); track opcao.codigoIbge) {
                      <li>
                        <button
                          class="btn btn--tertiary"
                          type="button"
                          (click)="
                            selecionarCidade({
                              codigoIbge: opcao.codigoIbge,
                              nome: opcao.nome,
                              uf: opcao.uf,
                            })
                          "
                        >
                          {{ opcao.nome }} — {{ opcao.uf }}
                        </button>
                      </li>
                    }
                  </ul>
                } @else if (
                  buscaCidade().trim().length >= 3 && !buscandoCidades() && buscaCidadeErro() === null
                ) {
                  <p class="field__hint" role="status" aria-live="polite">Nenhuma cidade encontrada.</p>
                }
              }
              <span class="field__hint" id="cfg-unidade-cidade-hint">
                Cidade-sede de referência da unidade. Opcional.
              </span>
              @if (cidadeErro(); as erro) {
                <span class="field__error" id="cfg-unidade-cidade-erro" role="alert">{{ erro }}</span>
              }
            </div>
          </div>
        </section>

        <section aria-labelledby="cfg-form-vigencia">
          <h3 id="cfg-form-vigencia" class="form-section__title">Vigência</h3>
          <div class="form-grid">
            <label class="field" [class.is-error]="erroDoCampo('vigenciaInicio')">
              <span class="field__label is-required">Início de vigência</span>
              <input
                class="input"
                type="date"
                formControlName="vigenciaInicio"
                [readonly]="modo() === 'editar'"
                [attr.aria-invalid]="erroDoCampo('vigenciaInicio') ? 'true' : null"
              />
              @if (erroDoCampo('vigenciaInicio')) {
                <span class="field__error">{{ erroDoCampo('vigenciaInicio') }}</span>
              }
            </label>
            <label class="field" [class.is-error]="erroDoCampo('vigenciaFim')">
              <span class="field__label">Fim de vigência</span>
              <input
                class="input"
                type="date"
                formControlName="vigenciaFim"
                [attr.aria-invalid]="erroDoCampo('vigenciaFim') ? 'true' : null"
              />
              <span class="field__hint">Vazio = unidade vigente.</span>
              @if (erroDoCampo('vigenciaFim')) {
                <span class="field__error">{{ erroDoCampo('vigenciaFim') }}</span>
              }
            </label>
            @if (modo() === 'editar') {
              <label class="field field--full">
                <span class="field__label">Motivo da mudança de identificador</span>
                <textarea class="textarea" formControlName="motivoMudancaIdentificador"></textarea>
              </label>
            }
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
          {{ saving() ? 'Salvando...' : modo() === 'criar' ? 'Criar unidade' : 'Salvar unidade' }}
        </button>
      </div>
    </ui-drawer>

    <ui-confirm-dialog
      [(visible)]="confirmOpen"
      heading="Remover unidade"
      [message]="confirmMessage()"
      confirmLabel="Remover"
      confirmVariant="danger"
      (confirmed)="removerConfirmado()"
    />
  `,
})
export class UnidadesPage {
  private readonly api = inject(UnidadesApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(ORGANIZACAO_BASE_PATH);
  private readonly geo = inject(GeoApi);

  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  /** Erro de referência de cidade (422, all-or-nothing) exibido inline (CA-06, mesmo padrão de Instituição). */
  protected readonly cidadeErro = signal<string | null>(null);
  protected readonly busca = signal('');
  protected readonly tipoFiltro = signal('');
  protected readonly drawerOpen = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly confirmOpen = signal(false);
  protected readonly unidadeSelecionada = signal<UnidadeDto | null>(null);
  protected readonly unidadeParaRemover = signal<UnidadeDto | null>(null);
  protected readonly modo = signal<ModoFormulario>('criar');
  protected readonly unidadeEmEdicaoId = signal<string | null>(null);
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());

  // Termo de busca aplicado — debounced (uma request por rajada, não por tecla).
  private readonly buscaAplicada = toSignal(
    toObservable(this.busca).pipe(
      map((termo) => termo.trim()),
      debounceTime(BUSCA_DEBOUNCE_MS),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );

  // Chave do filtro vigente — fonte do reset de paginação.
  private readonly filtroKey = computed(() =>
    JSON.stringify([this.buscaAplicada(), this.tipoFiltro()]),
  );

  /**
   * Página de navegação atual (`undefined` = primeira). Volta para a primeira
   * sempre que o filtro muda (linkedSignal: `source` = `filtroKey`). "Anterior"/
   * "Próximo" fazem `pagina.set({ cursor, direction })` com o cursor opaco do
   * header `Link` e a direção casada (`'prev'`/`'next'`) — navegação por
   * substituição sobre o cursor bidirecional (ADR-0089 do `uniplus-api`); o
   * cliente não mantém pilha de cursores.
   */
  private readonly pagina = linkedSignal<
    string,
    { readonly cursor: Cursor; readonly direction: PaginationDirection } | undefined
  >({
    source: () => this.filtroKey(),
    computation: () => undefined,
  });

  /**
   * GET reativo de `/api/organizacao/unidades`. Re-dispara quando filtro (`q`/`tipo`) ou
   * `cursor` mudam; `httpResource` cancela a request anterior nativamente — sem
   * `unsubscribe`/guarda manual. Vendor MIME `unidade v1` no HttpContext.
   */
  private readonly lista = useApiResource<readonly UnidadeDto[]>(() => ({
    url: `${this.basePath}/api/organizacao/unidades`,
    params: this.montarParams(),
    context: withVendorMime('unidade', 1),
  }));

  protected readonly loading = this.lista.isLoading;

  /**
   * Recarga que **substitui** a lista em andamento. Com navegação prev/next por
   * substituição, toda carga troca as linhas exibidas (troca de filtro, refetch
   * pós-mutação, ou navegação de página) — durante essa janela as linhas podem
   * estar desatualizadas (ex.: linha recém-removida ainda visível até a resposta
   * chegar), então as ações de linha ficam desabilitadas.
   */
  protected readonly recarregandoLista = computed(() => this.loading());

  /**
   * Cursores de navegação (prev/next) da página em exibição. `linkedSignal` em
   * vez de `computed(headers())` para **preservar** os cursores quando uma
   * navegação falha: em erro o `apiResultInterceptor` devolve os headers da
   * resposta de erro (sem `Link`), então ler `headers()` direto zeraria o pager
   * — o usuário perderia prev/next enquanto `unidades` ainda mostra a página
   * preservada. Espelha o `unidades`: sucesso extrai do `Link`; erro na 1ª
   * página zera (a lista também é limpa); erro em navegação ou loading preserva.
   */
  private readonly cursores = linkedSignal<
    ApiResult<readonly UnidadeDto[]> | undefined,
    { readonly prev: Cursor | null; readonly next: Cursor | null }
  >({
    source: () => this.lista.value(),
    computation: (envelope, previous) => {
      const atual = previous?.value ?? { prev: null, next: null };
      // Sem resposta ainda (loading/reload): preserva para não piscar o pager.
      if (envelope === undefined) {
        return atual;
      }
      const primeiraPagina = untracked(() => this.pagina() === undefined);
      if (!envelope.ok) {
        // Erro na 1ª página zera (a lista é limpa); erro em navegação preserva
        // os cursores da página atual para o usuário continuar navegando.
        return primeiraPagina ? { prev: null, next: null } : atual;
      }
      const link = untracked(() => this.lista.headers()?.get('Link') ?? null);
      return { prev: extractPrevCursor(link), next: extractNextCursor(link) };
    },
  });

  /** Cursor da página anterior (rel="prev" do header Link). `null` = primeira página. */
  protected readonly prevCursor = computed(() => this.cursores().prev);

  /** Próximo cursor (rel="next" do header Link). `null` = última página. */
  protected readonly nextCursor = computed(() => this.cursores().next);

  /**
   * Lista reativa por **substituição** (navegação prev/next, ADR-0089): cada
   * página troca a anterior — sem acumular. `linkedSignal` em vez de `effect`
   * (guidance oficial Angular: `effect` não serve para atualizar outro signal).
   */
  protected readonly unidades = linkedSignal<
    ApiResult<readonly UnidadeDto[]> | undefined,
    readonly UnidadeDto[]
  >({
    source: () => this.lista.value(),
    computation: (envelope, previous) => {
      const atual = previous?.value ?? [];
      // Sem resposta ainda (loading/reload): preserva para não piscar a lista.
      if (envelope === undefined) {
        return atual;
      }
      // Lê a página no instante em que os dados chegam — `untracked` porque a
      // única dependência reativa deste linkedSignal é `lista.value()`; rastrear
      // `pagina` reexecutaria a computação com dados velhos.
      const primeiraPagina = untracked(() => this.pagina() === undefined);
      if (!envelope.ok) {
        // Falha na primeira página (troca de filtro / refetch pós-mutação) limpa
        // — a lista anterior pode estar desatualizada (ex.: linha removida).
        // Falha em navegação (cursor definido) preserva a página atual para o
        // usuário não perder o contexto; o retry (banner) refaz a mesma página.
        return primeiraPagina ? [] : atual;
      }
      return [...envelope.data];
    },
  });

  /** Mensagem de erro da listagem (RFC 9457 → título i18n). */
  protected readonly errorMessage = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar unidades.' : null;
  });

  /** Há filtro ativo? Distingue "sem unidades" de "filtro sem resultado". */
  protected readonly temFiltro = computed(
    () => this.buscaAplicada().length > 0 || this.tipoFiltro().length > 0,
  );

  // Ativa a busca das opções de "unidade superior" na primeira abertura do
  // formulário (lazy — sem custo de request enquanto o form nunca abre).
  private readonly carregarOpcoesSuperior = signal(false);

  /** Termo de busca do campo "unidade superior" (input do formulário). */
  protected readonly buscaPai = signal('');
  // Termo de pai aplicado: atualizado com debounce na digitação (subscription
  // no constructor) e resetado de forma SÍNCRONA ao abrir o form — sem esperar
  // o debounce, senão a reabertura dispararia `?q=<termo antigo>`.
  private readonly buscaPaiAplicada = signal('');

  /**
   * Opções de "unidade superior" do formulário — desacopladas do filtro da
   * **listagem**, mas com busca server-side própria (`q`) para escalar além de
   * uma página: o usuário digita e o backend devolve os pais que casam, então
   * pais fora da primeira página continuam selecionáveis. Resource próprio,
   * lazy, recarregado a cada abertura do form.
   */
  private readonly opcoesSuperiorResource = useApiResource<readonly UnidadeDto[]>(() => {
    if (!this.carregarOpcoesSuperior()) {
      return undefined;
    }
    let params = new HttpParams().set('limit', String(PAGE_SIZE));
    const q = this.buscaPaiAplicada();
    if (q.length > 0) {
      params = params.set('q', q);
    }
    return {
      url: `${this.basePath}/api/organizacao/unidades`,
      params,
      context: withVendorMime('unidade', 1),
    };
  });
  protected readonly opcoesUnidadeSuperior = computed(
    () => this.opcoesSuperiorResource.data() ?? [],
  );
  /**
   * Falha ao carregar as opções de pai — diferencia "sem opções" de "não
   * carregou". Sem isso, um 5xx transitório no lookup deixaria o select só com
   * "Raiz" e o usuário submeteria pai em branco sem saber da falha. Não bloqueia
   * o submit (pai é opcional), mas sinaliza com retry.
   */
  protected readonly opcoesSuperiorComErro = computed(() => {
    const envelope = this.opcoesSuperiorResource.value();
    return (
      (envelope !== undefined && !envelope.ok) || this.opcoesSuperiorResource.error() !== undefined
    );
  });

  /** Cidade-sede escolhida — trio inteiro (codigoIbge/nome/uf), não um campo de texto. */
  protected readonly cidadeSelecionada = signal<CidadeRef | null>(null);
  /** Termo digitado no seletor de cidade; não integra o comando enviado — só o trio selecionado importa. */
  protected readonly buscaCidade = signal('');
  /** Resultado corrente da busca de cidade na Geo (mesmo padrão do "município que rege os prazos" do Seleção). */
  protected readonly cidadeOpcoes = signal<readonly CidadeResumoDto[]>([]);
  protected readonly buscandoCidades = signal(false);
  protected readonly buscaCidadeErro = signal<string | null>(null);

  /**
   * Cache monotônico de unidades já vistas (páginas da lista + busca de pai),
   * por id. `unidadeSuperiorLabel` consulta este cache em vez de só a página
   * filtrada: com filtro server-side ativo o pai (ex.: Reitoria) pode sair da
   * página, mas se já foi carregado antes seu rótulo continua resolvendo, sem
   * cair em "Não carregada". `linkedSignal` acumula em vez de `effect`.
   */
  private readonly unidadesConhecidas = linkedSignal<
    { lista: readonly UnidadeDto[]; opcoes: readonly UnidadeDto[] },
    ReadonlyMap<string, UnidadeDto>
  >({
    source: () => ({ lista: this.unidades(), opcoes: this.opcoesUnidadeSuperior() }),
    computation: (vistas, previous) => {
      const mapa = new Map(previous?.value ?? []);
      for (const unidade of vistas.lista) {
        mapa.set(unidade.id, unidade);
      }
      for (const unidade of vistas.opcoes) {
        mapa.set(unidade.id, unidade);
      }
      return mapa;
    },
  });

  protected readonly tipoOptions = TIPOS_UNIDADE.map((tipo) => ({
    value: tipo.value,
    label: tipo.label,
  }));

  /**
   * Chips de tipo a partir do roster fechado `TIPOS_UNIDADE` (11 tipos).
   * Estático — não derivado da página: com filtro server-side a contagem por
   * tipo exigiria facetas que o backend não expõe, então sem count. O `value`
   * do chip é o ordinal numérico (`TIPO_UNIDADE_FILTRO_ORDINAL`), não o enum
   * string — vira `tipoFiltro`/`montarParams`, que alimentam o query param
   * `?tipo=` bindado como `int[]` pelo backend.
   */
  protected readonly tipoChips: readonly UiFilterChipOption[] = [
    { value: '', label: 'Todas' },
    ...TIPOS_UNIDADE.map((tipo) => ({
      value: String(TIPO_UNIDADE_FILTRO_ORDINAL[tipo.value]),
      label: tipo.label,
    })),
  ];

  // A árvore reflete o conjunto carregado/filtrado. Com filtro ativo, nós cujo
  // pai foi filtrado aparecem como raiz — comportamento documentado (#397): não
  // há endpoint de hierarquia dedicado.
  protected readonly arvore = computed(() => montarArvore(this.unidades()));
  protected readonly formHeading = computed(() =>
    this.modo() === 'criar' ? 'Nova unidade' : 'Editar unidade',
  );
  protected readonly confirmMessage = computed(() => {
    const unidade = this.unidadeParaRemover();
    return unidade
      ? `Deseja remover ${unidade.sigla}? A remoção respeita as regras do backend para unidades subordinadas.`
      : 'Deseja remover esta unidade?';
  });

  protected readonly form: FormGroup<UnidadeForm> = new FormGroup<UnidadeForm>({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(250)],
    }),
    alias: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    slug: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    sigla: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)],
    }),
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)],
    }),
    unidadeSuperiorId: new FormControl('', { nonNullable: true }),
    tipo: new FormControl(TipoUnidade.instituto, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    unidadeAcademica: new FormControl(false, { nonNullable: true }),
    vigenciaInicio: new FormControl(dataAtualIso(), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    vigenciaFim: new FormControl('', { nonNullable: true }),
    motivoMudancaIdentificador: new FormControl('', { nonNullable: true }),
  });

  // Reativo ao select de tipo: na edição, um `tipo` vindo do backend que não
  // casa com nenhum dos 11 tipos conhecidos resulta em controle vazio — em vez
  // de coagir silenciosamente para "Outro". Mantém o submit bloqueado (tipo é
  // obrigatório) até o usuário escolher um tipo válido conscientemente.
  private readonly tipoControlValue = toSignal(this.form.controls.tipo.valueChanges, {
    initialValue: this.form.controls.tipo.value,
  });
  protected readonly tipoNaoReconhecido = computed(
    () => this.tipoControlValue().trim().length === 0,
  );

  constructor() {
    // 5xx na listagem → toast persistente além do banner inline. Disparado só
    // quando o problem muda (não duplica em re-render). 4xx fica só no banner.
    effect(() => {
      const problem = this.lista.problem();
      if (problem && problem.status >= 500) {
        const titulo = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title: titulo }));
      }
    });

    // Debounce da digitação no campo "unidade superior" → termo aplicado.
    toObservable(this.buscaPai)
      .pipe(
        map((termo) => termo.trim()),
        debounceTime(BUSCA_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((termo) => this.buscaPaiAplicada.set(termo));

    // Debounce da digitação no campo "Cidade" — uma request por pausa, não
    // por tecla. Abaixo de 3 letras não busca (mesmo corte do Seleção); a
    // partir daí, `switchMap` cancela a busca anterior automaticamente se o
    // termo mudar antes da resposta chegar (não precisa de guarda manual
    // contra resposta obsoleta).
    toObservable(this.buscaCidade)
      .pipe(
        map((termo) => termo.trim()),
        debounceTime(BUSCA_DEBOUNCE_MS),
        distinctUntilChanged(),
        switchMap((busca) => {
          if (busca.length < 3) {
            this.buscandoCidades.set(false);
            this.buscaCidadeErro.set(null);
            return of<ApiResult<readonly CidadeResumoDto[]> | null>(null);
          }
          this.buscandoCidades.set(true);
          this.buscaCidadeErro.set(null);
          return this.geo.listarCidades({ q: busca, limit: CIDADES_LIMIT });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (result === null) {
          this.cidadeOpcoes.set([]);
          return;
        }
        this.buscandoCidades.set(false);
        if (!result.ok) {
          this.cidadeOpcoes.set([]);
          this.buscaCidadeErro.set(this.problemI18n.resolve(result.problem).title);
          return;
        }
        this.cidadeOpcoes.set(result.data);
      });
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

  // Refaz a carga da página atual após falha. Reusa `reload()` porque `pagina`
  // já aponta para a página que falhou — `pagina.set(mesmoValor)` não dispararia
  // novo request. Cobre falha da primeira página e de navegação prev/next.
  protected tentarNovamente(): void {
    if (!this.loading()) {
      this.lista.reload();
    }
  }

  private montarParams(): HttpParams {
    let params = new HttpParams();
    const q = this.buscaAplicada();
    if (q.length > 0) {
      params = params.set('q', q);
    }
    const tipo = this.tipoFiltro();
    if (tipo.length > 0) {
      // Valor numérico-como-string do roster TIPOS_UNIDADE; `tipo` é repetível
      // no contrato (?tipo=3). Valor fora do roster → backend responde 400.
      params = params.append('tipo', tipo);
    }
    const pagina = this.pagina();
    if (pagina === undefined) {
      // Primeira página: define a janela; sem cursor/direction (o servidor
      // coage para 'next').
      params = params.set('limit', String(PAGE_SIZE));
    } else {
      // Navegação: o cursor opaco carrega a janela e a direção cifrada; envia
      // `direction` casado ao cursor (ADR-0089) e omite `limit`.
      params = params.set('cursor', cursorToString(pagina.cursor));
      params = params.set('direction', pagina.direction);
    }
    return params;
  }

  // Carrega/atualiza as opções de "unidade superior" ao abrir o formulário. Na
  // primeira vez ativa o resource (dispara o GET sem filtro); nas reaberturas
  // refaz a busca para incluir unidades criadas desde então.
  private prepararOpcoesSuperior(): void {
    const tinhaTermo = this.buscaPaiAplicada().length > 0;
    // Reset síncrono do termo (exibido e aplicado), para a reabertura não
    // carregar com `q` da busca anterior enquanto o debounce não zera.
    this.buscaPai.set('');
    this.buscaPaiAplicada.set('');

    if (!this.carregarOpcoesSuperior()) {
      this.carregarOpcoesSuperior.set(true); // primeira vez: ativa e dispara o GET
    } else if (!tinhaTermo) {
      // Sem termo anterior, o reset não muda params; força o refetch para
      // refletir unidades recém-criadas. Com termo, o reset de `buscaPaiAplicada`
      // já dispara o refetch (remove o `q`), sem duplicar a request.
      this.opcoesSuperiorResource.reload();
    }
  }

  protected recarregarOpcoesSuperior(): void {
    this.opcoesSuperiorResource.reload();
  }

  /** Grava o trio inteiro vindo da opção escolhida — nunca campo a campo. */
  protected selecionarCidade(cidade: CidadeRef): void {
    this.cidadeSelecionada.set(cidade);
    this.buscaCidade.set('');
    this.cidadeOpcoes.set([]);
  }

  /**
   * Limpa a seleção inteira — inclusive o erro de salvar e o resíduo de uma
   * busca anterior (termo, opções e erro de busca). Sem isso, "Trocar cidade"
   * reabria a busca com uma mensagem de erro de uma tentativa de salvar
   * anterior ainda visível, ou com opções obsoletas de uma resposta que
   * chegou tarde.
   */
  protected limparCidade(): void {
    this.cidadeSelecionada.set(null);
    this.buscaCidade.set('');
    this.cidadeOpcoes.set([]);
    this.cidadeErro.set(null);
    this.buscaCidadeErro.set(null);
  }

  /** `aria-describedby` do campo Cidade: hint + erro de salvar (sempre relevante) + erro de busca (só no ramo de busca). */
  protected cidadeDescribedBy(incluirErroBusca: boolean): string {
    const ids = ['cfg-unidade-cidade-hint'];
    if (this.cidadeErro() !== null) {
      ids.push('cfg-unidade-cidade-erro');
    }
    if (incluirErroBusca && this.buscaCidadeErro() !== null) {
      ids.push('cfg-unidade-cidade-busca-erro');
    }
    return ids.join(' ');
  }

  protected abrirCadastro(): void {
    this.modo.set('criar');
    this.unidadeEmEdicaoId.set(null);
    this.form.reset({
      nome: '',
      alias: '',
      slug: '',
      sigla: '',
      codigo: '',
      unidadeSuperiorId: '',
      tipo: TipoUnidade.instituto,
      unidadeAcademica: false,
      vigenciaInicio: dataAtualIso(),
      vigenciaFim: '',
      motivoMudancaIdentificador: '',
    });
    this.cidadeSelecionada.set(null);
    this.buscaCidade.set('');
    this.cidadeOpcoes.set([]);
    this.formError.set(null);
    this.cidadeErro.set(null);
    this.buscaCidadeErro.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.prepararOpcoesSuperior();
    this.formOpen.set(true);
  }

  protected abrirEdicao(unidade: UnidadeDto): void {
    this.modo.set('editar');
    this.unidadeEmEdicaoId.set(unidade.id);
    this.form.reset({
      nome: unidade.nome,
      alias: unidade.alias ?? '',
      slug: unidade.slug,
      sigla: unidade.sigla,
      codigo: unidade.codigo,
      unidadeSuperiorId: unidade.unidadeSuperiorId ?? '',
      tipo: tipoValueFromLabel(unidade.tipo),
      unidadeAcademica: unidade.unidadeAcademica,
      vigenciaInicio: unidade.vigenciaInicio,
      vigenciaFim: unidade.vigenciaFim ?? '',
      motivoMudancaIdentificador: '',
    });
    this.cidadeSelecionada.set(
      unidade.cidadeCodigoIbge === null
        ? null
        : {
            codigoIbge: unidade.cidadeCodigoIbge,
            nome: unidade.cidadeNome ?? '',
            uf: unidade.cidadeUf ?? '',
          },
    );
    this.buscaCidade.set('');
    this.cidadeOpcoes.set([]);
    this.formError.set(null);
    this.cidadeErro.set(null);
    this.buscaCidadeErro.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.prepararOpcoesSuperior();
    this.drawerOpen.set(false);
    this.formOpen.set(true);
  }

  protected abrirDetalhe(unidade: UnidadeDto): void {
    this.unidadeSelecionada.set(unidade);
    this.drawerOpen.set(true);
  }

  protected pedirRemocao(unidade: UnidadeDto): void {
    this.unidadeParaRemover.set(unidade);
    this.drawerOpen.set(false);
    this.confirmOpen.set(true);
  }

  protected removerConfirmado(): void {
    const unidade = this.unidadeParaRemover();
    if (unidade === null || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.api
      .remover(unidade.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.saving.set(false);
        if (result.ok) {
          this.notifications.success('Unidade removida', unidade.sigla);
          this.confirmOpen.set(false);
          this.unidadeParaRemover.set(null);
          this.recarregar();
          return;
        }
        // Falha de remoção é disparada de fora do drawer de formulário: a razão
        // (ex.: 409 "unidade é superior de outra") vai para a notificação, não
        // para `formError` — que pertence ao formulário e não está visível aqui.
        const mensagem = this.problemI18n.resolve(result.problem).title;
        this.notifications.errorFromProblem(result.problem, { title: mensagem });
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
    this.cidadeErro.set(null);

    if (this.modo() === 'criar') {
      this.api
        .criar(this.criarCommand(), withIdempotencyKey(this.idempotencyKeyAtual()))
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((result) => this.handleSalvarResult(result));
      return;
    }

    this.api
      .atualizar(
        this.unidadeEmEdicaoId() ?? '',
        this.atualizarCommand(),
        withIdempotencyKey(this.idempotencyKeyAtual()),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleSalvarResult(result));
  }

  protected erroDoCampo(nome: keyof UnidadeForm): string | null {
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
    if (control.errors['minlength']) return 'Informe ao menos 2 caracteres.';
    if (control.errors['maxlength']) return 'Valor acima do tamanho permitido.';
    return 'Valor inválido.';
  }

  protected unidadeSuperiorLabel(id: string | null): string {
    if (id === null) {
      return 'Sem superior';
    }
    // Consulta o cache de unidades já vistas (não só a página filtrada atual),
    // para o pai não virar "Não carregada" quando filtrado para fora da página.
    const superior = this.unidadesConhecidas().get(id);
    return superior ? `${superior.sigla} — ${superior.nome}` : 'Não carregada';
  }

  protected vigenciaLabel(unidade: UnidadeDto): string {
    return unidade.vigenciaFim === null
      ? `Desde ${formatarData(unidade.vigenciaInicio)}`
      : `${formatarData(unidade.vigenciaInicio)} a ${formatarData(unidade.vigenciaFim)}`;
  }

  /** Rótulo da cidade-sede na ficha de leitura (referência opcional, ADR-0090). */
  protected cidadeLabel(unidade: UnidadeDto): string {
    return unidade.cidadeCodigoIbge === null
      ? 'Não informada'
      : `${unidade.cidadeNome} — ${unidade.cidadeUf}`;
  }

  protected inputValue(event: Event): string {
    return event.target instanceof HTMLInputElement ? event.target.value : '';
  }

  protected limparFiltros(): void {
    this.busca.set('');
    this.tipoFiltro.set('');
  }

  private recarregar(): void {
    // Pós-mutação: volta para a primeira página e refaz o fetch. Se já está na
    // primeira (`pagina` undefined), `reload()` força o refetch (params iguais);
    // senão, resetar `pagina` dispara o refetch reativo pelo httpResource. Em
    // ambos os casos o linkedSignal `unidades` substitui a lista.
    if (this.pagina() === undefined) {
      this.lista.reload();
    } else {
      this.pagina.set(undefined);
    }
  }

  private handleSalvarResult(result: ApiResult<string | void>): void {
    this.saving.set(false);
    if (result.ok) {
      this.notifications.success(this.modo() === 'criar' ? 'Unidade criada' : 'Unidade atualizada');
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
    // Erro de referência de cidade (422 sem `errors[]`, all-or-nothing) — inline
    // no campo de cidade, mesmo padrão de Instituição (CA-06).
    if (ehErroDeEndereco(problem.code)) {
      this.renovarIdempotencyKey();
      this.cidadeErro.set(this.problemI18n.resolve(problem).title);
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
    let erroCidade: string | null = null;
    for (const erro of errors) {
      // Campos de cidade não têm controle flat no FormGroup (trio escolhido
      // inteiro numa busca) — vão inline no campo de cidade (CA-06), mesmo
      // padrão de Instituição, em vez de serem descartados por
      // `controlNameFromBackendField`.
      if (ehErroDeEndereco(erro.field) || ehErroDeEndereco(erro.code)) {
        erroCidade ??= erro.message;
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

    this.cidadeErro.set(erroCidade);
    if (aplicouAlgum) {
      this.formError.set(null);
      return;
    }

    this.formError.set('Não foi possível mapear os erros de validação. Revise os campos.');
  }

  private criarCommand(): CriarUnidadeCommand {
    const raw = this.form.getRawValue();
    const cidade = this.cidadeSelecionada();
    return {
      nome: raw.nome.trim(),
      alias: nullIfBlank(raw.alias),
      slug: raw.slug.trim(),
      sigla: raw.sigla.trim(),
      codigo: raw.codigo.trim(),
      unidadeSuperiorId: nullIfBlank(raw.unidadeSuperiorId),
      tipo: raw.tipo as TipoUnidade,
      unidadeAcademica: raw.unidadeAcademica,
      vigenciaInicio: raw.vigenciaInicio,
      vigenciaFim: nullIfBlank(raw.vigenciaFim),
      cidadeCodigoIbge: cidade?.codigoIbge ?? null,
      cidadeNome: cidade?.nome ?? null,
      cidadeUf: cidade?.uf ?? null,
    };
  }

  private atualizarCommand(): AtualizarUnidadeCommand {
    const raw = this.form.getRawValue();
    const cidade = this.cidadeSelecionada();
    return {
      id: this.unidadeEmEdicaoId() ?? '',
      nome: raw.nome.trim(),
      alias: nullIfBlank(raw.alias),
      slug: raw.slug.trim(),
      sigla: raw.sigla.trim(),
      codigo: raw.codigo.trim(),
      unidadeSuperiorId: nullIfBlank(raw.unidadeSuperiorId),
      tipo: raw.tipo as TipoUnidade,
      unidadeAcademica: raw.unidadeAcademica,
      vigenciaFim: nullIfBlank(raw.vigenciaFim),
      motivoMudancaIdentificador: nullIfBlank(raw.motivoMudancaIdentificador),
      cidadeCodigoIbge: cidade?.codigoIbge ?? null,
      cidadeNome: cidade?.nome ?? null,
      cidadeUf: cidade?.uf ?? null,
    };
  }
}

function montarArvore(unidades: readonly UnidadeDto[]): readonly UnidadeTreeNode[] {
  const nodes = new Map<string, { unidade: UnidadeDto; children: UnidadeTreeNode[] }>();
  for (const unidade of unidades) {
    nodes.set(unidade.id, { unidade, children: [] });
  }

  const roots: UnidadeTreeNode[] = [];
  for (const node of nodes.values()) {
    const parentId = node.unidade.unidadeSuperiorId;
    const parent = parentId === null ? undefined : nodes.get(parentId);
    if (parent === undefined) {
      roots.push(node);
    } else {
      parent.children.push(node);
    }
  }

  return ordenarArvore(roots);
}

function ordenarArvore(nodes: readonly UnidadeTreeNode[]): readonly UnidadeTreeNode[] {
  return [...nodes]
    .sort((a, b) => a.unidade.nome.localeCompare(b.unidade.nome, 'pt-BR'))
    .map((node) => ({ ...node, children: ordenarArvore(node.children) }));
}

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function controlNameFromBackendField(field: string): keyof UnidadeForm | null {
  const normalized =
    field
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/u, '') ?? field;
  if (normalized in BACKEND_FIELD_TO_CONTROL) {
    return BACKEND_FIELD_TO_CONTROL[normalized as keyof typeof BACKEND_FIELD_TO_CONTROL];
  }

  const camelCase = normalized.charAt(0).toLocaleLowerCase('pt-BR') + normalized.slice(1);
  return isUnidadeControlName(camelCase) ? camelCase : null;
}

function isUnidadeControlName(value: string): value is keyof UnidadeForm {
  return [
    'alias',
    'codigo',
    'motivoMudancaIdentificador',
    'nome',
    'sigla',
    'slug',
    'tipo',
    'unidadeAcademica',
    'unidadeSuperiorId',
    'vigenciaFim',
    'vigenciaInicio',
  ].includes(value);
}

function dataAtualIso(): string {
  // Data local (não UTC): `toISOString` poderia adiantar um dia à noite em
  // fusos negativos (ex.: 21h BRT vira o dia seguinte em UTC).
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function formatarData(value: string): string {
  const [year, month, day] = value.split('-');
  if (year === undefined || month === undefined || day === undefined) {
    return value;
  }
  return `${day}/${month}/${year}`;
}

function tipoValueFromLabel(label: string): string {
  const option = TIPOS_UNIDADE.find(
    (tipo) => normalizarEnumLabel(tipo.label) === normalizarEnumLabel(label),
  );
  // Sem casamento: devolve vazio (controle inválido) em vez de assumir "Outro" —
  // editar+salvar não deve reclassificar a unidade silenciosamente.
  return option === undefined ? '' : option.value;
}

function normalizarEnumLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\+/gu, 'plus')
    .replace(/[^a-z0-9]/giu, '')
    .toLocaleLowerCase('pt-BR');
}
