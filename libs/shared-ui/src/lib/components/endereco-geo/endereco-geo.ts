import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  forwardRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  type ValidationErrors,
  type Validator,
} from '@angular/forms';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import { UNIDADES_FEDERATIVAS } from '@uniplus/shared-utils';
import {
  NomesDeMunicipios,
  ValorDeMunicipioComponent,
} from '../editor-de-condicoes/valor-de-municipio';
import { SpinnerComponent } from '../spinner/spinner';
import { ConducaoDoEndereco } from './endereco-geo.conducao';
import { BUSCA_DE_CEP, type EnderecoEstruturado } from './endereco-geo.model';

const URL_BUSCA_DE_CEP_DOS_CORREIOS = 'https://buscacepinter.correios.com.br';
const LIMITE_DO_COMPLEMENTO = 300;

/**
 * Componente reutilizável de endereço estruturado (referência ao Geo, ADR-0096),
 * consumido pelas telas de Instituição, Campus e Local de Oferta e pelo campo de
 * endereço do formulário do candidato. O Geo chega por injeção: `BUSCA_DE_CEP` e
 * `BUSCA_DE_MUNICIPIOS`, providos por quem hospeda o componente.
 *
 * Implementa `ControlValueAccessor` sobre um `EnderecoEstruturado | null`. Dois
 * fluxos:
 *
 * - **Autofill por CEP**: o usuário informa o CEP, o componente resolve
 *   pela busca de CEP e preenche o formulário. Os campos resolvidos pelo
 *   DNE ficam **read-only (âncora)** conforme o `nivelResolucao`; os não
 *   resolvidos ficam editáveis (`camposAncorados`). `numero`/`complemento` são
 *   dado próprio, sempre editáveis e nunca preenchidos pelo CEP: o complemento do
 *   DNE descreve o CEP ("lado par", "Clique e Retire Correios"), não a residência.
 * - **Fallback manual / sem CEP**: o usuário escolhe a cidade pelo
 *   campo de município com busca e digita o endereço manualmente.
 *
 * Um CEP já resolvido pode ser corrigido via botão "Trocar CEP" — reabre só o
 * campo CEP (`iniciarEdicaoCep`) sem descartar o restante do endereço já
 * preenchido; uma nova resolução bem-sucedida re-ancora o campo.
 *
 * Quem conduz o preenchimento é a `ConducaoDoEndereco`; o componente adapta o formulário ao
 * Angular Forms e cuida da interação visual (ids, foco). Erros de CEP (formato/404) são exibidos inline; o erro de coerência
 * cidade↔CEP (422) do backend chega via `erroExterno` do parent. Acessibilidade
 * WCAG 2.1 AA / e-MAG: `fieldset/legend`, labels associadas,
 * `aria-invalid`/`aria-describedby`, estados read-only anunciados.
 */
@Component({
  selector: 'ui-endereco-geo',
  standalone: true,
  imports: [ReactiveFormsModule, SpinnerComponent, ValorDeMunicipioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './endereco-geo.css',
  templateUrl: './endereco-geo.html',
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
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly injector = inject(Injector);
  private readonly campoCep = viewChild<ElementRef<HTMLInputElement>>('campoCep');

  /** Prefixo dos `id`/`for` — único por instância para a11y. */
  readonly idPrefix = input('endereco');
  /** Texto do `<legend>` do grupo. */
  readonly legend = input('Endereço');
  /** Erro de coerência cidade↔CEP (422) ou de campo vindo do backend. */
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
  protected readonly unidadesFederativas = UNIDADES_FEDERATIVAS;

  private onChange: (value: EnderecoEstruturado | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private onValidatorChange: () => void = () => undefined;

  protected readonly conducao = new ConducaoDoEndereco({
    exigeCep: () => this.exigeCep(),
    buscaDeCep: inject(BUSCA_DE_CEP),
    municipios: inject(NomesDeMunicipios),
    tituloDoProblema: (falha) => this.problemI18n.resolve(falha.problem).title,
    destroyRef: inject(DestroyRef),
    aoMudarOValor: (valor) => this.onChange(valor),
    aoMudarAValidade: () => this.onValidatorChange(),
  });

  /** O CEP já resolvido, travado até o "Trocar CEP". */
  protected readonly cepTravado = computed(
    () => this.conducao.resolucao.ehAncorado('cep') && !this.conducao.editandoCep(),
  );
  /** O CEP tem erro ou foi digitado sem ser resolvido: o campo comunica a invalidez. */
  protected readonly cepInvalido = computed(
    () => this.conducao.cepErro() !== null || this.conducao.resolucao.cepPendente(),
  );
  /** Ids que descrevem o CEP: a ajuda, o aviso do CEP geral e o erro ou a pendência. */
  protected readonly descricaoDoCep = computed(() => {
    const geral = this.conducao.resolucao.cepGeral();
    const comErro = this.conducao.cepErro() !== null;
    const pendente = !comErro && this.conducao.resolucao.cepPendente();
    return [
      this.id('cep') + '-hint',
      geral ? this.id('cep') + '-geral' : null,
      comErro ? this.id('cep') + '-error' : null,
      pendente ? this.id('cep') + '-pendente' : null,
    ]
      .filter((id) => id !== null)
      .join(' ');
  });

  writeValue(value: EnderecoEstruturado | null): void {
    this.conducao.escrever(value);
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

  validate(): ValidationErrors | null {
    return this.conducao.validar();
  }

  setDisabledState(isDisabled: boolean): void {
    this.conducao.desabilitar(isDisabled);
  }

  protected id(campo: string): string {
    return `${this.idPrefix()}-${campo}`;
  }

  /** Resolve o CEP no blur apenas quando há 8 dígitos novos. */
  protected aoSairDoCep(): void {
    this.onTouched();
    if (this.conducao.cepNovoCompleto()) {
      this.conducao.resolverCep();
    }
  }

  /** Reabre o CEP para correção; o botão que tinha o foco muda de papel, então o foco vai ao campo. */
  protected trocarCep(): void {
    this.conducao.iniciarEdicaoCep();
    afterNextRender(() => this.campoCep()?.nativeElement.focus(), { injector: this.injector });
  }

  protected confirmarCep(evento: Event): void {
    this.onTouched();
    this.conducao.confirmarCep((evento.target as HTMLInputElement).checked);
  }

  /** O grupo é tocado quando o foco sai dele, e não a cada troca de campo dentro dele. */
  protected aoSairDoGrupo(evento: FocusEvent): void {
    const grupo = evento.currentTarget as HTMLElement;
    if (!grupo.contains(evento.relatedTarget as Node | null)) {
      this.onTouched();
    }
  }

  protected alternarModoManual(): void {
    this.onTouched();
    this.conducao.alternarModoManual();
  }

  protected escolherUf(evento: Event): void {
    this.onTouched();
    const alvo = evento.target;
    this.conducao.escolherUf(alvo instanceof HTMLSelectElement ? alvo.value : '');
  }

  protected selecionarCidade(codigo: string): void {
    this.onTouched();
    this.conducao.selecionarCidade(codigo);
  }
}
