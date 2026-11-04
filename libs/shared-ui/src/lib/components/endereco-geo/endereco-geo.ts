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
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  type ValidationErrors,
  type Validator,
} from '@angular/forms';
import { type ApiFailure, ProblemI18nService, STATUS_HTTP } from '@uniplus/shared-core/http';
import { UNIDADES_FEDERATIVAS } from '@uniplus/shared-utils';
import {
  NomesDeMunicipios,
  ValorDeMunicipioComponent,
} from '../editor-de-condicoes/valor-de-municipio';
import { SpinnerComponent } from '../spinner/spinner';
import {
  ENDERECO_VAZIO,
  criarFormularioDoEndereco,
  montarEndereco,
  textosDoCep,
  textosDoEndereco,
} from './endereco-geo.formulario';
import {
  BUSCA_DE_CEP,
  type CepEncontrado,
  type EnderecoEstruturado,
  ORIGEM_MANUAL,
} from './endereco-geo.model';
import { ResolucaoDoEndereco, somenteDigitos } from './endereco-geo.resolucao';

const URL_BUSCA_DE_CEP_DOS_CORREIOS = 'https://buscacepinter.correios.com.br';
const LIMITE_DO_COMPLEMENTO = 300;
/** Sentinela do erro de CEP inexistente quando o endereço exige CEP (mensagem com link). */
const CEP_SEM_REGISTRO = 'CEP_SEM_REGISTRO';
const DIGITOS_DO_CEP = 8;

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
 * Erros de CEP (formato/404) são exibidos inline; o erro de coerência
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
  private readonly buscaDeCep = inject(BUSCA_DE_CEP);
  private readonly municipios = inject(NomesDeMunicipios);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);

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
  protected readonly form = criarFormularioDoEndereco();
  protected readonly resolucao = new ResolucaoDoEndereco(() => this.exigeCep());

  protected readonly tamanhoDoComplemento = signal(0);
  protected readonly disabled = signal(false);
  protected readonly resolvendoCep = signal(false);
  protected readonly cepErro = signal<string | null>(null);
  /** CEP ancorado reaberto para correção via "Trocar CEP" — ver `iniciarEdicaoCep`. */
  protected readonly editandoCep = signal(false);
  protected readonly modoManual = signal(false);
  /** A UF escolhida no endereço sem CEP, antes da cidade: a busca de municípios se limita a ela. */
  private readonly ufEscolhida = signal('');
  /** A UF da cidade escolhida, ou a escolhida antes dela. */
  protected readonly ufDaCidade = computed(() => this.resolucao.cidade()?.uf ?? this.ufEscolhida());

  /** A cidade escolhida no campo de município, pelo código IBGE. */
  protected readonly codigoDaCidade = computed(() => {
    const cidade = this.resolucao.cidade();
    return cidade ? [cidade.codigoIbge] : [];
  });

  /** O 404 do Geo com `exigeCep`: a mensagem leva o link da busca dos Correios. */
  protected readonly cepSemRegistro = computed(() => this.cepErro() === CEP_SEM_REGISTRO);
  /** Ids que descrevem o CEP: a ajuda, o aviso do CEP geral e o erro. */
  protected readonly descricaoDoCep = computed(() =>
    [
      this.id('cep') + '-hint',
      this.resolucao.cepGeral() ? this.id('cep') + '-geral' : null,
      this.cepErro() !== null ? this.id('cep') + '-error' : null,
    ]
      .filter((id) => id !== null)
      .join(' '),
  );

  private onChange: (value: EnderecoEstruturado | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private onValidatorChange: () => void = () => undefined;

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.emitir());
  }

  writeValue(value: EnderecoEstruturado | null): void {
    if (value === null) {
      this.form.reset(ENDERECO_VAZIO, { emitEvent: false });
      this.resolucao.limpar();
    } else {
      this.form.setValue(textosDoEndereco(value), { emitEvent: false });
      this.resolucao.restaurar(value);
      // O nome da cidade gravada aparece no campo de município sem passar pela busca.
      if (value.cidade) {
        this.municipios.lembrar([value.cidade]);
      }
    }
    this.restaurarEstadoDaTela(value);
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
   * Inválido enquanto houver um CEP digitado que não foi resolvido pelo Geo — bloqueia o save
   * mesmo quando o endereço é opcional (Instituição), para a tentativa de CEP não ser descartada
   * em silêncio.
   */
  validate(): ValidationErrors | null {
    const resolucao = this.resolucao;
    if (resolucao.cepPendente()) {
      return { cepNaoResolvido: true };
    }
    if (resolucao.cepDeFaixaSemConfirmacao()) {
      return { cepNaoConfirmado: true };
    }
    if (
      this.exigeCep() &&
      resolucao.cidade() !== null &&
      resolucao.cepResolvido().length !== DIGITOS_DO_CEP
    ) {
      return { cepObrigatorio: true };
    }
    return this.logradouroOuBairroVazios() ? { logradouroBairroObrigatorios: true } : null;
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

  /** Logradouro ou bairro obrigatório (CEP geral da cidade) ainda vazio. */
  protected faltaPreencher(campo: 'logradouro' | 'bairro'): boolean {
    return (
      this.resolucao.logradouroBairroObrigatorios() && this.form.controls[campo].value.trim() === ''
    );
  }

  /**
   * O campo que o CEP resolveu sem valor: o DNE não tem bairro ou distrito para esse logradouro — o
   * distrito, em especial, só existe fora da sede do município. Travado e vazio, ele não informa
   * nada ao usuário e parece defeito, então não aparece; o valor continua nulo.
   */
  protected semValorDoCep(campo: 'bairro' | 'distrito'): boolean {
    return this.resolucao.ehAncorado(campo) && this.form.controls[campo].value.trim() === '';
  }

  /** Resolve o CEP no blur apenas quando há 8 dígitos novos (evita request redundante). */
  protected aoSairDoCep(): void {
    this.onTouched();
    const digitos = somenteDigitos(this.form.controls.cep.value);
    if (digitos.length === DIGITOS_DO_CEP && digitos !== this.resolucao.cepResolvido()) {
      this.resolverCep();
    }
  }

  /**
   * Reabre o campo CEP para correção sem descartar o restante do endereço já resolvido; a outra
   * saída, o fluxo "sem CEP", zera CEP e campos derivados como efeito colateral.
   */
  protected iniciarEdicaoCep(): void {
    this.editandoCep.set(true);
    this.cepErro.set(null);
  }

  protected resolverCep(): void {
    if (this.resolvendoCep() || this.disabled()) {
      return;
    }
    const digitos = somenteDigitos(this.form.controls.cep.value);
    if (digitos.length !== DIGITOS_DO_CEP) {
      this.cepErro.set('Informe um CEP com 8 dígitos.');
      return;
    }
    this.resolvendoCep.set(true);
    this.cepErro.set(null);
    this.buscaDeCep(digitos)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        this.resolvendoCep.set(false);
        // Resposta obsoleta: o CEP mudou durante a busca e não pode sobrescrever o formulário.
        if (somenteDigitos(this.form.controls.cep.value) !== digitos) {
          return;
        }
        if (resultado.ok) {
          this.aplicarCepResolvido(resultado.data, digitos);
        } else {
          this.recusarCep(resultado);
        }
      });
  }

  protected confirmarCep(evento: Event): void {
    this.resolucao.confirmar((evento.target as HTMLInputElement).checked);
    this.onTouched();
    this.emitir();
  }

  /** Alterna entre autofill por CEP e preenchimento manual (sem CEP). */
  protected alternarModoManual(): void {
    if (this.exigeCep()) {
      return;
    }
    const manual = !this.modoManual();
    this.ufEscolhida.set(this.resolucao.cidade()?.uf ?? '');
    this.modoManual.set(manual);
    this.cepErro.set(null);
    this.editandoCep.set(false);
    if (manual) {
      this.resolucao.passarParaEntradaManual();
      this.form.reset(ENDERECO_VAZIO, { emitEvent: false });
    }
    this.emitir();
  }

  /** A UF do endereço sem CEP: trocá-la tira a cidade de outra UF. */
  protected escolherUf(sigla: string): void {
    this.ufEscolhida.set(sigla);
    const cidade = this.resolucao.cidade();
    if (cidade !== null && cidade.uf !== sigla) {
      this.selecionarCidade('');
    }
  }

  protected valorDoSelect(evento: Event): string {
    return evento.target instanceof HTMLSelectElement ? evento.target.value : '';
  }

  /** A cidade escolhida no campo de município, achada pela busca; o código vazio tira a cidade. */
  protected selecionarCidade(codigo: string): void {
    const selecionada = codigo === '' ? null : this.municipios.municipio(codigo);
    this.resolucao.escolherCidade(
      selecionada
        ? { codigoIbge: selecionada.codigoIbge, nome: selecionada.nome, uf: selecionada.uf }
        : null,
    );
    this.onTouched();
    this.emitir();
  }

  private restaurarEstadoDaTela(value: EnderecoEstruturado | null): void {
    this.tamanhoDoComplemento.set((value?.complemento ?? '').length);
    this.ufEscolhida.set(value?.cidade?.uf ?? '');
    // Endereço gravado manualmente reabre em modo manual (tudo editável).
    this.modoManual.set(value?.origem === ORIGEM_MANUAL && !this.exigeCep());
    this.cepErro.set(null);
    this.editandoCep.set(false);
  }

  private logradouroOuBairroVazios(): boolean {
    if (!this.resolucao.logradouroBairroObrigatorios()) {
      return false;
    }
    const { logradouro, bairro } = this.form.getRawValue();
    return logradouro.trim() === '' || bairro.trim() === '';
  }

  private recusarCep(falha: ApiFailure): void {
    if (falha.status === STATUS_HTTP.NAO_ENCONTRADO) {
      this.resolucao.aoNaoEncontrarCep();
      this.cepErro.set(
        this.exigeCep()
          ? CEP_SEM_REGISTRO
          : 'CEP não encontrado. Verifique ou preencha o endereço manualmente.',
      );
    } else if (falha.status === STATUS_HTTP.REQUISICAO_INVALIDA) {
      this.cepErro.set('CEP em formato inválido.');
    } else {
      this.cepErro.set(this.problemI18n.resolve(falha.problem).title);
    }
  }

  private aplicarCepResolvido(cep: CepEncontrado, digitos: string): void {
    this.modoManual.set(false);
    this.editandoCep.set(false);
    this.municipios.lembrar([this.resolucao.adotar(cep, digitos)]);
    this.form.patchValue(textosDoCep(cep, !this.resolucao.cepEmFaixa()), { emitEvent: false });
    this.emitir();
  }

  private emitir(): void {
    if (this.form.controls.cep.value.trim().length === 0 && this.resolucao.temResolucao) {
      this.descartarCorrecaoAbandonada();
    }
    const texto = this.form.getRawValue();
    this.tamanhoDoComplemento.set(texto.complemento.length);
    this.resolucao.sincronizarComCampo(texto.cep);
    if (this.resolucao.cepCorrespondeAoResolvido()) {
      this.cepErro.set(null);
    }
    this.onValidatorChange();
    this.onChange(montarEndereco(texto, this.resolucao));
  }

  private descartarCorrecaoAbandonada(): void {
    this.resolucao.descartar();
    this.cepErro.set(null);
    // O número descreve um imóvel do endereço abandonado e não pode vazar para o próximo CEP.
    this.form.patchValue(
      { ...ENDERECO_VAZIO, cep: this.form.controls.cep.value },
      { emitEvent: false },
    );
  }
}
