import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import {
  CalendarioDiasUteisApi,
  CriarCalendarioDiasUteisCommand,
  NATUREZAS_LEGAIS,
} from '@uniplus/shared-data/configuracao';
import {
  ApiResult,
  idempotencyKey,
  NotificationService,
  ProblemDetails,
  ProblemI18nService,
  withIdempotencyKey,
} from '@uniplus/shared-core';
import {
  ABRANGENCIAS,
  UNIDADES_FEDERATIVAS,
} from '@uniplus/shared-data/configuracao';

type DiaNaoUtilFormGroupCampoNome =
  | 'codigoMunicipio'
  | 'uf'
  | 'abrangencia'
  | 'descricao'
  | 'data';

interface DiaNaoUtilFormGroup {
  uf: FormControl<string | null>;
  codigoMunicipio: FormControl<string | null>;
  abrangencia: FormControl<string>;
  data: FormControl<Date | null>;
  descricao: FormControl<string>;
}

interface CalendarioDiaUtilFormGroup {
  versaoDataset: FormControl<string>;
  diasNaoUteis: FormArray<FormGroup<DiaNaoUtilFormGroup>>;
}

export const DATA_DUPLICADA_DATASET_CODE = 'uniplus.configuracao.calendario_dias_uteis.data_duplicada_no_dataset';
export const MUNICIPIO_CODE_INVALID = 'uniplus.configuracao.calendario_dias_uteis.municipio_ibge_formato_invalido';

@Component({
  selector: 'cfg-calendario-dias-uteis-novo',
  imports: [ReactiveFormsModule, RouterLink],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header page-header--form">
      <a
        [routerLink]="['/calendario-dias-uteis']"
        class="btn btn--tertiary btn--sm btn--rect cfg-voltar"
      >
        <i aria-hidden="true" class="pi pi-chevron-left"></i>
        Voltar à lista
      </a>
      <div class="page-header__content">
        <h1 tabindex="-1" class="page-header__title">Novo calendário</h1>
        <p class="page-header__desc"></p>
      </div>
    </div>
    <form [formGroup]="form" class="cfg-form">
      <section class="form-section" aria-labelledby="cfg-sec-dados-gerais">
        <h2 id="cfg-sec-dados-gerais" class="form-section__title">Dados Gerais</h2>
        <div class="form-grid">
          <label class="field field--full" [class.is-error]="erroDoCampo('versaoDataset')">
            <span class="field__label is-required">Versão do dataset</span>
            <input
              type="text"
              autocapitalize="characters"
              class="input ng-untouched ng-pristine ng-invalid"
              formControlName="versaoDataset"
            />
            <span class="field__hint">Texto livre. Ex.: 2027.1</span>
            @if (erroDoCampo('versaoDataset')) {
              <span class="field__error">{{ erroDoCampo('versaoDataset') }}</span>
            }
          </label>
        </div>
      </section>
      <section class="form-section" aria-labelledby="cfg-mod-dias-nao-uteis">
        <div style="display: flex; justify-content: space-between;">
          <h2 id="cfg-mod-dias-nao-uteis" class="form-section__title">Dias não úteis</h2>
          <button type="button" class="btn" (click)="adicionaNovoDiaNaoUtilFormGroup()">
            <i class="pi pi-plus"></i>
            Adicionar dia
          </button>
        </div>
        <ng-container formArrayName="diasNaoUteis">
          @for (diaNaoUtil of diasNaoUteis.controls; track diaNaoUtil; let index = $index) {
            <div
              class="dias-nao-util-form-grid"
              [class.dias-nao-util-form-grid--4col]="
                diaNaoUtil?.get('abrangencia')?.value === 'MUNICIPAL' ||
                diaNaoUtil?.get('abrangencia')?.value === 'ESTADUAL'
              "
              [formGroupName]="index"
            >
              <label
                class="field"
                [class.is-error]="erroDoCampoDiasNaoUteis('abrangencia', index)"
                for="abrangencia"
              >
                <span class="field__label is-required">Abrangência</span>
                <select
                  id="abrangencia"
                  class="select"
                  [attr.aria-invalid]="
                    erroDoCampoDiasNaoUteis('abrangencia', index) ? 'true' : null
                  "
                  (change)="mudaAbrangencia(index)"
                  formControlName="abrangencia"
                >
                  <option value="" disabled>Selecione a abrangência</option>
                  @for (abrangencia of abrangencias(); track abrangencia.value) {
                    <option [value]="abrangencia.value">
                      {{ abrangencia.label }}
                    </option>
                  }
                </select>
                @if (erroDoCampoDiasNaoUteis('abrangencia', index)) {
                  <span class="field__error">{{
                    erroDoCampoDiasNaoUteis('abrangencia', index)
                  }}</span>
                }
              </label>
              @if (diaNaoUtil?.get('abrangencia')?.value === 'MUNICIPAL') {
                <label
                  class="field"
                  [class.is-error]="erroDoCampoDiasNaoUteis('codigoMunicipio', index)"
                >
                  <span class="field__label is-required">Município (Código IBGE)</span>
                  <input type="text" class="input" formControlName="codigoMunicipio" />
                  @if (erroDoCampoDiasNaoUteis('codigoMunicipio', index)) {
                    <span class="field__error">{{
                      erroDoCampoDiasNaoUteis('codigoMunicipio', index)
                    }}</span>
                  }
                </label>
              }
              @if (diaNaoUtil?.get('abrangencia')?.value === 'ESTADUAL') {
                <label class="field" [class.is-error]="erroDoCampoDiasNaoUteis('uf', index)">
                  <span class="field__label is-required">Unidade Federativa (UF)</span>
                  <select
                    class="select"
                    [attr.aria-invalid]="erroDoCampoDiasNaoUteis('uf', index) ? 'true' : null"
                    formControlName="uf"
                  >
                    @for (unidadeFederativa of unidadesFederativas(); track unidadeFederativa.id) {
                      <option [value]="unidadeFederativa.sigla">
                        {{ unidadeFederativa.nome }} - {{ unidadeFederativa.sigla }}
                      </option>
                    }
                  </select>
                  @if (erroDoCampoDiasNaoUteis('uf', index)) {
                    <span class="field__error">{{ erroDoCampoDiasNaoUteis('uf', index) }}</span>
                  }
                </label>
              }
              <label class="field" [class.is-error]="erroDoCampoDiasNaoUteis('data', index)">
                <span class="field__label is-required">Data</span>
                <input class="input" type="date" formControlName="data" />
                <span class="field__hint">
                  Não se pode repetir para a mesma combinação de abrangência/região dentro do mesmo
                  dataset.
                </span>
                @if (erroDoCampoDiasNaoUteis('data', index)) {
                  <span class="field__error">{{ erroDoCampoDiasNaoUteis('data', index) }}</span>
                }
              </label>
              <label
                class="field is-error"
                [class.is-error]="erroDoCampoDiasNaoUteis('descricao', index)"
              >
                <span class="field__label is-required">Descrição</span>
                <textarea class="textarea" formControlName="descricao"></textarea>
                <span class="field__hint">Obrigatório. Até 200 caracteres.</span>
                @if (erroDoCampoDiasNaoUteis('descricao', index)) {
                  <span class="field__error">{{
                    erroDoCampoDiasNaoUteis('descricao', index)
                  }}</span>
                }
              </label>
              <div style="display: flex; align-items: center;">
                <button
                  type="button"
                  class="btn btn--tertiary btn--sm"
                  (click)="removerLinhaPeloIndice(index)"
                  [disabled]="saving()"
                >
                  <i class="pi pi-trash"></i>
                </button>
              </div>
            </div>
          }
        </ng-container>
      </section>
    </form>
    <div class="cfg-form-footer" style="margin-top: auto;">
      <a [routerLink]="['/calendario-dias-uteis']" class="btn btn--tertiary btn--rect">Cancelar</a>
      <button
        type="submit"
        form="cfg-modalidade-form"
        class="btn btn--primary"
        (click)="salvar()"
        [disabled]="saving() || form.invalid"
      >
        Criar calendário
      </button>
    </div>
  `,
  host: { class: 'cfg-page' },
})
export class CalendarioDiasUteisNovoPage {
  private readonly api = inject(CalendarioDiasUteisApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  protected readonly form: FormGroup<CalendarioDiaUtilFormGroup> = new FormGroup({
    versaoDataset: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(60)],
    }),
    diasNaoUteis: new FormArray<FormGroup<DiaNaoUtilFormGroup>>([]),
  });
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly abrangencias = signal(ABRANGENCIAS);
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());
  protected readonly unidadesFederativas = signal(UNIDADES_FEDERATIVAS);

  protected salvar(): void {
    if (this.saving()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // Validação client-side: obrigatório ter pelo menos um dia não útil para cadastrar
    if (this.form.controls.diasNaoUteis.length === 0) {
      this.notifications.error('ao menos um dia não útil é obrigatório');
      this.formError.set('Ao menos um dia não útil é obrigatório');
      return;
    }

    this.saving.set(true);
    const command: CriarCalendarioDiasUteisCommand = {
      versaoDataset: this.form.controls.versaoDataset.value.trim(),
      diasNaoUteis: this.form.controls.diasNaoUteis.controls.map((control) => {
        return {
          abrangencia: control.controls.abrangencia.value,
          data: control.controls.data.value?.toString() || '',
          uf: control.controls.uf.value || '',
          municipioIbge: control.controls.codigoMunicipio.value || '',
          descricao: control.controls.descricao.value || '',
        };
      }),
    };

    this.api
      .criar(command, withIdempotencyKey(this.idempotencyKeyAtual()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleSalvarResult(result));
  }

  private renovarIdempotencyKey(): void {
    this.idempotencyKeyAtual.set(idempotencyKey.create());
  }

  private aplicarFalha(problem: ProblemDetails): void {
    if (problem.status === 422 && problem.errors && problem.errors.length > 0) {
      this.notifications.errorFromProblem(problem);
      this.renovarIdempotencyKey();
      return;
    }

    if (problem.status === 422 && problem.code === DATA_DUPLICADA_DATASET_CODE) {
      this.notifications.errorFromProblem(problem);
      this.renovarIdempotencyKey();
      return;
    }

    if (problem.status === 422 && problem.code === MUNICIPIO_CODE_INVALID) {
      this.notifications.errorFromProblem(problem);
      this.renovarIdempotencyKey();
      const pattern = /(\d+)-(\d+)-(\d+)/g;
      const dataRaw = (problem.detail ?? '').match(pattern);
      if (dataRaw) {
        const controlIndex = this.form.controls.diasNaoUteis.controls.findIndex(
          (control) => (control.get('data') as FormControl).value === (dataRaw[0] ?? ''),
        );
        const control = this.diasNaoUteis.at(controlIndex);
        if (control && problem.detail) {
          const message = problem.detail.replace(/\s*\(data \d{4}-\d{2}-\d{2}\)/, '');
          control
            .get('codigoMunicipio')
            ?.setErrors({ backend: { code: problem.code, message: message } });
        }
        return;
      }
    }
  }

  private handleSalvarResult(result: ApiResult<string | void>): void {
    this.saving.set(false);
    if (result.ok) {
      this.notifications.success('Calendário criado');
      this.router.navigateByUrl('/calendario-dias-uteis');
      return;
    }
    this.aplicarFalha(result.problem);
  }

  protected erroDoCampoDiasNaoUteis(nome: keyof DiaNaoUtilFormGroup, index: number): string | null {
    const control = this.diasNaoUteis.controls[index].get(nome);
    if (!control) {
      return null;
    }
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
    return 'Valor inválido.';
  }

  protected erroDoCampo(nome: keyof CalendarioDiaUtilFormGroup): string | null {
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
    return 'Valor inválido.';
  }

  protected mudaAbrangencia(index: number): void {
    const control = this.form.controls.diasNaoUteis.at(index);
    if (!control) {
      return;
    }
    const abrangenciaControl = control.controls.abrangencia;
    if (abrangenciaControl && abrangenciaControl.value === 'MUNICIPAL') {
      control.controls.codigoMunicipio = new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(7), Validators.maxLength(7)],
      });
      control.controls.uf = new FormControl('', { nonNullable: false });
    }

    if (abrangenciaControl && abrangenciaControl.value === 'ESTADUAL') {
      control.controls.uf = new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(2), Validators.maxLength(2)],
      });
      control.controls.codigoMunicipio = new FormControl('', { nonNullable: false });
      return;
    }
  }

  private criaDiaNaoUtilFormGroup(): FormGroup<DiaNaoUtilFormGroup> {
    return new FormGroup<DiaNaoUtilFormGroup>({
      abrangencia: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      codigoMunicipio: new FormControl('', {
        nonNullable: false,
        validators: [],
      }),
      uf: new FormControl('', {
        nonNullable: false,
        validators: [],
      }),
      data: new FormControl<Date | null>(null, {
        nonNullable: true,
        validators: [Validators.required],
      }),
      descricao: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(200)],
      }),
    });
  }

  protected get diasNaoUteis(): FormArray {
    return this.form.controls.diasNaoUteis;
  }

  protected removerLinhaPeloIndice(index: number): void {
    this.diasNaoUteis.removeAt(index);
  }

  protected adicionaNovoDiaNaoUtilFormGroup(): void {
    this.form.controls.diasNaoUteis.push(this.criaDiaNaoUtilFormGroup());
  }

  protected readonly naturezas = NATUREZAS_LEGAIS;
  protected erroDoCampoDiaNaoUtil(
    index: number,
    nome: DiaNaoUtilFormGroupCampoNome,
  ): string | null {
    const grupo = this.form.controls.diasNaoUteis.at(index);
    if (!grupo) {
      return null;
    }
    return this.erroDeControle(grupo.controls[nome]);
  }

  private erroDeControle(control: AbstractControl): string | null {
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

    if (control.errors['maxlength']) {
      return 'Valor acima do tamanho permitido.';
    }
    return 'Valor inválido.';
  }
}
