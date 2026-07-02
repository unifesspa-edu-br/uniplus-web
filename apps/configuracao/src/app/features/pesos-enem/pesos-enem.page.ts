import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, expand, forkJoin, map } from 'rxjs';

import {
  ApiResult,
  ProblemDetails,
  ProblemI18nService,
  cursorToString,
  extractNextCursor,
  idempotencyKey,
  withIdempotencyKey,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AtualizarPesoAreaEnemCommand,
  CriarPesoAreaEnemCommand,
  PesoAreaEnemDto,
  PesosEnemApi,
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

/** Domínio fechado dos 4 grupos de área do ENEM (Res. INEP 805/2024, Anexo I).
 *  Espelha `GrupoCurso` do backend (Configuracao.Domain.ValueObjects) — o
 *  schema expõe `grupoCurso` como `string` livre, então o roster é declarado
 *  no cliente na ordem exibida na tela DS. */
const GRUPOS_CURSO: readonly string[] = [
  'Tecnológica',
  'Humanística I',
  'Humanística II',
  'Saúde e Biológicas',
];

/** Tetos espelhando `PesoAreaEnem.PesoMaximo`/`CorteRedacaoMaximo` no backend —
 *  evita 422 surpresa por overflow das colunas `numeric(4,2)`/`numeric(7,3)`. */
const PESO_MAXIMO = 99.99;
const CORTE_MAXIMO = 1000;
const CORTE_REDACAO_PADRAO = 400;

/** Tamanho de página ao esgotar o cursor (ADR-0015/0026) — ver `carregar()`. */
const PAGE_SIZE = 100;
/** Teto defensivo de páginas seguidas via `Link: rel="next"` — evita loop
 *  infinito caso o backend devolva um cursor que nunca esgota. */
const MAX_PAGINAS = 50;

const PAR_JA_EXISTE_CODE = 'uniplus.configuracao.peso_area_enem.par_ja_existe';

type PesoCampoComum =
  | 'pesoLinguagens'
  | 'pesoCienciasHumanas'
  | 'pesoCienciasNatureza'
  | 'pesoMatematica'
  | 'pesoRedacao'
  | 'corteRedacao'
  | 'baseLegal';

interface PesoGrupoForm {
  grupoCurso: FormControl<string>;
  pesoLinguagens: FormControl<number>;
  pesoCienciasHumanas: FormControl<number>;
  pesoCienciasNatureza: FormControl<number>;
  pesoMatematica: FormControl<number>;
  pesoRedacao: FormControl<number>;
  corteRedacao: FormControl<number>;
  baseLegal: FormControl<string>;
}

interface PesoLoteForm {
  resolucao: FormControl<string>;
  baseLegalGlobal: FormControl<string>;
  grupos: FormArray<FormGroup<PesoGrupoForm>>;
}

interface PesoEdicaoGrupoForm {
  id: FormControl<string>;
  grupoCurso: FormControl<string>;
  pesoLinguagens: FormControl<number>;
  pesoCienciasHumanas: FormControl<number>;
  pesoCienciasNatureza: FormControl<number>;
  pesoMatematica: FormControl<number>;
  pesoRedacao: FormControl<number>;
  corteRedacao: FormControl<number>;
  baseLegal: FormControl<string>;
}

type EstadoOperacao = 'ok' | 'erro';

@Component({
  selector: 'cfg-pesos-enem-page',
  standalone: true,
  imports: [
    AlertComponent,
    ConfirmDialogComponent,
    DrawerComponent,
    EmptyStateComponent,
    ReactiveFormsModule,
    SkeletonComponent,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Peso ENEM por grupo de curso</h1>
        <p class="page-header__desc">
          Pesos das cinco áreas do ENEM por grupo de curso, versionados por resolução INEP ·
          UNI-REQ-0066.
        </p>
      </div>
      @if (!isLoading() && resolucoes().length === 0) {
        <div class="page-header__actions">
          <button
            type="button"
            class="btn btn--primary"
            [disabled]="submitting()"
            (click)="abrirDrawerCriacao()"
          >
            <i class="pi pi-plus btn__icon" aria-hidden="true"></i>
            Cadastrar nova resolução
          </button>
        </div>
      }
    </div>

    <ui-alert
      variant="info"
      heading="Chave composta: resolução + grupo de curso"
      [dynamic]="false"
    >
      Cada linha representa um dos 4 grupos de curso de uma resolução INEP. Os pesos das áreas são
      definidos pela instituição em cada edital — não há soma fixa; o sistema registra os valores
      informados sem bloquear. O corte de redação é a nota mínima exigida na redação (padrão 400;
      não entra em cálculo de soma). Estes parâmetros também são congelados por edital (RN08).
    </ui-alert>

    @if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar os pesos do ENEM">
        {{ errorMessage() }}
        <div class="cfg-pesos-enem__retry">
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

    @if (isLoading() && resolucoes().length === 0) {
      <ui-skeleton skeletonKind="card" blockSize="10rem" />
      <ui-skeleton skeletonKind="card" blockSize="10rem" />
    }

    @for (resolucao of resolucoes(); track resolucao; let first = $first) {
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
                [disabled]="submitting()"
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
          [class.is-editing]="editandoResolucao() === resolucao"
          [attr.aria-label]="'Pesos do ENEM — ' + resolucao"
          (keydown.escape)="editandoResolucao() === resolucao && cancelarEdicao()"
        >
          <div class="num-grid__header" aria-hidden="true">
            <div class="num-cell">Grupo de curso</div>
            <div class="num-cell num-cell--head">Linguagens</div>
            <div class="num-cell num-cell--head">Humanas</div>
            <div class="num-cell num-cell--head">Natureza</div>
            <div class="num-cell num-cell--head">Matemática</div>
            <div class="num-cell num-cell--head">Redação</div>
            <div class="num-cell num-cell--head">Corte de redação</div>
          </div>

          @if (editandoResolucao() === resolucao && editForm(); as form) {
            @for (grupo of form.controls; track grupo.controls.id.value; let gi = $index) {
              <div class="num-grid__row" [formGroup]="grupo">
                <div>
                  <strong class="cell-label--group-label">{{ grupo.controls.grupoCurso.value }}</strong>
                  <span class="field__hint">Chave composta — não editável</span>
                  @if (estadoLinhasEdicao().get(grupo.controls.id.value) === 'ok') {
                    <ui-tag variant="success">Salvo</ui-tag>
                  }
                </div>
                <div class="num-cell">
                  <label class="sr-only" [for]="'pe-' + slug(resolucao) + '-g' + gi + '-ling'">
                    {{ grupo.controls.grupoCurso.value }} — Linguagens
                  </label>
                  <input
                    [id]="'pe-' + slug(resolucao) + '-g' + gi + '-ling'"
                    class="num-input"
                    type="number"
                    min="0"
                    [attr.max]="PESO_MAXIMO"
                    step="0.05"
                    formControlName="pesoLinguagens"
                    [attr.aria-invalid]="erroDoCampo(grupo, 'pesoLinguagens') ? 'true' : null"
                  />
                  @if (erroDoCampo(grupo, 'pesoLinguagens'); as erro) {
                    <span class="field__error" role="alert">{{ erro }}</span>
                  }
                </div>
                <div class="num-cell">
                  <label class="sr-only" [for]="'pe-' + slug(resolucao) + '-g' + gi + '-hum'">
                    {{ grupo.controls.grupoCurso.value }} — Ciências humanas
                  </label>
                  <input
                    [id]="'pe-' + slug(resolucao) + '-g' + gi + '-hum'"
                    class="num-input"
                    type="number"
                    min="0"
                    [attr.max]="PESO_MAXIMO"
                    step="0.05"
                    formControlName="pesoCienciasHumanas"
                    [attr.aria-invalid]="erroDoCampo(grupo, 'pesoCienciasHumanas') ? 'true' : null"
                  />
                  @if (erroDoCampo(grupo, 'pesoCienciasHumanas'); as erro) {
                    <span class="field__error" role="alert">{{ erro }}</span>
                  }
                </div>
                <div class="num-cell">
                  <label class="sr-only" [for]="'pe-' + slug(resolucao) + '-g' + gi + '-nat'">
                    {{ grupo.controls.grupoCurso.value }} — Ciências da natureza
                  </label>
                  <input
                    [id]="'pe-' + slug(resolucao) + '-g' + gi + '-nat'"
                    class="num-input"
                    type="number"
                    min="0"
                    [attr.max]="PESO_MAXIMO"
                    step="0.05"
                    formControlName="pesoCienciasNatureza"
                    [attr.aria-invalid]="erroDoCampo(grupo, 'pesoCienciasNatureza') ? 'true' : null"
                  />
                  @if (erroDoCampo(grupo, 'pesoCienciasNatureza'); as erro) {
                    <span class="field__error" role="alert">{{ erro }}</span>
                  }
                </div>
                <div class="num-cell">
                  <label class="sr-only" [for]="'pe-' + slug(resolucao) + '-g' + gi + '-mat'">
                    {{ grupo.controls.grupoCurso.value }} — Matemática
                  </label>
                  <input
                    [id]="'pe-' + slug(resolucao) + '-g' + gi + '-mat'"
                    class="num-input"
                    type="number"
                    min="0"
                    [attr.max]="PESO_MAXIMO"
                    step="0.05"
                    formControlName="pesoMatematica"
                    [attr.aria-invalid]="erroDoCampo(grupo, 'pesoMatematica') ? 'true' : null"
                  />
                  @if (erroDoCampo(grupo, 'pesoMatematica'); as erro) {
                    <span class="field__error" role="alert">{{ erro }}</span>
                  }
                </div>
                <div class="num-cell">
                  <label class="sr-only" [for]="'pe-' + slug(resolucao) + '-g' + gi + '-red'">
                    {{ grupo.controls.grupoCurso.value }} — Redação
                  </label>
                  <input
                    [id]="'pe-' + slug(resolucao) + '-g' + gi + '-red'"
                    class="num-input"
                    type="number"
                    min="0"
                    [attr.max]="PESO_MAXIMO"
                    step="0.05"
                    formControlName="pesoRedacao"
                    [attr.aria-invalid]="erroDoCampo(grupo, 'pesoRedacao') ? 'true' : null"
                  />
                  @if (erroDoCampo(grupo, 'pesoRedacao'); as erro) {
                    <span class="field__error" role="alert">{{ erro }}</span>
                  }
                </div>
                <div class="num-cell">
                  <label class="sr-only" [for]="'pe-' + slug(resolucao) + '-g' + gi + '-corte'">
                    {{ grupo.controls.grupoCurso.value }} — Corte de redação (padrão 400)
                  </label>
                  <input
                    [id]="'pe-' + slug(resolucao) + '-g' + gi + '-corte'"
                    class="num-input"
                    type="number"
                    min="0"
                    [attr.max]="CORTE_MAXIMO"
                    step="10"
                    placeholder="400"
                    formControlName="corteRedacao"
                    data-no-sum
                    [attr.aria-invalid]="erroDoCampo(grupo, 'corteRedacao') ? 'true' : null"
                  />
                  @if (erroDoCampo(grupo, 'corteRedacao'); as erro) {
                    <span class="field__error" role="alert">{{ erro }}</span>
                  }
                </div>
              </div>
            }
            <div class="grid-editbar" id="grid-pe-bar">
              @if (editErro()) {
                <ui-alert variant="danger" heading="Não foi possível salvar todos os grupos" [dynamic]="false">
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
            @for (grupo of gruposCurso; track grupo; let gi = $index) {
              @if (linhaDoGrupo(resolucao, grupo); as linha) {
                <div class="num-grid__row">
                  <div>
                    <strong class="cell-label--group-label">{{ grupo }}</strong>
                  </div>
                  <div class="num-cell">
                    <label class="sr-only" [for]="'pe-' + slug(resolucao) + '-g' + gi + '-ling'">
                      {{ grupo }} — Linguagens
                    </label>
                    <input
                      [id]="'pe-' + slug(resolucao) + '-g' + gi + '-ling'"
                      class="num-input"
                      type="number"
                      [value]="linha.pesoLinguagens"
                      readonly
                    />
                  </div>
                  <div class="num-cell">
                    <label class="sr-only" [for]="'pe-' + slug(resolucao) + '-g' + gi + '-hum'">
                      {{ grupo }} — Ciências humanas
                    </label>
                    <input
                      [id]="'pe-' + slug(resolucao) + '-g' + gi + '-hum'"
                      class="num-input"
                      type="number"
                      [value]="linha.pesoCienciasHumanas"
                      readonly
                    />
                  </div>
                  <div class="num-cell">
                    <label class="sr-only" [for]="'pe-' + slug(resolucao) + '-g' + gi + '-nat'">
                      {{ grupo }} — Ciências da natureza
                    </label>
                    <input
                      [id]="'pe-' + slug(resolucao) + '-g' + gi + '-nat'"
                      class="num-input"
                      type="number"
                      [value]="linha.pesoCienciasNatureza"
                      readonly
                    />
                  </div>
                  <div class="num-cell">
                    <label class="sr-only" [for]="'pe-' + slug(resolucao) + '-g' + gi + '-mat'">
                      {{ grupo }} — Matemática
                    </label>
                    <input
                      [id]="'pe-' + slug(resolucao) + '-g' + gi + '-mat'"
                      class="num-input"
                      type="number"
                      [value]="linha.pesoMatematica"
                      readonly
                    />
                  </div>
                  <div class="num-cell">
                    <label class="sr-only" [for]="'pe-' + slug(resolucao) + '-g' + gi + '-red'">
                      {{ grupo }} — Redação
                    </label>
                    <input
                      [id]="'pe-' + slug(resolucao) + '-g' + gi + '-red'"
                      class="num-input"
                      type="number"
                      [value]="linha.pesoRedacao"
                      readonly
                    />
                  </div>
                  <div class="num-cell">
                    <label class="sr-only" [for]="'pe-' + slug(resolucao) + '-g' + gi + '-corte'">
                      {{ grupo }} — Corte de redação (padrão 400)
                    </label>
                    <input
                      [id]="'pe-' + slug(resolucao) + '-g' + gi + '-corte'"
                      class="num-input"
                      type="number"
                      [value]="linha.corteRedacao"
                      placeholder="400"
                      readonly
                      data-no-sum
                    />
                  </div>
                </div>
              }
            }
          }

          <p class="grid-note">
            Os pesos das áreas são definidos pela instituição em cada edital — não há soma fixa; o
            sistema registra os valores informados sem bloquear. O corte de redação é a nota mínima
            exigida na redação (valor padrão 400; não entra em cálculo de soma).
          </p>
        </div>
      </section>
    } @empty {
      @if (!isLoading() && !errorMessage()) {
        <ui-empty-state
          heading="Nenhuma resolução cadastrada"
          description="Cadastre a primeira resolução de pesos do ENEM por grupo de curso."
        >
          <button
            type="button"
            class="btn btn--primary"
            [disabled]="submitting()"
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
              Identificador da resolução INEP. Parte da chave composta — não pode ser alterado
              após a criação.
            </span>
            @if (erroDoCampoLote('resolucao')) {
              <span class="field__error" role="alert">{{ erroDoCampoLote('resolucao') }}</span>
            }
          </label>
          <label class="field field--full" [class.is-error]="erroDoCampoLote('baseLegalGlobal')">
            <span class="field__label is-required">Base legal (padrão para os 4 grupos)</span>
            <input
              class="input"
              type="text"
              placeholder="Ex.: Res. 805/2024 Anexo I"
              formControlName="baseLegalGlobal"
              [attr.aria-invalid]="erroDoCampoLote('baseLegalGlobal') ? 'true' : null"
            />
            <span class="field__hint">
              Aplicada aos 4 grupos como valor pré-preenchido — cada grupo permanece editável.
            </span>
            @if (erroDoCampoLote('baseLegalGlobal')) {
              <span class="field__error" role="alert">{{ erroDoCampoLote('baseLegalGlobal') }}</span>
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
                {{ gruposCurso[gi] }}
                @if (estadoGruposCriacao().get(gi) === 'ok') {
                  <ui-tag variant="success">Criado</ui-tag>
                }
              </legend>
              <div class="form-grid">
                <label class="field">
                  <span class="field__label is-required">Linguagens</span>
                  <input
                    class="input"
                    type="number"
                    min="0"
                    [attr.max]="PESO_MAXIMO"
                    step="0.05"
                    formControlName="pesoLinguagens"
                  />
                  @if (erroDoCampoGrupo(gi, 'pesoLinguagens'); as erro) {
                    <span class="field__error" role="alert">{{ erro }}</span>
                  }
                </label>
                <label class="field">
                  <span class="field__label is-required">Ciências humanas</span>
                  <input
                    class="input"
                    type="number"
                    min="0"
                    [attr.max]="PESO_MAXIMO"
                    step="0.05"
                    formControlName="pesoCienciasHumanas"
                  />
                  @if (erroDoCampoGrupo(gi, 'pesoCienciasHumanas'); as erro) {
                    <span class="field__error" role="alert">{{ erro }}</span>
                  }
                </label>
                <label class="field">
                  <span class="field__label is-required">Ciências da natureza</span>
                  <input
                    class="input"
                    type="number"
                    min="0"
                    [attr.max]="PESO_MAXIMO"
                    step="0.05"
                    formControlName="pesoCienciasNatureza"
                  />
                  @if (erroDoCampoGrupo(gi, 'pesoCienciasNatureza'); as erro) {
                    <span class="field__error" role="alert">{{ erro }}</span>
                  }
                </label>
                <label class="field">
                  <span class="field__label is-required">Matemática</span>
                  <input
                    class="input"
                    type="number"
                    min="0"
                    [attr.max]="PESO_MAXIMO"
                    step="0.05"
                    formControlName="pesoMatematica"
                  />
                  @if (erroDoCampoGrupo(gi, 'pesoMatematica'); as erro) {
                    <span class="field__error" role="alert">{{ erro }}</span>
                  }
                </label>
                <label class="field">
                  <span class="field__label is-required">Redação</span>
                  <input
                    class="input"
                    type="number"
                    min="0"
                    [attr.max]="PESO_MAXIMO"
                    step="0.05"
                    formControlName="pesoRedacao"
                  />
                  @if (erroDoCampoGrupo(gi, 'pesoRedacao'); as erro) {
                    <span class="field__error" role="alert">{{ erro }}</span>
                  }
                </label>
                <label class="field">
                  <span class="field__label">Corte de redação</span>
                  <input
                    class="input"
                    type="number"
                    min="0"
                    [attr.max]="CORTE_MAXIMO"
                    step="10"
                    placeholder="400"
                    formControlName="corteRedacao"
                  />
                  @if (erroDoCampoGrupo(gi, 'corteRedacao'); as erro) {
                    <span class="field__error" role="alert">{{ erro }}</span>
                  }
                </label>
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
  protected readonly gruposCurso = GRUPOS_CURSO;
  protected readonly PESO_MAXIMO = PESO_MAXIMO;
  protected readonly CORTE_MAXIMO = CORTE_MAXIMO;

  private readonly api = inject(PesosEnemApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly registros = signal<readonly PesoAreaEnemDto[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly porResolucao = computed(() => agruparPorResolucao(this.registros()));
  protected readonly resolucoes = computed(() =>
    [...this.porResolucao().entries()]
      .sort(([resolucaoA, linhasA], [resolucaoB, linhasB]) => {
        const diff = maxCriadoEm(linhasB) - maxCriadoEm(linhasA);
        return diff !== 0 ? diff : resolucaoB.localeCompare(resolucaoA, 'pt-BR');
      })
      .map(([resolucao]) => resolucao),
  );

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
    grupos: new FormArray(GRUPOS_CURSO.map((grupo) => criarPesoGrupoForm(grupo))),
  });

  // --- Inativação -----------------------------------------------------
  protected readonly confirmInativarAberto = signal(false);
  protected readonly resolucaoParaInativar = signal<string | null>(null);
  protected readonly confirmInativarMensagem = computed(() => {
    const resolucao = this.resolucaoParaInativar();
    return resolucao === null
      ? 'Deseja inativar esta resolução?'
      : `Você está prestes a inativar a resolução "${resolucao}" e os pesos dos seus 4 grupos ` +
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
    this.carregar();
  }

  protected slug(valor: string): string {
    return slug(valor);
  }

  protected linhaDoGrupo(resolucao: string, grupo: string): PesoAreaEnemDto | undefined {
    return this.porResolucao().get(resolucao)?.find((linha) => linha.grupoCurso === grupo);
  }

  protected tentarNovamente(): void {
    if (!this.isLoading()) {
      this.carregar();
    }
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
    const linhas = ordenarPorRoster(this.porResolucao().get(resolucao) ?? []);
    const form = new FormArray(linhas.map((linha) => criarPesoEdicaoGrupoForm(linha)));
    this.editForm.set(form);
    this.editErro.set(null);
    this.estadoLinhasEdicao.set(new Map());
    this.idempotencyKeysEdicao.set(new Map(linhas.map((linha) => [linha.id, idempotencyKey.create()])));
    this.ultimoPayloadEdicao.set(new Map());
    this.editandoResolucao.set(resolucao);
    queueMicrotask(() => {
      document.getElementById(`pe-${slug(resolucao)}-g0-ling`)?.focus();
    });
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
    if (form !== null && [...this.estadoLinhasEdicao().values()].some((estado) => estado === 'ok')) {
      this.aplicarLinhasAtualizadas(form);
    }
    this.editandoResolucao.set(null);
    this.editForm.set(null);
    this.editErro.set(null);
    this.estadoLinhasEdicao.set(new Map());
    if (resolucao !== null) {
      queueMicrotask(() => {
        document.getElementById(`pe-editar-${slug(resolucao)}`)?.focus();
      });
    }
  }

  protected erroDoCampo(grupo: FormGroup<PesoEdicaoGrupoForm>, nome: PesoCampoComum): string | null {
    return this.erroDeControle(grupo.controls[nome], nome);
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
        pesoLinguagens: raw.pesoLinguagens,
        pesoCienciasHumanas: raw.pesoCienciasHumanas,
        pesoCienciasNatureza: raw.pesoCienciasNatureza,
        pesoMatematica: raw.pesoMatematica,
        pesoRedacao: raw.pesoRedacao,
        corteRedacao: raw.corteRedacao,
        baseLegal: raw.baseLegal.trim(),
      };
      // Reusa a Idempotency-Key SOMENTE se o corpo é idêntico ao da última
      // tentativa dessa linha. A maioria dos 422 de peso/corte é rejeitada
      // por exceção do FluentValidation ANTES do handler — nesse caminho a
      // reserva de idempotência é descartada, então reenviar com corpo
      // corrigido sob a mesma key funciona normalmente. Mas há um caminho
      // de erro de domínio (retornado como Result, não lançado) que É
      // cacheado pelo idempotency store — reenviar corpo diferente sob a
      // mesma key nesse caso conflitaria como corpo divergente. Comparar o
      // payload evita ter que distinguir os dois caminhos: só reusa quando
      // o usuário não mudou nada (retry idêntico), renova quando mudou.
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

        for (const { id, grupo, result, chave, payloadAtual } of resultados) {
          novasChaves.set(id, chave);
          novosPayloads.set(id, payloadAtual);
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
          this.aplicarErroGrupo(grupo, result.problem);
        }

        this.estadoLinhasEdicao.set(novoEstado);
        this.idempotencyKeysEdicao.set(novasChaves);
        this.ultimoPayloadEdicao.set(novosPayloads);

        const falhas = resultados.filter((r) => !r.result.ok);
        if (falhas.length > 0) {
          this.editErro.set(
            `${falhas.length} de ${resultados.length} grupo(s) não foram salvos. Corrija e tente novamente.`,
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
          pesoLinguagens: nova.pesoLinguagens,
          pesoCienciasHumanas: nova.pesoCienciasHumanas,
          pesoCienciasNatureza: nova.pesoCienciasNatureza,
          pesoMatematica: nova.pesoMatematica,
          pesoRedacao: nova.pesoRedacao,
          corteRedacao: nova.corteRedacao,
          baseLegal: nova.baseLegal,
        };
      }),
    );
  }

  // --- Drawer de criação ----------------------------------------------

  protected abrirDrawerCriacao(): void {
    // pesoLoteForm é uma única instância reaproveitada entre sessões (não
    // recriada a cada abertura) — reabrir enquanto submitting() é true
    // resetaria/reabilitaria os MESMOS FormGroups que o forkJoin da sessão
    // anterior ainda referencia. Quando essa resposta tardia chegasse,
    // grupo.disable()/setErrors() mexeriam nos campos da sessão nova que o
    // usuário já está preenchendo.
    if (this.submitting()) {
      return;
    }
    this.pesoLoteForm.controls.resolucao.enable();
    this.pesoLoteForm.reset({ resolucao: '', baseLegalGlobal: '' });
    this.pesoLoteForm.controls.grupos.controls.forEach((grupo, index) => {
      grupo.enable();
      grupo.reset({
        grupoCurso: GRUPOS_CURSO[index],
        pesoLinguagens: 0,
        pesoCienciasHumanas: 0,
        pesoCienciasNatureza: 0,
        pesoMatematica: 0,
        pesoRedacao: 0,
        corteRedacao: CORTE_REDACAO_PADRAO,
        baseLegal: '',
      });
    });
    this.submitError.set(null);
    this.estadoGruposCriacao.set(new Map());
    this.idempotencyKeysCriacao.set(
      new Map(GRUPOS_CURSO.map((_, index) => [index, idempotencyKey.create()])),
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

  protected erroDoCampoLote(nome: keyof Pick<PesoLoteForm, 'resolucao' | 'baseLegalGlobal'>): string | null {
    return this.erroDeControle(this.pesoLoteForm.controls[nome], nome);
  }

  protected erroDoCampoGrupo(index: number, nome: PesoCampoComum): string | null {
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
        resolucao,
        grupoCurso: raw.grupoCurso,
        pesoLinguagens: raw.pesoLinguagens,
        pesoCienciasHumanas: raw.pesoCienciasHumanas,
        pesoCienciasNatureza: raw.pesoCienciasNatureza,
        pesoMatematica: raw.pesoMatematica,
        pesoRedacao: raw.pesoRedacao,
        corteRedacao: raw.corteRedacao,
        baseLegal: raw.baseLegal.trim(),
      };
      // Reusa a Idempotency-Key SOMENTE se o corpo é idêntico ao da última
      // tentativa desse grupo — só assim é seguro assumir que uma falha
      // transitória (rede/5xx) pode ter processado o POST no servidor
      // mesmo com a resposta perdida. Se o usuário alterou qualquer campo
      // entre tentativas (inclusive após uma falha transitória, que deixa
      // o grupo editável), o corpo mudou e reusar a key arriscaria um
      // conflito de idempotência (corpo divergente) no backend — gera uma
      // key nova nesse caso.
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

        for (const { index, grupo, result, chave, payloadAtual } of resultados) {
          novasChaves.set(index, chave);
          novosPayloads.set(index, payloadAtual);
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
            this.aplicarErroGrupo(grupo, result.problem);
          }
        }

        this.estadoGruposCriacao.set(novoEstado);
        this.idempotencyKeysCriacao.set(novasChaves);
        this.ultimoPayloadCriacao.set(novosPayloads);

        // Trava a resolução assim que QUALQUER grupo for criado: os grupos já
        // criados ficam presos a esse identificador no backend — mudar
        // `resolucao` depois de um sucesso parcial faria os grupos pendentes
        // serem recriados sob uma resolução diferente da dos já criados.
        const algumSucesso = [...novoEstado.values()].some((estado) => estado === 'ok');
        if (algumSucesso) {
          this.pesoLoteForm.controls.resolucao.disable();
        }

        if (duplicidade) {
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
          if (!duplicidade) {
            this.submitError.set(
              `${falhas.length} de ${resultados.length} grupo(s) não foram criados. Corrija e tente novamente.`,
            );
          }
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

  // --- Carregamento (exaustão de cursor, ADR-0015/0026) ------------------

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
    if (control.errors['required']) {
      return 'Campo obrigatório.';
    }
    if (control.errors['min']) {
      return nome === 'corteRedacao'
        ? 'O corte de redação não pode ser negativo.'
        : 'O peso não pode ser negativo.';
    }
    if (control.errors['max']) {
      return nome === 'corteRedacao'
        ? `Corte de redação não pode exceder ${CORTE_MAXIMO}.`
        : `Peso não pode exceder ${PESO_MAXIMO}.`;
    }
    if (control.errors['maxlength']) {
      return 'Valor acima do tamanho permitido.';
    }
    return 'Valor inválido.';
  }

  private aplicarErroGrupo(
    grupo: FormGroup<PesoGrupoForm> | FormGroup<PesoEdicaoGrupoForm>,
    problem: ProblemDetails,
  ): void {
    const controls = grupo.controls as unknown as Record<PesoCampoComum, AbstractControl>;
    if (problem.status === 422 && problem.errors && problem.errors.length > 0) {
      let aplicouAlgum = false;
      for (const erro of problem.errors) {
        const nome = controlNameFromBackendField(erro.field);
        if (nome === null) {
          continue;
        }
        controls[nome].setErrors({ backend: { code: erro.code, message: erro.message } });
        controls[nome].markAsTouched();
        aplicouAlgum = true;
      }
      if (aplicouAlgum) {
        return;
      }
    }
    // Fallback (erro de domínio 4xx sem `errors[]` granular) só trava o
    // campo quando a falha é acionável pelo usuário (algo no request precisa
    // mudar). Falha transitória (rede/status 0, 5xx) NÃO pina erro aqui —
    // isso invalidaria o form permanentemente e bloquearia retry do mesmo
    // payload até o usuário editar algum campo só para limpar o erro
    // sintético. O banner (editErro/submitError) já comunica a falha geral.
    if (ehFalhaAcionavelPeloUsuario(problem)) {
      controls.pesoLinguagens.setErrors({
        backend: { code: problem.code, message: this.problemI18n.resolve(problem).title },
      });
      controls.pesoLinguagens.markAsTouched();
    }
  }
}

function agruparPorResolucao(pesos: readonly PesoAreaEnemDto[]): Map<string, PesoAreaEnemDto[]> {
  const mapa = new Map<string, PesoAreaEnemDto[]>();
  for (const peso of pesos) {
    const grupo = mapa.get(peso.resolucao);
    if (grupo) {
      grupo.push(peso);
    } else {
      mapa.set(peso.resolucao, [peso]);
    }
  }
  return mapa;
}

function maxCriadoEm(linhas: readonly PesoAreaEnemDto[]): number {
  return linhas.reduce((max, linha) => Math.max(max, Date.parse(linha.criadoEm)), 0);
}

/** Ordena pela ordem canônica do roster (GRUPOS_CURSO) — a mesma ordem usada
 *  no modo leitura, para que entrar em edição não reordene visualmente as
 *  linhas mesmo que a API as devolva em outra ordem (ex.: ordem de inserção). */
function ordenarPorRoster(linhas: readonly PesoAreaEnemDto[]): readonly PesoAreaEnemDto[] {
  return [...linhas].sort(
    (a, b) => GRUPOS_CURSO.indexOf(a.grupoCurso) - GRUPOS_CURSO.indexOf(b.grupoCurso),
  );
}

function toNumber(valor: number | string): number {
  return typeof valor === 'number' ? valor : Number(valor);
}

function criarPesoGrupoForm(grupoCurso: string): FormGroup<PesoGrupoForm> {
  return new FormGroup<PesoGrupoForm>({
    grupoCurso: new FormControl(grupoCurso, { nonNullable: true }),
    pesoLinguagens: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(PESO_MAXIMO)],
    }),
    pesoCienciasHumanas: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(PESO_MAXIMO)],
    }),
    pesoCienciasNatureza: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(PESO_MAXIMO)],
    }),
    pesoMatematica: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(PESO_MAXIMO)],
    }),
    pesoRedacao: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(PESO_MAXIMO)],
    }),
    corteRedacao: new FormControl(CORTE_REDACAO_PADRAO, {
      nonNullable: true,
      validators: [Validators.min(0), Validators.max(CORTE_MAXIMO)],
    }),
    baseLegal: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(1), Validators.maxLength(500)],
    }),
  });
}

function criarPesoEdicaoGrupoForm(linha: PesoAreaEnemDto): FormGroup<PesoEdicaoGrupoForm> {
  return new FormGroup<PesoEdicaoGrupoForm>({
    id: new FormControl(linha.id, { nonNullable: true }),
    grupoCurso: new FormControl(linha.grupoCurso, { nonNullable: true }),
    pesoLinguagens: new FormControl(toNumber(linha.pesoLinguagens), {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(PESO_MAXIMO)],
    }),
    pesoCienciasHumanas: new FormControl(toNumber(linha.pesoCienciasHumanas), {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(PESO_MAXIMO)],
    }),
    pesoCienciasNatureza: new FormControl(toNumber(linha.pesoCienciasNatureza), {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(PESO_MAXIMO)],
    }),
    pesoMatematica: new FormControl(toNumber(linha.pesoMatematica), {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(PESO_MAXIMO)],
    }),
    pesoRedacao: new FormControl(toNumber(linha.pesoRedacao), {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(PESO_MAXIMO)],
    }),
    corteRedacao: new FormControl(toNumber(linha.corteRedacao), {
      // Required só na edição: `AtualizarPesoAreaEnemCommand.corteRedacao`
      // não é opcional no schema (diferente de criar, que aceita null e
      // assume o padrão 400 no backend). Sem isso, limpar o input só
      // deixaria a validação de min/max passar (elas ignoram valor vazio) e
      // o NumberValueAccessor escreveria `null` no controle mesmo com
      // `nonNullable: true` — que é garantia só de tipo, não de runtime — e
      // o command seria enviado com corteRedacao inválido para o contrato.
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(CORTE_MAXIMO)],
    }),
    baseLegal: new FormControl(linha.baseLegal, {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(1), Validators.maxLength(500)],
    }),
  });
}

/** 4xx = algo no pedido precisa mudar antes do retry (domínio/validação);
 *  0/5xx = falha transitória (rede, servidor) — o mesmo payload pode ter
 *  sucesso num novo envio, então não deve travar form nem consumir a
 *  Idempotency-Key original. */
function ehFalhaAcionavelPeloUsuario(problem: ProblemDetails): boolean {
  return problem.status >= 400 && problem.status < 500;
}

const PESO_CONTROL_NAMES: ReadonlySet<string> = new Set<PesoCampoComum>([
  'pesoLinguagens',
  'pesoCienciasHumanas',
  'pesoCienciasNatureza',
  'pesoMatematica',
  'pesoRedacao',
  'corteRedacao',
  'baseLegal',
]);

function controlNameFromBackendField(field: string): PesoCampoComum | null {
  const normalized =
    field
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/u, '') ?? field;
  const camelCase = normalized.charAt(0).toLocaleLowerCase('pt-BR') + normalized.slice(1);
  return PESO_CONTROL_NAMES.has(camelCase) ? (camelCase as PesoCampoComum) : null;
}

function slug(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/[^a-zA-Z0-9]+/gu, '-')
    .toLowerCase();
}
