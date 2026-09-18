import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  ApiResult,
  deveRotacionarIdempotencyKey,
  idempotencyKey,
  ProblemDetails,
  ProblemI18nService,
  useApiResource,
  withIdempotencyKey,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { formatIsoDateBr, formatIsoDateLong } from '@uniplus/shared-data/utils';
import {
  ABRANGENCIAS,
  CalendarioDiasUteisApi,
  CalendarioDiasUteisDto,
  CONFIGURACAO_BASE_PATH,
  DiaNaoUtilCommandItem,
  DiaNaoUtilDto,
  UNIDADES_FEDERATIVAS,
} from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  DialogComponent,
  DrawerComponent,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { debounceTime, map, Subject, switchMap, tap } from 'rxjs';

import {
  agruparPorMes,
  anosDoCalendario,
  type CelulaCalendarioMensal,
} from './calendario-mensal.util';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CIDADE_REFERENCIA_CODE_PREFIX,
  CODIGO_MUNICIPIO_PATTERN,
  DIAS_SEMANA,
  type DiaNaoUtilFormGroup,
  MUNICIPIO_BUSCA_DEBOUNCE_MS,
  MUNICIPIO_BUSCA_VAZIA,
  MUNICIPIO_OBRIGATORIO_MESSAGE,
  type MunicipioBuscaRequest,
  type MunicipioBuscaState,
  type MunicipioOpcao,
  MUNICIPIOS_LIMIT,
  nullIfBlank,
  PARA_SIGLA,
  snapshotMunicipalCoerente,
  textoNormalizado,
} from './calendario-dias-uteis.util';
import { type CidadeResumoDto, GeoApi } from '@uniplus/shared-data/geo';

@Component({
  selector: 'cfg-calendario-dias-uteis-detalhe',
  imports: [
    RouterLink,
    AlertComponent,
    SpinnerComponent,
    DrawerComponent,
    TagComponent,
    ReactiveFormsModule,
    DialogComponent,
  ],
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
          <section
            class="cfg-calendario-mensal"
            [attr.aria-labelledby]="'cfg-mes-titulo-' + mes.chave"
          >
            <h2 [id]="'cfg-mes-titulo-' + mes.chave" class="cfg-calendario-mensal__titulo">
              {{ mes.rotulo }}
            </h2>
            <table class="cfg-calendario-mensal__tabela">
              <caption class="sr-only">
                Calendário de
                {{
                  mes.rotulo
                }}
              </caption>
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
                              (mouseleave)="ocultarPreviewSeSemFoco($event)"
                              (focus)="mostrarPreview(celula.data)"
                              (blur)="ocultarPreviewSeSemHover($event)"
                              (keydown.escape)="ocultarPreview()"
                            >
                              <span aria-hidden="true">{{ celula.dia }}</span>
                              <span
                                class="cfg-calendario-mensal__marcador"
                                aria-hidden="true"
                              ></span>
                              @if (celula.ocorrencias.length > 1) {
                                <!-- Contador pintado em ::before (ver styles) — SC 2.5.3. -->
                                <span
                                  class="cfg-calendario-mensal__contador"
                                  aria-hidden="true"
                                  [attr.data-contador]="celula.ocorrencias.length"
                                ></span>
                              }
                              @if (diaEmPreview() === celula.data) {
                                <span class="cfg-calendario-mensal__preview" aria-hidden="true">
                                  {{ previewTexto(celula) }}
                                </span>
                              }
                            </button>
                          } @else {
                            <button
                              type="button"
                              class="cfg-calendario-mensal__dia"
                              [attr.aria-label]="ariaLabelDiaSemOcorrencia(celula)"
                              (click)="abrirDrawer(celula)"
                            >
                              {{ celula.dia }}
                            </button>
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
        (closed)="aoFecharDrawer()"
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
        } @empty {
          <div class="cfg-calendario-mensal__ocorrencia-vazia">Não há feriados cadastrados.</div>
        }
        <div class="cfg-calendario-mensal__actions">
          <button type="button" class="btn btn--primary btn--rect" (click)="abrirDialog()">
            <i class="pi pi-plus" aria-hidden="true"></i>
            Adicionar feriado
          </button>
        </div>
      </ui-drawer>
      <ui-dialog
        [(visible)]="dialogOpen"
        [heading]="'Adicionar novo feriado ao calendário'"
        (closed)="aoFecharDialogo()"
        [hasFooter]="true"
      >
        @if (dialogOpen()) {
          <form
            id="cfg-calendario-dias-uteis-form"
            [formGroup]="form"
            class="cfg-form cfg-calendario-form"
            (ngSubmit)="salvar()"
          >
            <section class="form-section cfg-calendario-dias">
              <article class="cfg-dia-card">
                <div class="form-grid form-grid--1col">
                  <label
                    class="field field--full"
                    [class.is-error]="erroDoCampoDiasNaoUteis('abrangencia')"
                    [attr.for]="'abrangencia'"
                  >
                    <span class="field__label is-required">Abrangência</span>
                    <select
                      [id]="'abrangencia'"
                      class="select"
                      [attr.aria-invalid]="erroDoCampoDiasNaoUteis('abrangencia') ? 'true' : null"
                      (change)="mudaAbrangencia()"
                      formControlName="abrangencia"
                    >
                      @for (abrangencia of abrangencias; track abrangencia.value) {
                        <option [value]="abrangencia.value">{{ abrangencia.label }}</option>
                      }
                    </select>
                    @if (erroDoCampoDiasNaoUteis('abrangencia')) {
                      <span class="field__error">{{ erroDoCampoDiasNaoUteis('abrangencia') }}</span>
                    }
                  </label>

                  @if (
                    form.controls.abrangencia.value === 'MUNICIPAL' ||
                    form.controls.abrangencia.value === 'ESTADUAL'
                  ) {
                    <label
                      class="field field--full"
                      [class.is-error]="erroDoCampoDiasNaoUteis('uf')"
                    >
                      <span class="field__label is-required">
                        {{
                          form.controls.abrangencia.value === 'MUNICIPAL'
                            ? 'Estado para busca'
                            : 'Unidade Federativa (UF)'
                        }}
                      </span>
                      <select
                        [id]="'uf'"
                        class="select"
                        [attr.aria-invalid]="erroDoCampoDiasNaoUteis('uf') ? 'true' : null"
                        formControlName="uf"
                        (change)="mudaUf()"
                      >
                        @for (
                          unidadeFederativa of unidadesFederativas;
                          track unidadeFederativa.id
                        ) {
                          <option [value]="unidadeFederativa.sigla">
                            {{ unidadeFederativa.nome }} - {{ unidadeFederativa.sigla }}
                          </option>
                        }
                      </select>
                      @if (erroDoCampoDiasNaoUteis('uf')) {
                        <span class="field__error">{{ erroDoCampoDiasNaoUteis('uf') }}</span>
                      }
                    </label>
                  }

                  @if (this.form.controls.abrangencia.value === 'MUNICIPAL') {
                    <div
                      class="field field--full cfg-dia-card__municipio"
                      [class.is-error]="erroDoCampoDiasNaoUteis('codigoMunicipio')"
                    >
                      <label [for]="'busca-municipio-'" class="field__label is-required">
                        Município
                      </label>
                      <div class="cfg-municipio-busca">
                        <div class="cfg-municipio-busca__input">
                          <i class="pi pi-search" aria-hidden="true"></i>
                          <input
                            [id]="'busca-municipio-'"
                            type="search"
                            autocomplete="off"
                            class="input"
                            formControlName="buscaMunicipio"
                            placeholder="Digite ao menos 2 letras"
                            (input)="buscarMunicipios(valorDoInput($event))"
                          />
                        </div>
                        <select
                          [id]="'codigo-municipio-'"
                          class="select"
                          formControlName="codigoMunicipio"
                          aria-label="Selecionar município"
                          [attr.aria-invalid]="
                            erroDoCampoDiasNaoUteis('codigoMunicipio') ? 'true' : null
                          "
                          (change)="selecionarMunicipio()"
                        >
                          <option value="" disabled>
                            {{
                              estadoBuscaMunicipio().carregando
                                ? 'Buscando…'
                                : 'Selecione o município'
                            }}
                          </option>
                          @for (
                            municipio of estadoBuscaMunicipio().opcoes;
                            track municipio.codigoIbge
                          ) {
                            <option [value]="municipio.codigoIbge">
                              {{ municipio.nome }} — {{ municipio.uf }}
                            </option>
                          }
                        </select>
                      </div>
                      @if (estadoBuscaMunicipio().carregando) {
                        <span class="field__hint" role="status">Consultando a API Geo…</span>
                      } @else if (estadoBuscaMunicipio().erro) {
                        <span class="field__error" role="alert">
                          Não foi possível buscar os municípios.
                          <button
                            type="button"
                            class="cfg-link-button"
                            (click)="recarregarMunicipios()"
                          >
                            Tentar novamente
                          </button>
                        </span>
                      } @else if (buscaSemResultado()) {
                        <span class="field__hint"
                          >Nenhum município encontrado para essa busca.</span
                        >
                      } @else if (municipioSelecionado(); as municipio) {
                        <span class="field__hint">
                          Selecionado: {{ municipio.nome }} — {{ municipio.uf }}
                        </span>
                      } @else {
                        <span class="field__hint">
                          A busca usa o nome; o código IBGE é preenchido automaticamente.
                        </span>
                      }
                      @if (erroDoCampoDiasNaoUteis('codigoMunicipio')) {
                        <span class="field__error">{{
                          erroDoCampoDiasNaoUteis('codigoMunicipio')
                        }}</span>
                      }
                    </div>
                  }

                  <label class="field" [class.is-error]="erroDoCampoDiasNaoUteis('data')">
                    <span class="field__label is-required">Data</span>
                    <input [id]="'data-'" class="input" type="date" formControlName="data" />
                    <span class="field__hint">Não repita a mesma data, abrangência e região.</span>
                    @if (erroDoCampoDiasNaoUteis('data')) {
                      <span class="field__error">{{ erroDoCampoDiasNaoUteis('data') }}</span>
                    }
                  </label>
                  @let erroDoCampoDescricao = erroDoCampoDiasNaoUteis('descricao');
                  <label
                    class="field field--full cfg-dia-card__descricao-field"
                    [class.is-error]="erroDoCampoDescricao"
                  >
                    <span class="field__label is-required">Descrição</span>
                    <textarea
                      class="textarea cfg-dia-card__descricao"
                      formControlName="descricao"
                      placeholder="Ex.: Aniversário do município"
                    ></textarea>
                    <span class="field__hint">Até 200 caracteres.</span>
                    @if (erroDoCampoDescricao) {
                      <span class="field__error">{{ erroDoCampoDescricao }}</span>
                    }
                  </label>
                </div>
              </article>
            </section>
          </form>
        }
        <div uiDialogFooter>
          <button
            class="btn btn--tertiary"
            type="button"
            [disabled]="saving()"
            (click)="dialogOpen.set(false)"
          >
            Cancelar
          </button>
          <!-- Continua habilitado enquanto grava, e de propósito: é o único controle
               que resta no diálogo nesse estado, e desabilitá-lo deixaria a janela
               aberta sem destino de foco nem de Tab. O acionamento repetido é
               inofensivo — \`salvar()\` sai cedo com a gravação em curso — e
               \`aria-busy\` com \`aria-disabled\` dizem ao leitor de tela que ele está
               ocupado e não aceita nova ação. -->
          <button
            class="btn btn--primary"
            type="button"
            [attr.aria-busy]="saving()"
            [attr.aria-disabled]="saving()"
            (click)="salvar()"
          >
            Adicionar
          </button>
        </div>
      </ui-dialog>
    }
  `,
  styleUrls: [
    './calendario-dias-uteis.css',
    './calendario-mensal.css',
    './calendario-dias-uteis-detalhe.page.css',
  ],
  host: { class: 'cfg-page' },
})
export class CalendarioDiasUteisDetalhePage {
  private readonly route = inject(ActivatedRoute);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);
  private readonly api = inject(CalendarioDiasUteisApi);
  private readonly geo = inject(GeoApi);
  protected readonly calendarioDiaUtilId = signal(this.route.snapshot.paramMap.get('id') ?? '');
  protected readonly diasSemana = DIAS_SEMANA;
  private readonly notifications = inject(NotificationService);

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
          // novo carregasse, e a prévia reapareceria sem hover/foco se o novo
          // calendário tivesse feriado na mesma data (comum em datas
          // nacionais), sem o Escape do botão disponível para dispensá-la
          // porque o foco já se perdeu com a grade antiga.
          this.drawerVisivel.set(false);
          this.diaSelecionado.set(null);
          this.diaEmPreview.set(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
    this.buscaMunicipioRequests
      .pipe(
        // O diálogo edita uma única ocorrência, então há um só campo de busca e
        // um só fluxo: o `switchMap` cancela a requisição anterior, e a resposta
        // que chega fora de ordem é descartada pela conferência de termo/UF em
        // `aplicarResultadoMunicipios`.
        debounceTime(MUNICIPIO_BUSCA_DEBOUNCE_MS),
        switchMap((request) =>
          this.geo
            .listarCidades({ uf: request.uf, q: request.termo, limit: MUNICIPIOS_LIMIT })
            .pipe(map((result) => ({ request, result }))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ request, result }) => this.aplicarResultadoMunicipios(request, result));
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

  protected readonly meses = computed(() => {
    const dias = this.calendario()?.diasNaoUteis ?? [];
    return anosDoCalendario(dias).flatMap((ano) => agruparPorMes(dias, ano));
  });
  /**
   * Registros do dataset, não datas do calendário. Duas ocorrências no mesmo
   * dia — abrangências diferentes, como um feriado municipal que cai num
   * nacional — são duas entradas próprias, e é por entrada que o dataset é
   * conferido antes de virar vigente.
   */
  protected readonly totalDiasNaoUteis = computed(
    () => this.calendario()?.diasNaoUteis.length ?? 0,
  );

  protected readonly diaEmPreview = signal<string | null>(null);
  protected readonly drawerVisivel = signal(false);
  protected readonly diaSelecionado = signal<CelulaCalendarioMensal | null>(null);

  protected readonly ocorrenciasSelecionadas = computed(
    () => this.diaSelecionado()?.ocorrencias ?? [],
  );
  protected readonly tituloDrawer = computed(() => {
    const celula = this.diaSelecionado();
    return celula ? formatIsoDateLong(celula.data) : '';
  });
  protected readonly saving = signal(false);
  readonly form = this.criaDiaNaoUtilFormGroup();
  protected readonly abrangencias = ABRANGENCIAS;
  protected readonly unidadesFederativas = UNIDADES_FEDERATIVAS;
  private readonly buscaMunicipioRequests = new Subject<MunicipioBuscaRequest>();
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());

  readonly dialogOpen = signal(false);
  private criaDiaNaoUtilFormGroup(): FormGroup<DiaNaoUtilFormGroup> {
    return new FormGroup<DiaNaoUtilFormGroup>(
      {
        abrangencia: new FormControl('ESTADUAL', {
          nonNullable: true,
          validators: [Validators.required],
        }),
        codigoMunicipio: new FormControl('', {
          nonNullable: false,
          validators: [],
        }),
        municipioNome: new FormControl(null, { nonNullable: false }),
        municipioUf: new FormControl(null, { nonNullable: false }),
        buscaMunicipio: new FormControl('', {
          nonNullable: true,
        }),
        uf: new FormControl(PARA_SIGLA, {
          nonNullable: false,
          validators: [Validators.required, Validators.pattern(/^[A-Z]{2}$/)],
        }),
        data: new FormControl('', {
          nonNullable: true,
          validators: [Validators.required],
        }),
        descricao: new FormControl('', {
          nonNullable: true,
          validators: [textoNormalizado(200)],
        }),
      },
      { validators: [snapshotMunicipalCoerente] },
    );
  }

  protected readonly estadoBuscaMunicipio = signal<MunicipioBuscaState>(MUNICIPIO_BUSCA_VAZIA);

  protected mudaAbrangencia(): void {
    const abrangencia = this.form.controls.abrangencia.value;
    const municipio = this.form.controls.codigoMunicipio;
    const uf = this.form.controls.uf;
    const buscaMunicipio = this.form.controls.buscaMunicipio;

    municipio.clearValidators();
    uf.clearValidators();
    this.limparSnapshotMunicipal();

    if (abrangencia === 'MUNICIPAL') {
      // A UF aqui é só o filtro da busca na Geo — não é persistida (o backend
      // recusa `uf` fora de ESTADUAL); a UF do município vem no snapshot.
      uf.setValue(PARA_SIGLA);
      uf.setValidators([Validators.required, Validators.pattern(/^[A-Z]{2}$/)]);
      municipio.setValidators([Validators.required, Validators.pattern(CODIGO_MUNICIPIO_PATTERN)]);
      this.atualizarEstadoMunicipio(MUNICIPIO_BUSCA_VAZIA);
    } else if (abrangencia === 'ESTADUAL') {
      uf.setValue(PARA_SIGLA);
      buscaMunicipio.reset('');
      uf.setValidators([Validators.required, Validators.pattern(/^[A-Z]{2}$/)]);
      this.atualizarEstadoMunicipio(MUNICIPIO_BUSCA_VAZIA);
    } else {
      uf.reset('');
      buscaMunicipio.reset('');
      this.atualizarEstadoMunicipio(MUNICIPIO_BUSCA_VAZIA);
    }

    municipio.updateValueAndValidity();
    uf.updateValueAndValidity();
  }

  /**
   * Descarta a tripla inteira — código, nome e UF andam juntos, sob pena de
   * sobrar um display cache de um município que não é mais o selecionado.
   */
  private limparSnapshotMunicipal(): void {
    this.form.controls.codigoMunicipio.reset('');
    this.form.controls.municipioNome.reset(null);
    this.form.controls.municipioUf.reset(null);
  }

  protected mudaUf(): void {
    if (this.form.controls.abrangencia.value !== 'MUNICIPAL') {
      return;
    }

    // Trocar o estado da busca invalida o município escolhido no estado anterior.
    this.limparSnapshotMunicipal();
    this.form.controls.buscaMunicipio.reset('');
    this.atualizarEstadoMunicipio(MUNICIPIO_BUSCA_VAZIA);
    this.form.controls.codigoMunicipio.updateValueAndValidity();
  }

  private atualizarEstadoMunicipio(state: MunicipioBuscaState): void {
    this.estadoBuscaMunicipio.set(state);
  }

  /** Snapshot já gravado na linha — independe da lista de busca vigente. */
  protected municipioSelecionado(): MunicipioOpcao | null {
    const codigoIbge = this.form.controls.codigoMunicipio.value?.trim();
    const nome = this.form.controls.municipioNome.value?.trim();
    const uf = this.form.controls.municipioUf.value?.trim();
    return codigoIbge && nome && uf ? { codigoIbge, nome, uf } : null;
  }

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

  // Mouse sai do botão que segue com foco de teclado (cursor pousado nele
  // ao tabular, ou o usuário usa mouse e teclado juntos): sem este guard, a
  // prévia some e só volta se o usuário tabular para longe e de volta.
  protected ocultarPreviewSeSemFoco(event: MouseEvent): void {
    if (document.activeElement !== event.currentTarget) {
      this.ocultarPreview();
    }
  }

  protected ocultarPreviewSeSemHover(event: FocusEvent): void {
    const alvo = event.target as HTMLElement;
    if (!alvo.matches(':hover')) {
      this.ocultarPreview();
    }
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
      .map(
        (ocorrencia) =>
          `${ocorrencia.descricao} (${this.abrangenciaLegivel(ocorrencia.abrangencia)})`,
      )
      .join(', ');
    return `${dataPorExtenso}: ${celula.ocorrencias.length} ocorrências — ${resumo}`;
  }

  /**
   * Dia sem ocorrência também é acionável — abre o painel para cadastrar. Sem
   * rótulo próprio o nome acessível seria só o número do dia, que não diz nem a
   * data completa nem o que o botão faz.
   */
  protected ariaLabelDiaSemOcorrencia(celula: CelulaCalendarioMensal): string {
    return `${formatIsoDateLong(celula.data)}: sem dia não útil cadastrado`;
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

  protected erroDoCampoDiasNaoUteis(nome: keyof DiaNaoUtilFormGroup): string | null {
    const control = this.form.controls[nome];
    const shouldShowError = control.touched || control.dirty;
    if (!shouldShowError) {
      return null;
    }
    // O snapshot incompleto é erro do grupo (nome e UF não têm campo próprio na
    // tela), mas quem o resolve é a seleção no campo Município.
    if (nome === 'codigoMunicipio' && this.form.errors?.['snapshotMunicipal']) {
      return MUNICIPIO_OBRIGATORIO_MESSAGE;
    }
    if (control.errors === null) {
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

  protected salvar(): void {
    if (this.saving()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const abrangencia = this.form.controls.abrangencia.value;
    const municipio = abrangencia === 'MUNICIPAL' ? this.municipioSelecionado() : null;
    const command: DiaNaoUtilCommandItem = {
      abrangencia: this.form.controls.abrangencia.value,
      data: this.form.controls.data.value,
      uf:
        this.form.controls.abrangencia.value === 'ESTADUAL'
          ? this.form.controls.uf.value || null
          : null,
      municipioIbge: municipio?.codigoIbge ?? null,
      municipioNome: municipio?.nome ?? null,
      municipioUf: municipio?.uf ?? null,
      descricao: nullIfBlank(this.form.controls.descricao.value),
    };
    this.api
      .criaNovaData(
        this.calendarioDiaUtilId(),
        command,
        withIdempotencyKey(this.idempotencyKeyAtual()),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleSalvarResult(result));
  }

  resetaFormulario(): void {
    this.form.reset({
      data: '',
      abrangencia: 'ESTADUAL',
      codigoMunicipio: '',
      uf: PARA_SIGLA,
      buscaMunicipio: '',
      descricao: '',
      municipioNome: null,
      municipioUf: null,
    });
    this.form.controls.data.enable();
    // `reset` devolve os valores, não os validadores: sem isto o `required` que
    // `mudaAbrangencia` pôs em `codigoMunicipio` para a abrangência municipal
    // sobrevive ao fechamento e trava o formulário na abrangência seguinte.
    this.mudaAbrangencia();
  }

  private handleSalvarResult(result: ApiResult<CalendarioDiasUteisDto | void>): void {
    this.saving.set(false);
    if (result.ok) {
      this.notifications.success('Dia não útil adicionado');
      // A chave gasta fica associada ao corpo já aceito: reaproveitá-la na
      // próxima inclusão devolveria `uniplus.idempotency.body_mismatch` em vez
      // de gravar o novo dia.
      this.renovarIdempotencyKey();
      this.dialogOpen.set(false);
      this.drawerVisivel.set(false);
      this.calendarioResource.reload();
      return;
    }
    this.aplicarFalha(result.problem);
  }

  private aplicarResultadoMunicipios(
    request: MunicipioBuscaRequest,
    result: ApiResult<readonly CidadeResumoDto[]>,
  ): void {
    const termoAtual = request.grupo.controls.buscaMunicipio.value.trim();
    const ufAtual = request.grupo.controls.uf.value?.trim().toUpperCase();
    if (termoAtual !== request.termo || ufAtual !== request.uf) {
      return;
    }

    const state = this.estadoBuscaMunicipio();
    const selecionado = this.municipioSelecionado();
    const opcoes: MunicipioOpcao[] = result.ok ? [...result.data] : [...state.opcoes];
    if (selecionado && !opcoes.some((opcao) => opcao.codigoIbge === selecionado.codigoIbge)) {
      opcoes.unshift(selecionado);
    }
    this.atualizarEstadoMunicipio({
      opcoes,
      carregando: false,
      erro: !result.ok,
    });
  }

  private aplicarFalha(problem: ProblemDetails): void {
    this.notifications.errorFromProblem(problem);
    // Qualquer recusa abaixo de 500 fica gravada contra o hash do corpo, não só
    // a de 422 — reenviar corrigido com a mesma chave devolveria
    // `body_mismatch`. O helper compartilhado já isola as exceções.
    if (deveRotacionarIdempotencyKey(problem)) {
      this.renovarIdempotencyKey();
    }

    if (
      problem.status === 422 &&
      problem.code.startsWith(CIDADE_REFERENCIA_CODE_PREFIX) &&
      problem.detail &&
      this.form.controls.abrangencia.value === 'MUNICIPAL'
    ) {
      const municipioControl = this.form.controls.codigoMunicipio;
      municipioControl.setErrors({
        ...municipioControl.errors,
        backend: { code: problem.code, message: problem.detail },
      });
      municipioControl.markAsTouched();
    }
  }

  protected recarregarMunicipios(): void {
    const termo = this.form.controls.buscaMunicipio.value.trim();
    const uf = this.form.controls.uf.value?.trim().toUpperCase() ?? '';
    if (termo.length < 2 || uf.length !== 2) {
      return;
    }
    this.atualizarEstadoMunicipio({
      ...this.estadoBuscaMunicipio(),
      carregando: true,
      erro: false,
    });
    this.buscaMunicipioRequests.next({ grupo: this.form, termo, uf });
  }

  private renovarIdempotencyKey(): void {
    this.idempotencyKeyAtual.set(idempotencyKey.create());
  }

  /**
   * Grava a tripla da opção escolhida no `<select>` alimentado pela Geo. É o
   * único ponto que escreve o snapshot: nome e UF nunca vêm do que foi digitado.
   */
  protected selecionarMunicipio(): void {
    const codigo = this.form.controls.codigoMunicipio.value;
    const opcao = this.estadoBuscaMunicipio().opcoes.find(
      (candidata) => candidata.codigoIbge === codigo,
    );
    if (!opcao) {
      this.limparSnapshotMunicipal();
      return;
    }
    this.form.controls.municipioNome.setValue(opcao.nome);
    this.form.controls.municipioUf.setValue(opcao.uf);
    this.form.controls.buscaMunicipio.setValue(opcao.nome);
    this.form.updateValueAndValidity();
  }

  protected valorDoInput(event: Event): string {
    return event.target instanceof HTMLInputElement ? event.target.value : '';
  }

  protected buscaSemResultado(): boolean {
    const state = this.estadoBuscaMunicipio();
    return (
      this.form.controls.buscaMunicipio.value.trim().length >= 2 &&
      !state.carregando &&
      !state.erro &&
      state.opcoes.length === 0
    );
  }

  protected buscarMunicipios(termo: string): void {
    if (this.form.controls.abrangencia.value !== 'MUNICIPAL') {
      return;
    }
    const uf = this.form.controls.uf.value?.trim().toUpperCase() ?? '';
    const normalizado = termo.trim();

    this.form.controls.buscaMunicipio.setValue(termo, { emitEvent: false });
    const selecionado = this.municipioSelecionado();
    if (
      selecionado &&
      normalizado.localeCompare(selecionado.nome, 'pt-BR', { sensitivity: 'base' }) !== 0
    ) {
      this.limparSnapshotMunicipal();
    }
    if (normalizado.length < 2 || uf.length !== 2) {
      this.atualizarEstadoMunicipio({
        opcoes: [],
        carregando: false,
        erro: false,
      });
      return;
    }

    this.atualizarEstadoMunicipio({
      ...this.estadoBuscaMunicipio(),
      carregando: true,
      erro: false,
    });
    this.buscaMunicipioRequests.next({ grupo: this.form, termo: normalizado, uf });
  }

  protected abrirDialog(): void {
    // Chave nova a cada abertura, como nas demais telas de cadastro: a
    // inclusão anterior já consumiu a corrente.
    this.renovarIdempotencyKey();
    this.form.controls.data.setValue(this.diaSelecionado()?.data ?? '');
    // A data vem do dia clicado na grade e não se edita aqui; desabilitar
    // mantém o campo visível como contexto sem deixá-lo divergir da célula.
    this.form.controls.data.disable();
    this.dialogOpen.set(true);
  }

  protected aoFecharDialogo(): void {
    this.ocultarPreview();
    this.resetaFormulario();
  }

  protected aoFecharDrawer(): void {
    this.ocultarPreview();
    this.resetaFormulario();
  }
}
