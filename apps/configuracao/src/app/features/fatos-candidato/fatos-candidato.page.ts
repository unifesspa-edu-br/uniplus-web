import { HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, linkedSignal, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
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
  FaseCanonicaDto,
  FatoCandidatoDto,
  FatoCandidatoView,
  FatosCandidatoApi,
} from '@uniplus/shared-data/configuracao';
import { CODIGO_CADASTRO_FORMATO, CODIGO_CADASTRO_TAMANHO_MAXIMO, sugerirCodigoDeCadastro } from '@uniplus/shared-utils';
import {
  AlertComponent,
  ConfirmDialogComponent,
  DrawerComponent,
  EmptyStateComponent,
  FilterBarComponent,
  type UiFiltroAtivo,
  FilterChipsComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
  TagComponent,
  type UiFilterChipOption,
} from '@uniplus/shared-ui/components';
import { FatoCandidatoEdicaoComponent } from './fato-candidato-edicao.component';
import {
  CARDINALIDADES,
  DOMINIOS,
  DOMINIOS_DO_DERIVADO,
  ESCOPOS,
  FONTES_DE_VALORES,
  FORMATOS_DE_TEXTO,
  ORIGENS,
  acaoDeAtivacao,
  campoDaRecusa,
  classificacoesDoDominio,
  fatosDeMembroAgregaveis,
  hipotesesDaClassificacao,
  resumoDoAgregado,
  rotuloDe,
  temFonteDeValores,
  temFormato,
  type AcaoDeAtivacao,
  type OpcaoDeVocabulario,
} from './fato-candidato.regras';

const PAGE_SIZE = 50;

/** O código do fato já existe — ativo ou desativado: código de fato nunca se reutiliza. */
const CODIGO_JA_EXISTE = 'uniplus.configuracao.fato_candidato.codigo_ja_existe';

/**
 * O que o administrador cria: um fato perguntado ao candidato, um derivado por regra, ou um agregado
 * que resume o que os membros de um grupo repetível responderam.
 */
type TipoDeCriacao = 'DECLARADO' | 'DERIVADO' | 'AGREGADO';

/** A desativação ou reativação que aguarda a confirmação do administrador. */
interface PedidoDeAtivacao {
  readonly fato: FatoCandidatoDto;
  readonly acao: AcaoDeAtivacao;
}

interface CriacaoForm {
  tipo: FormControl<TipoDeCriacao>;
  codigo: FormControl<string>;
  nome: FormControl<string>;
  descricao: FormControl<string>;
  dominio: FormControl<string>;
  fatoDeMembro: FormControl<string>;
  cardinalidade: FormControl<string>;
  fonteValores: FormControl<string>;
  formato: FormControl<string>;
  escopo: FormControl<string>;
  pontoResolucao: FormControl<string>;
  classificacaoProtecao: FormControl<string>;
  finalidadeTratamento: FormControl<string>;
  hipoteseLegal: FormControl<string>;
}

type CampoDaCriacao = Exclude<keyof CriacaoForm, 'tipo'>;

/**
 * O catálogo de fatos do candidato (ADR-0136): a lista com filtro por origem e situação, a criação
 * de fato declarado e de derivado por regra, e a edição — que abre logo depois de criar, porque o
 * derivado categórico precisa dos valores antes das regras.
 */
@Component({
  selector: 'cfg-fatos-candidato-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ConfirmDialogComponent,
    DrawerComponent,
    EmptyStateComponent,
    FatoCandidatoEdicaoComponent,
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
        <h1 class="page-header__title">Fato do Candidato</h1>
        <p class="page-header__desc">
          O que se sabe de cada candidato e que formulários, exigências documentais e critérios
          citam: os dados que ele declara, os derivados por regra e os que o sistema resolve.
          UNI-REQ-0143.
        </p>
      </div>
    </div>

    @if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar os fatos">
        {{ errorMessage() }}
        <div class="cfg-list__retry">
          <button type="button" class="btn btn--secondary btn--sm" [disabled]="loading()" (click)="tentarNovamente()">
            Tentar novamente
          </button>
        </div>
      </ui-alert>
    }

    <ui-filter-bar
      ariaLabel="Filtrar fatos do candidato"
      searchPlaceholder="Buscar por código ou nome…"
      searchAriaLabel="Buscar fato do candidato"
      [(searchValue)]="termoBusca"
      [filtrosAtivos]="filtrosAtivos()"
    >
      <ng-container uiFilterBarSecondary>
        <span class="u-eyebrow">Origem</span>
        <ui-filter-chips [options]="origemChips" [(selected)]="filtroOrigem" ariaLabel="Filtrar por origem" />
        <span class="u-eyebrow">Situação</span>
        <ui-filter-chips [options]="situacaoChips" [(selected)]="filtroSituacao" ariaLabel="Filtrar por situação" />
      </ng-container>
    </ui-filter-bar>

    <section class="panel" aria-labelledby="cfg-fatos-list-title">
      <div class="panel-head">
        <div class="panel-head__title">
          <h2 #tituloDaLista id="cfg-fatos-list-title" tabindex="-1">Fatos do candidato</h2>
          @if (loading()) {
            <span class="cfg-list__loading"><ui-spinner size="sm" /> Carregando</span>
          }
        </div>
        <button type="button" class="btn btn--primary" (click)="abrirCriacao()">
          <i class="pi pi-plus btn__icon" aria-hidden="true"></i>
          Novo fato
        </button>
      </div>

      @if (fatosBuscados().length > 0) {
        <div class="table-responsive">
          <table>
            <caption class="sr-only">Fatos do candidato, com origem, tipo de dado e situação</caption>
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Nome</th>
                <th scope="col">Origem</th>
                <th scope="col">Tipo de dado</th>
                <th scope="col">Situação</th>
                <th scope="col"><span class="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              @for (fato of fatosBuscados(); track fato.id) {
                <tr>
                  <td data-label="Código"><code>{{ fato.codigo }}</code></td>
                  <td data-label="Nome">
                    {{ fato.nome }}
                    @if (fato.sistema) {
                      <ui-tag variant="primary">Sistema</ui-tag>
                    }
                  </td>
                  <td data-label="Origem">{{ rotulo(origens, fato.origem) }}</td>
                  <td data-label="Tipo de dado">{{ rotulo(dominios, fato.dominio) }}</td>
                  <td data-label="Situação">
                    <ui-tag [variant]="fato.ativo ? 'success' : 'neutral'">{{ fato.ativo ? 'Ativo' : 'Desativado' }}</ui-tag>
                  </td>
                  <td class="table-responsive__actions" data-label="Ações">
                    <ui-icon-button
                      icon="pi-eye"
                      [accessibleName]="'Visualizar o fato ' + fato.codigo"
                      tooltip="Visualizar fato"
                      [isDisabled]="loading()"
                      (triggered)="abrirEdicao(fato.id, true)"
                    />
                    <ui-icon-button
                      icon="pi-pencil"
                      [accessibleName]="'Editar o fato ' + fato.codigo"
                      tooltip="Editar fato"
                      [isDisabled]="loading()"
                      (triggered)="abrirEdicao(fato.id)"
                    />
                    @if (fato.sistema) {
                      <!-- O fato de sistema não se desativa: o botão fica, desabilitado, com o porquê. -->
                      <ui-icon-button
                        icon="pi-power-off"
                        [accessibleName]="'Desativar o fato ' + fato.codigo"
                        tooltip="Fato de sistema: não pode ser desativado"
                        description="Fato de sistema não pode ser desativado; só o nome e a descrição se alteram."
                        [isDisabled]="true"
                      />
                    }
                    @switch (acaoDeAtivacao(fato)) {
                      @case ('DESATIVAR') {
                        <ui-icon-button
                          icon="pi-power-off"
                          [accessibleName]="'Desativar o fato ' + fato.codigo"
                          tooltip="Desativar fato"
                          [isDisabled]="loading() || ativando()"
                          (triggered)="pedirAtivacao(fato, 'DESATIVAR')"
                        />
                      }
                      @case ('REATIVAR') {
                        <ui-icon-button
                          icon="pi-replay"
                          [accessibleName]="'Reativar o fato ' + fato.codigo"
                          tooltip="Reativar fato"
                          [isDisabled]="loading() || ativando()"
                          (triggered)="pedirAtivacao(fato, 'REATIVAR')"
                        />
                      }
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (!loading() && !errorMessage()) {
        <ui-empty-state heading="Nenhum fato encontrado" description="Ajuste a busca ou os filtros para ver resultados." />
      }

      @if (prevCursor() !== null || nextCursor() !== null) {
        <ui-pager
          statusText="Navegação por páginas"
          navigationLabel="Paginação de fatos do candidato"
          [hasPrevious]="prevCursor() !== null"
          [hasNext]="nextCursor() !== null"
          [isDisabled]="loading()"
          (previous)="paginaAnterior()"
          (next)="proximaPagina()"
        />
      }
    </section>

    <ui-drawer class="cfg-form-drawer" [(visible)]="drawerAberto" [heading]="tituloDoDrawer()" ariaLabel="Fato do candidato" position="right">
      <!-- O conteúdo só existe com o drawer aberto: reabrir o mesmo fato recarrega do servidor e descarta o rascunho fechado. -->
      @if (drawerAberto() && fatoEmEdicao(); as id) {
        <cfg-fato-candidato-edicao [id]="id" [somenteLeitura]="somenteLeitura()" (alterado)="recarregar()" />
        <div class="cfg-form-footer">
          <button type="button" class="btn btn--secondary btn--rect" (click)="drawerAberto.set(false)">Fechar</button>
        </div>
      } @else if (drawerAberto()) {
        @if (erroDaCriacao()) {
          <ui-alert variant="danger" heading="Não foi possível criar o fato">{{ erroDaCriacao() }}</ui-alert>
        }
        @if (fasesComErro()) {
          <ui-alert variant="warning" heading="Fases não carregadas">
            Sem a lista de fases não é possível dizer a partir de quando o fato é conhecido.
            <div class="cfg-list__retry">
              <button type="button" class="btn btn--secondary btn--sm" (click)="fases.reload()">Tentar novamente</button>
            </div>
          </ui-alert>
        }
        <form [formGroup]="form" id="cfg-fato-criacao" class="cfg-form" (ngSubmit)="criar()" novalidate>
          <fieldset class="field form-grid__full">
            <legend class="field__label is-required">O que o fato é</legend>
            <label class="radio">
              <input type="radio" formControlName="tipo" value="DECLARADO" />
              <span class="radio__circle"></span>
              Perguntado ao candidato num formulário
            </label>
            <label class="radio">
              <input type="radio" formControlName="tipo" value="DERIVADO" />
              <span class="radio__circle"></span>
              Derivado por regra de outros fatos
            </label>
            <label class="radio">
              <input type="radio" formControlName="tipo" value="AGREGADO" />
              <span class="radio__circle"></span>
              Resumo das respostas dos membros de um grupo (ex.: composição familiar)
            </label>
          </fieldset>

          <div class="form-grid">
            <label class="field" [class.is-error]="erro('nome')">
              <span class="field__label is-required">Nome</span>
              <input class="input" type="text" formControlName="nome" [attr.aria-invalid]="erro('nome') ? 'true' : null" [attr.aria-describedby]="erro('nome') ? 'cfg-fato-nome-erro' : null" />
              @if (erro('nome')) {
                <span class="field__error" id="cfg-fato-nome-erro">{{ erro('nome') }}</span>
              }
            </label>
            <label class="field" [class.is-error]="erro('codigo')">
              <span class="field__label is-required">Código</span>
              <input
                class="input cfg-input-uppercase"
                type="text"
                formControlName="codigo"
                [attr.aria-describedby]="erro('codigo') ? 'cfg-fato-codigo-dica cfg-fato-codigo-erro' : 'cfg-fato-codigo-dica'" [attr.aria-invalid]="erro('codigo') ? 'true' : null"
              />
              <span class="field__hint" id="cfg-fato-codigo-dica">Caixa alta, letras, números e sublinhado. Nunca se reutiliza.</span>
              @if (erro('codigo')) {
                <span class="field__error" id="cfg-fato-codigo-erro">{{ erro('codigo') }}</span>
              }
            </label>
          </div>

          <label class="field form-grid__full" [class.is-error]="erro('descricao')">
            <span class="field__label">Descrição</span>
            <textarea class="textarea" rows="2" formControlName="descricao" [attr.aria-invalid]="erro('descricao') ? 'true' : null" [attr.aria-describedby]="erro('descricao') ? 'cfg-fato-descricao-erro' : null"></textarea>
            @if (erro('descricao')) {
              <span class="field__error" id="cfg-fato-descricao-erro">{{ erro('descricao') }}</span>
            }
          </label>

          @if (agregado()) {
            @if (catalogoComErro()) {
              <ui-alert variant="warning" heading="Fatos de membro não carregados">
                Sem o catálogo de fatos não é possível escolher o fato de membro que o agregado resume.
                <div class="cfg-list__retry">
                  <button type="button" class="btn btn--secondary btn--sm" (click)="catalogo.reload()">Tentar novamente</button>
                </div>
              </ui-alert>
            }
            <label class="field form-grid__full" [class.is-error]="erro('fatoDeMembro')">
              <span class="field__label is-required">Fato de membro resumido</span>
              <select
                class="select"
                formControlName="fatoDeMembro"
                [attr.aria-busy]="catalogo.isLoading() ? 'true' : null"
                [attr.aria-invalid]="erro('fatoDeMembro') ? 'true' : null"
                [attr.aria-describedby]="erro('fatoDeMembro') ? 'cfg-fato-membro-dica cfg-fato-fatoDeMembro-erro' : 'cfg-fato-membro-dica'"
              >
                <option value="">Selecione…</option>
                @for (membro of fatosDeMembro(); track membro.codigo) {
                  <option [value]="membro.codigo">{{ membro.nome }} ({{ membro.codigo }})</option>
                }
              </select>
              <span class="field__hint" id="cfg-fato-membro-dica" aria-live="polite">
                @if (membroEscolhido(); as membro) {
                  {{ resumo(membro.dominio) }} O fato de membro é conhecido a partir da fase {{ nomeDaFase(membro.pontoResolucao) }};
                  o agregado não pode ser conhecido antes dela nem ter proteção de dados mais fraca.
                } @else if (!catalogo.isLoading() && !catalogoComErro() && fatosDeMembro().length === 0) {
                  Nenhum fato de membro de grupo ativo, de sim ou não ou de lista de valores, no catálogo.
                } @else {
                  Fatos declarados de membro de grupo, de sim ou não ou de lista de valores.
                }
              </span>
              @if (erro('fatoDeMembro')) {
                <span class="field__error" id="cfg-fato-fatoDeMembro-erro">{{ erro('fatoDeMembro') }}</span>
              }
            </label>
          }

          <div class="form-grid">
            @if (!agregado()) {
            <label class="field" [class.is-error]="erro('dominio')">
              <span class="field__label is-required">Tipo de dado</span>
              <select class="select" formControlName="dominio" [attr.aria-invalid]="erro('dominio') ? 'true' : null" [attr.aria-describedby]="erro('dominio') ? 'cfg-fato-dominio-erro' : null">
                <option value="">Selecione…</option>
                @for (opcao of dominiosDaCriacao(); track opcao.valor) {
                  <option [value]="opcao.valor">{{ opcao.rotulo }}</option>
                }
              </select>
              @if (erro('dominio')) {
                <span class="field__error" id="cfg-fato-dominio-erro">{{ erro('dominio') }}</span>
              }
            </label>
            }
            @if (declarado()) {
              <label class="field" [class.is-error]="erro('cardinalidade')">
                <span class="field__label is-required">Quantos valores</span>
                <select class="select" formControlName="cardinalidade" [attr.aria-invalid]="erro('cardinalidade') ? 'true' : null" [attr.aria-describedby]="erro('cardinalidade') ? 'cfg-fato-cardinalidade-erro' : null">
                  @for (opcao of cardinalidades; track opcao.valor) {
                    <option [value]="opcao.valor">{{ opcao.rotulo }}</option>
                  }
                </select>
                @if (erro('cardinalidade')) {
                  <span class="field__error" id="cfg-fato-cardinalidade-erro">{{ erro('cardinalidade') }}</span>
                }
              </label>
            }
            @if (declarado() && temFonte()) {
              <label class="field" [class.is-error]="erro('fonteValores')">
                <span class="field__label is-required">De onde vêm os valores</span>
                <select class="select" formControlName="fonteValores" [attr.aria-invalid]="erro('fonteValores') ? 'true' : null" [attr.aria-describedby]="erro('fonteValores') ? 'cfg-fato-fonteValores-erro' : null">
                  <option value="">Selecione…</option>
                  @for (opcao of fontes; track opcao.valor) {
                    <option [value]="opcao.valor">{{ opcao.rotulo }}</option>
                  }
                </select>
                @if (erro('fonteValores')) {
                  <span class="field__error" id="cfg-fato-fonteValores-erro">{{ erro('fonteValores') }}</span>
                }
              </label>
            }
            @if (declarado() && temFormatoDeTexto()) {
              <label class="field" [class.is-error]="erro('formato')">
                <span class="field__label is-required">Formato do texto</span>
                <select class="select" formControlName="formato" [attr.aria-invalid]="erro('formato') ? 'true' : null" [attr.aria-describedby]="erro('formato') ? 'cfg-fato-formato-erro' : null">
                  <option value="">Selecione…</option>
                  @for (opcao of formatos; track opcao.valor) {
                    <option [value]="opcao.valor">{{ opcao.rotulo }}</option>
                  }
                </select>
                @if (erro('formato')) {
                  <span class="field__error" id="cfg-fato-formato-erro">{{ erro('formato') }}</span>
                }
              </label>
            }
            @if (!agregado()) {
            <label class="field" [class.is-error]="erro('escopo')">
              <span class="field__label is-required">De quem é o dado</span>
              <select class="select" formControlName="escopo" [attr.aria-invalid]="erro('escopo') ? 'true' : null" [attr.aria-describedby]="erro('escopo') ? 'cfg-fato-escopo-erro' : null">
                @for (opcao of escopos; track opcao.valor) {
                  <option [value]="opcao.valor">{{ opcao.rotulo }}</option>
                }
              </select>
              @if (erro('escopo')) {
                <span class="field__error" id="cfg-fato-escopo-erro">{{ erro('escopo') }}</span>
              }
            </label>
            }
            <label class="field" [class.is-error]="erro('pontoResolucao')">
              <span class="field__label is-required">Conhecido a partir da fase</span>
              <select class="select" formControlName="pontoResolucao" [attr.aria-busy]="fases.isLoading() ? 'true' : null" [attr.aria-invalid]="erro('pontoResolucao') ? 'true' : null" [attr.aria-describedby]="erro('pontoResolucao') ? 'cfg-fato-pontoResolucao-erro' : null">
                <option value="">Selecione…</option>
                @for (fase of fasesCanonicas(); track fase.id) {
                  <option [value]="fase.codigo">{{ fase.nome }}</option>
                }
              </select>
              @if (erro('pontoResolucao')) {
                <span class="field__error" id="cfg-fato-pontoResolucao-erro">{{ erro('pontoResolucao') }}</span>
              }
            </label>
          </div>

          <fieldset class="field form-grid__full">
            <legend class="field__label">Proteção de dados (LGPD)</legend>
            <div class="form-grid">
              <label class="field" [class.is-error]="erro('classificacaoProtecao')">
                <span class="field__label is-required">Classificação</span>
                <select class="select" formControlName="classificacaoProtecao" [attr.aria-invalid]="erro('classificacaoProtecao') ? 'true' : null" [attr.aria-describedby]="erro('classificacaoProtecao') ? 'cfg-fato-classificacaoProtecao-erro' : null">
                  <option value="">Selecione…</option>
                  @for (opcao of classificacoesPermitidas(); track opcao.valor) {
                    <option [value]="opcao.valor">{{ opcao.rotulo }}</option>
                  }
                </select>
                @if (erro('classificacaoProtecao')) {
                  <span class="field__error" id="cfg-fato-classificacaoProtecao-erro">{{ erro('classificacaoProtecao') }}</span>
                }
              </label>
              <label class="field" [class.is-error]="erro('hipoteseLegal')">
                <span class="field__label is-required">Hipótese legal</span>
                <select class="select" formControlName="hipoteseLegal" [attr.aria-invalid]="erro('hipoteseLegal') ? 'true' : null" [attr.aria-describedby]="erro('hipoteseLegal') ? 'cfg-fato-hipoteseLegal-erro' : null">
                  <option value="">Selecione…</option>
                  @for (opcao of hipotesesPermitidas(); track opcao.valor) {
                    <option [value]="opcao.valor">{{ opcao.rotulo }}</option>
                  }
                </select>
                @if (erro('hipoteseLegal')) {
                  <span class="field__error" id="cfg-fato-hipoteseLegal-erro">{{ erro('hipoteseLegal') }}</span>
                }
              </label>
            </div>
            <label class="field form-grid__full" [class.is-error]="erro('finalidadeTratamento')">
              <span class="field__label is-required">Finalidade do tratamento</span>
              <textarea class="textarea" rows="2" formControlName="finalidadeTratamento" [attr.aria-invalid]="erro('finalidadeTratamento') ? 'true' : null" [attr.aria-describedby]="erro('finalidadeTratamento') ? 'cfg-fato-finalidadeTratamento-erro' : null"></textarea>
              @if (erro('finalidadeTratamento')) {
                <span class="field__error" id="cfg-fato-finalidadeTratamento-erro">{{ erro('finalidadeTratamento') }}</span>
              }
            </label>
          </fieldset>
        </form>

        <div class="cfg-form-footer">
          <button type="button" class="btn btn--tertiary btn--rect" (click)="drawerAberto.set(false)">Cancelar</button>
          <button type="submit" form="cfg-fato-criacao" class="btn btn--primary" [disabled]="salvando()">
            @if (salvando()) {
              <ui-spinner size="sm" />
            }
            {{ salvando() ? 'Criando...' : 'Criar fato' }}
          </button>
        </div>
      }
    </ui-drawer>

    <ui-confirm-dialog
      [(visible)]="confirmacaoAberta"
      [heading]="pedidoDeAtivacao()?.acao === 'REATIVAR' ? 'Reativar fato do candidato' : 'Desativar fato do candidato'"
      [message]="mensagemDaConfirmacao()"
      [confirmLabel]="pedidoDeAtivacao()?.acao === 'REATIVAR' ? 'Reativar' : 'Desativar'"
      [confirmVariant]="pedidoDeAtivacao()?.acao === 'REATIVAR' ? 'primary' : 'danger'"
      (confirmed)="confirmarAtivacao()"
    />
  `,
  host: { class: 'cfg-page' },
})
export class FatosCandidatoPage {
  private readonly api = inject(FatosCandidatoApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  protected readonly origens = ORIGENS;
  protected readonly dominios = DOMINIOS;
  protected readonly cardinalidades = CARDINALIDADES;
  protected readonly fontes = FONTES_DE_VALORES;
  protected readonly formatos = FORMATOS_DE_TEXTO;
  protected readonly escopos = ESCOPOS;
  protected readonly rotulo = rotuloDe;
  protected readonly resumo = resumoDoAgregado;
  protected readonly acaoDeAtivacao = acaoDeAtivacao;

  protected readonly origemChips: readonly UiFilterChipOption[] = [
    { value: '', label: 'Todas' },
    ...ORIGENS.map((origem) => ({ value: origem.valor, label: origem.rotulo })),
  ];
  protected readonly situacaoChips: readonly UiFilterChipOption[] = [
    { value: 'true', label: 'Ativos' },
    { value: 'false', label: 'Desativados' },
    { value: '', label: 'Todos' },
  ];

  protected readonly termoBusca = signal('');
  protected readonly filtroOrigem = signal('');
  protected readonly filtroSituacao = signal('true');
  /** Situação começa em "Ativos": é esse o padrão que fica de fora, não "Todos". */
  protected readonly filtrosAtivos = computed<readonly UiFiltroAtivo[]>(() => {
    const ativos: UiFiltroAtivo[] = [];
    const origem = this.filtroOrigem();
    if (origem !== '') {
      const rotulo = this.origemChips.find((chip) => chip.value === origem)?.label ?? origem;
      ativos.push({ nome: 'Origem', valor: rotulo });
    }
    const situacao = this.filtroSituacao();
    if (situacao !== 'true') {
      const rotulo = this.situacaoChips.find((chip) => chip.value === situacao)?.label ?? situacao;
      ativos.push({ nome: 'Situação', valor: rotulo });
    }
    return ativos;
  });
  /** O cursor pertence ao filtro com que foi emitido: trocar o filtro volta à primeira página. */
  private readonly pagina = linkedSignal<string, CursorPagina | undefined>({
    source: () => JSON.stringify([this.filtroOrigem(), this.filtroSituacao()]),
    computation: () => undefined,
  });

  protected readonly drawerAberto = signal(false);
  protected readonly fatoEmEdicao = signal<string | null>(null);
  /** O fato aberto só para consultar, pela ação de visualizar. */
  protected readonly somenteLeitura = signal(false);
  protected readonly salvando = signal(false);
  protected readonly erroDaCriacao = signal<string | null>(null);
  private chaveDaCriacao = idempotencyKey.create();
  private ultimaSugestao = '';

  protected readonly confirmacaoAberta = signal(false);
  protected readonly pedidoDeAtivacao = signal<PedidoDeAtivacao | null>(null);
  protected readonly ativando = signal(false);
  private readonly erroDaAtivacao = signal<string | null>(null);
  private chaveDaAtivacao = idempotencyKey.create();
  private readonly tituloDaLista = viewChild<ElementRef<HTMLElement>>('tituloDaLista');

  private readonly lista = useApiResource<readonly FatoCandidatoDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/admin/fatos-candidato`,
    params: this.montarParams(),
    context: withVendorMime('fato-candidato', 1),
  }));

  protected readonly fases = useApiResource<readonly FaseCanonicaDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/fases-canonicas`,
    params: new HttpParams().set('limit', '100'),
    context: withVendorMime('fase-canonica', 1),
  }));

  // O cursor recusado (consulta mudou ou expirou) reinicia a lista do começo: "Tentar novamente"
  // repetiria o mesmo cursor morto indefinidamente.
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

  /**
   * O catálogo de onde sai o fato de membro do agregado. Só é pedido enquanto a criação de agregado
   * está aberta, e cada abertura busca de novo: o fato de membro pode ter sido criado há pouco.
   */
  protected readonly catalogo = useApiResource<readonly FatoCandidatoView[]>(() =>
    this.drawerAberto() && this.fatoEmEdicao() === null && this.agregado()
      ? { url: `${this.basePath}/api/configuracao/fatos-candidato`, context: withVendorMime('fato-candidato', 1) }
      : undefined,
  );
  protected readonly catalogoComErro = computed(() => this.catalogo.problem() !== null || this.catalogo.error() !== undefined);
  protected readonly fatosDeMembro = computed(() => fatosDeMembroAgregaveis(this.catalogo.data() ?? []));
  protected readonly membroEscolhido = computed(
    () => this.fatosDeMembro().find((fato) => fato.codigo === this.valores().fatoDeMembro) ?? null,
  );

  protected readonly fasesCanonicas = computed(() => this.fases.data() ?? []);
  protected readonly fasesComErro = computed(() => this.fases.problem() !== null || this.fases.error() !== undefined);
  protected readonly loading = this.lista.isLoading;

  private readonly cursores = linkedSignal<
    ApiResult<readonly FatoCandidatoDto[]> | undefined,
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

  // Busca sobre a página carregada: a API filtra por origem e situação, não por texto.
  protected readonly fatosBuscados = computed(() => {
    const termo = this.termoBusca().trim().toLocaleLowerCase('pt-BR');
    const fatos = this.lista.data() ?? [];
    return termo.length === 0
      ? fatos
      : fatos.filter(
          (fato) => fato.codigo.toLocaleLowerCase('pt-BR').includes(termo) || fato.nome.toLocaleLowerCase('pt-BR').includes(termo),
        );
  });

  protected readonly errorMessage = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem && this.recuperandoDeCursorObsoleto()) return null;
    if (problem) return this.problemI18n.resolve(problem).title;
    return this.lista.error() ? 'Erro inesperado ao carregar os fatos.' : null;
  });

  protected readonly mensagemDaConfirmacao = computed(() => {
    const erro = this.erroDaAtivacao();
    if (erro !== null) return erro;
    const pedido = this.pedidoDeAtivacao();
    if (pedido === null) return '';
    return pedido.acao === 'DESATIVAR'
      ? `Deseja desativar o fato ${pedido.fato.codigo}? Formulários, exigências documentais e critérios novos deixam de ` +
          'poder citá-lo; o que já o cita continua valendo. O fato pode ser reativado depois.'
      : `Deseja reativar o fato ${pedido.fato.codigo}? Ele volta a poder ser citado por formulários, exigências ` +
          'documentais e critérios novos.';
  });

  protected readonly tituloDoDrawer = computed(() => (this.fatoEmEdicao() === null ? 'Novo fato do candidato' : 'Fato do candidato'));

  protected readonly form = new FormGroup<CriacaoForm>({
    tipo: new FormControl<TipoDeCriacao>('DECLARADO', { nonNullable: true }),
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(CODIGO_CADASTRO_TAMANHO_MAXIMO), Validators.pattern(CODIGO_CADASTRO_FORMATO)],
    }),
    nome: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    descricao: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    dominio: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    fatoDeMembro: new FormControl('', { nonNullable: true }),
    cardinalidade: new FormControl('ESCALAR', { nonNullable: true }),
    fonteValores: new FormControl('', { nonNullable: true }),
    formato: new FormControl('', { nonNullable: true }),
    escopo: new FormControl('CANDIDATO', { nonNullable: true }),
    pontoResolucao: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    classificacaoProtecao: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    finalidadeTratamento: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
    hipoteseLegal: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  private readonly valores = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  protected readonly declarado = computed(() => this.valores().tipo === 'DECLARADO');
  protected readonly agregado = computed(() => this.valores().tipo === 'AGREGADO');
  protected readonly dominiosDaCriacao = computed(() => (this.declarado() ? DOMINIOS : DOMINIOS_DO_DERIVADO));
  protected readonly temFonte = computed(() => temFonteDeValores(this.valores().dominio));
  protected readonly temFormatoDeTexto = computed(() => temFormato(this.valores().dominio));
  protected readonly classificacoesPermitidas = computed(() => classificacoesDoDominio(this.valores().dominio));
  protected readonly hipotesesPermitidas = computed(() => hipotesesDaClassificacao(this.valores().classificacaoProtecao));

  constructor() {
    this.form.controls.nome.valueChanges.pipe(takeUntilDestroyed()).subscribe((nome) => this.sugerirCodigo(nome));
    this.form.controls.codigo.valueChanges.pipe(takeUntilDestroyed()).subscribe((codigo) => this.normalizarCaixaDoCodigo(codigo));

    // A escolha que deixou de estar entre as opções (o tipo de dado depois de trocar para
    // derivado, a classificação depois de trocar o tipo de dado, a hipótese depois de trocar a
    // classificação) se esvazia: ficaria no controle, invisível, e só a API a recusaria.
    effect(() => {
      const dominios = this.dominiosDaCriacao();
      const classificacoes = this.classificacoesPermitidas();
      const hipoteses = this.hipotesesPermitidas();
      untracked(() => {
        esvaziarSeForaDas(this.form.controls.dominio, dominios);
        esvaziarSeForaDas(this.form.controls.classificacaoProtecao, classificacoes);
        esvaziarSeForaDas(this.form.controls.hipoteseLegal, hipoteses);
      });
    });

    // A fonte é obrigatória no categórico e o formato no texto — e só neles existem. O agregado
    // não escolhe o tipo de dado, que sai do fato de membro escolhido.
    effect(() => {
      const exigeFonte = this.declarado() && this.temFonte();
      const exigeFormato = this.declarado() && this.temFormatoDeTexto();
      const agregado = this.agregado();
      untracked(() => {
        exigirSe(this.form.controls.fonteValores, exigeFonte);
        exigirSe(this.form.controls.formato, exigeFormato);
        exigirSe(this.form.controls.dominio, !agregado);
        exigirSe(this.form.controls.fatoDeMembro, agregado);
      });
    });

    effect(() => {
      const problem = this.lista.problem();
      if (problem && problem.status >= 500) {
        const titulo = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title: titulo }));
      }
    });
  }

  protected abrirCriacao(): void {
    this.fatoEmEdicao.set(null);
    this.somenteLeitura.set(false);
    this.form.reset();
    this.ultimaSugestao = '';
    this.erroDaCriacao.set(null);
    this.chaveDaCriacao = idempotencyKey.create();
    this.drawerAberto.set(true);
  }

  protected abrirEdicao(id: string, somenteLeitura = false): void {
    this.fatoEmEdicao.set(id);
    this.somenteLeitura.set(somenteLeitura);
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
    const identificacao = {
      codigo: v.codigo.trim(),
      nome: v.nome.trim(),
      descricao: v.descricao.trim() || null,
      pontoResolucao: v.pontoResolucao,
      classificacaoProtecao: v.classificacaoProtecao,
      finalidadeTratamento: v.finalidadeTratamento.trim(),
      hipoteseLegal: v.hipoteseLegal,
    };
    const comum = { ...identificacao, dominio: v.dominio, escopo: v.escopo };
    const contexto = withIdempotencyKey(this.chaveDaCriacao);
    // O agregado não manda tipo de dado nem escopo: os dois saem do fato de membro na API.
    const escrita =
      v.tipo === 'AGREGADO'
        ? this.api.criarAgregado({ ...identificacao, fatoDeMembro: v.fatoDeMembro }, contexto)
        : v.tipo === 'DECLARADO'
          ? this.api.criar(
              {
                ...comum,
                cardinalidade: v.cardinalidade,
                fonteValores: temFonteDeValores(v.dominio) ? v.fonteValores : null,
                formato: temFormato(v.dominio) ? v.formato : null,
              },
              contexto,
            )
          : this.api.criarDerivado(comum, contexto);

    escrita.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((resultado) => {
      this.salvando.set(false);
      if (resultado.ok) {
        this.chaveDaCriacao = idempotencyKey.create();
        this.notifications.success('Fato criado', v.codigo);
        this.recarregar();
        // A edição abre em seguida: o derivado categórico recebe os valores e depois as regras.
        this.fatoEmEdicao.set(resultado.data);
        return;
      }
      this.aplicarFalha(resultado.problem);
    });
  }

  protected pedirAtivacao(fato: FatoCandidatoDto, acao: AcaoDeAtivacao): void {
    this.pedidoDeAtivacao.set({ fato, acao });
    this.erroDaAtivacao.set(null);
    this.chaveDaAtivacao = idempotencyKey.create();
    this.confirmacaoAberta.set(true);
  }

  /**
   * Desativa ou reativa o fato confirmado. No sucesso o foco vai ao título da lista: a linha do fato
   * pode sair dela pelo filtro de situação, e o botão que tinha o foco sumiria junto. Na recusa o
   * diálogo reabre com a mensagem da API — o fato pode ter mudado em outra sessão.
   */
  protected confirmarAtivacao(): void {
    const pedido = this.pedidoDeAtivacao();
    if (pedido === null || this.ativando()) return;
    this.ativando.set(true);
    const { fato, acao } = pedido;
    const escrita =
      acao === 'DESATIVAR' ? this.api.desativar(fato.id) : this.api.ativar(fato.id, withIdempotencyKey(this.chaveDaAtivacao));
    escrita.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((resultado) => {
      this.ativando.set(false);
      if (resultado.ok) {
        this.notifications.success(acao === 'DESATIVAR' ? 'Fato desativado' : 'Fato reativado', fato.codigo);
        this.pedidoDeAtivacao.set(null);
        this.recarregar();
        this.tituloDaLista()?.nativeElement.focus();
        return;
      }
      if (deveRotacionarIdempotencyKey(resultado.problem)) {
        this.chaveDaAtivacao = idempotencyKey.create();
      }
      const titulo = this.problemI18n.resolve(resultado.problem).title;
      this.erroDaAtivacao.set(titulo);
      this.confirmacaoAberta.set(true);
      if (resultado.problem.status >= 500) this.notifications.errorFromProblem(resultado.problem, { title: titulo });
    });
  }

  protected nomeDaFase(codigo: string): string {
    return this.fasesCanonicas().find((fase) => fase.codigo === codigo)?.nome ?? codigo;
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

  protected recarregar(): void {
    if (this.pagina() === undefined) {
      this.lista.reload();
    } else {
      this.pagina.set(undefined);
    }
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

  private montarParams(): HttpParams {
    let params = new HttpParams();
    const origem = this.filtroOrigem();
    const situacao = this.filtroSituacao();
    if (origem !== '') params = params.set('origem', origem);
    if (situacao !== '') params = params.set('ativo', situacao);
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
        if (campo in this.form.controls && campo !== 'tipo') {
          this.marcarCampo(campo as CampoDaCriacao, erro.message);
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

  /**
   * A API só aceita código em caixa alta. O modelo é normalizado sem reescrever a vista, para não
   * mover o cursor; a caixa alta na tela é do estilo do campo.
   */
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

function esvaziarSeForaDas(controle: FormControl<string>, opcoes: readonly OpcaoDeVocabulario[]): void {
  if (controle.value !== '' && !opcoes.some((opcao) => opcao.valor === controle.value)) {
    controle.setValue('');
  }
}

function exigirSe(controle: FormControl<string>, exigido: boolean): void {
  if (exigido) {
    controle.addValidators(Validators.required);
  } else {
    controle.removeValidators(Validators.required);
    controle.setValue('', { emitEvent: false });
  }
  controle.updateValueAndValidity({ emitEvent: false });
}
