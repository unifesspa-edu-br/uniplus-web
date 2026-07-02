import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  model,
  signal,
} from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { AlertComponent, DrawerComponent, SpinnerComponent, DialogComponent, PageHeaderComponent, TagComponent } from '@uniplus/shared-ui/components';
import {
  PesosEnemApi,
  PesoAreaEnemDto,
} from '@uniplus/shared-data/configuracao';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { idempotencyKey } from '@uniplus/shared-core/http';

interface PesoLoteForm {
  resolucao: FormControl<string>;
  baseLegalGlobal: FormControl<string>;
  grupos: FormArray<FormGroup<PesoGrupoForm>>;
}

interface PesoGrupoForm {
  grupoCurso: FormControl<string>; // readonly — valor fixo
  pesoLinguagens: FormControl<number>;
  pesoCienciasHumanas: FormControl<number>;
  pesoCienciasNatureza: FormControl<number>;
  pesoMatematica: FormControl<number>;
  pesoRedacao: FormControl<number>;
  corteRedacao: FormControl<number | null>;
  baseLegal: FormControl<string>;
}

@Component({
  selector: 'cfg-pesos-enem-page',
  standalone: true,
  imports: [
    AlertComponent,
    DrawerComponent,
    ReactiveFormsModule,
    SpinnerComponent,
    DialogComponent,
    PageHeaderComponent,
    TagComponent
],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-page-header
      heading="Peso ENEM por grupo de curso"
      description="Pesos das áreas do ENEM por grupo de curso"
    />
    @if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível criar o edital">
        {{ errorMessage() }}
      </ui-alert>
    }
    <ui-alert variant="info" heading="Chave composta: resolução + grupo de curso" [dynamic]="false">
      Cada linha representa um dos 4 grupos de curso de uma resolução INEP. Os pesos das áreas são
      definidos pela instituição em cada edital — não há soma fixa; o sistema registra os valores
      informados sem bloquear. O corte de redação é a nota mínima exigida na redação (padrão 400;
      não entra em cálculo de soma). Resolução vigente: '{{ 'resolucao-vigente  '}}' . Estes parâmetros
      também são congelados por edital (RN08).
    </ui-alert>

    @for(resolucao of resolucoes(); track resolucao; let first = $first) {
      <section class="panel" aria-labelledby="cfg-unidades-list-title">
      <div class="panel-head">
        <div class="panel-head__title">
          <h2>Pesos — {{ resolucao }}</h2>
          <ui-tag [variant]="first ? 'success' : 'warning'">
            {{ first ? 'Vigente' : 'Anterior'}}
          </ui-tag>
        </div>
        <div class="button-actions">
          <button
            class="btn btn--secondary btn--sm"
            type="button"
            data-drawer-trigger="drawer-resolucao"
            aria-haspopup="dialog"
            aria-expanded="false"
            (click)="this.drawerAberto.set(true)"
          >
            Cadastrar nova resolução
          </button>
          <button
            class="btn btn--primary btn--sm"
            type="button"
            data-grid-edit="grid-pe"
            aria-expanded="false"
          >
            <i aria-hidden="true" class="pi pi-pen-to-square btn__icon"></i>
            Editar parâmetros
          </button>
          <button
            class="btn btn--tertiary btn--sm"
            type="button"
            data-dialog-trigger="dialog-inativar-resolucao"
            aria-haspopup="dialog"
            aria-expanded="false"
            [aria-label]="'Inativar ' + resolucao"
            (click)="dialogVisivel.set(true)"
          >
            Inativar resolução
          </button>
        </div>
      </div>
      <div class="num-grid pe-grid" id="grid-pe" aria-label="Pesos do ENEM por grupo de curso">
        <div class="num-grid__header" aria-hidden="true">
          <div class="num-cell">Grupo de curso</div>
          <div class="num-cell num-cell--head">Linguagens</div>
          <div class="num-cell num-cell--head">Humanas</div>
          <div class="num-cell num-cell--head">Natureza</div>
          <div class="num-cell num-cell--head">Matemática</div>
          <div class="num-cell num-cell--head">Redação</div>
          <div class="num-cell num-cell--head">Corte de redação</div>
        </div>
        <div class="num-grid__row">
          <div>
            <strong class="cell-label--group-label ">Grupo 1</strong>
            <span class="cell-label--group-num"> — Tecnológica </span>
          </div>
          <div class="num-cell">
            <label class="sr-only" for="pe-g1-ling">G1 — Linguagens</label>
            <input
              id="pe-g1-ling"
              class="num-input"
              type="number"
              value="1.0"
              min="0"
              step="0.05"
              readonly
            />
          </div>
          <div class="num-cell">
            <label class="sr-only" for="pe-g1-hum"> G1 — Humanas </label>
            <input
              class="num-input"
              id="pe-g1-hum"
              type="number"
              value="1.0"
              min="0"
              step="0.05"
              readonly
            />
          </div>
          <div class="num-cell">
            <label class="sr-only" for="pe-g1-nat">G1 — Natureza</label
            ><input
              class="num-input"
              id="pe-g1-nat"
              type="number"
              value="1.5"
              min="0"
              step="0.05"
              readonly
            />
          </div>
          <div class="num-cell">
            <label class="sr-only" for="pe-g1-mat">G1 — Matemática</label
            ><input
              class="num-input"
              id="pe-g1-mat"
              type="number"
              value="2.5"
              min="0"
              step="0.05"
              readonly
            />
          </div>
          <div class="num-cell">
            <label class="sr-only" for="pe-g1-red">G1 — Redação</label
            ><input
              class="num-input"
              id="pe-g1-red"
              type="number"
              value="1.5"
              min="0"
              step="0.05"
              readonly
            />
          </div>
          <div class="num-cell">
            <label class="sr-only" for="pe-g1-corte">G1 — Corte de redação (padrão 400)</label
            ><input
              class="num-input"
              id="pe-g1-corte"
              type="number"
              value="400"
              placeholder="400"
              min="0"
              max="1000"
              step="10"
              readonly
              data-no-sum
            />
          </div>
        </div>
        <div [hidden]="!editandoResolucao()" class="grid-editbar" id="grid-pe-bar">
          <button class="btn btn--secondary" type="button" data-grid-cancel="grid-pe">
            Cancelar
          </button>
          <button
            class="btn btn--primary"
            type="button"
            data-grid-save="grid-pe"
            data-toast-title="Pesos salvos"
          >
            Salvar
          </button>
        </div>

        <p class="grid-note">
          Os pesos das áreas são definidos pela instituição em cada edital — não há soma fixa; o
          sistema registra os valores informados sem bloquear. O corte de redação é a nota mínima
          exigida na redação (valor padrão 400; não entra em cálculo de soma). Fonte: Resolução INEP
          805/2024.
        </p>
      </div>
    </section>
    <ui-dialog [visible]="dialogVisivel()" heading="Inativar resolução?" [hasFooter]="true" (closed)="dialogVisivel.set(false)">
      <p>
        Você está prestes a inativar a <strong><code>Resolução INEP 805/2024</code></strong> e os
        pesos dos seus 4 grupos de curso. A inativação é uma
        <strong>remoção lógica</strong> (soft-delete): o registro permanece para auditoria e a chave
        composta (resolução + grupo) continua reservada.
      </p>
      <ui-alert variant="info" heading="Registro único" [dynamic]="false">
        Cada instância da plataforma atende uma única instituição. Não é possível criar nem listar
        várias — apenas editar a Instituição existente. A remoção é lógica e só ocorre em
        recadastramento institucional.
      </ui-alert>
      <ng-container uiDialogFooter>
        <button
          class="btn btn--secondary"
          type="button"
          data-dialog-close=""
          (click)="dialogVisivel.set(false)"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="btn btn--danger"
          data-confirm-toast=""
          data-toast-title="Resolução inativada"
          data-toast-message="A resolução não estará disponível para novos editais (exemplo do kit — sem persistência real)."
          (click)="inativarResolucao()"
        >
          Confirmar inativação
        </button>
      </ng-container>
    </ui-dialog>
    }
    <ui-drawer
      class="cfg-form-drawer"
      [(visible)]="drawerAberto"
      heading="Cadastrar nova resolução"
      ariaLabel="Formulário da instituição"
      position="right"
    >
      @if (submitError()) {
        <ui-alert variant="danger" heading="Não foi possível salvar">
          {{ submitError() }}
        </ui-alert>
      }

      <form
        [formGroup]="pesoLoteForm"
        id="cfg-instituicao-form"
        novalidate
        class="cfg-form"
      >
        <div class="form-grid">
          <label class="field field--full" [class.is-error]="erroDoCampo('resolucao')">
            <span class="field__label is-required">Número/ano da resolução</span>
            <input
              class="input"
              type="text"
              placeholder="Ex.: Resolução INEP 805/2024"
              formControlName="resolucao"
              [attr.aria-invalid]="erroDoCampo('resolucao') ? 'true' : null"
            />
            <span class="field__hint"
              >Identificador da resolução INEP. Parte da chave composta — não pode ser alterado após
              a criação.</span
            >
            @if (erroDoCampo('resolucao')) {
              <span class="field__error">{{ erroDoCampo('resolucao') }}</span>
            }
          </label>
          <label class="field field--full" [class.is-error]="erroDoCampo('baseLegalGlobal')">
            <span class="field__label is-required">Base legal</span>
            <input
              class="input"
              type="text"
              placeholder="Ex.: Res. 805/2024 Anexo I"
              formControlName="baseLegalGlobal"
              [attr.aria-invalid]="erroDoCampo('baseLegalGlobal') ? 'true' : null"
            />
            <span class="field__hint"
              >Dispositivo exato (resolução + anexo) que fundamenta os pesos. Obrigatório — não se
              cadastra peso sem a base legal.</span
            >
            @if (erroDoCampo('baseLegalGlobal')) {
              <span class="field__error">{{ erroDoCampo('baseLegalGlobal') }}</span>
            }
          </label>
        </div>
      </form>
      <div class="cfg-form-footer">
        <button type="button" class="btn btn--secondary" (click)="drawerAberto.set(false)">
          Cancelar
        </button>
        <button
          type="submit"
          form="cfg-instituicao-form"
          class="btn btn--primary"
          [disabled]="submitting() || pesoLoteForm.invalid"
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
  readonly registros = signal<PesoAreaEnemDto[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly pesos = signal<{ id: string }[]>([{ id: '1' }]);
  readonly pesoEnemApi = inject(PesosEnemApi);
  protected readonly submitError = signal<string | null>(null);
  readonly dialogVisivel = model(false);
  private readonly notificationService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());
  readonly porResolucao = computed(
    () => this.agruparPorResolucao(this.registros()),
  );
  readonly resolucoes = computed(
    () => [...this.porResolucao().keys()],
  );
  readonly editandoResolucao = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly editFormGroup = signal<FormGroup | null>(null);
  readonly drawerAberto = signal(false);

  protected readonly pesoGrupoForm: FormGroup<PesoGrupoForm> = new FormGroup<PesoGrupoForm>({
    grupoCurso: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(1)],
    }),
    pesoLinguagens: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    pesoCienciasHumanas: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    pesoCienciasNatureza: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    pesoMatematica: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    pesoRedacao: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    corteRedacao: new FormControl(0, {
      validators: [Validators.required, Validators.min(0)],
    }),
    baseLegal: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(1)],
    }),
  });

  protected readonly pesoLoteForm: FormGroup<PesoLoteForm> = new FormGroup<PesoLoteForm>({
    resolucao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(1), Validators.maxLength(255)],
    }),
    baseLegalGlobal: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(1), Validators.maxLength(255)],
    }),
    grupos: new FormArray([
      this.pesoGrupoForm,
      this.pesoGrupoForm,
      this.pesoGrupoForm,
      this.pesoGrupoForm,
    ]),
  });

  agruparPorResolucao(pesos: PesoAreaEnemDto[]): Map<string, PesoAreaEnemDto[]> {
    const map: Map<string, PesoAreaEnemDto[]> = new Map();
    pesos.forEach(peso => {
      if(!map.has(peso.resolucao)) {
        map.set(peso.resolucao, [peso]);
      }
      else {
        const result = map.get(peso.resolucao) as PesoAreaEnemDto[];
        map.set(peso.resolucao, [...result, peso]);
      }
    });
    return map;
  }

  protected erroDoCampo(nome: keyof PesoLoteForm): string | null {
    const control = this.pesoLoteForm.controls[nome];
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

  protected inativarResolucao(): void {
    this.dialogVisivel.set(false);
    this.notificationService.success(
      'Resolução inativada',
      'A resolução não estará disponível para novos editais (exemplo do kit — sem persistência real).',
    );
  }
}
