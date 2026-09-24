import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  Signal,
  afterNextRender,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, expand, forkJoin, map } from 'rxjs';

import {
  ApiResult,
  ProblemDetails,
  ProblemI18nService,
  cursorToString,
  deveRotacionarIdempotencyKey,
  extractNextCursor,
  idempotencyKey,
  withIdempotencyKey,
  STATUS_HTTP,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AreaPesoAreaEnemDto,
  AtualizarPesoAreaEnemCommand,
  CriarPesoAreaEnemCommand,
  PesoAreaEnemAreaCommand,
  PesoAreaEnemAreaDto,
  PesoAreaEnemDto,
  PesosEnemApi,
  type GrupoAreaEnemDto,
} from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  ConfirmDialogComponent,
  DrawerComponent,
  EmptyStateComponent,
  SkeletonComponent,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';

import { AlertaNovaTentativaComponent } from '../../shared/alerta-nova-tentativa';
import { focarAposNovaTentativa } from '../../shared/foco';
import { controlNameFromBackendField, nullIfBlank } from '../../shared/formulario';
import { CatalogoGruposAreaEnem } from '../../shared/grupos-area-enem';
import { listaDeReferencia, motivoDaFalha } from '../../shared/lista-de-referencia';
import { NumeroDigitadoValidoDirective } from './numero-digitado-valido.directive';

/** Tetos espelhando `PesoAreaEnem.PesoMaximo`/`CorteMaximo` no backend — evita
 *  422 surpresa por overflow das colunas `numeric(4,2)`/`numeric(7,3)`. */
const PESO_MAXIMO = 99.99;
const CORTE_MAXIMO = 1000;
/** Casas decimais que as colunas guardam: peso `numeric(4,2)`, corte `numeric(7,3)`. */
const CASAS_PESO = 2;
const CASAS_CORTE = 3;

/** Tamanho de página ao esgotar o cursor (ADR-0015/0026) — ver `carregar()`. */
const PAGE_SIZE = 100;
/** Teto defensivo de páginas seguidas via `Link: rel="next"` — evita loop
 *  infinito caso o backend devolva um cursor que nunca esgota. */
const MAX_PAGINAS = 50;

const PAR_JA_EXISTE_CODE = 'uniplus.configuracao.peso_area_enem.par_ja_existe';

/** Campo editável de uma área: o peso (obrigatório) e o corte (opcional). */
type CampoDaArea = 'peso' | 'corte';

/** Uma área dentro de um grupo: o código identifica a área (fixo, vindo da API);
 *  o operador edita só peso e corte. */
interface AreaForm {
  codigo: FormControl<string>;
  peso: FormControl<number>;
  corte: FormControl<number | null>;
}

/** O grupo não é editável: o controle carrega código (enviado na criação) e rótulo
 *  (exibido), como a API os devolve. */
interface PesoGrupoForm {
  grupoCurso: FormControl<GrupoAreaEnemDto>;
  areas: FormArray<FormGroup<AreaForm>>;
  baseLegal: FormControl<string>;
}

interface PesoLoteForm {
  resolucao: FormControl<string>;
  baseLegalGlobal: FormControl<string>;
  grupos: FormArray<FormGroup<PesoGrupoForm>>;
}

interface PesoEdicaoGrupoForm {
  id: FormControl<string>;
  grupoCurso: FormControl<GrupoAreaEnemDto>;
  areas: FormArray<FormGroup<AreaForm>>;
  baseLegal: FormControl<string>;
}

type EstadoOperacao = 'ok' | 'erro';

/** Campos de primeiro nível do pedido que o operador corrige no contexto atual. O
 *  que falta aqui não tem campo visível — e o grupo nunca tem, porque não se edita —:
 *  o erro dele vai para o banner da operação. */
interface DestinosDePrimeiroNivel {
  readonly resolucao?: AbstractControl;
  readonly baseLegal?: AbstractControl;
}

const CAMPOS_DE_PRIMEIRO_NIVEL: ReadonlySet<keyof DestinosDePrimeiroNivel> = new Set([
  'resolucao',
  'baseLegal',
]);

@Component({
  selector: 'cfg-pesos-enem-page',
  standalone: true,
  imports: [
    AlertComponent,
    AlertaNovaTentativaComponent,
    ConfirmDialogComponent,
    DrawerComponent,
    EmptyStateComponent,
    NumeroDigitadoValidoDirective,
    ReactiveFormsModule,
    SkeletonComponent,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title" id="cfg-pesos-enem-titulo" tabindex="-1">Peso por Área</h1>
        <p class="page-header__desc">
          Pesos das áreas do ENEM por grupo de curso, versionados por resolução do Consepe.
        </p>
      </div>
      @if (!isLoading() && resolucoes().length === 0) {
        <div class="page-header__actions">
          <button
            type="button"
            class="btn btn--primary"
            [disabled]="submitting() || !podeCadastrar()"
            (click)="abrirDrawerCriacao()"
          >
            <i class="pi pi-plus btn__icon" aria-hidden="true"></i>
            Cadastrar nova resolução
          </button>
        </div>
      }
    </div>

    <ui-alert variant="info" heading="Chave composta: resolução + grupo de curso" [dynamic]="false">
      Cada linha representa um grupo de curso de uma resolução do Consepe. Os pesos das áreas são
      definidos pela instituição em cada processo seletivo — não há soma fixa; o sistema registra os valores
      informados sem bloquear. O corte de uma área é a nota mínima exigida nela: é opcional e não entra em
      cálculo de soma. Por enquanto, só a Redação aceita corte. Estes parâmetros também são congelados por
      processo seletivo.
    </ui-alert>

    <!-- Um alerta e um "Tentar novamente" por lista. -->
    @if (listaAreas.falhou()) {
      <cfg-alerta-nova-tentativa
        titulo="Não foi possível carregar as áreas do ENEM"
        [mensagem]="motivoFalhaAreas() ?? 'A lista de áreas do ENEM não foi carregada.'"
        [pendente]="listaAreas.pendente()"
        idBotao="cfg-pesos-enem-areas-tentar"
        (tentar)="tentarCarregarAreas()"
      />
    }

    @if (catalogoGrupos.falhou()) {
      <cfg-alerta-nova-tentativa
        titulo="Não foi possível carregar os grupos de área do ENEM"
        [mensagem]="motivoFalhaGrupos() ?? 'A lista de grupos de área do ENEM não foi carregada.'"
        [pendente]="catalogoGrupos.pendente()"
        idBotao="cfg-pesos-enem-grupos-tentar"
        (tentar)="tentarCarregarGrupos()"
      />
    }

    @if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar os pesos do ENEM">
        {{ errorMessage() }}
        <div class="cfg-list__retry">
          <button
            type="button"
            class="btn btn--secondary btn--sm"
            [disabled]="isLoading()"
            (click)="tentarNovamente()"
          >
            Tentar novamente
          </button>
        </div>
      </ui-alert>
    }

    @if (estadoDaTabela() === 'carregando') {
      <ui-skeleton skeletonKind="card" blockSize="10rem" />
      <ui-skeleton skeletonKind="card" blockSize="10rem" />
    }

    @for (resolucao of resolucoesExibiveis(); track resolucao; let first = $first) {
      <section class="panel" [attr.aria-labelledby]="'cfg-pesos-enem-title-' + slug(resolucao)">
        <div class="panel-head">
          <div class="panel-head__title">
            <h2 [id]="'cfg-pesos-enem-title-' + slug(resolucao)">Pesos — {{ resolucao }}</h2>
            <ui-tag [variant]="first ? 'success' : 'neutral'">
              {{ first ? 'Vigente' : 'Anterior' }}
            </ui-tag>
          </div>
          <div class="button-actions">
            @if (first) {
              <button
                class="btn btn--secondary btn--sm"
                type="button"
                [disabled]="submitting() || !podeCadastrar()"
                (click)="abrirDrawerCriacao()"
              >
                Cadastrar nova resolução
              </button>
            }
            <button
              class="btn btn--primary btn--sm"
              type="button"
              [id]="'pe-editar-' + slug(resolucao)"
              [attr.aria-expanded]="editandoResolucao() === resolucao"
              [disabled]="salvandoEdicao()"
              (click)="clicarEditarParametros(resolucao)"
            >
              <i aria-hidden="true" class="pi pi-pen-to-square btn__icon"></i>
              Editar parâmetros
            </button>
            <button
              class="btn btn--tertiary btn--sm"
              type="button"
              [attr.aria-label]="'Inativar ' + resolucao"
              (click)="pedirInativacao(resolucao)"
            >
              Inativar resolução
            </button>
          </div>
        </div>

        <div
          class="num-grid pe-grid"
          tabindex="-1"
          [style.--pe-colunas]="areas().length"
          [class.is-editing]="editandoResolucao() === resolucao"
          [attr.aria-label]="'Pesos do ENEM — ' + resolucao"
          (keydown.escape)="editandoResolucao() === resolucao && cancelarEdicao()"
        >
          <div class="num-grid__header" aria-hidden="true">
            <div class="num-cell">Grupo de curso</div>
            @for (area of areas(); track area.codigo) {
              <div class="num-cell num-cell--head">{{ area.rotulo }}</div>
            }
          </div>

          @if (editandoResolucao() === resolucao && editForm(); as form) {
            @for (grupo of form.controls; track grupo.controls.id.value; let gi = $index) {
              <div class="num-grid__row">
                <div>
                  <strong class="cell-label--group-label">{{
                    grupo.controls.grupoCurso.value.rotulo
                  }}</strong>
                  <span class="field__hint">Chave composta — não editável</span>
                  @if (estadoLinhasEdicao().get(grupo.controls.id.value) === 'ok') {
                    <ui-tag variant="success">Salvo</ui-tag>
                  }
                </div>
                @for (
                  area of grupo.controls.areas.controls;
                  track area.controls.codigo.value;
                  let ai = $index
                ) {
                  @let idPeso = idCampo(resolucao, gi, ai, 'peso');
                  @let idCorte = idCampo(resolucao, gi, ai, 'corte');
                  @let erroPeso = erroDaArea(area, 'peso');
                  @let erroCorte = erroDaArea(area, 'corte');
                  @let sufixo = sufixoDoRotulo(area.controls.codigo.value, grupo.controls.grupoCurso.value.rotulo);
                  <div class="num-cell" [formGroup]="area">
                    <span class="pe-cell-rotulo" aria-hidden="true">{{
                      rotuloDaArea(area.controls.codigo.value)
                    }}</span>
                    <!-- Rótulo visível curto; o restante do nome acessível (área e grupo)
                         fica só para o leitor de tela e continua o texto visível. -->
                    <label class="pe-campo-rotulo" [for]="idPeso">
                      Peso<span class="sr-only">{{ sufixo }}</span>
                    </label>
                    <input
                      [id]="idPeso"
                      class="num-input"
                      type="number"
                      min="0"
                      [attr.max]="PESO_MAXIMO"
                      step="0.05"
                      formControlName="peso"
                      cfgNumeroDigitadoValido
                      [attr.aria-describedby]="descritoPor(erroPeso ? idPeso + '-erro' : null)"
                      [attr.aria-invalid]="erroPeso ? 'true' : null"
                    />
                    @if (erroPeso) {
                      <span class="field__error" role="alert" [id]="idPeso + '-erro'">{{ erroPeso }}</span>
                    }
                    <label class="pe-campo-rotulo" [for]="idCorte">
                      Corte<span class="sr-only">{{ sufixo }}</span>
                    </label>
                    <input
                      [id]="idCorte"
                      class="num-input"
                      type="number"
                      min="0"
                      [attr.max]="CORTE_MAXIMO"
                      step="10"
                      placeholder="Sem corte"
                      formControlName="corte"
                      cfgNumeroDigitadoValido
                      [attr.aria-describedby]="descritoPor(idCorte + '-dica', erroCorte ? idCorte + '-erro' : null)"
                      [attr.aria-invalid]="erroCorte ? 'true' : null"
                    />
                    <span class="sr-only" [id]="idCorte + '-dica'">
                      Opcional — em branco, a área fica sem corte.
                    </span>
                    @if (erroCorte) {
                      <span class="field__error" role="alert" [id]="idCorte + '-erro'">{{ erroCorte }}</span>
                    }
                  </div>
                }
              </div>
            }
            <div class="grid-editbar" id="grid-pe-bar">
              @if (editErro()) {
                <!-- Região viva (role="alert"): recusas sem campo na tela só aparecem aqui. -->
                <ui-alert variant="danger" heading="Não foi possível salvar todos os grupos">
                  {{ editErro() }}
                </ui-alert>
              }
              <button
                class="btn btn--secondary"
                type="button"
                [disabled]="salvandoEdicao()"
                (click)="cancelarEdicao()"
              >
                Cancelar
              </button>
              <button
                class="btn btn--primary"
                type="button"
                [disabled]="salvandoEdicao()"
                (click)="salvarEdicao()"
              >
                @if (salvandoEdicao()) {
                  <ui-spinner size="sm" />
                  Salvando...
                } @else {
                  Salvar
                }
              </button>
            </div>
          } @else {
            @for (linha of linhasDaResolucao(resolucao); track linha.id; let gi = $index) {
              <div class="num-grid__row">
                <div>
                  <strong class="cell-label--group-label">{{ linha.grupoCurso.rotulo }}</strong>
                </div>
                @for (area of areas(); track area.codigo; let ai = $index) {
                  @let valor = valorDaArea(linha, area.codigo);
                  @let corte = corteExibido(valor);
                  @let idLeitura = idCampoLeitura(resolucao, gi, ai);
                  <div class="num-cell">
                    <span class="pe-cell-rotulo" aria-hidden="true">{{ area.rotulo }}</span>
                    <label class="sr-only" [for]="idLeitura">
                      {{ rotuloDoCampo('peso', area.codigo, linha.grupoCurso.rotulo) }}
                    </label>
                    <!-- O corte é anunciado junto do peso: fica ligado ao campo como descrição. -->
                    <input
                      [id]="idLeitura"
                      class="num-input"
                      type="number"
                      [value]="valor?.peso"
                      [attr.aria-describedby]="corte !== null ? idLeitura + '-corte' : null"
                      readonly
                    />
                    @if (corte !== null) {
                      <span class="pe-corte" [id]="idLeitura + '-corte'">
                        Corte: {{ corte }}
                      </span>
                    }
                  </div>
                }
              </div>
            }
          }

          <p class="grid-note">
            Os pesos das áreas são definidos pela instituição em cada processo seletivo — não há soma fixa; o
            sistema registra os valores informados sem bloquear. O corte de uma área é a nota mínima
            exigida nela: aparece abaixo do peso quando existe e não entra em cálculo de soma.
          </p>
        </div>
      </section>
    } @empty {
      @if (estadoDaTabela() === 'vazia') {
        <ui-empty-state
          heading="Nenhuma resolução cadastrada"
          description="Cadastre a primeira resolução de pesos do ENEM por grupo de curso."
        >
          <button
            type="button"
            class="btn btn--primary"
            [disabled]="submitting() || !podeCadastrar()"
            (click)="abrirDrawerCriacao()"
          >
            Cadastrar nova resolução
          </button>
        </ui-empty-state>
      }
    }

    <ui-confirm-dialog
      [(visible)]="confirmInativarAberto"
      heading="Inativar resolução?"
      [message]="confirmInativarMensagem()"
      confirmLabel="Confirmar inativação"
      confirmVariant="danger"
      (confirmed)="confirmarInativacao()"
    />

    <ui-drawer
      class="cfg-form-drawer"
      [(visible)]="drawerAberto"
      heading="Cadastrar nova resolução"
      ariaLabel="Formulário de nova resolução de pesos do ENEM"
      position="right"
      (closed)="aoFecharDrawerCriacao()"
    >
      @if (submitError()) {
        <ui-alert variant="danger" heading="Não foi possível salvar">
          {{ submitError() }}
        </ui-alert>
      }

      <form
        [formGroup]="pesoLoteForm"
        id="cfg-pesos-enem-form"
        (ngSubmit)="criarResolucao()"
        novalidate
        class="cfg-form"
      >
        <div class="form-grid">
          <label class="field field--full" [class.is-error]="erroDoCampoLote('resolucao')">
            <span class="field__label is-required">Número/ano da resolução</span>
            <input
              class="input"
              type="text"
              placeholder="Ex.: Res. 805/2024"
              formControlName="resolucao"
              [attr.aria-invalid]="erroDoCampoLote('resolucao') ? 'true' : null"
            />
            <span class="field__hint">
              Identificador da resolução do Consepe. Parte da chave composta — não pode ser alterado após
              a criação.
            </span>
            @if (erroDoCampoLote('resolucao')) {
              <span class="field__error" role="alert">{{ erroDoCampoLote('resolucao') }}</span>
            }
          </label>
          <label class="field field--full" [class.is-error]="erroDoCampoLote('baseLegalGlobal')">
            <span class="field__label is-required">Base legal (padrão para todos os grupos)</span>
            <input
              class="input"
              type="text"
              placeholder="Ex.: Res. 805/2024 Anexo I"
              formControlName="baseLegalGlobal"
              [attr.aria-invalid]="erroDoCampoLote('baseLegalGlobal') ? 'true' : null"
            />
            <span class="field__hint">
              Aplicada a todos os grupos como valor pré-preenchido — cada grupo permanece editável.
            </span>
            @if (erroDoCampoLote('baseLegalGlobal')) {
              <span class="field__error" role="alert">{{
                erroDoCampoLote('baseLegalGlobal')
              }}</span>
            }
          </label>
        </div>

        <div formArrayName="grupos">
          @for (grupo of pesoLoteForm.controls.grupos.controls; track grupo; let gi = $index) {
            <fieldset
              [formGroupName]="gi"
              class="pe-drawer-grupo"
              [disabled]="estadoGruposCriacao().get(gi) === 'ok'"
            >
              <legend>
                {{ grupo.controls.grupoCurso.value.rotulo }}
                @if (estadoGruposCriacao().get(gi) === 'ok') {
                  <ui-tag variant="success">Criado</ui-tag>
                }
              </legend>
              <div class="form-grid">
                @for (
                  area of grupo.controls.areas.controls;
                  track area.controls.codigo.value;
                  let ai = $index
                ) {
                  @let rotulo = rotuloDaArea(area.controls.codigo.value);
                  @let erroPeso = erroDaArea(area, 'peso');
                  @let erroCorte = erroDaArea(area, 'corte');
                  @let idPesoErro = idDrawer(gi, ai, 'peso-erro');
                  @let idCorteDica = idDrawer(gi, ai, 'corte-dica');
                  @let idCorteErro = idDrawer(gi, ai, 'corte-erro');
                  <label class="field" [formGroup]="area">
                    <span class="field__label is-required">Peso de {{ rotulo }}</span>
                    <input
                      class="input"
                      type="number"
                      min="0"
                      [attr.max]="PESO_MAXIMO"
                      step="0.05"
                      formControlName="peso"
                      cfgNumeroDigitadoValido
                      [attr.aria-label]="rotuloDoCampo('peso', area.controls.codigo.value, grupo.controls.grupoCurso.value.rotulo)"
                      [attr.aria-describedby]="descritoPor(erroPeso ? idPesoErro : null)"
                      [attr.aria-invalid]="erroPeso ? 'true' : null"
                    />
                    @if (erroPeso) {
                      <span class="field__error" role="alert" [id]="idPesoErro">{{ erroPeso }}</span>
                    }
                  </label>
                  <label class="field" [formGroup]="area">
                    <span class="field__label">Corte de {{ rotulo }}</span>
                    <input
                      class="input"
                      type="number"
                      min="0"
                      [attr.max]="CORTE_MAXIMO"
                      step="10"
                      placeholder="Sem corte"
                      formControlName="corte"
                      cfgNumeroDigitadoValido
                      [attr.aria-label]="rotuloDoCampo('corte', area.controls.codigo.value, grupo.controls.grupoCurso.value.rotulo)"
                      [attr.aria-describedby]="descritoPor(idCorteDica, erroCorte ? idCorteErro : null)"
                      [attr.aria-invalid]="erroCorte ? 'true' : null"
                    />
                    <span class="field__hint" [id]="idCorteDica">
                      Opcional — em branco, a área fica sem corte.
                    </span>
                    @if (erroCorte) {
                      <span class="field__error" role="alert" [id]="idCorteErro">{{ erroCorte }}</span>
                    }
                  </label>
                }
                <label class="field field--full">
                  <span class="field__label is-required">Base legal</span>
                  <input class="input" type="text" formControlName="baseLegal" />
                  @if (erroDoCampoGrupo(gi, 'baseLegal'); as erro) {
                    <span class="field__error" role="alert">{{ erro }}</span>
                  }
                </label>
              </div>
            </fieldset>
          }
        </div>
      </form>
      <div class="cfg-form-footer">
        <button type="button" class="btn btn--secondary" (click)="drawerAberto.set(false)">
          Cancelar
        </button>
        <button
          type="submit"
          form="cfg-pesos-enem-form"
          class="btn btn--primary"
          [disabled]="submitting()"
        >
          @if (submitting()) {
            <ui-spinner size="sm" />
            Salvando...
          } @else {
            Criar resolução
          }
        </button>
      </div>
    </ui-drawer>
  `,
  styles: '.button-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }',
})
export class PesosEnemPage {
  protected readonly PESO_MAXIMO = PESO_MAXIMO;
  protected readonly CORTE_MAXIMO = CORTE_MAXIMO;

  private readonly api = inject(PesosEnemApi);
  protected readonly catalogoGrupos = inject(CatalogoGruposAreaEnem);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  /** As áreas do cadastro, na ordem canônica, vindas da API — a fonte das colunas da
   *  tabela e dos campos dos formulários. Nenhuma lista de áreas é escrita no cliente.
   *  Carga, falha e nova tentativa seguem `listaDeReferencia`, como os grupos. */
  protected readonly listaAreas = listaDeReferencia<AreaPesoAreaEnemDto>(
    () => this.api.listarAreas(),
    this.destroyRef,
  );
  protected readonly areas: Signal<readonly AreaPesoAreaEnemDto[]> = this.listaAreas.opcoes;
  protected readonly motivoFalhaAreas = motivoDaFalha(this.listaAreas);
  /** Os grupos de área do ENEM, na ordem da API — a fonte dos grupos do cadastro e da
   *  ordem das linhas de cada resolução. Nenhuma lista de grupos é escrita no cliente. */
  protected readonly grupos: Signal<readonly GrupoAreaEnemDto[]> = this.catalogoGrupos.opcoes;
  protected readonly motivoFalhaGrupos = motivoDaFalha(this.catalogoGrupos);
  /** "Tentar novamente" de cada lista: a guarda é o pendente dela, o mesmo do
   *  `aria-disabled` do botão. Quando a lista chega, o foco passa ao título da página. */
  private readonly novaTentativaDasAreas = focarAposNovaTentativa(
    this.listaAreas.pendente,
    this.listaAreas.falhou,
    () => document.getElementById('cfg-pesos-enem-titulo'),
  );
  private readonly novaTentativaDosGrupos = focarAposNovaTentativa(
    this.catalogoGrupos.pendente,
    this.catalogoGrupos.falhou,
    () => document.getElementById('cfg-pesos-enem-titulo'),
  );
  /** O cadastro de nova resolução monta um grupo por item da lista de grupos e uma área
   *  por item da lista de áreas: sem as duas, ele não abre. */
  protected readonly podeCadastrar = computed(
    () => this.areas().length > 0 && this.grupos().length > 0,
  );
  private readonly rotuloPorCodigo = computed(
    () => new Map(this.areas().map((area) => [area.codigo, area.rotulo])),
  );
  /** Ordem dos grupos, congelada enquanto há edição em linha aberta: a lista que chega
   *  no meio da edição não reordena a leitura das outras resoluções nem deixa a edição
   *  numa ordem diferente da leitura. Ao fechar a edição, a ordem nova vale para todas. */
  private readonly ordemDaLista = computed<ReadonlyMap<string, number>>(
    () => new Map(this.grupos().map((grupo, indice) => [grupo.codigo, indice])),
  );
  private readonly ordemDosGrupos = linkedSignal<
    { readonly ordem: ReadonlyMap<string, number>; readonly editando: boolean },
    ReadonlyMap<string, number>
  >({
    source: () => ({ ordem: this.ordemDaLista(), editando: this.editandoResolucao() !== null }),
    computation: (estado, anterior) =>
      estado.editando && anterior !== undefined ? anterior.value : estado.ordem,
  });

  protected readonly registros = signal<readonly PesoAreaEnemDto[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  /** Linhas de cada resolução, na ordem dos grupos da API — a mesma na leitura e na
   *  edição, para entrar em edição não reordenar as linhas na tela. */
  protected readonly porResolucao = computed(() =>
    agruparPorResolucao(this.registros(), this.ordemDosGrupos()),
  );
  protected readonly resolucoes = computed(() =>
    [...this.porResolucao().entries()]
      .sort(([resolucaoA, linhasA], [resolucaoB, linhasB]) => {
        const diff = maxCriadoEm(linhasB) - maxCriadoEm(linhasA);
        return diff !== 0 ? diff : resolucaoB.localeCompare(resolucaoA, 'pt-BR');
      })
      .map(([resolucao]) => resolucao),
  );
  /** Sem as áreas não há colunas: a tabela espera por elas. A lista de grupos só ordena
   *  as linhas, que já trazem o rótulo do grupo: a tabela espera por ela na primeira
   *  carga, para não reordenar as linhas na tela, mas não quando falha — aí as linhas
   *  aparecem na ordem da API, e só o cadastro fica bloqueado. Resolvida uma vez nesta
   *  tela, a espera acaba: uma recarga dos grupos depois disso (a nova tentativa do
   *  operador, uma recarga automática) não esconde a tabela, o que desmontaria a edição
   *  em linha aberta com o que o operador já digitou. */
  private readonly gruposResolvidos = signal(false);
  protected readonly resolucoesExibiveis = computed(() =>
    this.areas().length > 0 && this.gruposResolvidos() ? this.resolucoes() : [],
  );
  /** O que a área da tabela mostra quando não há resolução a exibir. */
  protected readonly estadoDaTabela = computed<'pronta' | 'carregando' | 'erro' | 'vazia'>(() => {
    if (this.resolucoesExibiveis().length > 0) {
      return 'pronta';
    }
    if (this.isLoading() || this.listaAreas.pendente() || this.catalogoGrupos.pendente()) {
      return 'carregando';
    }
    if (this.errorMessage() !== null || this.listaAreas.falhou() || this.catalogoGrupos.falhou()) {
      return 'erro';
    }
    return 'vazia';
  });

  // --- Edição in-line ---------------------------------------------------
  protected readonly editandoResolucao = signal<string | null>(null);
  protected readonly editForm = signal<FormArray<FormGroup<PesoEdicaoGrupoForm>> | null>(null);
  protected readonly editErro = signal<string | null>(null);
  protected readonly salvandoEdicao = signal(false);
  protected readonly estadoLinhasEdicao = signal<ReadonlyMap<string, EstadoOperacao>>(new Map());
  private readonly idempotencyKeysEdicao = signal<ReadonlyMap<string, string>>(new Map());
  /** Último corpo (JSON) efetivamente enviado por linha — usado para
   *  decidir se a Idempotency-Key pode ser reaproveitada num retry (só
   *  quando o corpo não mudou desde a última tentativa). */
  private readonly ultimoPayloadEdicao = signal<ReadonlyMap<string, string>>(new Map());

  // --- Drawer de criação --------------------------------------------------
  protected readonly drawerAberto = signal(false);
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly estadoGruposCriacao = signal<ReadonlyMap<number, EstadoOperacao>>(new Map());
  private readonly idempotencyKeysCriacao = signal<ReadonlyMap<number, string>>(new Map());
  /** Último corpo (JSON) efetivamente enviado por grupo — usado para
   *  decidir se a Idempotency-Key pode ser reaproveitada num retry (só
   *  quando o corpo não mudou desde a última tentativa). */
  private readonly ultimoPayloadCriacao = signal<ReadonlyMap<number, string>>(new Map());

  protected readonly pesoLoteForm: FormGroup<PesoLoteForm> = new FormGroup<PesoLoteForm>({
    resolucao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(1), Validators.maxLength(40)],
    }),
    baseLegalGlobal: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(1), Validators.maxLength(500)],
    }),
    // Os grupos e as áreas de cada um só são montados ao abrir o drawer, quando as
    // listas da API já chegaram.
    grupos: new FormArray<FormGroup<PesoGrupoForm>>([]),
  });

  // --- Inativação -----------------------------------------------------
  protected readonly confirmInativarAberto = signal(false);
  protected readonly resolucaoParaInativar = signal<string | null>(null);
  protected readonly confirmInativarMensagem = computed(() => {
    const resolucao = this.resolucaoParaInativar();
    return resolucao === null
      ? 'Deseja inativar esta resolução?'
      : `Você está prestes a inativar a resolução "${resolucao}" e os pesos de todos os seus grupos ` +
          'de curso. A inativação é uma remoção lógica (soft-delete): o registro permanece para ' +
          'auditoria e o identificador pode ser reutilizado. Editais publicados congelam os ' +
          'pesos por valor no snapshot de classificação — a inativação não altera o que já foi ' +
          'congelado nem é bloqueada por processos que a referenciaram.';
  });

  constructor() {
    this.pesoLoteForm.controls.baseLegalGlobal.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((valor) => {
        this.pesoLoteForm.controls.grupos.controls.forEach((grupo, index) => {
          // Pula grupo já criado ('ok', desabilitado): ele não entra mais no
          // próximo POST, então propagar o valor global faria o card
          // "Criado" mostrar uma base legal que nunca foi enviada ao
          // backend — a linha real fica com o valor antigo.
          if (this.estadoGruposCriacao().get(index) === 'ok') {
            return;
          }
          if (grupo.controls.baseLegal.pristine) {
            grupo.controls.baseLegal.setValue(valor, { emitEvent: false });
          }
        });
      });
    this.catalogoGrupos.garantirCarregado();
    this.listaAreas.garantirCarregado();
    this.carregar();
    effect(() => {
      if (this.grupos().length > 0 || !this.catalogoGrupos.pendente()) {
        untracked(() => this.gruposResolvidos.set(true));
      }
    });
  }

  protected slug(valor: string): string {
    return slug(valor);
  }

  /** Id de um campo editável da edição em linha. */
  protected idCampo(resolucao: string, grupo: number, area: number, campo: CampoDaArea): string {
    return `pe-${slug(resolucao)}-g${grupo}-a${area}-${campo}`;
  }

  /** Id de um elemento de apoio (dica, erro) de uma área no drawer de criação. */
  protected idDrawer(grupo: number, area: number, sufixo: string): string {
    return `pe-drawer-g${grupo}-a${area}-${sufixo}`;
  }

  /** Valor de `aria-describedby`: os ids presentes, ou nenhum atributo. */
  protected descritoPor(...ids: readonly (string | null)[]): string | null {
    const presentes = ids.filter((id): id is string => id !== null);
    return presentes.length > 0 ? presentes.join(' ') : null;
  }

  /** Id do campo somente leitura: distinto do da edição, para o foco ao abrir a
   *  edição nunca cair no input que está saindo da tela. */
  protected idCampoLeitura(resolucao: string, grupo: number, area: number): string {
    return `pe-${slug(resolucao)}-g${grupo}-a${area}-leitura`;
  }

  protected rotuloDaArea(codigo: string): string {
    return this.rotuloPorCodigo().get(codigo) ?? codigo;
  }

  /** Nome acessível completo do campo: área e grupo, para quem navega campo a campo
   *  sem ver o cabeçalho da coluna (ex.: "Peso de Matemática e suas Tecnologias —
   *  Tecnológica"). */
  protected rotuloDoCampo(campo: CampoDaArea, codigo: string, grupo: string): string {
    return `${campo === 'peso' ? 'Peso' : 'Corte'}${this.sufixoDoRotulo(codigo, grupo)}`;
  }

  /** O que segue "Peso"/"Corte" no nome acessível — oculto na tela, onde o rótulo
   *  visível é curto e a área e o grupo já aparecem no cabeçalho e na linha. */
  protected sufixoDoRotulo(codigo: string, grupo: string): string {
    return ` de ${this.rotuloDaArea(codigo)} — ${grupo}`;
  }

  protected linhasDaResolucao(resolucao: string): readonly PesoAreaEnemDto[] {
    return this.porResolucao().get(resolucao) ?? [];
  }

  protected valorDaArea(linha: PesoAreaEnemDto, codigo: string): PesoAreaEnemAreaDto | undefined {
    return linha.areas.find((area) => area.codigo === codigo);
  }

  /** O corte da área como texto em pt-BR, ou `null` quando a área não tem corte (o
   *  zero é corte válido e aparece). */
  protected corteExibido(valor: PesoAreaEnemAreaDto | undefined): string | null {
    const corte = corteComoNumero(valor?.corte);
    return corte === null ? null : formatarNumero(corte);
  }

  protected tentarNovamente(): void {
    if (!this.isLoading()) {
      this.carregar();
    }
  }

  protected tentarCarregarAreas(): void {
    this.novaTentativaDasAreas.executar(() => this.listaAreas.tentarDeNovo());
  }

  protected tentarCarregarGrupos(): void {
    this.novaTentativaDosGrupos.executar(() => this.catalogoGrupos.tentarDeNovo());
  }

  // --- Edição in-line -----------------------------------------------------

  protected clicarEditarParametros(resolucao: string): void {
    // Enquanto salvandoEdicao() é true, o forkJoin da sessão atual ainda vai
    // resolver e seu subscribe reaplica editForm()/estadoLinhasEdicao() e
    // pode chamar cancelarEdicao() — se abrirEdicao() já tiver trocado a
    // sessão para outra resolução nesse meio-tempo, essa resposta tardia
    // fecharia/corromperia a sessão nova que o usuário acabou de abrir.
    // Trocar de sessão só é seguro após o envio atual terminar.
    if (this.salvandoEdicao()) {
      return;
    }
    const atual = this.editandoResolucao();
    if (atual === resolucao) {
      return;
    }
    if (atual !== null) {
      if (this.editForm()?.dirty ?? false) {
        const prosseguir = globalThis.confirm(
          'Há alterações não salvas nesta resolução. Deseja descartá-las e editar outra?',
        );
        if (!prosseguir) {
          return;
        }
      }
      // Fecha a sessão atual pelo mesmo caminho do botão Cancelar/Esc — se
      // ela teve sucesso parcial (linhas 'ok' antes da falha/desistência),
      // cancelarEdicao() aplica essas linhas em registros() antes de
      // trocar. Ir direto para abrirEdicao() sem passar por aqui deixaria
      // esses valores já persistidos visíveis só após um reload manual.
      this.cancelarEdicao();
    }
    this.abrirEdicao(resolucao);
  }

  private abrirEdicao(resolucao: string): void {
    const linhas = this.linhasDaResolucao(resolucao);
    const form = new FormArray(
      linhas.map((linha) => criarPesoEdicaoGrupoForm(linha, this.areas())),
    );
    this.editForm.set(form);
    this.editErro.set(null);
    this.estadoLinhasEdicao.set(new Map());
    this.idempotencyKeysEdicao.set(
      new Map(linhas.map((linha) => [linha.id, idempotencyKey.create()])),
    );
    this.ultimoPayloadEdicao.set(new Map());
    this.editandoResolucao.set(resolucao);
    // Depois da renderização: antes dela o bloco de edição ainda não existe na tela.
    afterNextRender(
      () => {
        document.getElementById(this.idCampo(resolucao, 0, 0, 'peso'))?.focus();
      },
      { injector: this.injector },
    );
  }

  protected cancelarEdicao(): void {
    // O botão Cancelar já fica [disabled] durante o envio, mas o atalho Esc
    // (ligado incondicionalmente a editandoResolucao() === resolucao) não
    // tinha essa trava — Esc durante o envio limpava editForm()/
    // estadoLinhasEdicao() ANTES do forkJoin de salvarEdicao() resolver.
    // Quando a resposta chegasse depois, aplicarLinhasAtualizadas() não
    // teria mais form/estado para aplicar, e os valores salvos ficariam
    // invisíveis até um reload manual. Este guard bloqueia qualquer
    // chamador externo (Esc, clique) durante o envio; a chamada interna de
    // salvarEdicao() no sucesso roda DEPOIS de salvandoEdicao.set(false),
    // então não é afetada.
    if (this.salvandoEdicao()) {
      return;
    }
    const resolucao = this.editandoResolucao();
    const form = this.editForm();
    // Se a sessão teve sucesso parcial (algumas linhas já persistidas antes
    // de uma falha ou de o usuário desistir do restante), aplica essas
    // linhas em `registros` antes de descartar — senão o modo leitura
    // voltaria a mostrar o valor pré-edição para uma linha que já foi salva
    // no backend, ficando desatualizado até um reload manual.
    if (
      form !== null &&
      [...this.estadoLinhasEdicao().values()].some((estado) => estado === 'ok')
    ) {
      this.aplicarLinhasAtualizadas(form);
    }
    this.editandoResolucao.set(null);
    this.editForm.set(null);
    this.editErro.set(null);
    this.estadoLinhasEdicao.set(new Map());
    if (resolucao !== null) {
      // Depois da renderização: antes dela o botão "Editar parâmetros" ainda pode estar
      // desabilitado pelo envio que acabou de terminar, e o foco se perderia.
      afterNextRender(
        () => {
          document.getElementById(`pe-editar-${slug(resolucao)}`)?.focus();
        },
        { injector: this.injector },
      );
    }
  }

  protected erroDaArea(area: FormGroup<AreaForm>, campo: CampoDaArea): string | null {
    return this.erroDeControle(area.controls[campo], campo);
  }

  protected salvarEdicao(): void {
    const form = this.editForm();
    const resolucao = this.editandoResolucao();
    if (form === null || resolucao === null || this.salvandoEdicao()) {
      return;
    }
    form.markAllAsTouched();
    if (form.invalid) {
      return;
    }

    const pendentes = form.controls.filter(
      (grupo) => this.estadoLinhasEdicao().get(grupo.controls.id.value) !== 'ok',
    );
    if (pendentes.length === 0) {
      return;
    }

    this.salvandoEdicao.set(true);
    this.editErro.set(null);
    // Trava as linhas pendentes DURANTE o envio (issue §5.5: "disabled em
    // todos os inputs enquanto submit está em curso"). Sem isso havia uma
    // janela de corrida: o usuário editava um valor depois do snapshot já
    // enviado ao backend, mas antes do PUT resolver, e
    // aplicarLinhasAtualizadas() gravava em registros() esse valor nunca
    // persistido.
    pendentes.forEach((grupo) => grupo.disable());

    const chamadas = pendentes.map((grupo) => {
      const raw = grupo.getRawValue();
      const command: AtualizarPesoAreaEnemCommand = {
        id: raw.id,
        areas: areasDoPayload(raw.areas),
        baseLegal: nullIfBlank(raw.baseLegal),
      };
      // Reusa a Idempotency-Key SOMENTE num retry idêntico depois de falha em que
      // o servidor pode ter processado sem a resposta chegar (rede, 5xx). Depois de
      // recusa definitiva a chave é descartada no retorno (ver o laço abaixo): a API
      // guarda essa resposta, e reenviar sob a mesma chave a devolveria de novo.
      const payloadAtual = JSON.stringify(command);
      const chave =
        this.ultimoPayloadEdicao().get(raw.id) === payloadAtual
          ? (this.idempotencyKeysEdicao().get(raw.id) ?? idempotencyKey.create())
          : idempotencyKey.create();
      return this.api
        .atualizar(raw.id, command, withIdempotencyKey(chave))
        .pipe(map((result) => ({ id: raw.id, grupo, result, chave, payloadAtual })));
    });

    forkJoin(chamadas)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultados) => {
        this.salvandoEdicao.set(false);
        const novoEstado = new Map(this.estadoLinhasEdicao());
        const novasChaves = new Map(this.idempotencyKeysEdicao());
        const novosPayloads = new Map(this.ultimoPayloadEdicao());
        let ultimoProblema: ProblemDetails | null = null;
        const semCampo: string[] = [];

        for (const { id, grupo, result, chave, payloadAtual } of resultados) {
          lembrarChave(novasChaves, novosPayloads, id, chave, payloadAtual, result);
          if (result.ok) {
            novoEstado.set(id, 'ok');
            // Trava a linha salva: sem isso, o usuário poderia editá-la de
            // novo sem reenviar (ela não entra em `pendentes` no próximo
            // Salvar) e `aplicarLinhasAtualizadas` gravaria em `registros`
            // um valor nunca persistido no backend.
            grupo.disable();
            continue;
          }
          ultimoProblema = result.problem;
          novoEstado.set(id, 'erro');
          // Reabilita só a linha que falhou, para o usuário corrigir e
          // reenviar — as demais (ok/pendente-de-outra-rodada) permanecem
          // como estavam.
          grupo.enable();
          // A edição em linha só permite corrigir as áreas: resolução, grupo e base legal
          // não aparecem nela, e o erro deles vai para o banner, nomeando o grupo.
          const mensagens = this.aplicarErroGrupo(grupo, result.problem, {});
          semCampo.push(...mensagens.map((m) => `${grupo.controls.grupoCurso.value.rotulo}: ${m}`));
        }

        this.estadoLinhasEdicao.set(novoEstado);
        this.idempotencyKeysEdicao.set(novasChaves);
        this.ultimoPayloadEdicao.set(novosPayloads);

        const falhas = resultados.filter((r) => !r.result.ok);
        if (falhas.length > 0) {
          this.editErro.set(
            [
              `${falhas.length} de ${resultados.length} grupo(s) não foram salvos. Corrija e tente novamente.`,
              ...semCampo,
            ].join(' '),
          );
          if (ultimoProblema && ultimoProblema.status >= 500) {
            this.notifications.errorFromProblem(ultimoProblema);
          }
          return;
        }

        this.notifications.success('Pesos salvos', resolucao);
        // cancelarEdicao() aplica as linhas 'ok' em registros() antes de
        // fechar a sessão — mesma lógica usada num cancelamento após sucesso
        // parcial, sem duplicar a aplicação aqui.
        this.cancelarEdicao();
      });
  }

  private aplicarLinhasAtualizadas(form: FormArray<FormGroup<PesoEdicaoGrupoForm>>): void {
    // Só aplica linhas confirmadas 'ok' pelo backend — chamado tanto após
    // sucesso total quanto ao cancelar uma sessão com sucesso parcial, então
    // nunca deve copiar valores de linhas que falharam ou nunca chegaram a
    // ser reenviadas.
    const estado = this.estadoLinhasEdicao();
    const atualizadas = new Map(
      form.controls
        .filter((grupo) => estado.get(grupo.controls.id.value) === 'ok')
        .map((grupo) => {
          const raw = grupo.getRawValue();
          return [raw.id, raw] as const;
        }),
    );
    this.registros.update((atual) =>
      atual.map((linha) => {
        const nova = atualizadas.get(linha.id);
        if (nova === undefined) {
          return linha;
        }
        return {
          ...linha,
          areas: nova.areas.map((area) => ({
            codigo: area.codigo,
            rotulo: this.rotuloDaArea(area.codigo),
            peso: area.peso,
            corte: area.corte,
          })),
          baseLegal: nova.baseLegal,
        };
      }),
    );
  }

  // --- Drawer de criação ----------------------------------------------

  protected abrirDrawerCriacao(): void {
    // Cada abertura recria os grupos do formulário, mas o estado do envio é guardado
    // por índice do grupo (estadoGruposCriacao, chaves e corpos de idempotência) e a
    // resolução é um controle só. Reabrir enquanto submitting() é true deixaria a
    // resposta tardia da sessão anterior aplicar o resultado dela, pelos mesmos
    // índices, à sessão nova: marcar "Criado" num grupo que não foi enviado, travar a
    // resolução que o usuário está preenchendo e trocar as chaves de idempotência.
    if (this.submitting() || !this.podeCadastrar()) {
      return;
    }
    this.pesoLoteForm.controls.resolucao.enable();
    this.pesoLoteForm.setControl(
      'grupos',
      new FormArray(this.grupos().map((grupo) => criarPesoGrupoForm(grupo, this.areas()))),
    );
    this.pesoLoteForm.reset({ resolucao: '', baseLegalGlobal: '' });
    this.submitError.set(null);
    this.estadoGruposCriacao.set(new Map());
    this.idempotencyKeysCriacao.set(
      new Map(this.grupos().map((_, index) => [index, idempotencyKey.create()])),
    );
    this.ultimoPayloadCriacao.set(new Map());
    this.drawerAberto.set(true);
  }

  /** Ligado a `(closed)` do `ui-drawer` — dispara em QUALQUER caminho de
   *  fechamento (botão Cancelar, X, Esc, ou `drawerAberto.set(false)`
   *  programático), não só no clique explícito do botão Cancelar. Sem isso,
   *  fechar pelo X/Esc depois de um sucesso parcial deixava os grupos já
   *  criados invisíveis em `registros()` até um reload manual, e uma nova
   *  tentativa para a mesma resolução podia colidir com linhas que o
   *  usuário não enxergava. */
  protected aoFecharDrawerCriacao(): void {
    if (this.submitting()) {
      // Um envio (criação inicial ou retry de grupos pendentes) ainda está
      // em voo — o próprio subscribe de criarResolucao() decide se
      // recarrega quando resolver (sucesso total sempre recarrega; falha
      // parcial recarrega se o drawer já estiver fechado e algo tiver sido
      // criado). Recarregar aqui TAMBÉM criaria uma corrida: esta chamada
      // prematura veria só o estado 'ok' de ANTES do envio atual, e o
      // reload legítimo de depois seria descartado pelo guard de
      // isLoading() em carregar() — publicando a lista sem o grupo que
      // ainda estava sendo (re)criado.
      return;
    }
    const houveSucessoParcial = [...this.estadoGruposCriacao().values()].some(
      (estado) => estado === 'ok',
    );
    if (houveSucessoParcial) {
      this.carregar();
    }
  }

  protected erroDoCampoLote(
    nome: keyof Pick<PesoLoteForm, 'resolucao' | 'baseLegalGlobal'>,
  ): string | null {
    return this.erroDeControle(this.pesoLoteForm.controls[nome], nome);
  }

  protected erroDoCampoGrupo(index: number, nome: 'baseLegal'): string | null {
    const grupo = this.pesoLoteForm.controls.grupos.at(index);
    return this.erroDeControle(grupo.controls[nome], nome);
  }

  protected criarResolucao(): void {
    if (this.submitting()) {
      return;
    }
    this.pesoLoteForm.markAllAsTouched();
    if (this.pesoLoteForm.invalid) {
      return;
    }

    const resolucao = this.pesoLoteForm.controls.resolucao.value.trim();
    const grupos = this.pesoLoteForm.controls.grupos.controls;
    const pendentes = grupos
      .map((grupo, index) => ({ grupo, index }))
      .filter(({ index }) => this.estadoGruposCriacao().get(index) !== 'ok');
    if (pendentes.length === 0) {
      return;
    }

    this.submitting.set(true);
    this.submitError.set(null);
    // Trava os grupos pendentes DURANTE o envio — mesma corrida do modo
    // edição: sem isso, o usuário podia editar um valor depois do snapshot
    // já enviado ao POST, mas antes da resposta chegar, e o sucesso
    // posterior desabilitaria o MESMO FormGroup marcando "Criado" com um
    // valor diferente do que o backend realmente recebeu.
    pendentes.forEach(({ grupo }) => grupo.disable());

    const chamadas = pendentes.map(({ grupo, index }) => {
      const raw = grupo.getRawValue();
      const command: CriarPesoAreaEnemCommand = {
        resolucao: nullIfBlank(resolucao),
        grupoCurso: raw.grupoCurso.codigo,
        areas: areasDoPayload(raw.areas),
        baseLegal: nullIfBlank(raw.baseLegal),
      };
      // Reusa a Idempotency-Key SOMENTE num retry idêntico depois de falha em que
      // o servidor pode ter processado sem a resposta chegar (rede, 5xx): repetir a
      // chave é o que evita criar o grupo duas vezes. Corpo alterado ou recusa
      // definitiva anterior (descartada no laço abaixo) saem com chave nova.
      const payloadAtual = JSON.stringify(command);
      const chave =
        this.ultimoPayloadCriacao().get(index) === payloadAtual
          ? (this.idempotencyKeysCriacao().get(index) ?? idempotencyKey.create())
          : idempotencyKey.create();
      return this.api
        .criar(command, withIdempotencyKey(chave))
        .pipe(map((result) => ({ index, grupo, result, chave, payloadAtual })));
    });

    forkJoin(chamadas)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultados) => {
        this.submitting.set(false);
        const novoEstado = new Map(this.estadoGruposCriacao());
        const novasChaves = new Map(this.idempotencyKeysCriacao());
        const novosPayloads = new Map(this.ultimoPayloadCriacao());
        let duplicidade = false;
        let ultimoProblema: ProblemDetails | null = null;
        const semCampo: string[] = [];
        // Algum grupo já criado, neste envio ou num anterior: a resolução fica
        // travada (ver abaixo), e travar limpa o erro do campo — por isso, nesse caso,
        // o erro de resolução vai para o banner.
        const algumSucesso =
          [...this.estadoGruposCriacao().values()].some((estado) => estado === 'ok') ||
          resultados.some((r) => r.result.ok);

        for (const { index, grupo, result, chave, payloadAtual } of resultados) {
          lembrarChave(novasChaves, novosPayloads, index, chave, payloadAtual, result);
          if (result.ok) {
            novoEstado.set(index, 'ok');
            grupo.disable();
            continue;
          }
          ultimoProblema = result.problem;
          novoEstado.set(index, 'erro');
          // Reabilita só o grupo que falhou, para o usuário corrigir e
          // reenviar — os demais (ok/pendente-de-outra-rodada) permanecem
          // como estavam.
          grupo.enable();
          if (result.problem.code === PAR_JA_EXISTE_CODE) {
            duplicidade = true;
          } else {
            const mensagens = this.aplicarErroGrupo(grupo, result.problem, {
              resolucao: algumSucesso ? undefined : this.pesoLoteForm.controls.resolucao,
              baseLegal: grupo.controls.baseLegal,
            });
            semCampo.push(...mensagens.map((m) => `${grupo.controls.grupoCurso.value.rotulo}: ${m}`));
          }
        }

        this.estadoGruposCriacao.set(novoEstado);
        this.idempotencyKeysCriacao.set(novasChaves);
        this.ultimoPayloadCriacao.set(novosPayloads);

        // Trava a resolução assim que QUALQUER grupo for criado: os grupos já
        // criados ficam presos a esse identificador no backend — mudar
        // `resolucao` depois de um sucesso parcial faria os grupos pendentes
        // serem recriados sob uma resolução diferente da dos já criados.
        if (algumSucesso) {
          this.pesoLoteForm.controls.resolucao.disable();
        }

        // "Informe um identificador diferente" só é uma instrução que o
        // usuário consegue seguir quando o campo resolução ainda está
        // editável. Com sucesso parcial ele já está travado (acima) — pinar
        // essa mensagem ali pediria uma ação impossível. Nesse caso o aviso
        // vai só para o banner geral.
        if (duplicidade && !algumSucesso) {
          const control = this.pesoLoteForm.controls.resolucao;
          control.setErrors({
            backend: {
              code: PAR_JA_EXISTE_CODE,
              message: 'Resolução já cadastrada. Informe um identificador diferente.',
            },
          });
          control.markAsTouched();
        }

        const falhas = resultados.filter((r) => !r.result.ok);
        if (falhas.length > 0) {
          // Se o usuário já fechou o drawer (X/Esc) enquanto os POSTs ainda
          // estavam em voo, aoFecharDrawerCriacao() rodou antes de qualquer
          // resultado chegar e não viu sucesso para recarregar. O banner de
          // erro também ficaria invisível com o drawer fechado — a única
          // forma de refletir os grupos já criados é recarregar agora.
          if (!this.drawerAberto() && algumSucesso) {
            this.carregar();
          }
          // Com resolução duplicada e nada criado, o aviso fica no campo da resolução
          // (acima) e o banner leva só as mensagens dos outros grupos que não têm campo.
          const partes: string[] = [];
          if (duplicidade && algumSucesso) {
            partes.push(
              'Um dos grupos pendentes já existe com esse identificador. Os grupos já criados foram salvos — confira os dados existentes antes de tentar novamente.',
            );
          } else if (!duplicidade) {
            partes.push(
              `${falhas.length} de ${resultados.length} grupo(s) não foram criados. Corrija e tente novamente.`,
            );
          }
          partes.push(...semCampo);
          this.submitError.set(partes.length > 0 ? partes.join(' ') : null);
          if (ultimoProblema && ultimoProblema.status >= 500) {
            this.notifications.errorFromProblem(ultimoProblema);
          }
          return;
        }

        this.notifications.success('Resolução criada', resolucao);
        // Zera o estado ANTES de fechar: aoFecharDrawerCriacao() (ligado a
        // (closed)) também checa sucesso parcial e recarregaria de novo se
        // ainda visse grupos 'ok' aqui — o carregar() explícito abaixo já
        // cobre esse caso de sucesso total.
        this.estadoGruposCriacao.set(new Map());
        this.drawerAberto.set(false);
        this.carregar();
      });
  }

  // --- Inativação -------------------------------------------------------

  protected pedirInativacao(resolucao: string): void {
    this.resolucaoParaInativar.set(resolucao);
    this.confirmInativarAberto.set(true);
  }

  protected confirmarInativacao(): void {
    const resolucao = this.resolucaoParaInativar();
    this.resolucaoParaInativar.set(null);
    if (resolucao === null) {
      return;
    }
    const linhas = this.porResolucao().get(resolucao) ?? [];
    if (linhas.length === 0) {
      return;
    }
    if (this.editandoResolucao() === resolucao) {
      // O identificador pode ser reaproveitado após inativação (§5.3 da
      // issue #395) — um novo cadastro com o MESMO texto de resolução gera
      // ids novos. Sem limpar aqui, o panel novo renderizaria "já em
      // edição" usando o editForm() antigo (ligado aos ids agora
      // deletados), e Salvar tentaria PUT em linhas que não existem mais.
      // Reset direto (não cancelarEdicao(), que teria efeito colateral de
      // tentar aplicar valores de linhas que estão prestes a deixar de
      // existir).
      this.editandoResolucao.set(null);
      this.editForm.set(null);
      this.editErro.set(null);
      this.estadoLinhasEdicao.set(new Map());
    }
    forkJoin(linhas.map((linha) => this.api.remover(linha.id)))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultados) => {
        const falhas = resultados.filter((r) => !r.ok);
        if (falhas.length === 0) {
          this.notifications.success('Resolução inativada', resolucao);
        } else if (falhas.length === resultados.length) {
          this.notifications.errorFromProblem(falhas[0].problem, {
            title: this.problemI18n.resolve(falhas[0].problem).title,
          });
        } else {
          this.notifications.warning(
            'Inativação parcial',
            `${resultados.length - falhas.length} de ${resultados.length} grupos foram ` +
              'inativados. A lista foi atualizada com o estado atual.',
          );
        }
        this.carregar();
      });
  }

  // --- Carregamento -------------------------------------------------------

  /** Exaustão de cursor (ADR-0015/0026). */
  private carregar(): void {
    if (this.isLoading()) {
      return;
    }
    this.isLoading.set(true);
    this.errorMessage.set(null);

    let acumulado: PesoAreaEnemDto[] = [];
    let falhou: ProblemDetails | null = null;
    let paginas = 0;

    this.api
      .listar({ limit: PAGE_SIZE })
      .pipe(
        expand((result: ApiResult<readonly PesoAreaEnemDto[]>) => {
          paginas += 1;
          if (!result.ok || paginas >= MAX_PAGINAS) {
            return EMPTY;
          }
          const proximo = extractNextCursor(result.headers.get('Link'));
          return proximo === null
            ? EMPTY
            : this.api.listar({ cursor: cursorToString(proximo), direction: 'next' });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          if (!result.ok) {
            falhou ??= result.problem;
            return;
          }
          acumulado = [...acumulado, ...result.data];
        },
        complete: () => {
          this.isLoading.set(false);
          if (falhou !== null) {
            this.errorMessage.set(this.problemI18n.resolve(falhou).title);
            if (falhou.status >= 500) {
              this.notifications.errorFromProblem(falhou);
            }
            return;
          }
          this.registros.set(acumulado);
        },
      });
  }

  private erroDeControle(control: AbstractControl, nome: string): string | null {
    const shouldShowError = control.touched || control.dirty;
    if (!shouldShowError || control.errors === null) {
      return null;
    }
    if (control.errors['backend']) {
      const backend = control.errors['backend'] as { code: string; message: string };
      return backend.message;
    }
    if (control.errors['numeroInvalido']) {
      return 'Número inválido.';
    }
    // Texto ainda incompleto ("2,", "1e"): o campo continua inválido, mas nada é dito
    // até o operador terminar — nem "Campo obrigatório.", que o valor vazio causaria.
    if (control.errors['digitacaoIncompleta']) {
      return null;
    }
    if (control.errors['required']) {
      return 'Campo obrigatório.';
    }
    if (control.errors['min']) {
      return nome === 'corte' ? 'O corte não pode ser negativo.' : 'O peso não pode ser negativo.';
    }
    if (control.errors['max']) {
      return nome === 'corte'
        ? `O corte não pode exceder ${formatarNumero(CORTE_MAXIMO)}.`
        : `O peso não pode exceder ${formatarNumero(PESO_MAXIMO)}.`;
    }
    if (control.errors['casasDecimais']) {
      return nome === 'corte'
        ? `O corte aceita no máximo ${CASAS_CORTE} casas decimais.`
        : `O peso aceita no máximo ${CASAS_PESO} casas decimais.`;
    }
    if (control.errors['maxlength']) {
      return 'Valor acima do tamanho permitido.';
    }
    return 'Valor inválido.';
  }

  /** Leva cada erro do backend ao campo em que o operador o corrige neste contexto.
   *  Devolve as mensagens que não têm campo corrigível aqui (ex.: a base legal na
   *  edição em linha, que não a exibe), para o banner da operação: um controle
   *  inválido e invisível travaria o formulário sem mensagem, e pôr o erro num campo
   *  que não é o dele faria o operador mexer no lugar errado. */
  private aplicarErroGrupo(
    grupo: FormGroup<PesoGrupoForm> | FormGroup<PesoEdicaoGrupoForm>,
    problem: ProblemDetails,
    destinos: DestinosDePrimeiroNivel,
  ): string[] {
    const areas = grupo.controls.areas;
    const semCampo: string[] = [];
    if (
      problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO &&
      problem.errors &&
      problem.errors.length > 0
    ) {
      // Vários erros podem cair no mesmo campo (ex.: `areas[i].codigo` e `areas[i].peso`
      // vão ambos ao peso da área): acumula as mensagens, para o operador ver todas.
      const porControle = new Map<AbstractControl, { code: string; mensagens: string[] }>();
      for (const erro of problem.errors) {
        const control = controleDoCampoBackend(areas, destinos, erro.field);
        if (control === null) {
          if (!semCampo.includes(erro.message)) {
            semCampo.push(erro.message);
          }
          continue;
        }
        const acumulado = porControle.get(control) ?? { code: erro.code, mensagens: [] };
        if (!acumulado.mensagens.includes(erro.message)) {
          acumulado.mensagens.push(erro.message);
        }
        porControle.set(control, acumulado);
      }
      for (const [control, { code, mensagens }] of porControle) {
        control.setErrors({ backend: { code, message: mensagens.join(' ') } });
        control.markAsTouched();
      }
      return semCampo;
    }
    // Recusa 4xx sem `errors[]` (ex.: linha removida por outra sessão, conflito de
    // concorrência): não aponta campo nenhum, então vai ao banner da operação, e não a
    // um campo que não é o dela. Falha transitória (rede/status 0, 5xx) não acrescenta
    // nada: o banner geral já a comunica, e o mesmo pedido pode passar num novo envio.
    if (ehFalhaAcionavelPeloUsuario(problem)) {
      semCampo.push(this.problemI18n.resolve(problem).title);
    }
    return semCampo;
  }
}

/** Agrupa as linhas por resolução e ordena cada grupo pela ordem dos grupos da API. Um
 *  código que a lista não traga vai para o fim, em vez de sumir da tela. */
function agruparPorResolucao(
  pesos: readonly PesoAreaEnemDto[],
  ordemDosGrupos: ReadonlyMap<string, number>,
): Map<string, PesoAreaEnemDto[]> {
  const mapa = new Map<string, PesoAreaEnemDto[]>();
  for (const peso of pesos) {
    const grupo = mapa.get(peso.resolucao);
    if (grupo) {
      grupo.push(peso);
    } else {
      mapa.set(peso.resolucao, [peso]);
    }
  }
  const posicao = (linha: PesoAreaEnemDto): number =>
    ordemDosGrupos.get(linha.grupoCurso.codigo) ?? Number.MAX_SAFE_INTEGER;
  for (const linhas of mapa.values()) {
    linhas.sort((a, b) => posicao(a) - posicao(b));
  }
  return mapa;
}

function maxCriadoEm(linhas: readonly PesoAreaEnemDto[]): number {
  return linhas.reduce((max, linha) => Math.max(max, Date.parse(linha.criadoEm)), 0);
}

function toNumber(valor: number | string): number {
  return typeof valor === 'number' ? valor : Number(valor);
}

/** O corte vindo da API como número, ou `null` quando a área não tem corte. */
function corteComoNumero(corte: number | string | null | undefined): number | null {
  return corte === null || corte === undefined ? null : toNumber(corte);
}

/** Um formatador para a página inteira: criar um a cada célula e a cada detecção de
 *  mudanças custaria a construção de um `Intl.NumberFormat` por chamada. */
const FORMATADOR_NUMERO = new Intl.NumberFormat('pt-BR');

function formatarNumero(valor: number): string {
  return FORMATADOR_NUMERO.format(valor);
}

function criarAreaForm(codigo: string, peso: number, corte: number | null): FormGroup<AreaForm> {
  return new FormGroup<AreaForm>({
    codigo: new FormControl(codigo, { nonNullable: true }),
    peso: new FormControl(peso, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(0),
        Validators.max(PESO_MAXIMO),
        maximoDeCasasDecimais(CASAS_PESO),
      ],
    }),
    // Opcional: em branco (null) é "sem corte" — sem Validators.required.
    corte: new FormControl<number | null>(corte, {
      validators: [Validators.min(0), Validators.max(CORTE_MAXIMO), maximoDeCasasDecimais(CASAS_CORTE)],
    }),
  });
}

/** Recusa valor com mais casas decimais do que a coluna guarda: sem isso, a tela
 *  mostraria o número digitado e o backend gravaria outro, arredondado. */
function maximoDeCasasDecimais(maximo: number): ValidatorFn {
  return (control) => {
    const valor: unknown = control.value;
    if (typeof valor !== 'number' || !Number.isFinite(valor)) {
      return null;
    }
    return casasDecimais(valor) > maximo ? { casasDecimais: { maximo } } : null;
  };
}

/** Casas decimais de um número, inclusive na notação exponencial (ex.: 1.5e-7). */
function casasDecimais(valor: number): number {
  const [mantissa = '', expoente = '0'] = String(valor).toLowerCase().split('e');
  const decimaisDaMantissa = mantissa.split('.')[1]?.length ?? 0;
  return Math.max(0, decimaisDaMantissa - Number(expoente));
}

/** Uma área por item da lista da API, na ordem dela, com peso zero e sem corte. */
function criarAreasForm(areas: readonly AreaPesoAreaEnemDto[]): FormArray<FormGroup<AreaForm>> {
  return new FormArray(areas.map((area) => criarAreaForm(area.codigo, 0, null)));
}

function criarPesoGrupoForm(
  grupoCurso: GrupoAreaEnemDto,
  areas: readonly AreaPesoAreaEnemDto[],
): FormGroup<PesoGrupoForm> {
  return new FormGroup<PesoGrupoForm>({
    grupoCurso: new FormControl(grupoCurso, { nonNullable: true }),
    areas: criarAreasForm(areas),
    baseLegal: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(1), Validators.maxLength(500)],
    }),
  });
}

/** As áreas da edição seguem a ordem da lista da API, não a ordem em que a linha as
 *  devolveu: o índice de cada controle é o índice que o backend usa em
 *  `areas[i]`, para o erro voltar ao campo certo. */
function criarPesoEdicaoGrupoForm(
  linha: PesoAreaEnemDto,
  areas: readonly AreaPesoAreaEnemDto[],
): FormGroup<PesoEdicaoGrupoForm> {
  return new FormGroup<PesoEdicaoGrupoForm>({
    id: new FormControl(linha.id, { nonNullable: true }),
    grupoCurso: new FormControl(linha.grupoCurso, { nonNullable: true }),
    areas: new FormArray(
      areas.map((area) => {
        const valor = linha.areas.find((existente) => existente.codigo === area.codigo);
        return criarAreaForm(
          area.codigo,
          valor === undefined ? 0 : toNumber(valor.peso),
          corteComoNumero(valor?.corte),
        );
      }),
    ),
    baseLegal: new FormControl(linha.baseLegal, {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(1), Validators.maxLength(500)],
    }),
  });
}

function areasDoPayload(
  areas: readonly { codigo: string; peso: number; corte: number | null }[],
): PesoAreaEnemAreaCommand[] {
  return areas.map((area) => ({ codigo: area.codigo, peso: area.peso, corte: area.corte ?? null }));
}

/** Guarda a chave e o corpo enviados para um retry idêntico reaproveitar a chave —
 *  exceto depois de recusa definitiva, que a API guarda: aí o registro sai, e o
 *  próximo envio, mesmo com o corpo igual, leva chave nova. */
function lembrarChave<K>(
  chaves: Map<K, string>,
  payloads: Map<K, string>,
  alvo: K,
  chave: string,
  payload: string,
  result: ApiResult<unknown>,
): void {
  if (!result.ok && deveRotacionarIdempotencyKey(result.problem)) {
    chaves.delete(alvo);
    payloads.delete(alvo);
    return;
  }
  chaves.set(alvo, chave);
  payloads.set(alvo, payload);
}

/** 4xx = algo no pedido precisa mudar antes do retry (domínio/validação);
 *  0/5xx = falha transitória (rede, servidor) — o mesmo payload pode ter
 *  sucesso num novo envio, então não deve travar form nem consumir a
 *  Idempotency-Key original. */
function ehFalhaAcionavelPeloUsuario(problem: ProblemDetails): boolean {
  return problem.status >= 400 && problem.status < 500;
}

/** Leva o erro do backend ao campo em que o operador corrige: `areas[i].corte` ao
 *  corte da área; `areas[i].peso`, `areas[i].codigo` (o código não é editável) e o erro
 *  do item inteiro (`areas[i]`) ao peso da área; `areas` (área faltando) ao primeiro
 *  peso; `resolucao` e `baseLegal` ao campo deles, quando corrigíveis neste contexto.
 *  O resto (inclusive `grupoCurso`) devolve `null`, e a mensagem vai para o banner. Tolera prefixo no caminho (`request.`, `$.`) e a
 *  primeira letra maiúscula (`Areas[2].Peso`). */
function controleDoCampoBackend(
  areas: FormArray<FormGroup<AreaForm>>,
  destinos: DestinosDePrimeiroNivel,
  field: string,
): AbstractControl | null {
  const daArea = /(?:^|\.)areas\[(\d+)\](?:\.(\w+))?$/iu.exec(field);
  if (daArea !== null) {
    const area = areas.at(Number(daArea[1]));
    if (area === undefined) {
      return null;
    }
    return daArea[2]?.toLowerCase() === 'corte' ? area.controls.corte : area.controls.peso;
  }
  if (/(?:^|\.)areas$/iu.test(field)) {
    return areas.at(0)?.controls.peso ?? null;
  }
  const nome = controlNameFromBackendField<keyof DestinosDePrimeiroNivel>(field, CAMPOS_DE_PRIMEIRO_NIVEL);
  return nome === null ? null : (destinos[nome] ?? null);
}

function slug(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/[^a-zA-Z0-9]+/gu, '-')
    .toLowerCase();
}
