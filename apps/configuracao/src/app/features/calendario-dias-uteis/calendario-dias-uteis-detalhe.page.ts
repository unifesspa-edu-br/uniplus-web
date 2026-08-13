import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ProblemI18nService, useApiResource, withVendorMime } from '@uniplus/shared-core/http';
import { CalendarioDiasUteisDto, CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { AlertComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { tap } from 'rxjs';

@Component({
  selector: 'cfg-calendario-dias-uteis-detalhe',
  imports: [RouterLink, ReactiveFormsModule, AlertComponent, SpinnerComponent],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header--form">
      <a class="btn btn--tertiary btn--sm btn--rect cfg-voltar" routerLink="/calendario-dias-uteis">
        <i class="pi pi-chevron-left" aria-hidden="true"></i>
        Voltar à lista
      </a>
      <div class="page-header__content">
        <h1 class="page-header__title" tabindex="-1">Detalhes</h1>
      </div>
    </div>
    @if (calendarioResource.isLoading()) {
      <div class="cfg-loading" role="status"><ui-spinner /> Carregando calendário</div>
    } @else if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar o calendário">
        {{ errorMessage() }}
        <div class="cfg-calendario-dias-uteis__retry">
          <button type="button" class="btn btn--secondary btn--sm" (click)="tentarNovamente()">
            Tentar novamente
          </button>
        </div>
      </ui-alert>
    } @else if (calendario(); as calendarioAtual) {
      <section class="form-section" aria-labelledby="cfg-calendario-identificacao">
        <h2 id="cfg-calendario-identificacao" class="form-section__title">Identificação</h2>
        <div class="form-grid">
          <label class="field field--full">
            <span class="field__label is-required">Versão do dataset</span>
            <input
              type="text"
              autocapitalize="characters"
              class="input ng-untouched ng-pristine ng-invalid"
              [value]="calendarioAtual.versaoDataset"
              [disabled]="true"
            />
          </label>
        </div>
      </section>

      <section class="form-section" aria-labelledby="cfg-calendario-dias-nao-uteis">
        <div class="examples-container">
          <h2 id="cfg-calendario-dias-nao-uteis" class="form-section__title">Dias não úteis</h2>
        </div>
        <ng-container>
          @for (
            diaNaoUtil of calendarioAtual.diasNaoUteis;
            track diaNaoUtil.id;
            let index = $index
          ) {
            <div
              class="dias-nao-util-form-grid"
              [class.dias-nao-util-form-grid--4col]="
                diaNaoUtil.abrangencia === 'MUNICIPAL' || diaNaoUtil.abrangencia === 'ESTADUAL'
              "
              role="group"
              [attr.aria-labelledby]="'cfg-detalhe-dia-nao-util-' + index"
            >
              <h3 [id]="'cfg-detalhe-dia-nao-util-' + index" class="sr-only">
                Dia não útil {{ index + 1 }}
              </h3>
              <label class="field" [attr.for]="'detalhe-abrangencia-' + index">
                <span class="field__label is-required">Abrangência</span>
                <select [id]="'detalhe-abrangencia-' + index" class="select" [disabled]="true">
                  <option>
                    {{ diaNaoUtil.abrangencia }}
                  </option>
                </select>
              </label>
              @if (diaNaoUtil.abrangencia === 'MUNICIPAL') {
                <label class="field">
                  <span class="field__label is-required">Município (Código IBGE)</span>
                  <input
                    type="text"
                    class="input"
                    [value]="diaNaoUtil.municipioIbge"
                    [disabled]="true"
                  />
                </label>
              }
              @if (diaNaoUtil.abrangencia === 'ESTADUAL') {
                <label class="field">
                  <span class="field__label is-required">Unidade Federativa (UF)</span>
                  <select class="select" [disabled]="true">
                    <option>
                      {{ diaNaoUtil.uf }}
                    </option>
                  </select>
                </label>
              }
              <label class="field">
                <span class="field__label">Data</span>
                <input class="input" type="date" [value]="diaNaoUtil.data" [disabled]="true" />
              </label>
              <label class="field">
                <span class="field__label is-required">Descrição</span>
                <textarea class="textarea" [disabled]="true" [value]="diaNaoUtil.descricao">
                </textarea>
              </label>
            </div>
          }
        </ng-container>
      </section>
    }
  `,
  host: { class: 'cfg-page' },
})
export class CalendarioDiasUteisDetalhePage {
  private readonly route = inject(ActivatedRoute);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);
  protected readonly calendarioDiaUtilId = signal(this.route.snapshot.paramMap.get('id') ?? '');

  protected readonly calendarioResource = useApiResource<CalendarioDiasUteisDto>(() => ({
    url: `${this.basePath}/api/configuracao/calendarios-dias-uteis/${this.calendarioDiaUtilId()}`,
    context: withVendorMime('calendario-dias-uteis', 1),
  }));

  constructor() {
    this.route.params
      .pipe(
        tap((params) => this.calendarioDiaUtilId.set(params['id'] ?? '')),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected calendario = computed(() => {
    return this.calendarioResource.data();
  });

  protected readonly errorMessage = computed<string | null>(() => {
    const problem = this.calendarioResource.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.calendarioResource.error() ? 'Erro inesperado ao carregar o calendário.' : null;
  });

  protected tentarNovamente(): void {
    if (!this.calendarioResource.isLoading()) {
      this.calendarioResource.reload();
    }
  }
}
