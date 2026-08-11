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

import {
  NotificationService,
  ProblemI18nService,
  useApiResource,
  withVendorMime,
} from '@uniplus/shared-core';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data';
import { CalendarioDiasUteisDto } from '@uniplus/shared-data/configuracao';
import { tap } from 'rxjs';

@Component({
  selector: 'cfg-calendario-dias-uteis-detalhe',
  imports: [RouterLink, ReactiveFormsModule],
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
      <section class="form-section">
        <h2 id="cfg-mod-identificacao" class="form-section__title">Identificação</h2>
        <div class="form-grid">
          <label class="field field--full">
            <span class="field__label is-required">Versão do dataset</span>
            <input
              type="text"
              autocapitalize="characters"
              class="input ng-untouched ng-pristine ng-invalid"
              [value]="calendario()?.versaoDataset"
              [disabled]="true"
            />
          </label>
        </div>
      </section>

      <section class="form-section">
        <div class="examples-container">
          <h2 id="cfg-mod-identificacao" class="form-section__title">Dias não úteis</h2>
        </div>
        <ng-container>
          @for (diaNaoUtil of calendario()?.diasNaoUteis; track diaNaoUtil) {
            <div
              class="dias-nao-util-form-grid"
              [class.dias-nao-util-form-grid--4col]="
                diaNaoUtil.abrangencia === 'MUNICIPAL' || diaNaoUtil.abrangencia === 'ESTADUAL'
              "
            >
              <label class="field" for="abrangencia">
                <span class="field__label is-required">Abrangência</span>
                <select id="abrangencia" class="select" [disabled]="true">
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
  `,
  host: { class: 'cfg-page' },
})
export class CalendarioDiasUteisDetalhePage {
  private readonly route = inject(ActivatedRoute);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);
  protected readonly calendarioDiaUtilId = signal('');

  protected readonly calendarioResource = useApiResource<CalendarioDiasUteisDto>(() => ({
    url: `${this.basePath}/api/configuracao/calendarios-dias-uteis/${this.calendarioDiaUtilId()}`,
    context: withVendorMime('calendario-dias-uteis', 1),
  }));

  constructor() {
    this.route.params
      .pipe(tap((params) => this.calendarioDiaUtilId.set(params['id'] ?? '')))
      .subscribe();
  }

  protected calendario = computed(() => {
    return this.calendarioResource.data();
  });
}
