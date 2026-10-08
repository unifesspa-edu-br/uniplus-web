import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { ValorDeMunicipioComponent } from '../editor-de-condicoes/valor-de-municipio';
import { EnderecoGeoComponent } from '../endereco-geo/endereco-geo';
import type { EnderecoEstruturado } from '../endereco-geo/endereco-geo.model';
import {
  type CampoNoPasso,
  fatoDaUf,
  mensagensDasRestricoes,
  opcoesDoCampo,
  type OpcaoDoCampo,
} from './formulario-do-candidato.model';
import { codigosDa, estaVazia } from './interpretador/logica';
import type { ValorJson } from './interpretador/regras-do-formulario';

/** Acima disto, a escolha única vira lista suspensa em vez de botões de opção. */
const MAXIMO_DE_OPCOES_EM_BOTOES = 6;
/** O número como se escreve em pt-BR: vírgula decimal, sem separador de milhar. */
const NUMERO_BR = /^-?[0-9]+(,[0-9]+)?$/;
/**
 * O número ainda sendo escrito — o sinal sozinho, ou a vírgula sem as casas decimais —, que não é erro:
 * "1," vale 1 até a casa decimal chegar, e o sinal sozinho é sem resposta.
 */
const NUMERO_BR_PELA_METADE = /^-?([0-9]+,)?$/;

const ENTRADA_DO_FORMATO: Readonly<
  Record<string, { inputmode: string; autocomplete: string; tipo: string }>
> = {
  CPF: { inputmode: 'numeric', autocomplete: 'off', tipo: 'text' },
  TELEFONE: { inputmode: 'tel', autocomplete: 'tel', tipo: 'tel' },
  CEP: { inputmode: 'numeric', autocomplete: 'postal-code', tipo: 'text' },
  EMAIL: { inputmode: 'email', autocomplete: 'email', tipo: 'email' },
  NOME_PESSOA: { inputmode: 'text', autocomplete: 'name', tipo: 'text' },
};

/**
 * Um campo do formulário como o candidato o vê: o controle pelo tipo de renderização, a ajuda, a
 * marca de obrigatório e, ao lado dele, a mensagem de cada regra que a resposta viola e do
 * impedimento. Não decide regra nenhuma: tudo vem da avaliação que o interpretador fez das regras.
 */
@Component({
  selector: 'ui-campo-do-candidato',
  standalone: true,
  imports: [ValorDeMunicipioComponent, EnderecoGeoComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'field' },
  template: `
    @switch (controle()) {
      @case ('escolha') {
        <fieldset class="formulario-candidato__escolhas" [attr.aria-describedby]="descritoPor()">
          <legend class="field__label" [class.is-required]="obrigatorio()">
            {{ campo().rotulo }}
          </legend>
          @for (opcao of opcoes(); track opcao.codigo) {
            <label [class]="multipla() ? 'checkbox' : 'radio'">
              <input
                [type]="multipla() ? 'checkbox' : 'radio'"
                [name]="id()"
                [checked]="escolhido(opcao.codigo)"
                [attr.aria-invalid]="problemas().length > 0 ? 'true' : null"
                [attr.aria-describedby]="opcao.orientacao ? idDaOrientacao(opcao.codigo) : null"
                (change)="escolher(opcao.codigo, $event)"
              />
              <span [class]="multipla() ? 'checkbox__box' : 'radio__dot'" aria-hidden="true"></span>
              {{ rotuloDa(opcao) }}
            </label>
            @if (opcao.orientacao) {
              <span class="formulario-candidato__orientacao" [id]="idDaOrientacao(opcao.codigo)">{{
                opcao.orientacao
              }}</span>
            }
          } @empty {
            <p class="field__hint">Nenhuma opção vale com as respostas dadas até aqui.</p>
          }
        </fieldset>
      }
      @case ('booleano') {
        <fieldset class="formulario-candidato__escolhas" [attr.aria-describedby]="descritoPor()">
          <legend class="field__label" [class.is-required]="obrigatorio()">
            {{ campo().rotulo }}
          </legend>
          <label class="radio">
            <input
              type="radio"
              [name]="id()"
              [checked]="resposta() === true"
              (change)="responder(true)"
            />
            <span class="radio__dot" aria-hidden="true"></span>
            Sim
          </label>
          <label class="radio">
            <input
              type="radio"
              [name]="id()"
              [checked]="resposta() === false"
              (change)="responder(false)"
            />
            <span class="radio__dot" aria-hidden="true"></span>
            Não
          </label>
        </fieldset>
      }
      @case ('lista') {
        <label class="field__label" [class.is-required]="obrigatorio()" [for]="id()">{{
          campo().rotulo
        }}</label>
        <select
          class="select"
          [id]="id()"
          [attr.aria-invalid]="problemas().length > 0 ? 'true' : null"
          [attr.aria-describedby]="descritoPor()"
          (change)="responderTexto(valorDe($event))"
        >
          <option value="" [selected]="vazia()">Selecione</option>
          @for (opcao of opcoes(); track opcao.codigo) {
            <option [value]="opcao.codigo" [selected]="resposta() === opcao.codigo">
              {{ rotuloDa(opcao) }}
            </option>
          }
        </select>
      }
      @case ('municipio') {
        <label
          class="field__label"
          [class.is-required]="obrigatorio()"
          [attr.for]="municipio.campoId()"
          >{{ campo().rotulo }}</label
        >
        <ui-valor-de-municipio
          #municipio
          [rotulo]="campo().rotulo"
          [values]="municipios()"
          [uf]="uf()"
          [disabled]="esperaAUf() && municipios().length === 0"
          [invalido]="problemas().length > 0"
          [descritoPor]="descritoPor()"
          (valuesChange)="responder($event[0])"
        />
      }
      @case ('endereco') {
        <ui-endereco-geo
          aparencia="campo"
          [formControl]="endereco"
          [idPrefix]="id()"
          [legend]="campo().rotulo"
          [obrigatorio]="obrigatorio()"
          [descritoPor]="descritoPor()"
        />
      }
      @default {
        <label class="field__label" [class.is-required]="obrigatorio()" [for]="id()">{{
          campo().rotulo
        }}</label>
        <input
          class="input"
          [id]="id()"
          [type]="entrada().tipo"
          [attr.inputmode]="entrada().inputmode"
          [attr.autocomplete]="entrada().autocomplete"
          [value]="texto()"
          [attr.aria-invalid]="problemas().length > 0 ? 'true' : null"
          [attr.aria-describedby]="descritoPor()"
          (input)="digitar(valorDe($event))"
        />
      }
    }

    @if (campo().pedirConfirmacao && controle() === 'texto') {
      <label class="field__label" [for]="id() + '-confirmacao'"
        >Confirme {{ campo().rotulo }}</label
      >
      <input
        class="input"
        autocomplete="off"
        [id]="id() + '-confirmacao'"
        [type]="entrada().tipo"
        [attr.inputmode]="entrada().inputmode"
        [attr.aria-invalid]="confirmacaoDiverge() ? 'true' : null"
        [attr.aria-describedby]="confirmacaoDiverge() ? id() + '-confirmacao-erro' : null"
        (input)="confirmacao.set(valorDe($event))"
      />
      @if (confirmacaoDiverge()) {
        <span class="field__error" [id]="id() + '-confirmacao-erro'"
          >A confirmação não confere com a resposta.</span
        >
      }
    }

    @if (campo().ajuda; as ajuda) {
      <span class="field__hint" [id]="id() + '-ajuda'">{{ ajuda }}</span>
    }
    @if (controle() === 'municipio' && esperaAUf()) {
      <span class="field__hint" [id]="id() + '-uf'"
        >Informe antes a UF para escolher o município.</span
      >
    }
    @if (problemas().length > 0) {
      <span class="field__error" [id]="id() + '-erro'">
        @for (problema of problemas(); track problema) {
          {{ problema }}
        }
      </span>
    }
  `,
})
export class CampoDoCandidatoComponent {
  readonly noPasso = input.required<CampoNoPasso>();
  readonly resposta = input<ValorJson | undefined>(undefined);
  /** A resposta à UF de que o campo de município depende. */
  readonly respostaDaUf = input<ValorJson | undefined>(undefined);
  /** O id do controle, único na tela. */
  readonly id = input.required<string>();
  /** A seção foi dada como concluída: o obrigatório sem resposta passa a mostrar a pendência. */
  readonly mostrarPendencia = input<boolean>(false);

  readonly respondida = output<ValorJson | undefined>();

  protected readonly campo = computed(() => this.noPasso().campo);
  protected readonly obrigatorio = computed(
    () => this.noPasso().avaliado.obrigatorio === 'VERDADEIRO',
  );
  protected readonly opcoes = computed(() =>
    opcoesDoCampo(this.campo(), this.noPasso().avaliado, codigosDa(this.resposta()) ?? []),
  );
  protected readonly multipla = computed(
    () => this.campo().tipoRenderizacao === 'SELECAO_MULTIPLA',
  );
  protected readonly vazia = computed(() => estaVazia(this.resposta()));
  protected readonly entrada = computed(
    () =>
      ENTRADA_DO_FORMATO[this.campo().formato ?? ''] ?? {
        inputmode: this.controle() === 'numero' ? 'decimal' : 'text',
        autocomplete: 'off',
        tipo: this.controle() === 'data' ? 'date' : 'text',
      },
  );

  /**
   * A escolha que não tem valores no campo nem opções limitadas pelas regras: só resta escrever o
   * código. A que as regras limitam continua escolha, mesmo quando nenhuma opção vale no momento.
   */
  private readonly semValoresConhecidos = computed(
    () =>
      (this.campo().valoresSelecionaveis ?? []).length === 0 &&
      this.noPasso().avaliado.opcoes === null,
  );

  /** O controle pelo tipo de renderização; a escolha sem valores conhecidos vira entrada de código. */
  protected readonly controle = computed(() => {
    const tipo = this.campo().tipoRenderizacao;
    switch (tipo) {
      case 'BOOLEANO':
        return 'booleano';
      case 'NUMERO':
        return 'numero';
      case 'DATA':
        return 'data';
      case 'MUNICIPIO':
        return 'municipio';
      case 'ENDERECO':
        return 'endereco';
      case 'SELECAO_UNICA':
        return this.semValoresConhecidos()
          ? 'codigo'
          : this.opcoes().length > MAXIMO_DE_OPCOES_EM_BOTOES
            ? 'lista'
            : 'escolha';
      case 'SELECAO_MULTIPLA':
        return this.semValoresConhecidos() ? 'codigos' : 'escolha';
      default:
        return 'texto';
    }
  });

  /**
   * O que o controle de texto mostra: o que se digitou enquanto ele corresponde à resposta — o número
   * pela metade, como "1,", não vira resposta e não pode ser apagado —, ou a resposta recebida.
   */
  protected readonly texto = linkedSignal<ValorJson | undefined, string>({
    source: this.resposta,
    computation: (resposta, anterior) =>
      anterior !== undefined &&
      JSON.stringify(this.respostaDoTexto(anterior.value)) === JSON.stringify(resposta)
        ? anterior.value
        : textoDa(resposta),
  });
  /** O número digitado que não se reconhece: não vira resposta. */
  private readonly numeroInvalido = signal(false);
  protected readonly confirmacao = signal('');
  /** O endereço do campo de endereço: composto no Geo, pelo CEP ou pela cidade. */
  protected readonly endereco = new FormControl<EnderecoEstruturado | null>(null);
  protected readonly confirmacaoDiverge = computed(
    () => this.confirmacao() !== '' && this.confirmacao() !== textoDa(this.resposta()),
  );

  protected readonly uf = computed(() => {
    const uf = this.respostaDaUf();
    return fatoDaUf(this.noPasso().regra) !== null && typeof uf === 'string' && uf !== ''
      ? uf
      : null;
  });
  /** O município que depende da UF respondida antes espera por ela; sem essa regra, vale qualquer um. */
  protected readonly esperaAUf = computed(
    () => fatoDaUf(this.noPasso().regra) !== null && this.uf() === null,
  );
  protected readonly municipios = computed(() =>
    typeof this.resposta() === 'string' ? [this.resposta() as string] : [],
  );

  /** As mensagens ao lado do campo: pendência, número não reconhecido, regras violadas e impedimento. */
  protected readonly problemas = computed(() => {
    const { avaliado, regra } = this.noPasso();
    return [
      ...(this.mostrarPendencia() && this.obrigatorio() && this.vazia() && !this.numeroInvalido()
        ? ['Responda este campo.']
        : []),
      ...(this.numeroInvalido() ? ['Escreva um número, com vírgula para as casas decimais.'] : []),
      ...mensagensDasRestricoes(avaliado, regra),
      ...(avaliado.impedido === 'VERDADEIRO'
        ? [regra?.impedimento?.mensagem?.trim() || 'Esta resposta impede a inscrição.']
        : []),
    ];
  });

  protected readonly descritoPor = computed(
    () =>
      [
        this.campo().ajuda ? `${this.id()}-ajuda` : null,
        this.controle() === 'municipio' && this.esperaAUf() ? `${this.id()}-uf` : null,
        this.problemas().length > 0 ? `${this.id()}-erro` : null,
      ]
        .filter((id) => id !== null)
        .join(' ') || null,
  );

  /** A última resposta que o endereço deu, para reconhecer a que volta dela. */
  private respostaDoEnderecoDada: string | undefined;

  constructor() {
    // A resposta recebida chega ao endereço só quando não é a que ele mesmo deu: reescrevê-lo com
    // ela desfaria o modo sem CEP e a correção do CEP em curso.
    effect(() => {
      const resposta = this.resposta();
      if (JSON.stringify(resposta) !== this.respostaDoEnderecoDada) {
        this.endereco.setValue(enderecoDa(resposta), { emitEvent: false });
      }
    });
    // O endereço com o CEP digitado e ainda não resolvido não é resposta: o obrigatório segue pendente.
    this.endereco.valueChanges.pipe(takeUntilDestroyed()).subscribe((endereco) => {
      const resposta =
        endereco === null || this.endereco.invalid ? undefined : respostaDoEndereco(endereco);
      this.respostaDoEnderecoDada = JSON.stringify(resposta);
      this.responder(resposta);
    });
  }

  protected rotuloDa(opcao: OpcaoDoCampo): string {
    const rotulo = opcao.descricao?.trim() || opcao.codigo;
    return opcao.foraDasOpcoes ? `${rotulo} (não vale com as respostas dadas)` : rotulo;
  }

  /** O id da orientação da opção, que descreve o controle dela. */
  protected idDaOrientacao(codigo: string): string {
    return `${this.id()}-${codigo}-orientacao`;
  }

  protected escolhido(codigo: string): boolean {
    const resposta = this.resposta();
    return Array.isArray(resposta) ? resposta.includes(codigo) : resposta === codigo;
  }

  protected valorDe(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
  }

  protected escolher(codigo: string, evento: Event): void {
    if (!this.multipla()) {
      this.responder(codigo);
      return;
    }
    const marcado = (evento.target as HTMLInputElement).checked;
    const atual = Array.isArray(this.resposta()) ? (this.resposta() as readonly string[]) : [];
    const escolhidos = marcado ? [...atual, codigo] : atual.filter((c) => c !== codigo);
    this.responder(escolhidos.length === 0 ? undefined : escolhidos);
  }

  protected digitar(texto: string): void {
    this.texto.set(texto);
    const limpo = texto.trim();
    this.numeroInvalido.set(
      this.controle() === 'numero' &&
        limpo !== '' &&
        !NUMERO_BR.test(limpo) &&
        !NUMERO_BR_PELA_METADE.test(limpo),
    );
    this.responder(this.respostaDoTexto(texto));
  }

  /** A resposta que o texto digitado dá: o número em pt-BR, os códigos separados por ponto e vírgula, ou o texto. */
  private respostaDoTexto(texto: string): ValorJson | undefined {
    const limpo = texto.trim();
    if (limpo === '') return undefined;
    switch (this.controle()) {
      case 'numero':
        if (NUMERO_BR.test(limpo)) return Number(limpo.replace(',', '.'));
        return /^-?[0-9]+,$/.test(limpo) ? Number(limpo.slice(0, -1)) : undefined;
      case 'codigos': {
        const codigos = limpo
          .split(';')
          .map((parte) => parte.trim())
          .filter((parte) => parte !== '');
        return codigos.length === 0 ? undefined : codigos;
      }
      default:
        return texto;
    }
  }

  protected responderTexto(texto: string): void {
    this.responder(texto.trim() === '' ? undefined : texto);
  }

  protected responder(valor: ValorJson | undefined): void {
    this.respondida.emit(valor);
  }
}

function textoDa(resposta: ValorJson | undefined): string {
  if (resposta === undefined || resposta === null) return '';
  if (Array.isArray(resposta)) return resposta.join('; ');
  if (typeof resposta === 'number')
    return resposta.toLocaleString('pt-BR', { useGrouping: false, maximumFractionDigits: 20 });
  return String(resposta);
}

/** O endereço que a resposta guarda, na forma de `EnderecoGeoInput`; outra forma é sem endereço. */
function enderecoDa(resposta: ValorJson | undefined): EnderecoEstruturado | null {
  if (resposta === undefined || resposta === null || typeof resposta !== 'object' || Array.isArray(resposta))
    return null;
  const objeto = resposta as { readonly [chave: string]: ValorJson };
  const cidade = objeto['cidade'];
  const daCidade =
    cidade !== null && typeof cidade === 'object' && !Array.isArray(cidade)
      ? (cidade as { readonly [chave: string]: ValorJson })
      : null;
  return {
    cep: textoOuNulo(objeto['cep']),
    logradouro: textoOuNulo(objeto['logradouro']),
    numero: textoOuNulo(objeto['numero']),
    complemento: textoOuNulo(objeto['complemento']),
    bairro: textoOuNulo(objeto['bairro']),
    distrito: textoOuNulo(objeto['distrito']),
    cidade:
      daCidade === null
        ? null
        : {
            codigoIbge: textoOuNulo(daCidade['codigoIbge']) ?? '',
            nome: textoOuNulo(daCidade['nome']) ?? '',
            uf: textoOuNulo(daCidade['uf']) ?? '',
          },
    latitude: textoOuNulo(objeto['latitude']),
    longitude: textoOuNulo(objeto['longitude']),
    nivelResolucao: textoOuNulo(objeto['nivelResolucao']),
    origem: textoOuNulo(objeto['origem']),
  };
}

/** O endereço como resposta: um objeto JSON com a cidade aninhada. */
function respostaDoEndereco(endereco: EnderecoEstruturado): ValorJson {
  return { ...endereco, cidade: endereco.cidade === null ? null : { ...endereco.cidade } };
}

function textoOuNulo(valor: ValorJson | undefined): string | null {
  return typeof valor === 'string' ? valor : typeof valor === 'number' ? String(valor) : null;
}
