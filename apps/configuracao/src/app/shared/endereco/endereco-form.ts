import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  ControlValueAccessor,
  FormControl,
  FormGroup,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import { debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import {
  CepResolvidoDto,
  CidadeResumoDto,
  GeoApi,
  type NivelResolucao,
} from '@uniplus/shared-data/geo';
import { SpinnerComponent } from '@uniplus/shared-ui/components';
import {
  CampoEndereco,
  CidadeRef,
  EnderecoEstruturado,
  ORIGEM_GEO,
  ORIGEM_MANUAL,
  camposAncorados,
  normalizarNivel,
} from './endereco.model';

/** Debounce da busca textual de cidade (uma request por rajada, não por tecla). */
const BUSCA_DEBOUNCE_MS = 300;

/** Tamanho da janela do seletor de cidade (cursor pagination, ADR-0026). */
const CIDADES_LIMIT = 20;

interface EnderecoFormControls {
  cep: FormControl<string>;
  logradouro: FormControl<string>;
  numero: FormControl<string>;
  complemento: FormControl<string>;
  bairro: FormControl<string>;
  distrito: FormControl<string>;
  latitude: FormControl<string>;
  longitude: FormControl<string>;
}

/**
 * Componente reutilizável de endereço estruturado (referência ao Geo, ADR-0096),
 * consumido pelas telas de Instituição, Campus e Local de Oferta (story #412).
 *
 * Implementa `ControlValueAccessor` sobre um `EnderecoEstruturado | null`. Dois
 * fluxos:
 *
 * - **Autofill por CEP** (CA-01): o usuário informa o CEP, o componente resolve
 *   via `GET /api/cep/{cep}` e preenche o formulário. Os campos resolvidos pelo
 *   DNE ficam **read-only (âncora)** conforme o `nivelResolucao`; os não
 *   resolvidos ficam editáveis (`camposAncorados`). `numero`/`complemento` são
 *   sempre editáveis (dado próprio, fora do DNE).
 * - **Fallback manual / sem CEP** (CA-02): o usuário escolhe a cidade pelo
 *   seletor (`GET /api/cidades`) e digita o endereço manualmente.
 *
 * Erros de CEP (formato/404) são exibidos inline (CA-06); o erro de coerência
 * cidade↔CEP (422) do backend chega via `erroExterno` do parent. Acessibilidade
 * WCAG 2.1 AA / e-MAG (CA-05): `fieldset/legend`, labels associadas,
 * `aria-invalid`/`aria-describedby`, estados read-only anunciados.
 */
@Component({
  selector: 'cfg-endereco-form',
  standalone: true,
  imports: [ReactiveFormsModule, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="cfg-endereco" [disabled]="disabled()">
      <legend class="form-section__title">{{ legend() }}</legend>

      <div class="form-grid">
        <div class="field" [class.is-error]="cepErro() !== null">
          <label [for]="id('cep')" class="field__label">CEP</label>
          <div class="input-group">
            <input
              [id]="id('cep')"
              class="input"
              type="text"
              inputmode="numeric"
              autocomplete="postal-code"
              placeholder="00000-000"
              maxlength="9"
              [formControl]="form.controls.cep"
              [readonly]="ehAncorado('cep')"
              [attr.aria-readonly]="ehAncorado('cep') ? 'true' : null"
              [attr.aria-invalid]="cepErro() !== null ? 'true' : null"
              [attr.aria-describedby]="cepErro() !== null ? id('cep') + '-error' : null"
              (blur)="aoSairDoCep()"
            />
            <button
              type="button"
              class="btn btn--secondary btn--rect"
              [disabled]="disabled() || resolvendoCep() || ehAncorado('cep')"
              [attr.aria-busy]="resolvendoCep() ? 'true' : null"
              (click)="resolverCep()"
            >
              @if (resolvendoCep()) {
                <ui-spinner size="sm" />
              }
              Buscar CEP
            </button>
          </div>
          <span class="field__hint">
            Informe o CEP para preencher o endereço automaticamente, ou
            <button type="button" class="cfg-link-button" (click)="alternarModoManual()">
              {{ modoManual() ? 'voltar a buscar por CEP' : 'preencher sem CEP' }}
            </button>
            .
          </span>
          @if (cepErro(); as erro) {
            <span [id]="id('cep') + '-error'" class="field__error" role="alert">{{ erro }}</span>
          }
        </div>

        @if (modoManual()) {
          <div class="field field--full">
            <label [for]="id('cidade-busca')" class="field__label is-required">Cidade</label>
            <input
              [id]="id('cidade-busca')"
              class="input"
              type="search"
              autocomplete="off"
              placeholder="Buscar cidade por nome..."
              [value]="buscaCidade()"
              (input)="buscaCidade.set(valorDoInput($event))"
            />
            <select
              class="select"
              [attr.aria-label]="'Selecionar cidade'"
              (change)="selecionarCidade($event)"
            >
              <option value="">
                {{ buscandoCidades() ? 'Buscando…' : 'Selecione a cidade' }}
              </option>
              @for (opcao of cidadeOpcoes(); track opcao.codigoIbge) {
                <option [value]="opcao.codigoIbge" [selected]="opcao.codigoIbge === cidade()?.codigoIbge">
                  {{ opcao.nome }} — {{ opcao.uf }}
                </option>
              }
            </select>
            @if (cidade(); as c) {
              <span class="field__hint">Cidade selecionada: {{ c.nome }} — {{ c.uf }}</span>
            }
          </div>
        } @else if (cidade(); as c) {
          <div class="field field--full">
            <span class="field__label">Cidade</span>
            <output class="field__readonly" [attr.aria-label]="'Cidade resolvida pelo CEP'">
              {{ c.nome }} — {{ c.uf }}
            </output>
          </div>
        }

        <div class="field field--full">
          <label [for]="id('logradouro')" class="field__label">Logradouro</label>
          <input
            [id]="id('logradouro')"
            class="input"
            type="text"
            autocomplete="address-line1"
            [formControl]="form.controls.logradouro"
            [readonly]="ehAncorado('logradouro')"
            [attr.aria-readonly]="ehAncorado('logradouro') ? 'true' : null"
          />
          @if (ehAncorado('logradouro')) {
            <span class="field__hint">Preenchido pelo CEP.</span>
          }
        </div>

        <div class="field">
          <label [for]="id('numero')" class="field__label">Número</label>
          <input
            [id]="id('numero')"
            class="input"
            type="text"
            autocomplete="off"
            [formControl]="form.controls.numero"
          />
          <span class="field__hint">Dado próprio — sempre editável.</span>
        </div>

        <div class="field">
          <label [for]="id('complemento')" class="field__label">Complemento</label>
          <input
            [id]="id('complemento')"
            class="input"
            type="text"
            autocomplete="off"
            [formControl]="form.controls.complemento"
          />
        </div>

        <div class="field">
          <label [for]="id('bairro')" class="field__label">Bairro</label>
          <input
            [id]="id('bairro')"
            class="input"
            type="text"
            autocomplete="address-level3"
            [formControl]="form.controls.bairro"
            [readonly]="ehAncorado('bairro')"
            [attr.aria-readonly]="ehAncorado('bairro') ? 'true' : null"
          />
          @if (ehAncorado('bairro')) {
            <span class="field__hint">Preenchido pelo CEP.</span>
          }
        </div>

        <div class="field">
          <label [for]="id('distrito')" class="field__label">Distrito</label>
          <input
            [id]="id('distrito')"
            class="input"
            type="text"
            autocomplete="off"
            [formControl]="form.controls.distrito"
            [readonly]="ehAncorado('distrito')"
            [attr.aria-readonly]="ehAncorado('distrito') ? 'true' : null"
          />
          @if (ehAncorado('distrito')) {
            <span class="field__hint">Preenchido pelo CEP.</span>
          }
        </div>
      </div>

      @if (erroExterno(); as erro) {
        <p class="field__error" role="alert">{{ erro }}</p>
      }
    </fieldset>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => EnderecoFormComponent),
      multi: true,
    },
  ],
})
export class EnderecoFormComponent implements ControlValueAccessor {
  private readonly geo = inject(GeoApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);

  /** Prefixo dos `id`/`for` — único por instância para a11y (CA-05). */
  readonly idPrefix = input('endereco');
  /** Texto do `<legend>` do grupo. */
  readonly legend = input('Endereço');
  /** Erro de coerência cidade↔CEP (422) ou de campo vindo do backend (CA-06). */
  readonly erroExterno = input<string | null>(null);

  protected readonly disabled = signal(false);
  protected readonly resolvendoCep = signal(false);
  protected readonly cepErro = signal<string | null>(null);
  protected readonly modoManual = signal(false);
  protected readonly cidade = signal<CidadeRef | null>(null);
  protected readonly buscaCidade = signal('');
  protected readonly cidadeOpcoes = signal<readonly CidadeResumoDto[]>([]);
  protected readonly buscandoCidades = signal(false);

  /** Gatilho reativo da busca de cidade: modo manual + termo digitado. */
  private readonly buscaParams = computed(() => ({
    manual: this.modoManual(),
    termo: this.buscaCidade().trim(),
  }));

  /** Nível de resolução vigente — governa os campos ancorados (read-only). */
  private readonly nivel = signal<NivelResolucao | null>(null);
  /** Proveniência do endereço (`geo-api` quando do CEP, `manual` sem CEP). */
  private readonly origem = signal<string | null>(null);
  /**
   * Conjunto de campos ancorados (read-only) pelo `nivelResolucao` corrente.
   * Entrada manual (`origem === 'manual'`) não ancora nada — todo campo fica
   * editável, inclusive ao recarregar um endereço gravado manualmente.
   */
  protected readonly ancorados = computed(() =>
    this.origem() === ORIGEM_MANUAL ? new Set<CampoEndereco>() : camposAncorados(this.nivel()),
  );

  protected readonly form: FormGroup<EnderecoFormControls> = new FormGroup<EnderecoFormControls>({
    cep: new FormControl('', { nonNullable: true }),
    logradouro: new FormControl('', { nonNullable: true }),
    numero: new FormControl('', { nonNullable: true }),
    complemento: new FormControl('', { nonNullable: true }),
    bairro: new FormControl('', { nonNullable: true }),
    distrito: new FormControl('', { nonNullable: true }),
    latitude: new FormControl('', { nonNullable: true }),
    longitude: new FormControl('', { nonNullable: true }),
  });

  private onChange: (value: EnderecoEstruturado | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  /** Último CEP (8 dígitos) resolvido — evita refazer a busca no blur sem mudança. */
  private cepResolvido = '';

  constructor() {
    // Mudanças no formulário propagam o valor montado ao FormControl do parent.
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.emitir());

    // Busca de cidade do fluxo manual — só dispara no modo manual (evita request
    // ocioso ao montar) e debounced (uma request por rajada, cancela a anterior).
    toObservable(this.buscaParams)
      .pipe(
        debounceTime(BUSCA_DEBOUNCE_MS),
        distinctUntilChanged((a, b) => a.manual === b.manual && a.termo === b.termo),
        filter((p) => p.manual),
        switchMap((p) => {
          this.buscandoCidades.set(true);
          return this.geo.listarCidades(
            p.termo.length > 0 ? { q: p.termo, limit: CIDADES_LIMIT } : { limit: CIDADES_LIMIT },
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.buscandoCidades.set(false);
        this.cidadeOpcoes.set(result.ok ? result.data : []);
      });
  }

  writeValue(value: EnderecoEstruturado | null): void {
    if (value === null) {
      this.form.reset(
        { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', distrito: '', latitude: '', longitude: '' },
        { emitEvent: false },
      );
      this.cidade.set(null);
      this.nivel.set(null);
      this.origem.set(null);
      this.modoManual.set(false);
      this.cepErro.set(null);
      this.cepResolvido = '';
      return;
    }

    this.form.setValue(
      {
        cep: value.cep ?? '',
        logradouro: value.logradouro ?? '',
        numero: value.numero ?? '',
        complemento: value.complemento ?? '',
        bairro: value.bairro ?? '',
        distrito: value.distrito ?? '',
        latitude: value.latitude ?? '',
        longitude: value.longitude ?? '',
      },
      { emitEvent: false },
    );
    this.cidade.set(value.cidade);
    const nivel = normalizarNivel(value.nivelResolucao);
    this.nivel.set(nivel);
    this.origem.set(value.origem);
    this.cepResolvido = (value.cep ?? '').replace(/\D/g, '');
    // Endereço gravado manualmente reabre em modo manual (tudo editável).
    this.modoManual.set(value.origem === ORIGEM_MANUAL);
    this.cepErro.set(null);
  }

  registerOnChange(fn: (value: EnderecoEstruturado | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
    if (isDisabled) {
      this.form.disable({ emitEvent: false });
    } else {
      this.form.enable({ emitEvent: false });
    }
  }

  protected id(campo: string): string {
    return `${this.idPrefix()}-${campo}`;
  }

  protected ehAncorado(campo: CampoEndereco): boolean {
    return this.ancorados().has(campo);
  }

  protected valorDoInput(event: Event): string {
    return event.target instanceof HTMLInputElement ? event.target.value : '';
  }

  /** Resolve o CEP no blur apenas quando há 8 dígitos novos (evita request redundante). */
  protected aoSairDoCep(): void {
    this.onTouched();
    const digitos = this.form.controls.cep.value.replace(/\D/g, '');
    if (digitos.length === 8 && digitos !== this.cepResolvido) {
      this.resolverCep();
    }
  }

  protected resolverCep(): void {
    if (this.resolvendoCep() || this.disabled()) {
      return;
    }
    const digitos = this.form.controls.cep.value.replace(/\D/g, '');
    if (digitos.length !== 8) {
      this.cepErro.set('Informe um CEP com 8 dígitos.');
      return;
    }

    this.resolvendoCep.set(true);
    this.cepErro.set(null);
    this.geo
      .obterCep(digitos)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.resolvendoCep.set(false);
        if (result.ok) {
          this.aplicarCepResolvido(result.data, digitos);
          return;
        }
        if (result.status === 404) {
          // CEP não encontrado: mantém os campos editáveis para entrada manual.
          this.nivel.set(null);
          this.cepErro.set('CEP não encontrado. Verifique ou preencha o endereço manualmente.');
          return;
        }
        if (result.status === 400) {
          this.cepErro.set('CEP em formato inválido.');
          return;
        }
        this.cepErro.set(this.problemI18n.resolve(result.problem).title);
      });
  }

  private aplicarCepResolvido(dto: CepResolvidoDto, digitos: string): void {
    this.modoManual.set(false);
    this.cepResolvido = digitos;
    this.cidade.set({ codigoIbge: dto.codigoIbge, nome: dto.cidade, uf: dto.uf });
    this.nivel.set(normalizarNivel(dto.nivelResolucao));
    this.origem.set(dto.origem ?? ORIGEM_GEO);
    this.form.patchValue(
      {
        cep: dto.cep,
        logradouro: dto.logradouro ?? '',
        bairro: dto.bairro ?? '',
        distrito: dto.distrito ?? '',
        latitude: textoDeCoordenada(dto.latitude),
        longitude: textoDeCoordenada(dto.longitude),
      },
      { emitEvent: false },
    );
    this.emitir();
  }

  /** Alterna entre autofill por CEP e preenchimento manual (sem CEP). */
  protected alternarModoManual(): void {
    const manual = !this.modoManual();
    this.modoManual.set(manual);
    this.cepErro.set(null);
    if (manual) {
      // Entrada manual: libera todos os campos (nada ancorado) e marca a origem.
      this.nivel.set(null);
      this.origem.set(ORIGEM_MANUAL);
      if (this.cidadeOpcoes().length === 0) {
        this.buscaCidade.set('');
      }
    }
    this.emitir();
  }

  protected selecionarCidade(event: Event): void {
    const codigo = event.target instanceof HTMLSelectElement ? event.target.value : '';
    const selecionada = this.cidadeOpcoes().find((c) => c.codigoIbge === codigo);
    this.cidade.set(
      selecionada ? { codigoIbge: selecionada.codigoIbge, nome: selecionada.nome, uf: selecionada.uf } : null,
    );
    this.origem.set(ORIGEM_MANUAL);
    this.onTouched();
    this.emitir();
  }

  private emitir(): void {
    const raw = this.form.getRawValue();
    const cidade = this.cidade();
    const algumPreenchido =
      cidade !== null ||
      Object.values(raw).some((v) => v.trim().length > 0);

    if (!algumPreenchido) {
      this.onChange(null);
      return;
    }

    this.onChange({
      cep: vazioParaNulo(raw.cep),
      logradouro: vazioParaNulo(raw.logradouro),
      numero: vazioParaNulo(raw.numero),
      complemento: vazioParaNulo(raw.complemento),
      bairro: vazioParaNulo(raw.bairro),
      distrito: vazioParaNulo(raw.distrito),
      cidade,
      latitude: vazioParaNulo(raw.latitude),
      longitude: vazioParaNulo(raw.longitude),
      nivelResolucao: this.nivel(),
      origem: this.origem(),
    });
  }
}

function vazioParaNulo(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Coordenada do DTO (`string | number | null`) → texto do form control. */
function textoDeCoordenada(valor: string | number | null | undefined): string {
  return valor === null || valor === undefined ? '' : String(valor);
}
