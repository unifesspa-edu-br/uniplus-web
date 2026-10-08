import { ehFormatoConhecido } from './formatos';
import {
  comparaComLista,
  type Condicao,
  ehOperador,
  fatosCitadosPor,
  type Predicado,
} from './predicado';
import type {
  AgregadoDasRegras,
  CondicaoDasRegras,
  DerivacaoDasRegras,
  EtapaDasRegras,
  GrupoDasRegras,
  ImpedimentoDasRegras,
  ItemDasRegras,
  PredicadoDasRegras,
  RegrasDoFormulario,
  RestricaoDasRegras,
  TermoDasRegras,
  ValorJson,
} from './regras-do-formulario';
import {
  FAIXA_NUMERICA,
  faixaNumerica,
  formatoDeTexto,
  MUNICIPIOS_DA_UF,
  municipiosDaUf,
  OPCOES_DAS_RESPOSTAS,
  OPCOES_PERMITIDAS,
  opcoesDasRespostas,
  opcoesPermitidas,
  type Restricao,
  TAMANHO_TEXTO,
  tamanhoDeTexto,
} from './restricoes';

/** A obrigatoriedade: sempre, nunca, ou quando o predicado é verdadeiro. */
export type Obrigatoriedade =
  | { readonly tipo: 'SEMPRE' | 'NUNCA'; readonly predicado: null }
  | { readonly tipo: 'QUANDO'; readonly predicado: Predicado };

export interface DefinicaoItem {
  readonly fatoCodigo: string;
  readonly exibicao: Predicado | null;
  readonly obrigatoriedade: Obrigatoriedade;
  /** As restrições declaradas e, no campo de texto com formato, a do formato. */
  readonly restricoesDaResposta: readonly Restricao[];
  readonly impedimento: Predicado | null;
  /** Os fatos de que o campo depende; a condição do impedimento sobre o próprio campo não conta. */
  readonly fatosCitados: readonly string[];
}

export interface DefinicaoGrupo {
  readonly codigo: string;
  readonly exibicao: Predicado | null;
  readonly obrigatoriedade: Obrigatoriedade;
  readonly minimo: number;
  readonly maximo: number | null;
  readonly incluiCandidato: boolean;
  readonly subitens: readonly DefinicaoItem[];
  /** Os fatos fora da ocorrência de que o grupo depende. */
  readonly fatosDoCandidatoCitados: readonly string[];
}

export interface DefinicaoEtapa {
  readonly codigo: string;
  readonly exibicao: Predicado | null;
  readonly itens: readonly DefinicaoItem[];
  readonly grupos: readonly DefinicaoGrupo[];
}

export interface DefinicaoTermo {
  readonly codigo: string;
  readonly exibicao: Predicado | null;
  readonly obrigatoriedade: Obrigatoriedade;
}

/** As regras de um fato derivado: booleano (alguma regra ativa) ou a união do que as ativas contribuem. */
export interface DefinicaoDerivacao {
  readonly fatoCodigo: string;
  readonly booleano: boolean;
  /** A regra sem cláusula é a âncora, sempre ativa. */
  readonly regras: readonly { readonly quando: Predicado; readonly contribui: string | null }[];
  readonly dependencias: readonly string[];
}

export interface DefinicaoAgregado {
  readonly codigo: string;
  readonly grupoCodigo: string;
  readonly fatoDeMembro: string;
  readonly operacao: 'EXISTE' | 'VALORES_PRESENTES';
}

export interface DefinicaoFormulario {
  readonly etapas: readonly DefinicaoEtapa[];
  readonly termos: readonly DefinicaoTermo[];
  readonly derivacoes: readonly DefinicaoDerivacao[];
  readonly agregados: readonly DefinicaoAgregado[];
  /** A oferta de valores de cada campo que tem uma: a resposta fora dela não vale. */
  readonly ofertas: ReadonlyMap<string, ReadonlySet<string>>;
}

/** Regras que não formam um formulário: o caminho do problema nas regras e a causa. */
export interface RegrasInvalidas {
  readonly caminho: string;
  readonly mensagem: string;
}

export type LeituraDasRegras =
  | { readonly valida: true; readonly definicao: DefinicaoFormulario }
  | { readonly valida: false; readonly erro: RegrasInvalidas };

class Recusa extends Error {
  constructor(
    readonly caminho: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

/**
 * Lê as regras como a API as lê antes de avaliar: a forma que não forma formulário — elemento nulo,
 * obrigatoriedade sem o predicado que pede, restrição incoerente, código repetido — é recusada com o
 * caminho e a causa, para que um arquivo importado nunca chegue ao avaliador pela metade.
 */
export function lerRegras(regras: RegrasDoFormulario | null | undefined): LeituraDasRegras {
  try {
    if (!ehObjeto(regras)) throw new Recusa('regras', 'As regras do formulário são um objeto.');
    return { valida: true, definicao: lerFormulario(regras) };
  } catch (erro) {
    if (erro instanceof Recusa)
      return { valida: false, erro: { caminho: erro.caminho, mensagem: erro.message } };
    throw erro;
  }
}

function lerFormulario(regras: RegrasDoFormulario): DefinicaoFormulario {
  const etapas = lista(regras.etapas, 'etapas', lerEtapa);
  const termos = lista(regras.termos, 'termos', lerTermo);
  const derivacoes = lista(regras.derivacoes, 'derivacoes', lerDerivacao);
  const agregados = lista(regras.agregados, 'agregados', lerAgregado);

  garantirUnicos(
    etapas.map((e) => e.codigo),
    'etapa',
  );
  garantirUnicos(
    termos.map((t) => t.codigo),
    'termo',
  );
  const grupos = etapas.flatMap((e) => e.grupos);
  garantirUnicos(
    [
      ...etapas.flatMap((e) => e.itens.map((i) => i.fatoCodigo)),
      ...grupos.flatMap((g) => g.subitens.map((s) => s.fatoCodigo)),
      ...derivacoes.map((d) => d.fatoCodigo),
      ...agregados.map((a) => a.codigo),
      ...grupos.map((g) => g.codigo),
    ],
    'fato produzido ou grupo do formulário',
  );
  const codigosDosGrupos = new Set(grupos.map((g) => g.codigo));
  agregados.forEach((agregado, i) => {
    if (!codigosDosGrupos.has(agregado.grupoCodigo)) {
      throw new Recusa(
        `agregados[${i}].grupoCodigo`,
        `O agregado '${agregado.codigo}' é sobre o grupo '${agregado.grupoCodigo}', que o formulário não tem.`,
      );
    }
  });

  return { etapas, termos, derivacoes, agregados, ofertas: ofertasDe(regras) };
}

function lerEtapa(etapa: EtapaDasRegras, caminho: string): DefinicaoEtapa {
  return {
    codigo: codigo(etapa.codigo, `${caminho}.codigo`),
    exibicao: predicado(etapa.exibicao, `${caminho}.exibicao`),
    itens: lista(etapa.itens, `${caminho}.itens`, lerItem),
    grupos: lista(etapa.grupos, `${caminho}.grupos`, lerGrupo),
  };
}

function lerGrupo(grupo: GrupoDasRegras, caminho: string): DefinicaoGrupo {
  const codigoDoGrupo = codigo(grupo.codigo, `${caminho}.codigo`);
  const exibicao = predicado(grupo.exibicao, `${caminho}.exibicao`);
  const obrigatoriedade = lerObrigatoriedade(
    grupo.obrigatoriedade,
    grupo.predicadoObrigatoriedade,
    caminho,
    `grupo '${codigoDoGrupo}'`,
  );
  const subitens = lista(grupo.subitens, `${caminho}.subitens`, lerItem);
  const minimo = numero(grupo.minimo, `${caminho}.minimo`) ?? 0;
  const maximo = numero(grupo.maximo, `${caminho}.maximo`);
  if (!Number.isInteger(minimo) || minimo < 0)
    throw new Recusa(`${caminho}.minimo`, 'O mínimo de ocorrências é um inteiro não negativo.');
  if (maximo !== null && (!Number.isInteger(maximo) || maximo < Math.max(minimo, 1))) {
    throw new Recusa(
      `${caminho}.maximo`,
      'O máximo de ocorrências é um inteiro, ao menos 1 e não menor que o mínimo.',
    );
  }

  const dosSubitens = new Set(subitens.map((s) => s.fatoCodigo));
  return {
    codigo: codigoDoGrupo,
    exibicao,
    obrigatoriedade,
    minimo,
    maximo,
    incluiCandidato: booleano(grupo.incluiCandidato, `${caminho}.incluiCandidato`),
    subitens,
    fatosDoCandidatoCitados: [
      ...new Set([
        ...fatosCitadosPor(exibicao),
        ...fatosCitadosPor(obrigatoriedade.predicado),
        ...subitens.flatMap((s) => s.fatosCitados).filter((f) => !dosSubitens.has(f)),
      ]),
    ],
  };
}

function lerItem(item: ItemDasRegras, caminho: string): DefinicaoItem {
  const fatoCodigo = codigo(item.fatoCodigo, `${caminho}.fatoCodigo`);
  const exibicao = predicado(item.exibicao, `${caminho}.exibicao`);
  const obrigatoriedade = lerObrigatoriedade(
    item.obrigatoriedade,
    item.predicadoObrigatoriedade,
    caminho,
    `campo '${fatoCodigo}'`,
  );
  const restricoes = lista(item.restricoes, `${caminho}.restricoes`, lerRestricao);
  const impedimento = lerImpedimento(item.impedimento, `${caminho}.impedimento`);
  lista(item.oferta, `${caminho}.oferta`, (valor) => valor);

  const formato = item.formato ?? null;
  if (formato !== null && !ehFormatoConhecido(formato)) {
    throw new Recusa(
      `${caminho}.formato`,
      `O formato de texto '${formato}' não é do vocabulário do catálogo.`,
    );
  }

  return {
    fatoCodigo,
    exibicao,
    obrigatoriedade,
    restricoesDaResposta: formato === null ? restricoes : [...restricoes, formatoDeTexto(formato)],
    impedimento,
    fatosCitados: [
      ...new Set([
        ...fatosCitadosPor(exibicao),
        ...fatosCitadosPor(obrigatoriedade.predicado),
        ...restricoes.flatMap((r) => r.fatosCitados),
        ...fatosCitadosPor(impedimento).filter((f) => f !== fatoCodigo),
      ]),
    ],
  };
}

function lerTermo(termo: TermoDasRegras, caminho: string): DefinicaoTermo {
  const codigoDoTermo = codigo(termo.codigo, `${caminho}.codigo`);
  return {
    codigo: codigoDoTermo,
    exibicao: predicado(termo.exibicao, `${caminho}.exibicao`),
    obrigatoriedade: lerObrigatoriedade(
      termo.obrigatoriedade,
      termo.predicadoObrigatoriedade,
      caminho,
      `termo '${codigoDoTermo}'`,
    ),
  };
}

function lerDerivacao(derivacao: DerivacaoDasRegras, caminho: string): DefinicaoDerivacao {
  const fatoCodigo = codigo(derivacao.fatoCodigo, `${caminho}.fatoCodigo`).trim();
  const ehBooleano = booleano(derivacao.booleano, `${caminho}.booleano`);
  const regras = lista(derivacao.regras, `${caminho}.regras`, (regra, daRegra) => {
    if (regra.quando === null || regra.quando === undefined) {
      throw new Recusa(
        `${daRegra}.quando`,
        `Uma regra de '${fatoCodigo}' não diz quando ativa; a regra sempre ativa tem a lista vazia.`,
      );
    }
    const quando = predicado(regra.quando, `${daRegra}.quando`) as Predicado;
    if (ehBooleano) return { quando, contribui: null };
    const contribui = typeof regra.contribui === 'string' ? regra.contribui.trim() : '';
    if (contribui === '')
      throw new Recusa(
        `${daRegra}.contribui`,
        'Uma regra de derivação precisa contribuir um código de valor do domínio do fato.',
      );
    return { quando, contribui };
  });
  if (regras.length === 0)
    throw new Recusa(
      `${caminho}.regras`,
      `A derivação de '${fatoCodigo}' precisa de ao menos uma regra.`,
    );

  const dependencias = [...new Set(regras.flatMap((r) => fatosCitadosPor(r.quando)))];
  if (dependencias.includes(fatoCodigo)) {
    throw new Recusa(
      caminho,
      `A derivação de '${fatoCodigo}' cita o próprio fato — um derivado não pode depender de si mesmo.`,
    );
  }
  return { fatoCodigo, booleano: ehBooleano, regras, dependencias };
}

function lerAgregado(agregado: AgregadoDasRegras, caminho: string): DefinicaoAgregado {
  const codigoDoAgregado = codigo(agregado.codigo, `${caminho}.codigo`);
  if (agregado.operacao !== 'EXISTE' && agregado.operacao !== 'VALORES_PRESENTES') {
    throw new Recusa(
      `${caminho}.operacao`,
      `A operação do agregado '${codigoDoAgregado}' é EXISTE ou VALORES_PRESENTES.`,
    );
  }
  return {
    codigo: codigoDoAgregado,
    grupoCodigo: codigo(agregado.grupoCodigo, `${caminho}.grupoCodigo`),
    fatoDeMembro: codigo(agregado.fatoDeMembro, `${caminho}.fatoDeMembro`),
    operacao: agregado.operacao,
  };
}

function lerObrigatoriedade(
  token: string,
  predicadoDoFio: PredicadoDasRegras,
  caminho: string,
  dono: string,
): Obrigatoriedade {
  const quando = predicado(predicadoDoFio, `${caminho}.predicadoObrigatoriedade`);
  if ((token === 'SEMPRE' || token === 'NUNCA') && quando === null)
    return { tipo: token, predicado: null };
  if (token === 'QUANDO' && quando !== null) return { tipo: 'QUANDO', predicado: quando };
  throw new Recusa(
    `${caminho}.obrigatoriedade`,
    `A obrigatoriedade do ${dono} é SEMPRE ou NUNCA sem predicado, ou QUANDO com ele.`,
  );
}

function lerImpedimento(
  impedimento: ImpedimentoDasRegras | null | undefined,
  caminho: string,
): Predicado | null {
  if (impedimento === null || impedimento === undefined) return null;
  if (!ehObjeto(impedimento)) throw new Recusa(caminho, 'O impedimento é um objeto.');
  const quando = condicaoQueValeSempreSeVazia(impedimento.quando, `${caminho}.quando`);
  if (quando === null)
    throw new Recusa(
      `${caminho}.quando`,
      'O impedimento tem a condição sobre a resposta do campo.',
    );
  return quando;
}

function lerRestricao(restricao: RestricaoDasRegras, caminho: string): Restricao {
  const minimo = numero(restricao.minimo, `${caminho}.minimo`);
  const maximo = numero(restricao.maximo, `${caminho}.maximo`);
  switch (restricao.tipo) {
    case FAIXA_NUMERICA:
      if (minimo === null && maximo === null)
        throw new Recusa(caminho, 'A faixa numérica precisa de ao menos um limite.');
      if (minimo !== null && maximo !== null && minimo > maximo)
        throw new Recusa(caminho, `O mínimo (${minimo}) é maior que o máximo (${maximo}).`);
      return faixaNumerica(minimo, maximo);
    case TAMANHO_TEXTO:
      if ([minimo, maximo].some((limite) => limite !== null && !Number.isInteger(limite))) {
        throw new Recusa(caminho, 'Os limites de tamanho de texto são números inteiros.');
      }
      if (minimo === null && maximo === null)
        throw new Recusa(caminho, 'O tamanho de texto precisa de ao menos um limite.');
      if (
        (minimo ?? 0) < 0 ||
        (maximo ?? 0) < 0 ||
        (minimo !== null && maximo !== null && minimo > maximo)
      ) {
        throw new Recusa(caminho, `Os limites de tamanho (${minimo}, ${maximo}) são incoerentes.`);
      }
      return tamanhoDeTexto(minimo, maximo);
    case OPCOES_PERMITIDAS: {
      const entradas = lista(restricao.entradas, `${caminho}.entradas`, (entrada, daEntrada) => ({
        quando: condicaoQueValeSempreSeVazia(entrada.quando, `${daEntrada}.quando`),
        valores: textos(
          entrada.valores,
          `${daEntrada}.valores`,
          'Um grupo de opções precisa de valores não vazios.',
        ),
      }));
      if (entradas.length === 0)
        throw new Recusa(
          `${caminho}.entradas`,
          'As opções permitidas precisam de ao menos um grupo de valores.',
        );
      return opcoesPermitidas(entradas);
    }
    case OPCOES_DAS_RESPOSTAS:
      return opcoesDasRespostas(
        textos(
          restricao.fatos,
          `${caminho}.fatos`,
          'As opções formadas pelas respostas precisam citar ao menos um fato.',
        ),
      );
    case MUNICIPIOS_DA_UF: {
      const fatos = textos(
        restricao.fatos,
        `${caminho}.fatos`,
        'Os municípios da UF citam exatamente um fato, o da UF.',
      );
      if (fatos.length !== 1)
        throw new Recusa(
          `${caminho}.fatos`,
          'Os municípios da UF citam exatamente um fato, o da UF.',
        );
      return municipiosDaUf(fatos[0]);
    }
    default:
      throw new Recusa(
        `${caminho}.tipo`,
        'O tipo da restrição é FAIXA_NUMERICA, TAMANHO_TEXTO, OPCOES_PERMITIDAS, OPCOES_DAS_RESPOSTAS ou MUNICIPIOS_DA_UF.',
      );
  }
}

/** O predicado da exibição e da obrigatoriedade: nulo é sem condição; a lista vazia, o predicado sem cláusula. */
function predicado(clausulas: PredicadoDasRegras, caminho: string): Predicado | null {
  if (clausulas === null || clausulas === undefined) return null;
  if (!Array.isArray(clausulas)) throw new Recusa(caminho, 'O predicado é uma lista de cláusulas.');
  return {
    clausulas: lista(clausulas, caminho, (clausula: readonly CondicaoDasRegras[], daClausula) => {
      if (!Array.isArray(clausula) || clausula.length === 0)
        throw new Recusa(daClausula, 'Uma cláusula deve ter ao menos uma condição.');
      return lista(clausula, daClausula, lerCondicao);
    }),
  };
}

/** O predicado do impedimento e das opções condicionadas: aqui, a lista vazia é ausência de condição. */
function condicaoQueValeSempreSeVazia(
  clausulas: PredicadoDasRegras,
  caminho: string,
): Predicado | null {
  return Array.isArray(clausulas) && clausulas.length === 0 ? null : predicado(clausulas, caminho);
}

function lerCondicao(condicao: CondicaoDasRegras, caminho: string): Condicao {
  if (typeof condicao.fato !== 'string' || condicao.fato.trim() === '')
    throw new Recusa(`${caminho}.fato`, 'O fato da condição é obrigatório.');
  if (typeof condicao.operador !== 'string' || !ehOperador(condicao.operador)) {
    throw new Recusa(`${caminho}.operador`, 'O operador da condição não é reconhecido.');
  }
  const valor = condicao.valor ?? null;
  const emBranco = (v: unknown): boolean => typeof v === 'string' && v.trim() === '';
  const coerente = comparaComLista(condicao.operador)
    ? Array.isArray(valor) && !valor.some(emBranco)
    : !Array.isArray(valor) && !ehObjeto(valor) && !emBranco(valor);
  if (!coerente) {
    throw new Recusa(
      `${caminho}.valor`,
      comparaComLista(condicao.operador)
        ? 'Os operadores EM e NAO_EM exigem uma lista, sem itens de texto em branco.'
        : 'Os operadores IGUAL, DIFERENTE, MAIOR_IGUAL e MENOR_IGUAL exigem um valor simples não branco.',
    );
  }
  return { fato: condicao.fato.trim(), operador: condicao.operador, valor: valor as ValorJson };
}

/** A oferta de valores de cada campo — itens e subitens. */
function ofertasDe(regras: RegrasDoFormulario): ReadonlyMap<string, ReadonlySet<string>> {
  const ofertas = new Map<string, ReadonlySet<string>>();
  for (const item of (regras.etapas ?? []).flatMap((e) => [
    ...(e.itens ?? []),
    ...(e.grupos ?? []).flatMap((g) => g.subitens ?? []),
  ])) {
    if (item.oferta && !ofertas.has(item.fatoCodigo))
      ofertas.set(item.fatoCodigo, new Set(item.oferta));
  }
  return ofertas;
}

/** Os elementos da lista, cada um lido no caminho dele; o elemento nulo é recusado. */
function lista<T, R>(
  elementos: readonly T[] | null | undefined,
  caminho: string,
  ler: (elemento: T, caminho: string) => R,
): R[] {
  if (elementos === null || elementos === undefined) return [];
  if (!Array.isArray(elementos)) throw new Recusa(caminho, 'O elemento é uma lista.');
  return elementos.map((elemento, i) => {
    const doElemento = `${caminho}[${i}]`;
    if (elemento === null || elemento === undefined)
      throw new Recusa(doElemento, `O elemento '${doElemento}' das regras é nulo.`);
    return ler(elemento, doElemento);
  });
}

function textos(
  valores: readonly string[] | null | undefined,
  caminho: string,
  mensagem: string,
): string[] {
  const lidos = lista(valores, caminho, (valor) => valor);
  if (lidos.length === 0 || lidos.some((v) => typeof v !== 'string' || v.trim() === ''))
    throw new Recusa(caminho, mensagem);
  return lidos;
}

/**
 * O valor lógico, como a API o lê do corpo: ausente é falso, e o de outro tipo — um texto como "true"
 * — é recusado.
 */
function booleano(valor: boolean | undefined, caminho: string): boolean {
  if (valor === undefined) return false;
  if (typeof valor !== 'boolean') throw new Recusa(caminho, 'O valor é verdadeiro ou falso.');
  return valor;
}

/**
 * O número, como a API o lê do corpo: aceita também o número escrito em texto, como `"9"`; ausente é
 * nulo, e o de outra forma é recusado.
 */
function numero(valor: unknown, caminho: string): number | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string' && /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$/.test(valor))
    return Number(valor);
  throw new Recusa(caminho, 'O valor é um número.');
}

function codigo(valor: string, caminho: string): string {
  if (typeof valor !== 'string' || valor.trim() === '')
    throw new Recusa(caminho, 'O código é obrigatório.');
  return valor;
}

function garantirUnicos(codigos: readonly string[], oQue: string): void {
  const vistos = new Set<string>();
  for (const valor of codigos) {
    if (vistos.has(valor))
      throw new Recusa('regras', `O código '${valor}' aparece mais de uma vez como ${oQue}.`);
    vistos.add(valor);
  }
}

function ehObjeto(valor: unknown): valor is object {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}
