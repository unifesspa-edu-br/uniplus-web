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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ControlValueAccessor,
  FormControl,
  FormGroup,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  type ValidationErrors,
  type Validator,
} from '@angular/forms';
import { ProblemI18nService, STATUS_HTTP } from '@uniplus/shared-core/http';
import { UNIDADES_FEDERATIVAS } from '@uniplus/shared-utils';
import { NomesDeMunicipios, ValorDeMunicipioComponent } from '../editor-de-condicoes/valor-de-municipio';
import { SpinnerComponent } from '../spinner/spinner';
import {
  BUSCA_DE_CEP,
  type CampoEndereco,
  type CepEncontrado,
  type CidadeRef,
  type EnderecoEstruturado,
  type NivelResolucao,
  ORIGEM_GEO,
  ORIGEM_MANUAL,
  camposAncorados,
  normalizarNivel,
} from './endereco-geo.model';


const URL_BUSCA_DE_CEP_DOS_CORREIOS = 'https://buscacepinter.correios.com.br';
const LIMITE_DO_COMPLEMENTO = 300;
/** Origens do Geo: o CEP cai numa faixa (`faixa-cidade`, `faixa-bairro`, `faixa-distrito`) ou é o CEP geral. */
const PREFIXO_ORIGEM_FAIXA = 'faixa-';
const ORIGEM_CEP_GERAL = 'cep-geral';
/** Sentinela do erro de CEP inexistente quando o endereço exige CEP (mensagem com link). */
const CEP_SEM_REGISTRO = 'CEP_SEM_REGISTRO';

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
 * consumido pelas telas de Instituição, Campus e Local de Oferta e pelo campo de
 * endereço do formulário do candidato. O Geo chega por injeção: `BUSCA_DE_CEP` e
 * `BUSCA_DE_MUNICIPIOS`, providos por quem hospeda o componente.
 *
 * Implementa `ControlValueAccessor` sobre um `EnderecoEstruturado | null`. Dois
 * fluxos:
 *
 * - **Autofill por CEP** (CA-01): o usuário informa o CEP, o componente resolve
 *   pela busca de CEP e preenche o formulário. Os campos resolvidos pelo
 *   DNE ficam **read-only (âncora)** conforme o `nivelResolucao`; os não
 *   resolvidos ficam editáveis (`camposAncorados`). `numero`/`complemento` são
 *   dado próprio, sempre editáveis e nunca preenchidos pelo CEP: o complemento do
 *   DNE descreve o CEP ("lado par", "Clique e Retire Correios"), não a residência.
 * - **Fallback manual / sem CEP** (CA-02): o usuário escolhe a cidade pelo
 *   campo de município com busca e digita o endereço manualmente.
 *
 * Um CEP já resolvido pode ser corrigido via botão "Trocar CEP" — reabre só o
 * campo CEP (`iniciarEdicaoCep`) sem descartar o restante do endereço já
 * preenchido; uma nova resolução bem-sucedida re-ancora o campo. #438.
 *
 * Erros de CEP (formato/404) são exibidos inline (CA-06); o erro de coerência
 * cidade↔CEP (422) do backend chega via `erroExterno` do parent. Acessibilidade
 * WCAG 2.1 AA / e-MAG (CA-05): `fieldset/legend`, labels associadas,
 * `aria-invalid`/`aria-describedby`, estados read-only anunciados.
 */
@Component({
  selector: 'ui-endereco-geo',
  standalone: true,
  imports: [ReactiveFormsModule, SpinnerComponent, ValorDeMunicipioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .endereco-geo__cidade {
      display: flex;
      gap: var(--space-2);
      align-items: flex-start;
    }
    .endereco-geo__cidade > ui-valor-de-municipio {
      flex: 1;
      min-inline-size: 0;
    }
    .endereco-geo__contagem {
      display: block;
      text-align: end;
    }
    .endereco-geo__link {
      padding: 0;
      color: inherit;
      background: transparent;
      border: 0;
      font: inherit;
      text-align: left;
      text-decoration: underline;
      cursor: pointer;
    }
  `,
  template: `
    <fieldset class="endereco-geo" [disabled]="disabled()" [attr.aria-describedby]="descritoPor()">
      <legend
        [class]="aparencia() === 'campo' ? 'field__label' : 'form-section__title'"
        [class.is-required]="obrigatorio()"
      >
        {{ legend() }}
      </legend>

      <div class="form-grid">
        <div class="field" [class.is-error]="cepErro() !== null || cepPendente()">
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
              [readonly]="(ehAncorado('cep') && !editandoCep()) || resolvendoCep()"
              [attr.aria-readonly]="(ehAncorado('cep') && !editandoCep()) || resolvendoCep() ? 'true' : null"
              [attr.aria-invalid]="cepErro() !== null ? 'true' : null"
              [attr.aria-describedby]="cepErro() !== null ? id('cep') + '-hint ' + id('cep') + '-error' : id('cep') + '-hint'"
              (blur)="aoSairDoCep()"
            />
            @if (ehAncorado('cep') && !editandoCep()) {
              <button
                type="button"
                class="btn btn--secondary btn--rect"
                [disabled]="disabled()"
                (click)="iniciarEdicaoCep()"
              >
                Trocar CEP
              </button>
            } @else {
              <button
                type="button"
                class="btn btn--secondary btn--rect"
                [disabled]="disabled() || resolvendoCep()"
                [attr.aria-busy]="resolvendoCep() ? 'true' : null"
                (click)="resolverCep()"
              >
                @if (resolvendoCep()) {
                  <ui-spinner size="sm" />
                }
                Buscar CEP
              </button>
            }
          </div>
          @if (exigeCep()) {
            <span [id]="id('cep') + '-hint'" class="field__hint">
              Informe o CEP para preencher o endereço automaticamente.
            </span>
          } @else {
            <span [id]="id('cep') + '-hint'" class="field__hint">
              Informe o CEP para preencher o endereço automaticamente, ou
              <button type="button" class="endereco-geo__link" (click)="alternarModoManual()">
                {{ modoManual() ? 'voltar a buscar por CEP' : 'preencher sem CEP' }}
              </button>
              .
            </span>
          }
          @if (cepGeral() && cidade(); as c) {
            <span [id]="id('cep') + '-geral'" class="field__hint">
              Este é o CEP geral de {{ c.nome }}/{{ c.uf }}
            </span>
          }
          @if (cepEmFaixa() && cidade(); as c) {
            <p [id]="id('cep') + '-faixa'" class="field__error" role="alert">
              O CEP {{ form.controls.cep.value }} não corresponde a uma rua cadastrada nos Correios.
              Ele fica na faixa de CEPs de {{ c.nome }}/{{ c.uf }}. Se você digitou errado, corrija;
              se o seu endereço usa o CEP geral da cidade ou do bairro, confirme abaixo.
            </p>
            <label class="checkbox">
              <input
                type="checkbox"
                [checked]="cepConfirmado()"
                [attr.aria-invalid]="cepDeFaixaSemConfirmacao() ? 'true' : null"
                [attr.aria-describedby]="id('cep') + '-faixa'"
                [disabled]="disabled()"
                (change)="confirmarCep($event)"
              />
              <span class="checkbox__box" aria-hidden="true"></span>
              Confirmo que este é o CEP que uso no meu endereço
            </label>
            @if (cepDeFaixaSemConfirmacao()) {
              <span [id]="id('cep') + '-confirmacao'" class="field__error" role="alert">
                Confirme o CEP ou corrija-o para continuar.
              </span>
            }
          }
          @if (cepSemRegistro()) {
            <span [id]="id('cep') + '-error'" class="field__error" role="alert">
              CEP não encontrado. Confira o seu CEP na
              <a
                [href]="urlBuscaDeCepDosCorreios"
                target="_blank"
                rel="noopener noreferrer"
                >busca de CEP dos Correios (abre em nova aba)</a
              >; se o seu bairro não tem CEP próprio, use o CEP geral da sua cidade e descreva o
              endereço real no complemento.
            </span>
          } @else if (cepErro(); as erro) {
            <span [id]="id('cep') + '-error'" class="field__error" role="alert">{{ erro }}</span>
          } @else if (cepPendente()) {
            <span class="field__error" role="alert">
              Valide o CEP em "Buscar CEP" ou limpe o campo para continuar.
            </span>
          }
        </div>

        @if (modoManual()) {
          <div class="field">
            <label [for]="id('uf')" class="field__label is-required">UF</label>
            <select
              class="select"
              [id]="id('uf')"
              [disabled]="disabled()"
              (change)="escolherUf(valorDoSelect($event))"
            >
              <option value="" [selected]="ufDaCidade() === ''">Selecione a UF</option>
              @for (uf of unidadesFederativas; track uf.sigla) {
                <option [value]="uf.sigla" [selected]="uf.sigla === ufDaCidade()">{{ uf.nome }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field__label is-required" [attr.for]="municipio.campoId()">Cidade</label>
            <div class="endereco-geo__cidade">
              <ui-valor-de-municipio
                #municipio
                rotulo="Cidade"
                [values]="codigoDaCidade()"
                [uf]="ufDaCidade() || null"
                [disabled]="disabled() || ufDaCidade() === ''"
                [invalido]="!!erroExterno()"
                [descritoPor]="erroExterno() ? id('erro') : ufDaCidade() === '' ? id('cidade-uf') : null"
                [contagemVisivel]="false"
                (valuesChange)="selecionarCidade($event.at(0) ?? '')"
              />
              @if (cidade() && !disabled()) {
                <button
                  type="button"
                  class="btn btn--secondary btn--rect"
                  aria-label="Limpar cidade"
                  (click)="selecionarCidade('')"
                >
                  Limpar
                </button>
              }
            </div>
            @if (ufDaCidade() === '') {
              <span class="field__hint" [id]="id('cidade-uf')">Escolha antes a UF.</span>
            }
          </div>
        } @else if (cidade(); as c) {
          <div class="field">
            <label [for]="id('uf')" class="field__label">UF</label>
            <input [id]="id('uf')" class="input" type="text" [value]="c.uf" readonly aria-readonly="true" />
            <span class="field__hint">Preenchida pelo CEP.</span>
          </div>
          <div class="field">
            <label [for]="id('cidade')" class="field__label">Cidade</label>
            <input [id]="id('cidade')" class="input" type="text" [value]="c.nome" readonly aria-readonly="true" />
            <span class="field__hint">Preenchida pelo CEP.</span>
          </div>
        }

        <!-- Detalhes do endereço só quando há CEP resolvido: sem resolução o
             backend não persiste endereço estruturado (só a cidade). #412 -->
        @if (mostrarDetalheEndereco()) {
        <div class="field form-grid__full">
          <label
            [for]="id('logradouro')"
            class="field__label"
            [class.is-required]="logradouroBairroObrigatorios()"
            >Logradouro</label
          >
          <input
            [id]="id('logradouro')"
            class="input"
            type="text"
            autocomplete="address-line1"
            [formControl]="form.controls.logradouro"
            [readonly]="ehAncorado('logradouro')"
            [attr.aria-readonly]="ehAncorado('logradouro') ? 'true' : null"
            [attr.aria-required]="logradouroBairroObrigatorios() ? 'true' : null"
            [attr.aria-invalid]="faltaPreencher('logradouro') ? 'true' : null"
            [attr.aria-describedby]="faltaPreencher('logradouro') ? id('logradouro') + '-error' : null"
          />
          @if (ehAncorado('logradouro')) {
            <span class="field__hint">Preenchido pelo CEP.</span>
          }
          @if (faltaPreencher('logradouro')) {
            <span [id]="id('logradouro') + '-error'" class="field__error" role="alert">
              Informe o logradouro.
            </span>
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

        @if (exigeCep()) {
          <div class="field form-grid__full">
            <label [for]="id('complemento')" class="field__label">Complemento</label>
            <textarea
              [id]="id('complemento')"
              class="textarea"
              rows="3"
              autocomplete="off"
              [attr.maxlength]="limiteDoComplemento"
              [attr.aria-describedby]="id('complemento') + '-hint ' + id('complemento') + '-contagem'"
              [formControl]="form.controls.complemento"
            ></textarea>
            <span [id]="id('complemento') + '-hint'" class="field__hint">
              Use para indicar ponto de referência ou o endereço real, quando o CEP for o geral da
              cidade ou de outro bairro.
            </span>
            <span [id]="id('complemento') + '-contagem'" class="field__hint endereco-geo__contagem">
              {{ tamanhoDoComplemento() }} de {{ limiteDoComplemento }} caracteres
            </span>
          </div>
        } @else {
        <div class="field">
          <label [for]="id('complemento')" class="field__label">Complemento</label>
          <input
            [id]="id('complemento')"
            class="input"
            type="text"
            autocomplete="off"
            [formControl]="form.controls.complemento"
          />
          <span class="field__hint">Dado próprio — sempre editável.</span>
        </div>
        }

        @if (!semValorDoCep('bairro')) {
        <div class="field">
          <label
            [for]="id('bairro')"
            class="field__label"
            [class.is-required]="logradouroBairroObrigatorios()"
            >Bairro</label
          >
          <input
            [id]="id('bairro')"
            class="input"
            type="text"
            autocomplete="address-level3"
            [formControl]="form.controls.bairro"
            [readonly]="ehAncorado('bairro')"
            [attr.aria-readonly]="ehAncorado('bairro') ? 'true' : null"
            [attr.aria-required]="logradouroBairroObrigatorios() ? 'true' : null"
            [attr.aria-invalid]="faltaPreencher('bairro') ? 'true' : null"
            [attr.aria-describedby]="faltaPreencher('bairro') ? id('bairro') + '-error' : null"
          />
          @if (ehAncorado('bairro')) {
            <span class="field__hint">Preenchido pelo CEP.</span>
          }
          @if (faltaPreencher('bairro')) {
            <span [id]="id('bairro') + '-error'" class="field__error" role="alert">
              Informe o bairro.
            </span>
          }
        </div>
        }

        @if (!semValorDoCep('distrito')) {
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
        }
        }
      </div>

      @if (erroExterno(); as erro) {
        <p [id]="id('erro')" class="field__error" role="alert">{{ erro }}</p>
      }
    </fieldset>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => EnderecoGeoComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => EnderecoGeoComponent),
      multi: true,
    },
  ],
})
export class EnderecoGeoComponent implements ControlValueAccessor, Validator {
  private readonly buscaDeCep = inject(BUSCA_DE_CEP);
  private readonly municipios = inject(NomesDeMunicipios);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);

  /** Prefixo dos `id`/`for` — único por instância para a11y (CA-05). */
  readonly idPrefix = input('endereco');
  /** Texto do `<legend>` do grupo. */
  readonly legend = input('Endereço');
  /** Erro de coerência cidade↔CEP (422) ou de campo vindo do backend (CA-06). */
  readonly erroExterno = input<string | null>(null);
  /** Marca a legenda como de resposta obrigatória. */
  readonly obrigatorio = input(false);
  /** A legenda como título de seção do cadastro, ou como rótulo de um campo entre outros. */
  readonly aparencia = input<'secao' | 'campo'>('secao');
  /**
   * Só aceita endereço com CEP encontrado no Geo: sem o atalho "preencher sem CEP", com a
   * orientação dos Correios no 404, logradouro e bairro sempre editáveis (e obrigatórios no CEP
   * geral da cidade) e complemento de várias linhas. Usado no formulário do candidato.
   */
  readonly exigeCep = input(false);
  /** Ids das mensagens de quem hospeda (ajuda, pendência) que descrevem o grupo. */
  readonly descritoPor = input<string | null>(null);

  protected readonly urlBuscaDeCepDosCorreios = URL_BUSCA_DE_CEP_DOS_CORREIOS;
  protected readonly limiteDoComplemento = LIMITE_DO_COMPLEMENTO;
  protected readonly tamanhoDoComplemento = signal(0);
  protected readonly disabled = signal(false);
  protected readonly resolvendoCep = signal(false);
  protected readonly cepErro = signal<string | null>(null);
  /** CEP ancorado reaberto para correção via "Trocar CEP" — ver `iniciarEdicaoCep`. */
  protected readonly editandoCep = signal(false);
  protected readonly modoManual = signal(false);
  protected readonly cidade = signal<CidadeRef | null>(null);
  protected readonly unidadesFederativas = UNIDADES_FEDERATIVAS;
  /** A UF escolhida no endereço sem CEP, antes da cidade: a busca de municípios se limita a ela. */
  private readonly ufEscolhida = signal('');
  /** A UF da cidade escolhida, ou a escolhida antes dela. */
  protected readonly ufDaCidade = computed(() => this.cidade()?.uf ?? this.ufEscolhida());

  /** A cidade escolhida no campo de município, pelo código IBGE. */
  protected readonly codigoDaCidade = computed(() => {
    const cidade = this.cidade();
    return cidade ? [cidade.codigoIbge] : [];
  });

  /** O 404 do Geo com `exigeCep`: a mensagem leva o link da busca dos Correios. */
  protected readonly cepSemRegistro = computed(() => this.cepErro() === CEP_SEM_REGISTRO);
  /** CEP geral da cidade em endereço que exige CEP: o DNE não traz logradouro nem bairro. */
  protected readonly logradouroBairroObrigatorios = computed(
    () =>
      this.exigeCep() &&
      (this.cepGeral() || (this.cepEmFaixa() ? this.cepConfirmado() : this.nivel() === 'cidade')),
  );
  /** O CEP resolvido só cai numa faixa (cidade, bairro ou distrito), sem rua cadastrada. */
  protected readonly cepEmFaixa = computed(
    () => this.exigeCep() && (this.origem() ?? '').startsWith(PREFIXO_ORIGEM_FAIXA),
  );
  /** O CEP geral oficial de uma cidade ou distrito. */
  protected readonly cepGeral = computed(
    () => this.exigeCep() && this.origem() === ORIGEM_CEP_GERAL,
  );
  /** O candidato confirmou que usa o CEP de faixa no endereço (`cepConfirmado` na resposta). */
  protected readonly cepConfirmado = signal(false);
  protected readonly cepDeFaixaSemConfirmacao = computed(
    () => this.cepEmFaixa() && !this.cepConfirmado(),
  );

  /** Nível de resolução vigente — governa os campos ancorados (read-only). */
  private readonly nivel = signal<NivelResolucao | null>(null);
  /**
   * Mostra os campos de logradouro/número/complemento/bairro/distrito apenas
   * quando há um CEP **resolvido** (`nivel !== null`). Sem resolução — formulário
   * inicial, após 404, ou no fluxo "sem CEP" — esses campos não persistem (o
   * backend exige CEP no endereço), então exibi-los editáveis descartaria a
   * digitação em silêncio. #412.
   */
  protected readonly mostrarDetalheEndereco = computed(
    () => this.nivel() !== null && !this.cepDeFaixaSemConfirmacao(),
  );
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
  private onValidatorChange: () => void = () => undefined;
  /** Último CEP (8 dígitos) resolvido pelo Geo — âncora para validação e blur. */
  private readonly cepResolvido = signal('');
  /** Dígitos do CEP atualmente no campo (sincronizado em `emitir()`). */
  private readonly cepAtual = signal('');
  /** Texto cru (trim) do campo CEP — pega entradas sem dígito (ex.: "abc"). */
  private readonly cepTextoAtual = signal('');
  /**
   * Há um CEP digitado que ainda não foi resolvido pelo Geo (formato inválido,
   * sem dígitos, 404, ou ainda sem "Buscar"). Bloqueia o save mesmo em endereço
   * opcional — senão a tentativa de CEP seria descartada em silêncio (#412).
   * Considera o texto cru: qualquer valor não-vazio que não seja exatamente o
   * CEP resolvido (8 dígitos) é pendente.
   */
  protected readonly cepPendente = computed(() => {
    if (this.cepTextoAtual().length === 0) {
      return false;
    }
    const resolvido = this.cepResolvido();
    return !(resolvido.length === 8 && this.cepAtual() === resolvido);
  });

  constructor() {
    // Mudanças no formulário propagam o valor montado ao FormControl do parent.
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.emitir());
  }

  writeValue(value: EnderecoEstruturado | null): void {
    if (value === null) {
      this.form.reset(
        { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', distrito: '', latitude: '', longitude: '' },
        { emitEvent: false },
      );
      this.cidade.set(null);
      this.ufEscolhida.set('');
      this.nivel.set(null);
      this.origem.set(null);
      this.cepConfirmado.set(false);
      this.modoManual.set(false);
      this.cepErro.set(null);
      this.editandoCep.set(false);
      this.cepResolvido.set('');
      this.cepAtual.set('');
      this.cepTextoAtual.set('');
      this.tamanhoDoComplemento.set(0);
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
    this.tamanhoDoComplemento.set((value.complemento ?? '').length);
    this.cidade.set(value.cidade);
    this.ufEscolhida.set(value.cidade?.uf ?? '');
    // O nome da cidade gravada aparece no campo de município sem passar pela busca.
    if (value.cidade) {
      this.municipios.lembrar([value.cidade]);
    }
    const nivel = normalizarNivel(value.nivelResolucao);
    this.nivel.set(nivel);
    this.origem.set(value.origem);
    this.cepConfirmado.set(value.cepConfirmado === true);
    const cepDigitos = (value.cep ?? '').replace(/\D/g, '');
    this.cepResolvido.set(cepDigitos);
    this.cepAtual.set(cepDigitos);
    this.cepTextoAtual.set((value.cep ?? '').trim());
    // Endereço gravado manualmente reabre em modo manual (tudo editável).
    this.modoManual.set(value.origem === ORIGEM_MANUAL && !this.exigeCep());
    this.cepErro.set(null);
    this.editandoCep.set(false);
  }

  registerOnChange(fn: (value: EnderecoEstruturado | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  /**
   * Inválido enquanto houver um CEP digitado que não foi resolvido pelo Geo —
   * bloqueia o save mesmo quando o endereço é opcional (Instituição), para a
   * tentativa de CEP não ser descartada em silêncio (#412).
   */
  validate(): ValidationErrors | null {
    if (this.cepPendente()) {
      return { cepNaoResolvido: true };
    }
    if (this.cepDeFaixaSemConfirmacao()) {
      return { cepNaoConfirmado: true };
    }
    if (this.exigeCep() && this.cidade() !== null && this.cepResolvido().length !== 8) {
      return { cepObrigatorio: true };
    }
    if (this.logradouroBairroObrigatorios()) {
      const { logradouro, bairro } = this.form.getRawValue();
      if (logradouro.trim() === '' || bairro.trim() === '') {
        return { logradouroBairroObrigatorios: true };
      }
    }
    return null;
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
    if (this.exigeCep() && (campo === 'logradouro' || campo === 'bairro')) {
      return false;
    }
    return this.ancorados().has(campo);
  }

  /** Logradouro ou bairro obrigatório (CEP geral da cidade) ainda vazio. */
  protected faltaPreencher(campo: 'logradouro' | 'bairro'): boolean {
    return this.logradouroBairroObrigatorios() && this.form.controls[campo].value.trim() === '';
  }

  /**
   * O campo que o CEP resolveu sem valor: o DNE não tem bairro ou distrito para esse logradouro — o
   * distrito, em especial, só existe fora da sede do município. Travado e vazio, ele não informa
   * nada ao usuário e parece defeito, então não aparece; o valor continua nulo.
   */
  protected semValorDoCep(campo: 'bairro' | 'distrito'): boolean {
    return this.ehAncorado(campo) && this.form.controls[campo].value.trim() === '';
  }

  /** Resolve o CEP no blur apenas quando há 8 dígitos novos (evita request redundante). */
  protected aoSairDoCep(): void {
    this.onTouched();
    const digitos = this.form.controls.cep.value.replace(/\D/g, '');
    if (digitos.length === 8 && digitos !== this.cepResolvido()) {
      this.resolverCep();
    }
  }

  /**
   * Reabre o campo CEP para correção sem descartar o restante do endereço já
   * resolvido — antes disso, a única forma de corrigir um CEP ancorado era o
   * fluxo "sem CEP", que zera CEP e campos derivados como efeito colateral. #438.
   */
  protected iniciarEdicaoCep(): void {
    this.editandoCep.set(true);
    this.cepErro.set(null);
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
    this.buscaDeCep(digitos)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.resolvendoCep.set(false);
        // Resposta obsoleta: o usuário alterou o CEP enquanto o lookup estava em
        // voo — ignora para não sobrescrever o formulário com um CEP antigo. #412.
        if (this.form.controls.cep.value.replace(/\D/g, '') !== digitos) {
          return;
        }
        if (result.ok) {
          this.aplicarCepResolvido(result.data, digitos);
          return;
        }
        if (result.status === STATUS_HTTP.NAO_ENCONTRADO) {
          // CEP não encontrado. Sem resolução anterior, mantém os campos
          // editáveis para entrada manual. Em correção de um CEP já resolvido
          // (editandoCep), preserva a última resolução válida em vez de
          // descartá-la — do contrário, retornar ao CEP original sem uma nova
          // busca reaprovaria o formulário com `nivelResolucao` nulo enquanto
          // os campos de detalhe ainda carregam os dados da resolução antiga. #438.
          if (this.cepResolvido().length === 0) {
            this.nivel.set(null);
          }
          this.cepErro.set(
            this.exigeCep()
              ? CEP_SEM_REGISTRO
              : 'CEP não encontrado. Verifique ou preencha o endereço manualmente.',
          );
          return;
        }
        if (result.status === STATUS_HTTP.REQUISICAO_INVALIDA) {
          this.cepErro.set('CEP em formato inválido.');
          return;
        }
        this.cepErro.set(this.problemI18n.resolve(result.problem).title);
      });
  }

  private aplicarCepResolvido(dto: CepEncontrado, digitos: string): void {
    this.modoManual.set(false);
    this.editandoCep.set(false);
    this.cepResolvido.set(digitos);
    const cidade = { codigoIbge: dto.codigoIbge, nome: dto.cidade, uf: dto.uf };
    this.cidade.set(cidade);
    // Passando ao endereço sem CEP, a cidade resolvida segue no campo de município, pelo nome.
    this.municipios.lembrar([cidade]);
    this.nivel.set(normalizarNivel(dto.nivelResolucao));
    this.origem.set(dto.origem ?? ORIGEM_GEO);
    this.cepConfirmado.set(false);
    // Faixa de CEP: o Geo não tem a rua, então nada além de cidade e UF é preenchido.
    const preenche = !this.cepEmFaixa();
    this.form.patchValue(
      {
        cep: dto.cep,
        logradouro: preenche ? logradouroCompleto(dto.tipo ?? null, dto.logradouro ?? null) : '',
        bairro: preenche ? (dto.bairro ?? '') : '',
        distrito: preenche ? (dto.distrito ?? '') : '',
        latitude: preenche ? textoDeCoordenada(dto.latitude) : '',
        longitude: preenche ? textoDeCoordenada(dto.longitude) : '',
      },
      { emitEvent: false },
    );
    this.emitir();
  }

  protected confirmarCep(evento: Event): void {
    this.cepConfirmado.set((evento.target as HTMLInputElement).checked);
    this.onTouched();
    this.emitir();
  }

  /** Alterna entre autofill por CEP e preenchimento manual (sem CEP). */
  protected alternarModoManual(): void {
    if (this.exigeCep()) {
      return;
    }
    const manual = !this.modoManual();
    // A UF da cidade que já havia (a do CEP, por exemplo) segue escolhida no endereço sem CEP.
    this.ufEscolhida.set(this.cidade()?.uf ?? '');
    this.modoManual.set(manual);
    this.cepErro.set(null);
    this.editandoCep.set(false);
    if (manual) {
      // Entrada manual: libera todos os campos (nada ancorado) e marca a origem.
      this.nivel.set(null);
      this.origem.set(ORIGEM_MANUAL);
      // Fluxo "sem CEP" persiste só a cidade (o `endereco` do backend exige CEP).
      // Limpa CEP + os campos derivados do CEP: senão valores resolvidos antes
      // ficariam visíveis e seriam descartados silenciosamente no save. #412.
      this.form.reset(
        {
          cep: '',
          logradouro: '',
          numero: '',
          complemento: '',
          bairro: '',
          distrito: '',
          latitude: '',
          longitude: '',
        },
        { emitEvent: false },
      );
      this.cepResolvido.set('');
    }
    this.emitir();
  }

  /** A UF do endereço sem CEP: trocá-la tira a cidade de outra UF. */
  protected escolherUf(sigla: string): void {
    this.ufEscolhida.set(sigla);
    if (this.cidade() !== null && this.cidade()?.uf !== sigla) {
      this.selecionarCidade('');
    }
  }

  protected valorDoSelect(evento: Event): string {
    return evento.target instanceof HTMLSelectElement ? evento.target.value : '';
  }

  /** A cidade escolhida no campo de município, achada pela busca; o código vazio tira a cidade. */
  protected selecionarCidade(codigo: string): void {
    const selecionada = codigo === '' ? null : this.municipios.municipio(codigo);
    this.cidade.set(
      selecionada ? { codigoIbge: selecionada.codigoIbge, nome: selecionada.nome, uf: selecionada.uf } : null,
    );
    this.origem.set(ORIGEM_MANUAL);
    this.onTouched();
    this.emitir();
  }

  private emitir(): void {
    let raw = this.form.getRawValue();
    const cepDigitos = raw.cep.replace(/\D/g, '');

    if (raw.cep.trim().length === 0 && this.nivel() !== null) {
      // Correção via "Trocar CEP" abandonada (campo esvaziado por completo —
      // texto bruto vazio, não só sem dígitos: um valor tipo "abc" não conta
      // como abandono, e sim como formato pendente, ver cepPendente) enquanto
      // havia uma resolução preservada — descarta a resolução antiga e os
      // campos derivados dela em vez de deixá-los visíveis mas fora do que é
      // submetido (`enderecoParaCommand` só monta `endereco` com CEP de 8
      // dígitos; sem cidade, a cidade top-level também some). #438.
      this.nivel.set(null);
      this.cidade.set(null);
      this.origem.set(null);
      this.cepResolvido.set('');
      // Descartar a resolução preservada torna o CEP vazio válido de novo
      // (endereço é opcional); um erro de uma tentativa de correção anterior
      // (404, formato) não pode continuar na tela contradizendo isso.
      this.cepErro.set(null);
      // numero também é limpo aqui: embora seja "dado próprio" (nunca
      // ancorado pelo DNE), ele descreve um imóvel específico do endereço
      // abandonado — mantê-lo faria o número vazar para o próximo CEP
      // resolvido, que pode ser uma rua/cidade completamente diferente.
      this.form.patchValue(
        { logradouro: '', numero: '', complemento: '', bairro: '', distrito: '', latitude: '', longitude: '' },
        { emitEvent: false },
      );
      raw = this.form.getRawValue();
    }

    const cidade = this.cidade();
    // Só um CEP efetivamente resolvido pelo Geo entra no valor. Um CEP digitado
    // mas não resolvido (ex.: lookup 404, ou ainda sem "Buscar") NÃO deve virar
    // `endereco`: o mapeamento trataria os 8 dígitos como endereço válido e
    // submeteria um CEP que o usuário não conseguiu validar. #412.
    this.tamanhoDoComplemento.set(raw.complemento.length);
    if (cepDigitos !== this.cepResolvido()) {
      // Trocar o CEP desfaz a confirmação.
      this.cepConfirmado.set(false);
    }
    this.cepAtual.set(cepDigitos);
    this.cepTextoAtual.set(raw.cep.trim());
    const cepCorrespondeAoResolvido = cepDigitos.length > 0 && cepDigitos === this.cepResolvido();
    if (cepCorrespondeAoResolvido) {
      // O usuário voltou ao CEP já resolvido (ex.: desistiu de uma correção que
      // falhou) sem disparar nova busca — limpa um eventual erro de tentativa
      // anterior, que do contrário ficaria preso na tela mesmo com o formulário
      // válido outra vez. #438.
      this.cepErro.set(null);
    }
    this.onValidatorChange();
    const cepResolvidoNoValor = cepCorrespondeAoResolvido ? vazioParaNulo(raw.cep) : null;

    const algumPreenchido =
      cidade !== null ||
      cepResolvidoNoValor !== null ||
      [raw.logradouro, raw.numero, raw.complemento, raw.bairro, raw.distrito].some(
        (v) => v.trim().length > 0,
      );

    if (!algumPreenchido) {
      this.onChange(null);
      return;
    }

    this.onChange({
      cep: cepResolvidoNoValor,
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
      ...(this.cepConfirmado() ? { cepConfirmado: true } : {}),
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

/**
 * Nome completo do logradouro para exibição — o Geo devolve `tipo` (ex.
 * "Rua", "Avenida", "Terceira") separado de `logradouro` porque a API não
 * expõe um campo agregado; a concatenação precisa ser feita no client para
 * refletir o nome real do DNE (ex. "Terceira Avenida Bloco 1740"). #439.
 */
function logradouroCompleto(tipo: string | null, logradouro: string | null): string {
  if (logradouro === null || logradouro.length === 0) {
    return '';
  }
  return tipo !== null && tipo.length > 0 ? `${tipo} ${logradouro}` : logradouro;
}
