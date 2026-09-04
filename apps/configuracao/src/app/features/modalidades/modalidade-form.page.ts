import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  API_MAX_PAGE_SIZE,
  ApiResult,
  ProblemDetails,
  ProblemI18nService,
  ProblemValidationError,
  idempotencyKey,
  lookupCompleto,
  withIdempotencyKey,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  ACOES_QUANDO_INDEFERIDO,
  AcaoQuandoIndeferidoToken,
  AtualizarModalidadeCommand,
  COMPOSICAO_RETIRA_DE,
  COMPOSICAO_VAGAS_DEFAULT,
  COMPOSICOES_VAGAS,
  ComposicaoVagasToken,
  CriarModalidadeCommand,
  ModalidadeDto,
  ModalidadesApi,
  NATUREZA_LEGAL_DEFAULT,
  NATUREZAS_LEGAIS,
  NaturezaLegalToken,
  REGRAS_REMANEJAMENTO,
  RegraRemanejamentoToken,
} from '@uniplus/shared-data/configuracao';
import { AlertComponent, DialogComponent, SpinnerComponent } from '@uniplus/shared-ui/components';

const CODIGO_REGEX = /^[A-Z0-9_]+$/u;
const DESCRICAO_MAX = 300;
const BASE_LEGAL_MAX = 500;
const CODIGO_REFERENCIA_MAX = 60;

type RegraSelecao = RegraRemanejamentoToken | '';
type AcaoSelecao = AcaoQuandoIndeferidoToken | '';

interface ModalidadeForm {
  codigo: FormControl<string>;
  descricao: FormControl<string>;
  naturezaLegal: FormControl<NaturezaLegalToken>;
  composicaoVagas: FormControl<ComposicaoVagasToken>;
  composicaoOrigem: FormControl<string>;
  regraRemanejamento: FormControl<RegraSelecao>;
  remanejamentoDestino: FormControl<string>;
  remanejamentoPar: FormControl<string>;
  remanejamentoFallback: FormControl<string>;
  acaoQuandoIndeferido: FormControl<AcaoSelecao>;
  baseLegal: FormControl<string>;
}

@Component({
  selector: 'cfg-modalidade-form-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AlertComponent, DialogComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header page-header--form">
      <a class="btn btn--tertiary btn--sm btn--rect cfg-voltar" routerLink="/modalidades">
        <i class="pi pi-chevron-left" aria-hidden="true"></i>
        Voltar à lista
      </a>
      <div class="page-header__content">
        <h1 #tituloPagina class="page-header__title" tabindex="-1">{{ titulo() }}</h1>
        <p class="page-header__desc">
          Configure a natureza legal, a composição das vagas e a cascata de remanejamento. As
          escolhas se condicionam entre si — o resumo abaixo do formulário reflete o efeito atual.
        </p>
      </div>
    </div>

    @if (carregando()) {
      <div class="cfg-form__loading" role="status">
        <ui-spinner size="md" /> Carregando modalidade...
      </div>
    } @else {
      @if (erroCarregar()) {
        <ui-alert variant="danger" heading="Não foi possível carregar a modalidade">
          {{ erroCarregar() }}
        </ui-alert>
      }

      @if (formError()) {
        <ui-alert variant="danger" heading="Não foi possível salvar">{{ formError() }}</ui-alert>
      }

      <form [formGroup]="form" id="cfg-modalidade-form" (ngSubmit)="salvar()" novalidate class="cfg-form">
        <section aria-labelledby="cfg-mod-identificacao" class="form-section">
          <h2 id="cfg-mod-identificacao" class="form-section__title">Identificação</h2>
          <div class="form-grid">
            <label class="field field--full" [class.is-error]="erroDoCampo('codigo')">
              <span class="field__label is-required">Código</span>
              <input
                class="input"
                type="text"
                formControlName="codigo"
                autocapitalize="characters"
                [readonly]="modoEdicao()"
                [attr.aria-invalid]="erroDoCampo('codigo') ? 'true' : null"
                (input)="normalizarCodigo($event)"
                (blur)="verificarCodigoDuplicado()"
              />
              <span class="field__hint">
                Maiúsculas, dígitos e sublinhado (ex.: <code>LB_PPI</code>). Único entre as
                modalidades vivas.
                {{ modoEdicao() ? 'Não pode ser alterado após a criação.' : '' }}
              </span>
              @if (erroDoCampo('codigo')) {
                <span class="field__error">{{ erroDoCampo('codigo') }}</span>
              }
            </label>

            <label class="field field--full" [class.is-error]="erroDoCampo('descricao')">
              <span class="field__label">Descrição</span>
              <input
                class="input"
                type="text"
                formControlName="descricao"
                placeholder="Ex.: Cota PPI baixa renda"
                [attr.aria-invalid]="erroDoCampo('descricao') ? 'true' : null"
              />
              <span class="field__hint">Rótulo legível da modalidade (até {{ descricaoMax }} caracteres).</span>
              @if (erroDoCampo('descricao')) {
                <span class="field__error">{{ erroDoCampo('descricao') }}</span>
              }
            </label>
          </div>
        </section>

        <section aria-labelledby="cfg-mod-vagas" class="form-section">
          <h2 id="cfg-mod-vagas" class="form-section__title">Composição de vagas</h2>
          <div class="form-grid">
            <label class="field field--full" [class.is-error]="erroDoCampo('naturezaLegal')">
              <span class="field__label is-required">Natureza legal</span>
              <select
                class="select"
                formControlName="naturezaLegal"
                [attr.aria-invalid]="erroDoCampo('naturezaLegal') ? 'true' : null"
                (change)="aoMudarNatureza()"
              >
                @for (op of naturezas; track op.value) {
                  <option [value]="op.value">{{ op.label }}</option>
                }
              </select>
              <span class="field__hint">Governa as regras de remanejamento disponíveis.</span>
            </label>

            <label class="field field--full" [class.is-error]="erroDoCampo('composicaoVagas')">
              <span class="field__label is-required">Composição de vagas</span>
              <select
                class="select"
                formControlName="composicaoVagas"
                [attr.aria-invalid]="erroDoCampo('composicaoVagas') ? 'true' : null"
                (change)="aoMudarComposicao()"
              >
                @for (op of composicoes; track op.value) {
                  <option [value]="op.value">{{ op.label }}</option>
                }
              </select>
              <span class="field__hint">"Retira de" exige informar a modalidade de origem.</span>
            </label>

            @if (mostraOrigem()) {
              <label class="field field--full" [class.is-error]="erroDoCampo('composicaoOrigem')">
                <span class="field__label is-required">Origem (modalidade)</span>
                <select
                  class="select"
                  formControlName="composicaoOrigem"
                  [attr.aria-invalid]="erroDoCampo('composicaoOrigem') ? 'true' : null"
                >
                  <option value="">Selecione uma modalidade</option>
                  @for (op of opcoesReferencia(); track op.value) {
                    <option [value]="op.value">{{ op.label }}</option>
                  }
                </select>
                <span class="field__hint">De qual modalidade viva estas vagas são retiradas (por código).</span>
                @if (erroDoCampo('composicaoOrigem')) {
                  <span class="field__error">{{ erroDoCampo('composicaoOrigem') }}</span>
                }
              </label>
            }
          </div>
        </section>

        @if (mostraRemanejamento()) {
          <section aria-labelledby="cfg-mod-remanejamento" class="form-section">
            <h2 id="cfg-mod-remanejamento" class="form-section__title">Remanejamento</h2>
            <div class="form-grid">
              <label class="field field--full" [class.is-error]="erroDoCampo('regraRemanejamento')">
                <span class="field__label is-required">Regra de remanejamento</span>
                <select
                  class="select"
                  formControlName="regraRemanejamento"
                  [attr.aria-invalid]="erroDoCampo('regraRemanejamento') ? 'true' : null"
                  (change)="aoMudarRegra()"
                >
                  <option value="">Selecione uma regra</option>
                  @for (op of regras; track op.value) {
                    <option [value]="op.value" [disabled]="regraDesabilitada(op.value)">
                      {{ op.label }}
                    </option>
                  }
                </select>
                <span class="field__hint">{{ dicaRegra() }}</span>
                @if (erroDoCampo('regraRemanejamento')) {
                  <span class="field__error">{{ erroDoCampo('regraRemanejamento') }}</span>
                }
              </label>

              @if (mostraDestino()) {
                <label class="field field--full" [class.is-error]="erroDoCampo('remanejamentoDestino')">
                  <span class="field__label is-required">Destino</span>
                  <select
                    class="select"
                    formControlName="remanejamentoDestino"
                    [attr.aria-invalid]="erroDoCampo('remanejamentoDestino') ? 'true' : null"
                  >
                    <option value="">Selecione uma modalidade</option>
                    @for (op of opcoesReferencia(); track op.value) {
                      <option [value]="op.value">{{ op.label }}</option>
                    }
                  </select>
                  @if (erroDoCampo('remanejamentoDestino')) {
                    <span class="field__error">{{ erroDoCampo('remanejamentoDestino') }}</span>
                  }
                </label>
              }

              @if (mostraParFallback()) {
                <div class="form-grid--pair">
                  <label class="field" [class.is-error]="erroDoCampo('remanejamentoPar')">
                    <span class="field__label is-required">Par</span>
                    <select
                      class="select"
                      formControlName="remanejamentoPar"
                      [attr.aria-invalid]="erroDoCampo('remanejamentoPar') ? 'true' : null"
                    >
                      <option value="">Selecione uma modalidade</option>
                      @for (op of opcoesReferencia(); track op.value) {
                        <option [value]="op.value">{{ op.label }}</option>
                      }
                    </select>
                    @if (erroDoCampo('remanejamentoPar')) {
                      <span class="field__error">{{ erroDoCampo('remanejamentoPar') }}</span>
                    }
                  </label>
                  <label class="field" [class.is-error]="erroDoCampo('remanejamentoFallback')">
                    <span class="field__label is-required">Fallback</span>
                    <select
                      class="select"
                      formControlName="remanejamentoFallback"
                      [attr.aria-invalid]="erroDoCampo('remanejamentoFallback') ? 'true' : null"
                    >
                      <option value="">Selecione uma modalidade</option>
                      @for (op of opcoesReferencia(); track op.value) {
                        <option [value]="op.value">{{ op.label }}</option>
                      }
                    </select>
                    @if (erroDoCampo('remanejamentoFallback')) {
                      <span class="field__error">{{ erroDoCampo('remanejamentoFallback') }}</span>
                    }
                  </label>
                </div>
              }
            </div>
          </section>
        }

        <section aria-labelledby="cfg-mod-criterios" class="form-section">
          <h2 id="cfg-mod-criterios" class="form-section__title">Critérios e enquadramento</h2>
          <div class="form-grid">
            <div class="field field--full">
              <span class="field__label" id="cfg-mod-criterios-label">Critérios cumulativos</span>
              <div class="cfg-chips-input">
                <input
                  #criterioInput
                  class="input"
                  type="text"
                  placeholder="Ex.: escola pública"
                  aria-labelledby="cfg-mod-criterios-label"
                  (keydown.enter)="adicionarCriterio(criterioInput); $event.preventDefault()"
                />
                <button
                  type="button"
                  class="btn btn--secondary btn--sm btn--rect"
                  (click)="adicionarCriterio(criterioInput)"
                >
                  Adicionar
                </button>
              </div>
              @if (criterios().length > 0) {
                <ul class="cfg-chips" aria-label="Critérios cumulativos adicionados">
                  @for (criterio of criterios(); track criterio) {
                    <li class="cfg-chip">
                      <span>{{ criterio }}</span>
                      <button
                        type="button"
                        class="cfg-chip__remove"
                        [attr.aria-label]="'Remover critério ' + criterio"
                        (click)="removerCriterio(criterio)"
                      >
                        &times;
                      </button>
                    </li>
                  }
                </ul>
              }
              <span class="field__hint">Lista aberta (renda, autodeclaração, laudo, etc.).</span>
            </div>

            <label class="field field--full">
              <span class="field__label">Ação quando indeferido</span>
              <select class="select" formControlName="acaoQuandoIndeferido">
                <option value="">Não se aplica</option>
                @for (op of acoes; track op.value) {
                  <option [value]="op.value">{{ op.label }}</option>
                }
              </select>
              <span class="field__hint">Destino do candidato indeferido nesta modalidade (aplicável a cotas).</span>
            </label>

            <label class="field field--full" [class.is-error]="erroDoCampo('baseLegal')">
              <span class="field__label">Base legal</span>
              <input
                class="input"
                type="text"
                formControlName="baseLegal"
                placeholder="Ex.: Lei 12.711/2012, art. 1º"
                [attr.aria-invalid]="erroDoCampo('baseLegal') ? 'true' : null"
              />
              @if (erroDoCampo('baseLegal')) {
                <span class="field__error">{{ erroDoCampo('baseLegal') }}</span>
              }
            </label>
          </div>
        </section>

        <aside class="cond-diagram" aria-label="Resumo das escolhas" aria-live="polite">
          <h2 class="cond-diagram__title">Como estas vagas se comportam</h2>
          <ul class="cond-diagram__list">
            @for (clausula of resumoCondicional(); track clausula) {
              <li class="cond-diagram__item">{{ clausula }}</li>
            }
          </ul>
        </aside>
      </form>

      <div class="cfg-form-footer">
        <a class="btn btn--tertiary btn--rect" routerLink="/modalidades">Cancelar</a>
        <button type="submit" form="cfg-modalidade-form" class="btn btn--primary" [disabled]="salvando()">
          @if (salvando()) {
            <ui-spinner size="sm" />
          }
          {{ salvando() ? 'Salvando...' : modoEdicao() ? 'Salvar modalidade' : 'Criar modalidade' }}
        </button>
      </div>
    }

    <ui-dialog
      [(visible)]="confirmResetAberto"
      heading="Redefinir remanejamento?"
      (closed)="cancelarResetNatureza()"
    >
      <p>
        A natureza escolhida é incompatível com a regra de remanejamento atual. Se continuar, a
        regra e seus argumentos (destino, par e fallback) serão limpos.
      </p>
      <div uiDialogFooter>
        <button type="button" class="btn btn--tertiary btn--rect" (click)="cancelarResetNatureza()">
          Manter natureza anterior
        </button>
        <button type="button" class="btn btn--danger btn--rect" (click)="confirmarResetNatureza()">
          Redefinir campos
        </button>
      </div>
    </ui-dialog>
  `,
})
export class ModalidadeFormPage {
  private readonly api = inject(ModalidadesApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly naturezas = NATUREZAS_LEGAIS;
  protected readonly composicoes = COMPOSICOES_VAGAS;
  protected readonly regras = REGRAS_REMANEJAMENTO;
  protected readonly acoes = ACOES_QUANDO_INDEFERIDO;
  protected readonly descricaoMax = DESCRICAO_MAX;

  private readonly tituloPagina = viewChild<ElementRef<HTMLHeadingElement>>('tituloPagina');

  private readonly id = signal<string | null>(this.route.snapshot.paramMap.get('id'));
  protected readonly modoEdicao = computed(() => this.id() !== null);
  protected readonly titulo = computed(() =>
    this.modoEdicao() ? 'Editar modalidade' : 'Nova modalidade',
  );

  protected readonly carregando = signal(false);
  protected readonly salvando = signal(false);
  protected readonly erroCarregar = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly tentouSalvar = signal(false);
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());
  protected readonly criterios = signal<readonly string[]>([]);

  /** Modalidades vivas para os selects de referência (origem/destino/par/fallback). */
  private readonly modalidades = lookupCompleto(
    (cursor) => this.api.listar({ cursor, direction: 'next', limit: API_MAX_PAGE_SIZE }),
    this.destroyRef,
  );

  /** Snapshot da modalidade em edição — usado para pré-checar unicidade excluindo a si mesma. */
  private readonly codigoAtual = signal<string | null>(null);

  /** Estado condicional (dirige visibilidade/validação) — derivado dos controles. */
  private readonly natureza = signal<NaturezaLegalToken>(NATUREZA_LEGAL_DEFAULT);
  private readonly composicao = signal<ComposicaoVagasToken>(COMPOSICAO_VAGAS_DEFAULT);
  private readonly regra = signal<RegraSelecao>('');

  private naturezaAnterior: NaturezaLegalToken = NATUREZA_LEGAL_DEFAULT;
  private naturezaPendente: NaturezaLegalToken | null = null;
  protected readonly confirmResetAberto = signal(false);

  protected readonly form: FormGroup<ModalidadeForm> = new FormGroup<ModalidadeForm>({
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(CODIGO_REGEX)],
    }),
    descricao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(DESCRICAO_MAX)],
    }),
    naturezaLegal: new FormControl<NaturezaLegalToken>(NATUREZA_LEGAL_DEFAULT, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    composicaoVagas: new FormControl<ComposicaoVagasToken>(COMPOSICAO_VAGAS_DEFAULT, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    composicaoOrigem: new FormControl('', { nonNullable: true }),
    regraRemanejamento: new FormControl<RegraSelecao>('', { nonNullable: true }),
    remanejamentoDestino: new FormControl('', { nonNullable: true }),
    remanejamentoPar: new FormControl('', { nonNullable: true }),
    remanejamentoFallback: new FormControl('', { nonNullable: true }),
    acaoQuandoIndeferido: new FormControl<AcaoSelecao>('', { nonNullable: true }),
    baseLegal: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(BASE_LEGAL_MAX)],
    }),
  });

  protected readonly mostraRemanejamento = computed(() => this.natureza() !== 'AMPLA');
  protected readonly mostraOrigem = computed(() => this.composicao() === COMPOSICAO_RETIRA_DE);
  protected readonly mostraDestino = computed(() => this.regra() === 'DESTINO_UNICO');
  protected readonly mostraParFallback = computed(() => this.regra() === 'CRUZADO');

  /** Opções de referência: modalidades vivas exceto a própria (por código). */
  protected readonly opcoesReferencia = computed(() => {
    const proprio = this.codigoAtual();
    return this.modalidades.opcoes()
      .filter((m) => m.codigo !== proprio)
      .map((m) => ({ value: m.codigo, label: m.descricao ? `${m.codigo} — ${m.descricao}` : m.codigo }));
  });

  protected readonly dicaRegra = computed(() => {
    switch (this.natureza()) {
      case 'COTA_RESERVADA':
        return 'Cota reservada segue obrigatoriamente a cascata legal.';
      case 'SUPLEMENTAR':
      case 'OUTRA_MODALIDADE':
        return 'Escolha destino único ou remanejamento cruzado.';
      default:
        return 'Selecione a regra de remanejamento aplicável.';
    }
  });

  /** Snapshot reativo dos valores do form — dirige o mapa de condicionais (cond-diagram). */
  private readonly valoresForm = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly resumoCondicional = computed<readonly string[]>(() => {
    const clausulas: string[] = [];
    const natureza = this.natureza();
    const composicao = this.composicao();
    const regra = this.regra();
    this.valoresForm();
    const raw = this.form.getRawValue();

    if (composicao === COMPOSICAO_RETIRA_DE) {
      clausulas.push(
        raw.composicaoOrigem
          ? `As vagas são retiradas da modalidade ${raw.composicaoOrigem}.`
          : 'As vagas são retiradas de outra modalidade (informe a origem).',
      );
    } else {
      const label = COMPOSICOES_VAGAS.find((c) => c.value === composicao)?.label ?? composicao;
      clausulas.push(`Composição das vagas: ${label.toLocaleLowerCase('pt-BR')}.`);
    }

    if (natureza === 'AMPLA') {
      clausulas.push('Ampla concorrência não remaneja vagas ociosas.');
    } else if (natureza === 'COTA_RESERVADA') {
      clausulas.push('Cota reservada: vagas ociosas seguem a cascata legal de remanejamento.');
    } else if (regra === 'DESTINO_UNICO') {
      clausulas.push(
        raw.remanejamentoDestino
          ? `Vagas ociosas remanejam para ${raw.remanejamentoDestino}.`
          : 'Vagas ociosas remanejam para um destino único (informe o destino).',
      );
    } else if (regra === 'CRUZADO') {
      clausulas.push(
        raw.remanejamentoPar && raw.remanejamentoFallback
          ? `Remanejamento cruzado entre ${raw.remanejamentoPar} e ${raw.remanejamentoFallback}.`
          : 'Remanejamento cruzado (informe o par e o fallback).',
      );
    } else {
      clausulas.push('Selecione a regra de remanejamento para esta modalidade.');
    }

    return clausulas;
  });

  constructor() {
    afterNextRender(() => this.tituloPagina()?.nativeElement.focus());
    this.modalidades.recarregar();
    if (this.id() !== null) {
      this.carregarModalidade(this.id() as string);
    } else {
      this.reconciliarCondicionais();
    }
  }

  protected normalizarCodigo(event: Event): void {
    if (this.modoEdicao()) return;
    const alvo = event.target;
    if (!(alvo instanceof HTMLInputElement)) return;
    const normalizado = alvo.value.toLocaleUpperCase('pt-BR');
    if (normalizado !== alvo.value) {
      this.form.controls.codigo.setValue(normalizado);
    }
  }

  protected verificarCodigoDuplicado(): void {
    if (this.modoEdicao()) return;
    const control = this.form.controls.codigo;
    const codigo = control.value.trim();
    const duplicado =
      codigo.length > 0 && this.modalidades.opcoes().some((m) => m.codigo === codigo);
    if (duplicado) {
      control.setErrors({ ...(control.errors ?? {}), duplicado: true });
      control.markAsTouched();
      return;
    }
    if (control.hasError('duplicado')) {
      const erros = { ...(control.errors ?? {}) };
      delete erros['duplicado'];
      control.setErrors(Object.keys(erros).length > 0 ? erros : null);
    }
  }

  protected aoMudarComposicao(): void {
    this.composicao.set(this.form.controls.composicaoVagas.value);
    this.reconciliarCondicionais();
  }

  protected aoMudarRegra(): void {
    this.regra.set(this.form.controls.regraRemanejamento.value);
    this.reconciliarCondicionais();
  }

  protected aoMudarNatureza(): void {
    const nova = this.form.controls.naturezaLegal.value;
    if (nova === this.naturezaAnterior) return;
    // Precisa resetar remanejamento e há dados preenchidos? Pede confirmação (§5).
    if (this.remanejamentoPreenchido() && !this.naturezaCompativelComRegraAtual(nova)) {
      this.naturezaPendente = nova;
      this.confirmResetAberto.set(true);
      return;
    }
    this.aplicarNatureza(nova);
  }

  protected confirmarResetNatureza(): void {
    if (this.naturezaPendente !== null) {
      this.aplicarNatureza(this.naturezaPendente);
    }
    this.naturezaPendente = null;
    this.confirmResetAberto.set(false);
  }

  protected cancelarResetNatureza(): void {
    // Reverte a seleção visual para a natureza anterior, preservando os campos.
    this.form.controls.naturezaLegal.setValue(this.naturezaAnterior, { emitEvent: false });
    this.natureza.set(this.naturezaAnterior);
    this.naturezaPendente = null;
    this.confirmResetAberto.set(false);
  }

  protected regraDesabilitada(valor: RegraRemanejamentoToken): boolean {
    switch (this.natureza()) {
      case 'COTA_RESERVADA':
        return valor !== 'SEGUE_CASCATA';
      case 'SUPLEMENTAR':
      case 'OUTRA_MODALIDADE':
        return valor === 'SEGUE_CASCATA';
      default:
        return false;
    }
  }

  protected adicionarCriterio(input: HTMLInputElement): void {
    const valor = input.value.trim();
    if (valor.length === 0) return;
    if (!this.criterios().some((c) => c.toLocaleLowerCase('pt-BR') === valor.toLocaleLowerCase('pt-BR'))) {
      this.criterios.update((lista) => [...lista, valor]);
    }
    input.value = '';
    input.focus();
  }

  protected removerCriterio(criterio: string): void {
    this.criterios.update((lista) => lista.filter((c) => c !== criterio));
  }

  protected erroDoCampo(nome: keyof ModalidadeForm): string | null {
    const control = this.form.controls[nome];
    const mostrar = control.touched || control.dirty || this.tentouSalvar();
    if (!mostrar || control.errors === null) {
      return null;
    }
    if (control.errors['backend']) {
      const backend = control.errors['backend'] as { code: string; message: string };
      return backend.message;
    }
    if (control.errors['duplicado']) return 'Código já utilizado por outra modalidade viva.';
    if (control.errors['required']) return 'Campo obrigatório.';
    if (control.errors['pattern']) return 'Use apenas maiúsculas, dígitos e sublinhado.';
    if (control.errors['maxlength']) return 'Valor acima do tamanho permitido.';
    return 'Valor inválido.';
  }

  protected salvar(): void {
    if (this.salvando()) return;
    this.tentouSalvar.set(true);
    this.verificarCodigoDuplicado();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focarPrimeiroErro();
      return;
    }
    this.salvando.set(true);
    this.formError.set(null);

    if (this.modoEdicao()) {
      this.api
        .atualizar(this.id() as string, this.montarComandoAtualizar(), withIdempotencyKey(this.idempotencyKeyAtual()))
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((result) => this.tratarResultado(result));
      return;
    }

    this.api
      .criar(this.montarComandoCriar(), withIdempotencyKey(this.idempotencyKeyAtual()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.tratarResultado(result));
  }

  private aplicarNatureza(nova: NaturezaLegalToken): void {
    this.natureza.set(nova);
    this.naturezaAnterior = nova;
    this.reconciliarCondicionais();
  }

  /**
   * Reconcilia validação e valores condicionais espelhando as invariantes do
   * agregado `Modalidade` (uniplus-api #589): coerência natureza↔regra, equivalência
   * composição RETIRA_DE⟺origem e args por regra. Campos inaplicáveis são limpos aqui
   * e também anulados no comando, evitando valores ocultos obsoletos.
   */
  private reconciliarCondicionais(): void {
    const controls = this.form.controls;

    // Composição ↔ Origem.
    if (this.composicao() === COMPOSICAO_RETIRA_DE) {
      controls.composicaoOrigem.setValidators([Validators.required, Validators.maxLength(CODIGO_REFERENCIA_MAX)]);
    } else {
      controls.composicaoOrigem.clearValidators();
      controls.composicaoOrigem.setValue('', { emitEvent: false });
    }
    controls.composicaoOrigem.updateValueAndValidity({ emitEvent: false });

    // Natureza ↔ Regra.
    const natureza = this.natureza();
    if (natureza === 'AMPLA') {
      controls.regraRemanejamento.setValue('', { emitEvent: false });
      controls.regraRemanejamento.clearValidators();
    } else if (natureza === 'COTA_RESERVADA') {
      controls.regraRemanejamento.setValue('SEGUE_CASCATA', { emitEvent: false });
      controls.regraRemanejamento.setValidators([Validators.required]);
    } else {
      // SUPLEMENTAR / OUTRA_MODALIDADE: só DESTINO_UNICO/CRUZADO.
      if (controls.regraRemanejamento.value === 'SEGUE_CASCATA') {
        controls.regraRemanejamento.setValue('', { emitEvent: false });
      }
      controls.regraRemanejamento.setValidators([Validators.required]);
    }
    controls.regraRemanejamento.updateValueAndValidity({ emitEvent: false });
    this.regra.set(controls.regraRemanejamento.value);

    // Regra ↔ Args.
    const regra = controls.regraRemanejamento.value;
    this.configurarArg(controls.remanejamentoDestino, regra === 'DESTINO_UNICO');
    this.configurarArg(controls.remanejamentoPar, regra === 'CRUZADO');
    this.configurarArg(controls.remanejamentoFallback, regra === 'CRUZADO');
  }

  private configurarArg(control: AbstractControl, aplicavel: boolean): void {
    if (aplicavel) {
      control.setValidators([Validators.required, Validators.maxLength(CODIGO_REFERENCIA_MAX)]);
    } else {
      control.clearValidators();
      control.setValue('', { emitEvent: false });
    }
    control.updateValueAndValidity({ emitEvent: false });
  }

  /**
   * Indica se há **argumentos digitados pelo usuário** (destino/par/fallback) que
   * seriam perdidos ao trocar a natureza — só então a confirmação faz sentido. A
   * própria regra é auto-gerida por `reconciliarCondicionais` (ex.: o
   * `SEGUE_CASCATA` que a cota preenche sozinha), então não conta como dado do
   * usuário; considerá-la bloquearia trocas legítimas como COTA_RESERVADA →
   * SUPLEMENTAR sem nada a descartar.
   */
  private remanejamentoPreenchido(): boolean {
    const raw = this.form.getRawValue();
    return (
      raw.remanejamentoDestino !== '' ||
      raw.remanejamentoPar !== '' ||
      raw.remanejamentoFallback !== ''
    );
  }

  private naturezaCompativelComRegraAtual(natureza: NaturezaLegalToken): boolean {
    const regra = this.form.controls.regraRemanejamento.value;
    switch (natureza) {
      case 'AMPLA':
        return regra === '';
      case 'COTA_RESERVADA':
        return regra === 'SEGUE_CASCATA';
      default:
        return regra === 'DESTINO_UNICO' || regra === 'CRUZADO';
    }
  }

  private carregarModalidade(id: string): void {
    this.carregando.set(true);
    this.api
      .obter(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.carregando.set(false);
        if (!result.ok) {
          this.erroCarregar.set(this.problemI18n.resolve(result.problem).title);
          return;
        }
        this.preencher(result.data);
      });
  }

  private preencher(dto: ModalidadeDto): void {
    const natureza = dto.naturezaLegal as NaturezaLegalToken;
    this.codigoAtual.set(dto.codigo);
    this.form.patchValue(
      {
        codigo: dto.codigo,
        descricao: dto.descricao ?? '',
        naturezaLegal: natureza,
        composicaoVagas: dto.composicaoVagas as ComposicaoVagasToken,
        composicaoOrigem: dto.composicaoOrigem ?? '',
        regraRemanejamento: (dto.regraRemanejamento ?? '') as RegraSelecao,
        remanejamentoDestino: dto.remanejamentoDestino ?? '',
        remanejamentoPar: dto.remanejamentoPar ?? '',
        remanejamentoFallback: dto.remanejamentoFallback ?? '',
        acaoQuandoIndeferido: (dto.acaoQuandoIndeferido ?? '') as AcaoSelecao,
        baseLegal: dto.baseLegal ?? '',
      },
      { emitEvent: false },
    );
    this.criterios.set([...dto.criteriosCumulativos]);
    // Código é imutável na edição.
    this.form.controls.codigo.disable({ emitEvent: false });
    this.natureza.set(natureza);
    this.composicao.set(dto.composicaoVagas as ComposicaoVagasToken);
    this.regra.set((dto.regraRemanejamento ?? '') as RegraSelecao);
    this.naturezaAnterior = natureza;
    this.reconciliarCondicionais();
  }

  private tratarResultado(result: ApiResult<string | void>): void {
    this.salvando.set(false);
    if (result.ok) {
      this.notifications.success(
        this.modoEdicao() ? 'Modalidade atualizada' : 'Modalidade criada',
        this.form.getRawValue().codigo,
      );
      this.idempotencyKeyAtual.set(idempotencyKey.create());
      void this.router.navigate(['/modalidades']);
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
    // Unicidade de código (409).
    if (problem.status === 409 || problem.code === 'Modalidade.CodigoJaExiste') {
      this.renovarIdempotencyKey();
      const control = this.form.controls.codigo;
      control.setErrors({ backend: { code: problem.code, message: 'Código já utilizado por outra modalidade viva.' } });
      control.markAsTouched();
      this.formError.set(null);
      return;
    }
    if (problem.code === 'uniplus.idempotency.body_mismatch') {
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
    for (const erro of errors) {
      const controlName = controlNameFromBackendField(erro.field);
      if (controlName === null) continue;
      const control = this.form.controls[controlName];
      control.setErrors({ backend: { code: erro.code, message: erro.message } });
      control.markAsTouched();
      aplicouAlgum = true;
    }
    this.formError.set(
      aplicouAlgum ? null : 'Não foi possível mapear os erros de validação. Revise os campos.',
    );
  }

  /**
   * Campos comuns aos comandos de criação e atualização (tudo exceto código/id),
   * derivados **inteiramente** de `getRawValue()` (fonte única no submit). Campos
   * inaplicáveis são anulados aqui espelhando as invariantes do agregado, evitando
   * qualquer divergência entre o valor do form e o estado condicional em signals.
   */
  private montarCamposComuns(): Omit<CriarModalidadeCommand, 'codigo'> {
    const raw = this.form.getRawValue();
    const retiraDe = raw.composicaoVagas === COMPOSICAO_RETIRA_DE;
    const regra: string | null =
      raw.naturezaLegal === 'AMPLA' || raw.regraRemanejamento === '' ? null : raw.regraRemanejamento;
    return {
      descricao: normalizarOpcional(raw.descricao),
      naturezaLegal: raw.naturezaLegal,
      composicaoVagas: raw.composicaoVagas,
      composicaoOrigem: retiraDe ? normalizarOpcional(raw.composicaoOrigem) : null,
      regraRemanejamento: regra,
      remanejamentoDestino: regra === 'DESTINO_UNICO' ? normalizarOpcional(raw.remanejamentoDestino) : null,
      remanejamentoPar: regra === 'CRUZADO' ? normalizarOpcional(raw.remanejamentoPar) : null,
      remanejamentoFallback: regra === 'CRUZADO' ? normalizarOpcional(raw.remanejamentoFallback) : null,
      criteriosCumulativos: this.criterios().length > 0 ? [...this.criterios()] : null,
      acaoQuandoIndeferido: normalizarOpcional(raw.acaoQuandoIndeferido),
      baseLegal: normalizarOpcional(raw.baseLegal),
    };
  }

  private montarComandoCriar(): CriarModalidadeCommand {
    return {
      codigo: normalizarOpcional(this.form.getRawValue().codigo),
      ...this.montarCamposComuns(),
    };
  }

  private montarComandoAtualizar(): AtualizarModalidadeCommand {
    // Código é imutável — não vai no comando de atualização.
    return { id: this.id() as string, ...this.montarCamposComuns() };
  }

  private focarPrimeiroErro(): void {
    const primeiro = document.querySelector<HTMLElement>('.cfg-form .is-error .input, .cfg-form .is-error .select');
    primeiro?.focus();
  }
}

function normalizarOpcional(valor: string | null | undefined): string | null {
  if (valor === null || valor === undefined) return null;
  const trimmed = valor.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const MODALIDADE_CONTROL_NAMES: ReadonlySet<string> = new Set<keyof ModalidadeForm>([
  'codigo',
  'descricao',
  'naturezaLegal',
  'composicaoVagas',
  'composicaoOrigem',
  'regraRemanejamento',
  'remanejamentoDestino',
  'remanejamentoPar',
  'remanejamentoFallback',
  'acaoQuandoIndeferido',
  'baseLegal',
]);

function controlNameFromBackendField(field: string): keyof ModalidadeForm | null {
  const normalized =
    field
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/u, '') ?? field;
  const camelCase = normalized.charAt(0).toLocaleLowerCase('pt-BR') + normalized.slice(1);
  return MODALIDADE_CONTROL_NAMES.has(camelCase) ? (camelCase as keyof ModalidadeForm) : null;
}
