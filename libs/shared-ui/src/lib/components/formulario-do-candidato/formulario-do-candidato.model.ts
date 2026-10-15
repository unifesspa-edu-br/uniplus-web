import { type DadoRevelavel, formatarDataBr } from '@uniplus/shared-utils';

import { lerLimiteDeData } from './interpretador/leitura';
import { RESOLVIDO, VERDADEIRO } from './interpretador/logica';
import { diaDoLimite, FAIXA_DE_DATA } from './interpretador/restricoes';

import type {
  AvaliacaoDoFormulario,
  CampoAvaliado,
  GrupoAvaliado,
  ItemDasRegras,
  RegrasDoFormulario,
  RestricaoDasRegras,
  TermoAvaliado,
  ValorJson,
} from './interpretador/regras-do-formulario';

/**
 * O formulário que o candidato vê, como a API o publica no formulário renderizável: a apresentação de
 * cada seção, campo, grupo e termo, mais as regras que o interpretador avalia. Espelha o contrato; quem
 * hospeda passa o tipo gerado do OpenAPI.
 */
/**
 * Um inteiro do contrato. O tipo gerado aceita também o número escrito em texto, como a API lê o
 * corpo; quem compara ou ordena usa `comoInteiro`.
 */
export type Inteiro = number | string;

/** O inteiro do contrato como número. */
export function comoInteiro(valor: Inteiro): number {
  return Number(valor);
}

export interface ValorSelecionavel {
  readonly codigo: string;
  /** O nome da opção. */
  readonly descricao?: string | null;
  readonly ordem: Inteiro;
  /** O que o candidato precisa saber sobre a opção, mostrado abaixo dela. */
  readonly orientacao?: string | null;
}

export interface CampoRenderizavel {
  readonly fatoCodigo: string;
  readonly ordem: Inteiro;
  readonly rotulo: string;
  readonly tipoRenderizacao: string;
  readonly valoresSelecionaveis?: readonly ValorSelecionavel[] | null;
  readonly formato?: string | null;
  readonly ajuda?: string | null;
  readonly pedirConfirmacao?: boolean;
}

export interface GrupoRenderizavel {
  readonly codigo: string;
  readonly ordem: Inteiro;
  readonly rotulo: string;
  readonly minimo: Inteiro;
  readonly maximo?: Inteiro | null;
  readonly incluiCandidato: boolean;
  readonly subitens: readonly CampoRenderizavel[];
}

export interface SecaoRenderizavel {
  readonly codigo: string;
  /** O código com que a seção aparece nas regras; nulo nos blocos do sistema, que não têm regra. */
  readonly codigoNasRegras?: string | null;
  readonly ordem: Inteiro;
  /** `SECAO` ou `BLOCO`. */
  readonly tipo: string;
  readonly bloco?: string | null;
  readonly titulo: string;
  readonly descricao?: string | null;
  readonly aviso?: string | null;
}

export interface TermoRenderizavel {
  readonly codigo: string;
  readonly codigoNasRegras: string;
  readonly ordem: Inteiro;
  readonly nome: string;
  readonly texto: string;
  readonly baseLegal: string;
}

/**
 * Um fato que o formulário cita sem perguntar: respondido em outro formulário — com a apresentação de
 * lá —, ou calculado pelo sistema a partir de outros fatos, que `calculadoDe` lista.
 */
export interface PressupostoDoFormulario {
  readonly fatoCodigo: string;
  readonly rotulo?: string | null;
  readonly tipoRenderizacao?: string | null;
  readonly formato?: string | null;
  readonly valoresSelecionaveis?: readonly ValorSelecionavel[] | null;
  readonly calculadoDe?: readonly string[] | null;
}

export interface FormularioDoCandidato {
  readonly finalidade: string;
  /** A fase do cronograma que o formulário responde; nula fora de um processo, como no simulador. */
  readonly faseId?: string | null;
  readonly titulo?: string | null;
  readonly etapas: readonly SecaoRenderizavel[];
  readonly termos: readonly TermoRenderizavel[];
  readonly fatosColetados: readonly CampoRenderizavel[];
  readonly grupos: readonly GrupoRenderizavel[];
  readonly regras: RegrasDoFormulario;
  /** Os fatos citados que o formulário não pergunta; a simulação os informa à parte. */
  readonly pressupostos?: readonly PressupostoDoFormulario[] | null;
  /**
   * As respostas de que a avaliação da API depende, só pelos códigos (ADR-0143): os fatos — o subitem
   * de grupo como `GRUPO.FATO` — e os grupos cujas ocorrências contam.
   */
  readonly dependenciasDaAvaliacao?: DependenciasDaAvaliacao | null;
}

export interface DependenciasDaAvaliacao {
  readonly fatos: readonly string[];
  readonly grupos: readonly string[];
}

/** Uma resposta que o candidato não altera, como o CPF da conta: o valor e como ele aparece. */
export interface RespostaFixa {
  readonly valor: ValorJson;
  readonly exibicao: string;
  /** O dado sensível que o titular revela para conferir; presente, aparece no lugar da exibição. */
  readonly revelavel?: DadoRevelavel;
}

/**
 * Uma recusa do servidor ligada a uma parte do formulário. O campo é o código do fato, do grupo ou do
 * termo; dentro de um grupo, `grupo.ocorrência` ou `grupo.ocorrência.fato`.
 */
export interface ErroDoServidor {
  readonly campo: string;
  readonly mensagem: string;
}

/** O campo pertence à parte de código dado: é ela, ou está dentro dela, como `grupo.ocorrência.fato`. */
export function campoEm(campo: string, codigo: string): boolean {
  return campo === codigo || campo.startsWith(`${codigo}.`);
}

/** O campo do erro pertence à parte de código dado: é ela, ou está dentro dela. */
export function erroEm(erro: ErroDoServidor, codigo: string): boolean {
  return campoEm(erro.campo, codigo);
}

/** As mensagens dos erros cujo campo é exatamente este, numa frase só; nula quando não há. */
export function mensagemDosErros(erros: readonly ErroDoServidor[], campo: string): string | null {
  const mensagens = erros.filter((e) => e.campo === campo).map((e) => e.mensagem);
  return mensagens.length === 0 ? null : mensagens.join(' ');
}

export const BLOCO_MODALIDADES_CALCULADAS = 'MODALIDADES_CALCULADAS';
export const BLOCO_COMPROVACAO_DOCUMENTAL = 'COMPROVACAO_DOCUMENTAL';
export const BLOCO_REVISAO_E_ACEITE = 'REVISAO_E_ACEITE';

/** Acima disto, a escolha única vira lista suspensa em vez de botões de opção. */
const MAXIMO_DE_OPCOES_EM_BOTOES = 6;

/** O controle com que o campo aparece para o candidato. */
export type ControleDoCampo =
  | 'fixa'
  | 'texto'
  | 'numero'
  | 'data'
  | 'booleano'
  | 'municipio'
  | 'endereco'
  | 'escolha'
  | 'lista'
  | 'codigo'
  | 'codigos';

/**
 * O controle pelo tipo de renderização, fonte única do campo na tela e das regras que dependem de ele
 * ser de texto digitado, como a confirmação. A escolha sem valores conhecidos vira entrada de código; a
 * única com muitas opções, lista suspensa. Os dois dados da escolha só importam a ela.
 */
export function controleDoTipo(
  tipoRenderizacao: string,
  escolha: { readonly semValoresConhecidos: boolean; readonly opcoes: number } = {
    semValoresConhecidos: false,
    opcoes: 0,
  },
): Exclude<ControleDoCampo, 'fixa'> {
  switch (tipoRenderizacao) {
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
      return escolha.semValoresConhecidos
        ? 'codigo'
        : escolha.opcoes > MAXIMO_DE_OPCOES_EM_BOTOES
          ? 'lista'
          : 'escolha';
    case 'SELECAO_MULTIPLA':
      return escolha.semValoresConhecidos ? 'codigos' : 'escolha';
    default:
      return 'texto';
  }
}

/** Um campo do passo, com a avaliação dele e a regra que o descreve. */
export interface CampoNoPasso {
  readonly campo: CampoRenderizavel;
  readonly avaliado: CampoAvaliado;
  readonly regra: ItemDasRegras | null;
}

export interface GrupoNoPasso {
  readonly grupo: GrupoRenderizavel;
  readonly avaliado: GrupoAvaliado;
  /** As regras dos subitens, pelo fato. */
  readonly regras: ReadonlyMap<string, ItemDasRegras>;
}

export interface TermoNoPasso {
  readonly termo: TermoRenderizavel;
  readonly avaliado: TermoAvaliado;
}

/**
 * Um passo do formulário: uma seção, um bloco do sistema ou, no rascunho, os campos ainda sem seção.
 * Os campos e grupos entram no passo pela etapa em que a avaliação os põe, e só os que aparecem.
 */
export interface PassoDoFormulario {
  readonly chave: string;
  readonly titulo: string;
  readonly descricao: string | null;
  readonly aviso: string | null;
  readonly bloco: string | null;
  /** As etapas das regras que o passo conclui ao avançar. */
  readonly etapasNasRegras: readonly string[];
  readonly campos: readonly CampoNoPasso[];
  readonly grupos: readonly GrupoNoPasso[];
  readonly termos: readonly TermoNoPasso[];
}

const VISIVEL = 'VERDADEIRO';
const OCULTO = 'FALSO';

/**
 * Os passos na ordem das seções. A ligação com as regras é pelo código nas regras — no processo, o
 * código da seção é prefixado pela finalidade; no modelo, é o mesmo —, e cada campo entra no passo da
 * etapa em que a avaliação o põe. A etapa das regras sem seção, como a dos campos do rascunho ainda sem
 * seção, vira um passo "Outros dados" antes das seções. A seção oculta pelas regras some; os blocos do
 * sistema ficam sempre.
 */
export function passosDo(
  formulario: FormularioDoCandidato,
  avaliacao: AvaliacaoDoFormulario,
): PassoDoFormulario[] {
  const regraPorFato = regrasPorFato(formulario.regras);
  const avaliadoPorFato = new Map(avaliacao.campos.map((c) => [c.fatoCodigo, c]));
  const avaliadoPorGrupo = new Map(avaliacao.grupos.map((g) => [g.codigo, g]));
  const etapaVisivel = new Map(avaliacao.etapas.map((e) => [e.codigo, e.visivel]));

  const campos = [...formulario.fatosColetados]
    .sort((a, b) => comoInteiro(a.ordem) - comoInteiro(b.ordem))
    .flatMap((campo): CampoNoPasso[] => {
      const avaliado = avaliadoPorFato.get(campo.fatoCodigo);
      return avaliado && avaliado.visivel === VISIVEL
        ? [{ campo, avaliado, regra: regraPorFato.get(campo.fatoCodigo) ?? null }]
        : [];
    });
  const grupos = [...formulario.grupos]
    .sort((a, b) => comoInteiro(a.ordem) - comoInteiro(b.ordem))
    .flatMap((grupo): GrupoNoPasso[] => {
      const avaliado = avaliadoPorGrupo.get(grupo.codigo);
      return avaliado && avaliado.visivel === VISIVEL
        ? [{ grupo, avaliado, regras: regraPorFato }]
        : [];
    });
  const naEtapa = <T extends { avaliado: { etapaCodigo: string } }>(
    itens: readonly T[],
    etapas: readonly string[],
  ): T[] => itens.filter((item) => etapas.includes(item.avaliado.etapaCodigo));

  const codigosDasSecoes = new Set(
    formulario.etapas.flatMap((s) => (s.codigoNasRegras ? [s.codigoNasRegras] : [])),
  );
  const semSecao = (formulario.regras.etapas ?? [])
    .map((e) => e.codigo)
    .filter((codigo) => !codigosDasSecoes.has(codigo));
  const outros: PassoDoFormulario[] =
    semSecao.length === 0
      ? []
      : [
          {
            chave: 'outros-dados',
            titulo: 'Outros dados',
            descricao: 'Campos que ainda não estão em nenhuma seção do formulário.',
            aviso: null,
            bloco: null,
            etapasNasRegras: semSecao,
            campos: naEtapa(campos, semSecao),
            grupos: naEtapa(grupos, semSecao),
            termos: [],
          },
        ];

  const termos = termosVisiveis(formulario, avaliacao);
  const secoes = [...formulario.etapas]
    .sort((a, b) => comoInteiro(a.ordem) - comoInteiro(b.ordem))
    .filter((secao) => !secao.codigoNasRegras || etapaVisivel.get(secao.codigoNasRegras) !== OCULTO)
    .map((secao): PassoDoFormulario => {
      const etapas = secao.codigoNasRegras ? [secao.codigoNasRegras] : [];
      return {
        chave: `secao-${secao.codigo}`,
        titulo: secao.titulo,
        descricao: secao.descricao ?? null,
        aviso: secao.aviso ?? null,
        bloco: secao.tipo === 'BLOCO' ? (secao.bloco ?? null) : null,
        etapasNasRegras: etapas,
        campos: naEtapa(campos, etapas),
        grupos: naEtapa(grupos, etapas),
        termos: secao.bloco === BLOCO_REVISAO_E_ACEITE ? termos : [],
      };
    });

  return [...outros, ...secoes];
}

function termosVisiveis(
  formulario: FormularioDoCandidato,
  avaliacao: AvaliacaoDoFormulario,
): TermoNoPasso[] {
  const avaliadoPorCodigo = new Map(avaliacao.termos.map((t) => [t.codigo, t]));
  return [...formulario.termos]
    .sort((a, b) => comoInteiro(a.ordem) - comoInteiro(b.ordem))
    .flatMap((termo): TermoNoPasso[] => {
      const avaliado = avaliadoPorCodigo.get(termo.codigoNasRegras);
      return avaliado && avaliado.visivel === VISIVEL ? [{ termo, avaliado }] : [];
    });
}

/** O termo obrigatório ainda sem aceite. */
export function termoSemAceite(termo: TermoNoPasso, aceitos: ReadonlySet<string>): boolean {
  return termo.avaliado.obrigatorio === VERDADEIRO && !aceitos.has(termo.termo.codigo);
}

/**
 * O que a confirmação digitada de um campo que pede confirmação tem de errado: a que não confere com a
 * resposta ou a que falta, para toda resposta dada — gravada ou digitada nesta sessão.
 */
export type ProblemaDaConfirmacao = 'diverge' | 'em-branco';

/** Uma pendência do passo: o código com que a tela marca o que falta e, se for o caso, que é a confirmação. */
export interface PendenciaDoPasso {
  readonly campo: string;
  /** O que falta é a confirmação do campo, não a resposta dele. */
  readonly naConfirmacao: boolean;
}

function daResposta(campo: string): PendenciaDoPasso {
  return { campo, naConfirmacao: false };
}

/**
 * O que impede de dar o passo como pronto, na ordem da tela, pelo código com que a tela marca o campo,
 * o grupo, o subitem de uma ocorrência (`grupo.ocorrência.fato`) ou o termo. Lê a avaliação do
 * interpretador com o passo já concluído: o campo com regra violada ou que impede a inscrição, o
 * obrigatório que não resolveu, o grupo fora da contagem, sem resposta ou com subitem nessa situação e
 * o termo obrigatório sem aceite. A confirmação que falta ou não confere, dada pelo mesmo código, vem
 * logo depois da resposta do campo.
 */
export function pendenciasDo(
  passo: PassoDoFormulario,
  aceitos: ReadonlySet<string>,
  confirmacoes: ReadonlyMap<string, ProblemaDaConfirmacao>,
): PendenciaDoPasso[] {
  return [
    ...passo.campos.flatMap((c) => [
      ...(campoPendente(c.avaliado) ? [daResposta(c.campo.fatoCodigo)] : []),
      ...(confirmacoes.has(c.campo.fatoCodigo)
        ? [{ campo: c.campo.fatoCodigo, naConfirmacao: true }]
        : []),
    ]),
    ...passo.grupos.flatMap((g) => {
      const pendencia = pendenciaDoGrupo(g, confirmacoes);
      return pendencia === null ? [] : [pendencia];
    }),
    ...passo.termos
      .filter((t) => termoSemAceite(t, aceitos))
      .map((t) => daResposta(t.termo.codigo)),
  ];
}

function campoPendente(avaliado: CampoAvaliado): boolean {
  return (
    avaliado.restricoesVioladas.length > 0 ||
    avaliado.impedido === VERDADEIRO ||
    (avaliado.obrigatorio === VERDADEIRO && avaliado.estado !== RESOLVIDO)
  );
}

/**
 * A pendência do grupo, quando há: o próprio grupo na contagem inválida, na ocorrência do candidato
 * inválida e no obrigatório sem resposta; o primeiro subitem pendente, na resposta ou na confirmação,
 * quando é ele que falta.
 */
function pendenciaDoGrupo(
  { grupo, avaliado }: GrupoNoPasso,
  confirmacoes: ReadonlyMap<string, ProblemaDaConfirmacao>,
): PendenciaDoPasso | null {
  if (!avaliado.contagemValida || !avaliado.ocorrenciaDoCandidatoValida)
    return daResposta(grupo.codigo);
  for (const ocorrencia of avaliado.ocorrencias) {
    for (const subitem of ocorrencia.campos) {
      if (subitem.visivel !== VISIVEL) continue;
      const caminho = `${grupo.codigo}.${ocorrencia.id}.${subitem.fatoCodigo}`;
      if (campoPendente(subitem)) return daResposta(caminho);
      if (confirmacoes.has(caminho)) return { campo: caminho, naConfirmacao: true };
    }
  }
  return avaliado.obrigatorio === VERDADEIRO && avaliado.estado !== RESOLVIDO
    ? daResposta(grupo.codigo)
    : null;
}

/** A regra de cada campo e subitem, pelo fato. */
export function regrasPorFato(regras: RegrasDoFormulario): ReadonlyMap<string, ItemDasRegras> {
  return new Map(
    (regras.etapas ?? [])
      .flatMap((e) => [...(e.itens ?? []), ...(e.grupos ?? []).flatMap((g) => g.subitens ?? [])])
      .map((item) => [item.fatoCodigo, item]),
  );
}

/** Uma opção do campo de escolha; a já escolhida que as regras deixaram de permitir vem marcada. */
export interface OpcaoDoCampo extends ValorSelecionavel {
  readonly foraDasOpcoes?: boolean;
}

/**
 * As opções que o campo de escolha mostra: as vigentes, quando as regras as limitam, com a descrição do
 * valor quando ele é conhecido; senão, os valores do campo. A resposta já dada que as regras deixaram de
 * permitir continua na lista, marcada, para o candidato poder desfazê-la.
 */
export function opcoesDoCampo(
  campo: CampoRenderizavel,
  avaliado: CampoAvaliado,
  escolhidos: readonly string[] = [],
): readonly OpcaoDoCampo[] {
  const valores = [...(campo.valoresSelecionaveis ?? [])].sort(
    (a, b) => comoInteiro(a.ordem) - comoInteiro(b.ordem) || (a.codigo < b.codigo ? -1 : 1),
  );
  const porCodigo = new Map(valores.map((v) => [v.codigo, v]));
  let opcoes: OpcaoDoCampo[] = valores;
  if (avaliado.opcoes) {
    const codigos = avaliado.opcoes.codigos ?? [];
    const vigentes = new Set(codigos);
    opcoes = [
      ...valores.filter((v) => vigentes.has(v.codigo)),
      ...codigos
        .filter((c) => !porCodigo.has(c))
        .map((codigo, i) => ({ codigo, descricao: null, ordem: valores.length + i })),
    ];
  }
  const mostradas = new Set(opcoes.map((o) => o.codigo));
  const foraDasOpcoes = escolhidos
    .filter((c) => !mostradas.has(c))
    .map((codigo, i) => ({
      ...(porCodigo.get(codigo) ?? { codigo, descricao: null }),
      ordem: valores.length + opcoes.length + i,
      foraDasOpcoes: true,
    }));
  return [...opcoes, ...foraDasOpcoes];
}

/** O fato da UF de que o campo de município depende, pela restrição dos municípios da UF. */
export function fatoDaUf(regra: ItemDasRegras | null): string | null {
  return regra?.restricoes?.find((r) => r.tipo === 'MUNICIPIOS_DA_UF')?.fatos?.[0] ?? null;
}

const numeroBr = (valor: number): string => valor.toLocaleString('pt-BR');

/** Os dias `AAAA-MM-DD` que a faixa de data admite no dia do envio; o limite que não se sabe é nulo. */
export interface LimitesDeData {
  readonly minimo: string | null;
  readonly maximo: string | null;
}

/**
 * Os limites da faixa de data declarada no campo, resolvidos no dia do envio pela mesma conta que o
 * interpretador faz; nulo quando o campo não declara a faixa.
 */
export function limitesDaFaixaDeData(
  regra: ItemDasRegras | null,
  diaDoEnvio: string | null,
): LimitesDeData | null {
  const faixa = regra?.restricoes?.find((r) => r.tipo === FAIXA_DE_DATA);
  if (!faixa) return null;
  const resolver = (limite: RestricaoDasRegras['dataMinima']): string | null => {
    const lido = lerLimiteDeData(limite, '');
    return lido === null ? null : diaDoLimite(lido, diaDoEnvio);
  };
  return { minimo: resolver(faixa.dataMinima), maximo: resolver(faixa.dataMaxima) };
}

/** O que dizer ao candidato sobre os limites de data, com os dias em dd/mm/aaaa; nulo sem limite sabido. */
export function textoDosLimitesDeData(limites: LimitesDeData | null): string | null {
  const dia = (iso: string): string => formatarDataBr(iso, 'short');
  if (limites?.minimo && limites.maximo)
    return `Informe uma data entre ${dia(limites.minimo)} e ${dia(limites.maximo)}.`;
  if (limites?.maximo) return `Informe uma data até ${dia(limites.maximo)}.`;
  if (limites?.minimo) return `Informe uma data a partir de ${dia(limites.minimo)}.`;
  return null;
}

/** A mensagem de cada restrição que a resposta viola, montada com os limites que a regra declara. */
export function mensagensDasRestricoes(
  avaliado: CampoAvaliado,
  regra: ItemDasRegras | null,
  diaDoEnvio: string | null,
): string[] {
  const declarada = (tipo: string): RestricaoDasRegras | undefined =>
    regra?.restricoes?.find((r) => r.tipo === tipo);
  return avaliado.restricoesVioladas.map((tipo) => {
    const restricao = declarada(tipo);
    const minimo =
      restricao?.minimo === null || restricao?.minimo === undefined
        ? null
        : Number(restricao.minimo);
    const maximo =
      restricao?.maximo === null || restricao?.maximo === undefined
        ? null
        : Number(restricao.maximo);
    switch (tipo) {
      case 'FAIXA_NUMERICA':
        return minimo !== null && maximo !== null
          ? `Informe um número entre ${numeroBr(minimo)} e ${numeroBr(maximo)}.`
          : minimo !== null
            ? `Informe um número igual ou maior que ${numeroBr(minimo)}.`
            : `Informe um número igual ou menor que ${numeroBr(maximo ?? 0)}.`;
      case 'TAMANHO_TEXTO':
        return minimo !== null && maximo !== null
          ? `Escreva de ${minimo} a ${maximo} caracteres.`
          : minimo !== null
            ? `Escreva ao menos ${minimo} caracteres.`
            : `Escreva no máximo ${maximo ?? 0} caracteres.`;
      case 'OPCOES_PERMITIDAS':
      case 'OPCOES_DAS_RESPOSTAS':
        return 'Escolha uma das opções oferecidas.';
      case 'MUNICIPIOS_DA_UF':
        return 'Escolha um município da UF informada.';
      case FAIXA_DE_DATA:
        return (
          textoDosLimitesDeData(limitesDaFaixaDeData(regra, diaDoEnvio)) ??
          'A data não está dentro dos limites do campo.'
        );
      case 'FORMATO_TEXTO':
        return (
          MENSAGEM_DO_FORMATO[regra?.formato ?? ''] ?? 'A resposta não está no formato esperado.'
        );
      default:
        return 'A resposta não atende à regra do campo.';
    }
  });
}

const MENSAGEM_DO_FORMATO: Readonly<Record<string, string>> = {
  CPF: 'Informe um CPF válido.',
  EMAIL: 'Informe um e-mail válido.',
  TELEFONE: 'Informe o telefone com DDD.',
  CEP: 'Informe o CEP com os oito dígitos.',
  NOME_PESSOA: 'Informe nome e sobrenome, só com letras.',
};
