import { computed, signal } from '@angular/core';
import {
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

/** Origens do Geo aceitas sem confirmação; as demais (`faixa-cidade`, `faixa-bairro`, `faixa-distrito`...) a exigem. */
const ORIGEM_CEP_GERAL = 'cep-geral';
const ORIGENS_SEM_CONFIRMACAO: readonly string[] = [
  'logradouro',
  'grande-usuario',
  ORIGEM_CEP_GERAL,
];
const DIGITOS_DO_CEP = 8;

export function somenteDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

/**
 * Como o Geo resolveu o CEP do endereço: a cidade, o nível e a origem da resolução, o CEP
 * resolvido e o que o campo CEP tem agora. Destas informações saem os campos ancorados, os avisos
 * e as exigências do endereço. `exigeCep` é lido a cada conta, pois é uma entrada do componente.
 */
export class ResolucaoDoEndereco {
  private readonly cidadeResolvida = signal<CidadeRef | null>(null);
  private readonly cepResolvidoPeloGeo = signal('');
  private readonly confirmacaoDoCep = signal(false);
  private readonly nivel = signal<NivelResolucao | null>(null);
  /** Origem do CEP segundo o Geo (`logradouro`, `grande-usuario`, `cep-geral`, `faixa-*`), ou `manual` sem CEP. */
  private readonly origem = signal<string | null>(null);
  private readonly cepAtual = signal('');
  private readonly cepTextoAtual = signal('');

  readonly cidade = this.cidadeResolvida.asReadonly();
  /** Último CEP (8 dígitos) resolvido pelo Geo — âncora para validação e blur. */
  readonly cepResolvido = this.cepResolvidoPeloGeo.asReadonly();
  /** O candidato confirmou que usa o CEP de faixa no endereço (`cepConfirmado` na resposta). */
  readonly cepConfirmado = this.confirmacaoDoCep.asReadonly();

  /** O campo CEP voltou a ter o CEP já resolvido, sem precisar de nova busca. */
  readonly cepCorrespondeAoResolvido = computed(
    () => this.cepAtual().length > 0 && this.cepAtual() === this.cepResolvidoPeloGeo(),
  );

  /**
   * O CEP digitado é o resolvido pelo Geo. Os avisos, a confirmação e as exigências que vêm da
   * origem da resolução só valem assim; durante a troca do CEP o endereço fica pendente.
   */
  readonly cepVigente = computed(
    () =>
      this.cepResolvidoPeloGeo().length === DIGITOS_DO_CEP &&
      this.cepAtual() === this.cepResolvidoPeloGeo(),
  );

  /** O CEP geral oficial de uma cidade ou distrito. */
  readonly cepGeral = computed(
    () => this.exigeCep() && this.cepVigente() && this.origem() === ORIGEM_CEP_GERAL,
  );

  /**
   * O CEP resolvido não tem rua cadastrada: qualquer origem do Geo fora das aceitas sem
   * confirmação (`faixa-*` ou uma origem desconhecida) pede a confirmação do candidato.
   */
  readonly cepEmFaixa = computed(() => {
    const origem = this.origem();
    return (
      this.exigeCep() &&
      this.cepVigente() &&
      origem !== null &&
      !ORIGENS_SEM_CONFIRMACAO.includes(origem)
    );
  });

  readonly cepDeFaixaSemConfirmacao = computed(() => this.cepEmFaixa() && !this.cepConfirmado());

  /** CEP geral da cidade em endereço que exige CEP: o DNE não traz logradouro nem bairro. */
  readonly logradouroBairroObrigatorios = computed(
    () => this.exigeCep() && (this.cepGeral() || (this.cepEmFaixa() && this.cepConfirmado())),
  );

  /**
   * Há um CEP digitado que ainda não foi resolvido pelo Geo (formato inválido, sem dígitos, 404,
   * ou ainda sem "Buscar"). Bloqueia o save mesmo em endereço opcional — senão a tentativa de CEP
   * seria descartada em silêncio. Considera o texto cru: qualquer valor não vazio que não seja
   * exatamente o CEP resolvido (8 dígitos) é pendente.
   */
  readonly cepPendente = computed(() => this.cepTextoAtual().length > 0 && !this.cepVigente());

  /**
   * Os campos de logradouro, número, complemento, bairro e distrito só aparecem com um CEP
   * **resolvido**: sem resolução (formulário inicial, 404, fluxo "sem CEP") o backend não persiste
   * o endereço, e exibi-los editáveis descartaria a digitação em silêncio.
   */
  readonly mostrarDetalheEndereco = computed(
    () => this.nivel() !== null && !this.cepDeFaixaSemConfirmacao(),
  );

  /**
   * Campos ancorados (read-only) pelo nível de resolução corrente. A entrada manual não ancora
   * nada — todo campo fica editável, inclusive ao recarregar um endereço gravado manualmente.
   */
  private readonly ancorados = computed<ReadonlySet<CampoEndereco>>(() =>
    this.origem() === ORIGEM_MANUAL ? new Set<CampoEndereco>() : camposAncorados(this.nivel()),
  );

  constructor(private readonly exigeCep: () => boolean) {}

  /**
   * O campo é somente leitura por vir do CEP resolvido. Com `exigeCep`, logradouro e bairro ficam
   * sempre editáveis: o candidato corrige o que o DNE traz.
   */
  ehAncorado(campo: CampoEndereco): boolean {
    if (this.exigeCep() && (campo === 'logradouro' || campo === 'bairro')) {
      return false;
    }
    return this.ancorados().has(campo);
  }

  /** Esquece toda a resolução, como num endereço novo. */
  limpar(): void {
    this.cidadeResolvida.set(null);
    this.nivel.set(null);
    this.origem.set(null);
    this.confirmacaoDoCep.set(false);
    this.cepResolvidoPeloGeo.set('');
    this.cepAtual.set('');
    this.cepTextoAtual.set('');
  }

  /** Retoma a resolução de um endereço já gravado. */
  restaurar(valor: EnderecoEstruturado): void {
    const cep = valor.cep ?? '';
    this.cidadeResolvida.set(valor.cidade);
    this.nivel.set(normalizarNivel(valor.nivelResolucao));
    this.origem.set(valor.origem);
    this.confirmacaoDoCep.set(valor.cepConfirmado === true);
    this.cepResolvidoPeloGeo.set(somenteDigitos(cep));
    this.cepAtual.set(somenteDigitos(cep));
    this.cepTextoAtual.set(cep.trim());
  }

  /** Adota o CEP que o Geo acabou de resolver e devolve a cidade dele. */
  adotar(cep: CepEncontrado, digitos: string): CidadeRef {
    const cidade = { codigoIbge: cep.codigoIbge, nome: cep.cidade, uf: cep.uf };
    this.cepResolvidoPeloGeo.set(digitos);
    this.cidadeResolvida.set(cidade);
    this.nivel.set(normalizarNivel(cep.nivelResolucao));
    this.origem.set(cep.origem ?? ORIGEM_GEO);
    this.confirmacaoDoCep.set(false);
    return cidade;
  }

  /**
   * O Geo não achou o CEP. Sem resolução anterior os campos seguem editáveis para entrada manual;
   * numa correção de CEP já resolvido a última resolução válida fica, pois, sem ela, voltar ao CEP
   * original sem nova busca aprovaria o endereço sem nível de resolução, com os campos de detalhe
   * ainda carregando os dados da resolução antiga.
   */
  aoNaoEncontrarCep(): void {
    if (this.cepResolvidoPeloGeo().length === 0) {
      this.nivel.set(null);
    }
  }

  /** O endereço passa a ser digitado sem CEP: nada fica ancorado e nenhum CEP vale. */
  passarParaEntradaManual(): void {
    this.nivel.set(null);
    this.origem.set(ORIGEM_MANUAL);
    this.cepResolvidoPeloGeo.set('');
  }

  /** A cidade escolhida à mão no campo de município; `null` a retira. */
  escolherCidade(cidade: CidadeRef | null): void {
    this.cidadeResolvida.set(cidade);
    this.origem.set(ORIGEM_MANUAL);
  }

  /** Há resolução guardada, para um campo CEP que foi esvaziado por completo. */
  get temResolucao(): boolean {
    return this.nivel() !== null;
  }

  /**
   * A correção por "Trocar CEP" foi abandonada (campo esvaziado por completo; um valor como "abc"
   * não conta, é formato pendente): descarta a resolução antiga, que deixaria campos visíveis mas
   * fora do que é submetido, pois o endereço só é montado com CEP de 8 dígitos.
   */
  descartar(): void {
    this.nivel.set(null);
    this.cidadeResolvida.set(null);
    this.origem.set(null);
    this.cepResolvidoPeloGeo.set('');
  }

  /** Registra o que o campo CEP tem; trocar o CEP desfaz a confirmação. */
  sincronizarComCampo(cep: string): void {
    const digitos = somenteDigitos(cep);
    if (digitos !== this.cepResolvidoPeloGeo()) {
      this.confirmacaoDoCep.set(false);
    }
    this.cepAtual.set(digitos);
    this.cepTextoAtual.set(cep.trim());
  }

  /** O candidato marcou ou desmarcou a confirmação do CEP de faixa. */
  confirmar(confirmado: boolean): void {
    this.confirmacaoDoCep.set(confirmado);
  }

  /** O valor que o endereço leva: nível e origem da resolução, e a confirmação, quando existe. */
  paraOValor(): Pick<EnderecoEstruturado, 'nivelResolucao' | 'origem' | 'cepConfirmado'> {
    return {
      nivelResolucao: this.nivel(),
      origem: this.origem(),
      ...(this.confirmacaoDoCep() ? { cepConfirmado: true } : {}),
    };
  }
}
