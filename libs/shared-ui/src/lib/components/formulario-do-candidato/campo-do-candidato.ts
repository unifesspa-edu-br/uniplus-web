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
import { digitosDoTelefone, formatarTelefone } from '@uniplus/shared-utils';

import { DadoRevelavelComponent } from '../dado-revelavel/dado-revelavel';
import { ValorDeMunicipioComponent } from '../editor-de-condicoes/valor-de-municipio';
import { EnderecoGeoComponent } from '../endereco-geo/endereco-geo';
import type { EnderecoEstruturado } from '../endereco-geo/endereco-geo.model';
import { pedeConfirmacao } from './confirmacao-do-campo';
import { enderecoDa, respostaDoEndereco } from './endereco-do-campo';
import { problemasDoCampo } from './problemas-do-campo';
import { entradaDoCampo, numeroNaoReconhecido, respostaDoTexto, textoDa } from './texto-do-campo';
import { type CampoNoPasso } from './passos-do-formulario';
import { type ControleDoCampo, controleDoTipo } from './controle-do-campo';
import { fatoDaUf } from './regras-do-campo';
import { limitesDaFaixaDeData, textoDosLimitesDeData } from './mensagens-das-restricoes';
import { opcoesDoCampo, type OpcaoDoCampo } from './opcoes-do-campo';
import { type ProblemaDaConfirmacao } from './pendencias-do-passo';
import { type RespostaFixa } from './formulario-do-candidato.model';
import { codigosDa, estaVazia } from './interpretador/logica';
import type { ValorJson } from './interpretador/regras-do-formulario';

/**
 * Um campo do formulário como o candidato o vê: o controle pelo tipo de renderização, a ajuda, a
 * marca de obrigatório e, ao lado dele, a mensagem de cada regra que a resposta viola e do
 * impedimento. Não decide regra nenhuma: tudo vem da avaliação que o interpretador fez das regras.
 */
@Component({
  selector: 'ui-campo-do-candidato',
  standalone: true,
  imports: [
    DadoRevelavelComponent,
    ValorDeMunicipioComponent,
    EnderecoGeoComponent,
    ReactiveFormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'field' },
  templateUrl: './campo-do-candidato.html',
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
  /** O nome gravado do município respondido, com a UF; nulo sem nome gravado ou com outro código. */
  readonly rotuloGravado = input<string | null>(null);
  /** A resposta que o candidato não altera; o campo só a mostra. */
  readonly fixa = input<RespostaFixa | null>(null);
  /** A recusa do servidor a esta resposta, até o candidato mudá-la. */
  readonly erroDoServidor = input<string | null>(null);
  /** O dia do envio, `AAAA-MM-DD`, contra o qual contam os limites de data; nulo quando não se sabe. */
  readonly diaDoEnvio = input<string | null>(null);

  /** O que o candidato digitou na confirmação, quando o campo a pede; quem hospeda a guarda. */
  readonly confirmacao = input<string>('');
  /** O que há de errado na confirmação, segundo quem hospeda; nulo quando está certa ou não é exigida. */
  readonly problemaDaConfirmacao = input<ProblemaDaConfirmacao | null>(null);

  readonly respondida = output<ValorJson | undefined>();
  readonly confirmada = output<string>();

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
  /** O telefone vai à API só com os dígitos e aparece com a máscara (formato do catálogo). */
  private readonly deTelefone = computed(() => this.campo().formato === 'TELEFONE');
  protected readonly entrada = computed(() =>
    entradaDoCampo(this.campo().formato, this.controle()),
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
  protected readonly controle = computed<ControleDoCampo>(() =>
    this.fixa()
      ? 'fixa'
      : controleDoTipo(this.campo().tipoRenderizacao, {
          semValoresConhecidos: this.semValoresConhecidos(),
          opcoes: this.opcoes().length,
        }),
  );

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
        : this.textoDaResposta(resposta),
  });
  /** O número digitado que não se reconhece: não vira resposta. */
  private readonly numeroInvalido = signal(false);
  /** O endereço do campo de endereço: composto no Geo, pelo CEP ou pela cidade. */
  protected readonly endereco = new FormControl<EnderecoEstruturado | null>(null);
  protected readonly confirmando = computed(() =>
    pedeConfirmacao(this.campo(), this.fixa() !== null),
  );
  /**
   * A mensagem da confirmação. A que não confere aparece na hora; a que falta, só depois de a seção ser
   * dada como concluída, como a pendência da resposta.
   */
  protected readonly erroDaConfirmacao = computed(() => {
    switch (this.problemaDaConfirmacao()) {
      case 'diverge':
        return 'A confirmação não confere com a resposta.';
      case 'em-branco':
        return this.mostrarPendencia()
          ? `Confirme ${this.campo().rotulo} digitando o mesmo valor.`
          : null;
      default:
        return null;
    }
  });

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
  protected readonly rotulosGravados = computed<Readonly<Record<string, string>>>(() => {
    const [codigo] = this.municipios();
    const rotulo = this.rotuloGravado();
    return codigo !== undefined && rotulo !== null ? { [codigo]: rotulo } : {};
  });

  /** Os limites da faixa de data do campo no dia do envio, quando ele a declara. */
  private readonly limitesDeData = computed(() =>
    limitesDaFaixaDeData(this.noPasso().regra, this.diaDoEnvio()),
  );
  /**
   * O que o calendário admite: os limites da faixa, e sempre um ano de quatro dígitos, que o controle
   * nativo deixaria passar.
   */
  protected readonly calendario = computed(() => ({
    minimo: this.limitesDeData()?.minimo ?? '0001-01-01',
    maximo: this.limitesDeData()?.maximo ?? '9999-12-31',
  }));
  /** A dica dos limites, que aparece antes de qualquer erro. */
  protected readonly dicaDaData = computed(() =>
    this.controle() === 'data' ? textoDosLimitesDeData(this.limitesDeData()) : null,
  );
  /**
   * O candidato saiu do campo de data depois de escrever: só então a data fora dos limites é erro, para
   * a mensagem não piscar enquanto o ano está sendo digitado.
   */
  protected readonly saiu = signal(false);

  /** O obrigatório sem resposta, com a pendência aberta, ainda deve ser respondido. */
  private readonly faltaResponder = computed(
    () =>
      this.mostrarPendencia() &&
      this.obrigatorio() &&
      this.vazia() &&
      !this.numeroInvalido() &&
      !this.fixa(),
  );

  /** As mensagens ao lado do campo: pendência, número não reconhecido, regras violadas e impedimento. */
  protected readonly problemas = computed(() =>
    problemasDoCampo({
      noPasso: this.noPasso(),
      diaDoEnvio: this.diaDoEnvio(),
      faltaResponder: this.faltaResponder(),
      numeroInvalido: this.numeroInvalido(),
      dataConferida: this.saiu() || this.mostrarPendencia(),
      erroDoServidor: this.erroDoServidor(),
    }),
  );

  protected readonly descritoPor = computed(
    () =>
      [
        this.campo().ajuda ? `${this.id()}-ajuda` : null,
        this.controle() === 'fixa' ? `${this.id()}-fixa` : null,
        this.controle() === 'municipio' && this.esperaAUf() ? `${this.id()}-uf` : null,
        this.dicaDaData() ? `${this.id()}-faixa` : null,
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
    this.saiu.set(false);
    this.numeroInvalido.set(this.controle() === 'numero' && numeroNaoReconhecido(texto));
    this.responder(this.respostaDoTexto(texto));
  }

  private respostaDoTexto(texto: string): ValorJson | undefined {
    return respostaDoTexto(this.controle(), this.campo(), texto);
  }

  /** O texto que a resposta mostra no campo: o telefone, com a máscara. */
  private textoDaResposta(resposta: ValorJson | undefined): string {
    return this.deTelefone() && typeof resposta === 'string'
      ? formatarTelefone(resposta)
      : textoDa(resposta);
  }

  /** Ao sair do campo, a data fora da faixa vira erro e o telefone válido ganha a máscara. */
  protected sair(): void {
    this.saiu.set(true);
    const resposta = this.resposta();
    if (this.deTelefone() && typeof resposta === 'string' && digitosDoTelefone(resposta) !== null) {
      this.texto.set(formatarTelefone(resposta));
    }
  }

  protected responderTexto(texto: string): void {
    this.responder(texto.trim() === '' ? undefined : texto);
  }

  protected responder(valor: ValorJson | undefined): void {
    this.respondida.emit(valor);
  }
}
