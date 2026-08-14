import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ProblemI18nService, useApiResource, withVendorMime } from '@uniplus/shared-core/http';
import { formatIsoDateBr, formatIsoDateLong } from '@uniplus/shared-data/utils';
import {
  ABRANGENCIAS,
  CalendarioDiasUteisDto,
  CONFIGURACAO_BASE_PATH,
  DiaNaoUtilDto,
  UNIDADES_FEDERATIVAS,
} from '@uniplus/shared-data/configuracao';
import { AlertComponent, DrawerComponent, SpinnerComponent, TagComponent } from '@uniplus/shared-ui/components';
import { tap } from 'rxjs';

import { agruparPorMes, contarDiasNaoUteisUnicos, type CelulaCalendarioMensal } from './calendario-mensal.util';

const DIAS_SEMANA = [
  { abrev: 'Dom', nome: 'Domingo' },
  { abrev: 'Seg', nome: 'Segunda-feira' },
  { abrev: 'Ter', nome: 'Terça-feira' },
  { abrev: 'Qua', nome: 'Quarta-feira' },
  { abrev: 'Qui', nome: 'Quinta-feira' },
  { abrev: 'Sex', nome: 'Sexta-feira' },
  { abrev: 'Sáb', nome: 'Sábado' },
] as const;

@Component({
  selector: 'cfg-calendario-dias-uteis-detalhe',
  imports: [RouterLink, AlertComponent, SpinnerComponent, DrawerComponent, TagComponent],
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
      <dl class="cfg-calendario-resumo">
        <div class="cfg-calendario-resumo__item">
          <dt>Versão do dataset</dt>
          <dd>{{ calendarioAtual.versaoDataset }}</dd>
        </div>
        <div class="cfg-calendario-resumo__item">
          <dt>Situação</dt>
          <dd>
            @if (calendarioAtual.vigente) {
              <ui-tag variant="success">Vigente</ui-tag>
            } @else {
              <ui-tag>Não vigente</ui-tag>
            }
          </dd>
        </div>
        <div class="cfg-calendario-resumo__item">
          <dt>Dias não úteis</dt>
          <dd>{{ totalDiasNaoUteis() }}</dd>
        </div>
      </dl>

      <div class="cfg-calendario-mensal__lista">
        @for (mes of meses(); track mes.chave) {
          <section class="cfg-calendario-mensal" [attr.aria-labelledby]="'cfg-mes-titulo-' + mes.chave">
            <h2 [id]="'cfg-mes-titulo-' + mes.chave" class="cfg-calendario-mensal__titulo">
              {{ mes.rotulo }}
            </h2>
            <table class="cfg-calendario-mensal__tabela">
              <caption class="sr-only">Calendário de {{ mes.rotulo }}</caption>
              <thead>
                <tr>
                  @for (diaSemana of diasSemana; track diaSemana.abrev) {
                    <th scope="col">
                      <span aria-hidden="true">{{ diaSemana.abrev }}</span>
                      <span class="sr-only">{{ diaSemana.nome }}</span>
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (semana of mes.semanas; track $index) {
                  <tr>
                    @for (celula of semana; track $index) {
                      <td>
                        @if (celula) {
                          @if (celula.ocorrencias.length > 0) {
                            <button
                              type="button"
                              class="cfg-calendario-mensal__dia cfg-calendario-mensal__dia--feriado"
                              [attr.aria-label]="ariaLabelDia(celula)"
                              (click)="abrirDrawer(celula)"
                              (mouseenter)="mostrarPreview(celula.data)"
                              (mouseleave)="ocultarPreview()"
                              (focus)="mostrarPreview(celula.data)"
                              (blur)="ocultarPreview()"
                              (keydown.escape)="ocultarPreview()"
                            >
                              <span aria-hidden="true">{{ celula.dia }}</span>
                              <span class="cfg-calendario-mensal__marcador" aria-hidden="true"></span>
                              @if (celula.ocorrencias.length > 1) {
                                <span class="cfg-calendario-mensal__contador" aria-hidden="true">
                                  ×{{ celula.ocorrencias.length }}
                                </span>
                              }
                              @if (diaEmPreview() === celula.data) {
                                <span class="cfg-calendario-mensal__preview" aria-hidden="true">
                                  {{ previewTexto(celula) }}
                                </span>
                              }
                            </button>
                          } @else {
                            <span class="cfg-calendario-mensal__dia">{{ celula.dia }}</span>
                          }
                        }
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </section>
        }
      </div>

      <ui-drawer
        [(visible)]="drawerVisivel"
        [heading]="tituloDrawer()"
        [ariaLabel]="tituloDrawer()"
        (closed)="ocultarPreview()"
      >
        @for (ocorrencia of ocorrenciasSelecionadas(); track ocorrencia.id) {
          <article class="cfg-calendario-mensal__ocorrencia">
            <h3>{{ ocorrencia.descricao }}</h3>
            <dl>
              <div>
                <dt>Abrangência</dt>
                <dd>{{ abrangenciaLegivel(ocorrencia.abrangencia) }}</dd>
              </div>
              <div>
                <dt>Data</dt>
                <dd>{{ formatarDataCurta(ocorrencia.data) }}</dd>
              </div>
              @if (ocorrencia.abrangencia === 'MUNICIPAL') {
                <div>
                  <dt>Município</dt>
                  <dd>
                    <span>{{ municipioLegivel(ocorrencia) }}</span>
                    <span class="field__hint">Código IBGE: {{ ocorrencia.municipioIbge }}</span>
                  </dd>
                </div>
              }
              @if (ocorrencia.abrangencia === 'ESTADUAL') {
                <div>
                  <dt>Unidade Federativa (UF)</dt>
                  <dd>{{ ufLegivel(ocorrencia.uf) }}</dd>
                </div>
              }
            </dl>
          </article>
        }
      </ui-drawer>
    }
  `,
  styles: `
    .cfg-calendario-resumo {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-6);
      margin: 0 0 var(--space-6);
      padding: var(--space-4) var(--space-5);
      background: var(--surface-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
    }

    .cfg-calendario-resumo__item {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      min-width: 0;
    }

    .cfg-calendario-resumo__item dt {
      font-size: var(--text-xs);
      color: var(--text-muted);
    }

    .cfg-calendario-resumo__item dd {
      margin: 0;
      font-size: var(--text-base);
      font-weight: var(--weight-bold);
      color: var(--text-heading);
      overflow-wrap: anywhere;
    }

    .cfg-calendario-mensal__lista {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(20rem, 100%), 1fr));
      gap: var(--space-6);
      align-items: start;
    }

    .cfg-calendario-mensal {
      background: var(--surface-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: var(--space-4);
    }

    .cfg-calendario-mensal__titulo {
      margin: 0 0 var(--space-3);
      font-size: var(--text-base);
      font-weight: var(--weight-bold);
      color: var(--text-heading);
    }

    .cfg-calendario-mensal__tabela {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .cfg-calendario-mensal__tabela th {
      padding: var(--space-1) 0;
      font-size: var(--text-xs);
      font-weight: var(--weight-medium);
      color: var(--text-muted);
    }

    .cfg-calendario-mensal__tabela td {
      padding: 2px 0;
      text-align: center;
    }

    .cfg-calendario-mensal__dia {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.25rem;
      height: 2.25rem;
      margin: 0 auto;
      font-size: var(--text-sm);
      color: var(--text-secondary);
    }

    button.cfg-calendario-mensal__dia {
      position: relative;
      border: 1px solid transparent;
      border-radius: var(--radius-md);
      background: none;
      cursor: pointer;
      font: inherit;
    }

    button.cfg-calendario-mensal__dia--feriado {
      color: var(--color-primary);
      font-weight: var(--weight-bold);
      background: var(--color-primary-100);
    }

    .cfg-calendario-mensal__dia--feriado:hover {
      background: var(--color-primary-200);
    }

    .cfg-calendario-mensal__dia--feriado:focus-visible {
      outline: var(--focus-ring-width) solid var(--focus-ring-color);
      outline-offset: var(--focus-ring-offset);
    }

    .cfg-calendario-mensal__marcador {
      position: absolute;
      bottom: 3px;
      width: 4px;
      height: 4px;
      border-radius: var(--radius-circle);
      background: currentColor;
    }

    .cfg-calendario-mensal__contador {
      position: absolute;
      top: -4px;
      right: -4px;
      padding: 1px 3px;
      font-size: 0.625rem;
      line-height: 1;
      font-weight: var(--weight-bold);
      border-radius: var(--radius-pill);
      background: var(--color-primary);
      color: var(--text-on-primary);
    }

    .cfg-calendario-mensal__preview {
      position: absolute;
      bottom: calc(100% + var(--space-2));
      left: 50%;
      transform: translateX(-50%);
      width: max-content;
      max-width: min(80vw, 12rem);
      padding: var(--space-2) var(--space-3);
      background: var(--surface-inverse);
      color: var(--text-on-inverse);
      font-size: var(--text-xs);
      font-weight: var(--weight-regular);
      white-space: normal;
      overflow-wrap: anywhere;
      border-radius: var(--radius-md);
      z-index: 10;
    }

    /*
     * Domingo/segunda (colunas 1-2): centralizar estouraria a borda esquerda
     * da viewport em telas estreitas. Sexta/sábado (colunas 6-7): o mesmo à
     * direita. Só as colunas centrais mantêm a prévia centralizada no dia.
     */
    .cfg-calendario-mensal__tabela td:nth-child(-n + 2) .cfg-calendario-mensal__preview {
      left: 0;
      transform: none;
    }

    .cfg-calendario-mensal__tabela td:nth-child(n + 6) .cfg-calendario-mensal__preview {
      left: auto;
      right: 0;
      transform: none;
    }

    .cfg-calendario-mensal__ocorrencia + .cfg-calendario-mensal__ocorrencia {
      margin-top: var(--space-5);
      padding-top: var(--space-5);
      border-top: 1px solid var(--border-subtle);
    }

    .cfg-calendario-mensal__ocorrencia h3 {
      margin: 0 0 var(--space-2);
      font-size: var(--text-base);
      color: var(--text-heading);
      overflow-wrap: anywhere;
    }

    .cfg-calendario-mensal__ocorrencia dl {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      margin: 0;
    }

    .cfg-calendario-mensal__ocorrencia dt {
      font-size: var(--text-xs);
      color: var(--text-muted);
    }

    .cfg-calendario-mensal__ocorrencia dd {
      margin: 0;
      color: var(--text-secondary);
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
  protected readonly diasSemana = DIAS_SEMANA;

  protected readonly calendarioResource = useApiResource<CalendarioDiasUteisDto>(() => ({
    url: `${this.basePath}/api/configuracao/calendarios-dias-uteis/${this.calendarioDiaUtilId()}`,
    context: withVendorMime('calendario-dias-uteis', 1),
  }));

  constructor() {
    this.route.params
      .pipe(
        tap((params) => {
          this.calendarioDiaUtilId.set(params['id'] ?? '');
          // O Angular Router reaproveita esta instância ao navegar entre duas
          // rotas :id sem passar pela lista — sem isto, o drawer reabriria
          // sozinho com o dia selecionado do calendário anterior assim que o
          // novo carregasse.
          this.drawerVisivel.set(false);
          this.diaSelecionado.set(null);
        }),
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

  protected readonly meses = computed(() => agruparPorMes(this.calendario()?.diasNaoUteis ?? []));
  protected readonly totalDiasNaoUteis = computed(() => contarDiasNaoUteisUnicos(this.meses()));

  protected readonly diaEmPreview = signal<string | null>(null);
  protected readonly drawerVisivel = signal(false);
  protected readonly diaSelecionado = signal<CelulaCalendarioMensal | null>(null);

  protected readonly ocorrenciasSelecionadas = computed(() => this.diaSelecionado()?.ocorrencias ?? []);
  protected readonly tituloDrawer = computed(() => {
    const celula = this.diaSelecionado();
    return celula ? formatIsoDateLong(celula.data) : '';
  });

  protected tentarNovamente(): void {
    if (!this.calendarioResource.isLoading()) {
      this.calendarioResource.reload();
    }
  }

  protected mostrarPreview(data: string): void {
    this.diaEmPreview.set(data);
  }

  protected ocultarPreview(): void {
    this.diaEmPreview.set(null);
  }

  protected abrirDrawer(celula: CelulaCalendarioMensal): void {
    this.diaSelecionado.set(celula);
    this.drawerVisivel.set(true);
  }

  /** Nome acessível do dia — cobre a mesma informação da prévia visual (CA-06), sem depender de hover. */
  protected ariaLabelDia(celula: CelulaCalendarioMensal): string {
    const dataPorExtenso = formatIsoDateLong(celula.data);
    if (celula.ocorrencias.length === 1) {
      const [ocorrencia] = celula.ocorrencias;
      return `${dataPorExtenso}: ${ocorrencia.descricao} (${this.abrangenciaLegivel(ocorrencia.abrangencia)})`;
    }
    const resumo = celula.ocorrencias
      .map((ocorrencia) => `${ocorrencia.descricao} (${this.abrangenciaLegivel(ocorrencia.abrangencia)})`)
      .join(', ');
    return `${dataPorExtenso}: ${celula.ocorrencias.length} ocorrências — ${resumo}`;
  }

  protected previewTexto(celula: CelulaCalendarioMensal): string {
    if (celula.ocorrencias.length === 1) {
      const [ocorrencia] = celula.ocorrencias;
      return `${ocorrencia.descricao} — ${this.abrangenciaLegivel(ocorrencia.abrangencia)}`;
    }
    return `${celula.ocorrencias.length} ocorrências nesta data`;
  }

  protected abrangenciaLegivel(abrangencia: string): string {
    return ABRANGENCIAS.find((candidata) => candidata.value === abrangencia)?.label ?? abrangencia;
  }

  protected formatarDataCurta(data: string): string {
    return formatIsoDateBr(data);
  }

  /**
   * Nome e UF do município vêm do snapshot persistido no dataset (ADR-0090) —
   * a tela não consulta a Geo para resolver localidade já gravada. Registros
   * anteriores ao snapshot ficam sem nome e sem UF; não há fallback para eles
   * (a base de desenvolvimento é recriada), mas o que falta some da tela em vez
   * de virar a palavra "null" ao lado do código IBGE.
   */
  protected municipioLegivel(diaNaoUtil: DiaNaoUtilDto): string {
    return [diaNaoUtil.municipioNome, diaNaoUtil.municipioUf].filter(Boolean).join(' — ');
  }

  /** UF por extenso mais a sigla, ex.: `Pará — PA`. */
  protected ufLegivel(uf: string | null): string {
    const unidade = UNIDADES_FEDERATIVAS.find((candidata) => candidata.sigla === uf);
    return unidade ? `${unidade.nome} — ${unidade.sigla}` : (uf ?? '');
  }
}
