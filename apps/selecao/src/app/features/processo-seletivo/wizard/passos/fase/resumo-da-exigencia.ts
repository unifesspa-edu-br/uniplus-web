import { OperadorCodigo } from '@uniplus/shared-data/selecao';
import { descreverCondicao } from '@uniplus/shared-inscricao/formulario';

import type { BaseLegalConfig, ExigenciaDeDocumento } from '../../processo-seletivo.models';
import { type GrupoDaExigencia } from '../../shared/exigencias/consulta-das-exigencias';
import {
  ABRANGENCIAS_ESCOLHIVEIS,
  FATO_MODALIDADE,
  SITUACAO_BASE_LEGAL_ESCOLHIVEIS,
  temNormaResolvida,
} from '../../shared/exigencias/exigencias-documentais';
import {
  exigidoDeTodos,
  numerosDeClausula,
} from '../../shared/exigencias/modalidades-da-exigencia';
import {
  podeAlcancarModalidade,
  modalidadesUniformes,
  valorEscalarDe,
  valoresDeListaDe,
  type CondicaoDeFato,
  type FatoEscolhivel,
} from '../../shared/gatilho-de-exigencia';

/**
 * A quem uma exigência documental se aplica, na forma que a conferência lê e filtra.
 *
 * A restrição às modalidades que o editor escreve — o mesmo `EM` em todas as alternativas — vale
 * para o gatilho inteiro; as alternativas se combinam por OU, e as condições de uma alternativa
 * por E — a mesma leitura do editor. Qualquer outra condição de modalidade, que o domínio aceita
 * por outro caminho (o `EM` fora da restrição, é, não é, não é nenhum de), entra na alternativa
 * dela, descrita.
 */
export interface PublicoDaExigencia {
  readonly deTodos: boolean;
  /** As modalidades da restrição uniforme, ou `null` quando o gatilho não a tem. */
  readonly modalidades: readonly string[] | null;
  /** Cada alternativa do gatilho como as condições dela, já em prosa. */
  readonly alternativas: readonly (readonly string[])[];
  /**
   * As mesmas alternativas, condição a condição, com "código — nome" nas de modalidade. É só
   * apresentação: a identidade da condição, e o valor do filtro, vêm de `alternativas`.
   */
  readonly alternativasRotuladas: readonly (readonly string[])[];
  /**
   * Se alguma alternativa não depende de fato além da modalidade: por ela, o documento é
   * cobrado de quem concorre na modalidade, qualquer que seja a outra resposta.
   */
  readonly independeDeOutroFato: boolean;
  /** Se o documento pode ser cobrado de quem concorre na modalidade (regra do domínio). */
  readonly alcancaModalidade: (codigo: string) => boolean;
}

/** Como a tela nomeia cada modalidade pelo código: "código — nome", ou só o código. */
type Rotulos = ReadonlyMap<string, string>;

const SEM_ROTULOS: Rotulos = new Map();

export function publicoDaExigencia(
  exigencia: ExigenciaDeDocumento,
  fatoPorCodigo: ReadonlyMap<string, FatoEscolhivel>,
  rotulos: Rotulos = new Map(),
): PublicoDaExigencia {
  return exigidoDeTodos(exigencia)
    ? publicoDeTodos(exigencia)
    : publicoCondicional(exigencia, fatoPorCodigo, rotulos);
}

function publicoDeTodos(exigencia: ExigenciaDeDocumento): PublicoDaExigencia {
  return {
    deTodos: true,
    modalidades: null,
    alternativas: [],
    alternativasRotuladas: [],
    independeDeOutroFato: true,
    alcancaModalidade: (codigo) => podeAlcancarModalidade(exigencia, codigo),
  };
}

function publicoCondicional(
  exigencia: ExigenciaDeDocumento,
  fatoPorCodigo: ReadonlyMap<string, FatoEscolhivel>,
  rotulos: Rotulos,
): PublicoDaExigencia {
  return {
    deTodos: false,
    modalidades: modalidadesUniformes(exigencia),
    alcancaModalidade: (codigo) => podeAlcancarModalidade(exigencia, codigo),
    ...condicoesDoPublico(exigencia, fatoPorCodigo, rotulos),
  };
}

type CondicoesDoPublico = Pick<
  PublicoDaExigencia,
  'alternativas' | 'alternativasRotuladas' | 'independeDeOutroFato'
>;

function condicoesDoPublico(
  exigencia: ExigenciaDeDocumento,
  fatoPorCodigo: ReadonlyMap<string, FatoEscolhivel>,
  rotulos: Rotulos,
): CondicoesDoPublico {
  const porAlternativa = condicoesPorAlternativa(exigencia);
  const modalidades = modalidadesUniformes(exigencia);
  const descrever = (fatos: ReadonlyMap<string, FatoEscolhivel>, nomes: Rotulos) =>
    descreverAlternativas(porAlternativa, modalidades, fatos, nomes);
  return {
    alternativas: descrever(semRotulosDasModalidades(fatoPorCodigo, rotulos), SEM_ROTULOS),
    alternativasRotuladas: descrever(fatoPorCodigo, rotulos),
    independeDeOutroFato: porAlternativa.some((itens) => itens.every(ehCondicaoDeModalidade)),
  };
}

/**
 * Os fatos como a identidade da condição os lê: sem o "código — nome" que a tela põe nos valores
 * que são modalidades, para que renomear a modalidade não mude a chave do filtro.
 */
function semRotulosDasModalidades(
  fatoPorCodigo: ReadonlyMap<string, FatoEscolhivel>,
  rotulos: Rotulos,
): ReadonlyMap<string, FatoEscolhivel> {
  return new Map(
    [...fatoPorCodigo].map(([codigo, fato]) => [codigo, semRotulosIguaisA(fato, rotulos)]),
  );
}

function semRotulosIguaisA(fato: FatoEscolhivel, rotulos: Rotulos): FatoEscolhivel {
  if (fato.rotulos === undefined) return fato;
  const proprios = [...fato.rotulos].filter(([valor, rotulo]) => rotulos.get(valor) !== rotulo);
  return { ...fato, rotulos: new Map(proprios) };
}

function ehCondicaoDeModalidade(condicao: CondicaoDeFato): boolean {
  return condicao.fato === FATO_MODALIDADE;
}

/** Se uma alternativa só exige a modalidade, as outras não restringem o público dela. */
function descreverAlternativas(
  porAlternativa: readonly CondicaoDeFato[][],
  modalidades: readonly string[] | null,
  fatoPorCodigo: ReadonlyMap<string, FatoEscolhivel>,
  rotulos: Rotulos,
): readonly (readonly string[])[] {
  const descritas = porAlternativa.map((condicoes) =>
    descreverAlternativa(condicoes, modalidades, fatoPorCodigo, rotulos),
  );
  return descritas.some((alternativa) => alternativa.length === 0) ? [] : descritas;
}

function condicoesPorAlternativa(exigencia: ExigenciaDeDocumento): CondicaoDeFato[][] {
  const clausulas = exigencia.condicoes.length === 0 ? [] : numerosDeClausula(exigencia.condicoes);
  return clausulas.map((numero) =>
    exigencia.condicoes.filter((condicao) => condicao.clausula === numero),
  );
}

// A restrição é a mesma cláusula `EM` em todas as alternativas: ela já aparece como
// "Modalidades …", e repeti-la em cada alternativa só alongaria a frase. Fora da restrição, o
// `EM` é condição da própria alternativa e aparece descrito nela.
function descreverAlternativa(
  condicoes: readonly CondicaoDeFato[],
  modalidades: readonly string[] | null,
  fatoPorCodigo: ReadonlyMap<string, FatoEscolhivel>,
  rotulos: Rotulos,
): string[] {
  return condicoes
    .filter((condicao) => !ehRestricaoDeModalidades(condicao, modalidades))
    .map((condicao) =>
      ehCondicaoDeModalidade(condicao)
        ? descreverCondicaoDeModalidade(condicao, rotulos)
        : descreverCondicao(condicao, fatoPorCodigo.get(condicao.fato)),
    );
}

function ehRestricaoDeModalidades(
  condicao: CondicaoDeFato,
  modalidades: readonly string[] | null,
): boolean {
  return (
    modalidades !== null &&
    ehCondicaoDeModalidade(condicao) &&
    condicao.operador === OperadorCodigo.ALGUM_DE &&
    JSON.stringify(valoresDeListaDe(condicao)) === JSON.stringify(modalidades)
  );
}

/** A condição sobre a modalidade como frase, com "código — nome" de cada modalidade. */
export function descreverCondicaoDeModalidade(condicao: CondicaoDeFato, rotulos: Rotulos): string {
  const codigos = codigosDaCondicao(condicao);
  const lista = codigos.length > 0 ? listaDeRotulos(codigos, rotulos) : '(valor não escolhido)';
  const nega =
    condicao.operador === OperadorCodigo.DIFERENTE ||
    condicao.operador === OperadorCodigo.NENHUM_DE;

  if (nega) return `Modalidades exceto ${lista}`;
  return codigos.length > 1 ? `Modalidades ${lista}` : `Modalidade ${lista}`;
}

function codigosDaCondicao(condicao: CondicaoDeFato): readonly string[] {
  return condicao.operador === OperadorCodigo.ALGUM_DE ||
    condicao.operador === OperadorCodigo.NENHUM_DE
    ? valoresDeListaDe(condicao)
    : [valorEscalarDe(condicao)].filter((codigo) => codigo !== '');
}

function rotuloDe(codigo: string, rotulos: Rotulos): string {
  return rotulos.get(codigo) ?? codigo;
}

function listaDeRotulos(codigos: readonly string[], rotulos: Rotulos): string {
  return codigos.map((codigo) => rotuloDe(codigo, rotulos)).join(', ');
}

/**
 * A quem a exigência se aplica, numa frase. A exigência "de quem satisfaz" sem restrição nem
 * condição não é cobrada de ninguém, e a conferência precisa dizê-lo em vez de calar.
 */
export function descreverPublico(
  publico: PublicoDaExigencia,
  rotulos: Rotulos = new Map(),
): string {
  if (publico.deTodos) return 'Todo candidato';

  const condicoes = publico.alternativasRotuladas.map((item) => item.join(' e ')).join(', ou ');
  const restritas = publico.modalidades;
  const modalidades = restritas === null ? '' : `Modalidades ${listaDeRotulos(restritas, rotulos)}`;

  if (modalidades !== '' && condicoes !== '') return `${modalidades}, de quem: ${condicoes}`;
  if (modalidades !== '') return modalidades;
  if (condicoes !== '') return `Quem: ${condicoes}`;
  return 'Ninguém: nenhuma condição declarada';
}

/** Os filtros da conferência: quem a pessoa quer conferir. */
export type FiltroDePublico =
  | { readonly tipo: 'tudo' }
  | { readonly tipo: 'todo-candidato' }
  | { readonly tipo: 'modalidade'; readonly codigo: string }
  | { readonly tipo: 'condicao'; readonly condicao: string };

/**
 * Se o documento pode ser cobrado do público filtrado — o que um candidato daquele público
 * entrega.
 *
 * Por modalidade vale a regra do domínio: entra o documento de todo candidato e o condicional
 * que pode alcançar a modalidade, inclusive o que depende de outra resposta do candidato — a
 * linha mostra de quem, e escondê-lo faria a conferência de "tudo o que um LB_PPI entrega"
 * deixá-lo de fora.
 *
 * Por condição entra o documento que a declara em alguma alternativa e o que não depende de
 * outro fato em alguma alternativa (o de todo candidato, o restrito só por modalidade): esse
 * candidato também pode entregá-lo.
 */
export function alcancaOPublico(publico: PublicoDaExigencia, filtro: FiltroDePublico): boolean {
  switch (filtro.tipo) {
    case 'tudo':
      return true;
    case 'todo-candidato':
      return publico.deTodos;
    case 'modalidade':
      return publico.alcancaModalidade(filtro.codigo);
    case 'condicao':
      if (publico.independeDeOutroFato) return true;
      return publico.alternativas.some((alternativa) => alternativa.includes(filtro.condicao));
  }
}

/**
 * O que acontece com quem não entrega, como o editor o nomeia. Sem consequência, a exigência
 * obrigatória ainda decide pela falta do próprio documento, e o rótulo genérico mentiria.
 */
export function rotuloDaConsequencia(
  valor: string,
  obrigatorio: boolean,
  opcoes: readonly { readonly codigo: string; readonly rotulo: string }[],
): string {
  if (valor === '' && obrigatorio) return 'Nada além de faltar o documento obrigatório';
  if (valor === '') return 'Não decide sozinha';
  return opcoes.find((opcao) => opcao.codigo === valor)?.rotulo ?? '';
}

/** A norma como a conferência a mostra: a referência e, abaixo, o alcance e a identificação. */
export interface NormaDescrita {
  readonly referencia: string;
  readonly detalhe: string;
  readonly observacao: string;
}

export function descreverNorma(base: BaseLegalConfig): NormaDescrita {
  const abrangencia =
    ABRANGENCIAS_ESCOLHIVEIS.find((opcao) => opcao.valor === base.abrangencia)?.rotulo ??
    base.abrangencia;
  const status =
    SITUACAO_BASE_LEGAL_ESCOLHIVEIS.find((opcao) => opcao.valor === base.situacao)?.rotulo ??
    base.situacao;

  return {
    referencia: base.referencia.trim() !== '' ? base.referencia.trim() : 'Sem referência declarada',
    detalhe: `${abrangencia} · ${status}`,
    observacao: (base.observacao ?? '').trim(),
  };
}

/**
 * A norma única e resolvida que sustenta todas as exigências, ou `null` quando alguma exigência
 * tem outra, mais de uma ou nenhuma. Só a norma resolvida sobe para cima da tabela: a pendente
 * precisa continuar acusada na linha de cada exigência que a publicação recusaria.
 */
export function normaComum(
  basesPorExigencia: readonly (readonly BaseLegalConfig[])[],
): BaseLegalConfig | null {
  const [primeira] = basesPorExigencia;
  if (primeira?.length !== 1 || !temNormaResolvida(primeira)) return null;

  const [modelo] = primeira;
  const mesma = (base: BaseLegalConfig) =>
    base.referencia.trim() === modelo.referencia.trim() &&
    base.abrangencia === modelo.abrangencia &&
    base.situacao === modelo.situacao &&
    (base.observacao ?? '').trim() === (modelo.observacao ?? '').trim();

  return basesPorExigencia.every((bases) => bases.length === 1 && mesma(bases[0])) ? modelo : null;
}

/** Como o documento compõe um grupo, curto o bastante para a coluna da entrega. */
export function composicaoResumida(grupo: GrupoDaExigencia | null): string {
  if (grupo === null) return '';
  if (grupo.forma === 'TODOS_OS_ITENS') return `Conjunto de ${grupo.alternativas} documentos`;

  const minima = grupo.quantidadeMinima ?? 1;
  return minima === 1
    ? `Basta 1 entre ${grupo.alternativas} alternativas`
    : `${minima} entre ${grupo.alternativas} alternativas`;
}

/** A repetição do documento pelas ocorrências de um grupo do formulário; vazio quando é um por candidato. */
export function repeticaoResumida(rotuloDoGrupo: string | null): string {
  return rotuloDoGrupo === null ? '' : `Um por ocorrência de ${rotuloDoGrupo}`;
}

/** Um público que a conferência oferece, com o valor que o seletor guarda. */
export interface OpcaoDoFiltro {
  readonly valor: string;
  readonly rotulo: string;
}

/** A opção do seletor de público, rotulada pelo público que o valor codifica. */
export function opcaoDoFiltro(
  valor: string,
  rotulos: Rotulos = SEM_ROTULOS,
  rotulosDasCondicoes: Rotulos = SEM_ROTULOS,
): OpcaoDoFiltro {
  return { valor, rotulo: rotuloDoFiltro(filtroDoValor(valor), rotulos, rotulosDasCondicoes) };
}

function rotuloDoFiltro(filtro: FiltroDePublico, rotulos: Rotulos, condicoes: Rotulos): string {
  switch (filtro.tipo) {
    case 'modalidade':
      return `Candidato de ${rotuloDe(filtro.codigo, rotulos)}`;
    case 'condicao':
      return `Candidato com: ${rotuloDe(filtro.condicao, condicoes)}`;
    case 'todo-candidato':
      return 'Exigidos de todo candidato';
    case 'tudo':
      return 'Todos os documentos da fase';
  }
}

/** Cada condição declarada nos públicos: a identidade que o filtro guarda e o rótulo exibido. */
export function rotulosDasCondicoesDe(
  publicos: readonly PublicoDaExigencia[],
): Map<string, string> {
  const rotulos = new Map<string, string>();
  for (const publico of publicos) {
    publico.alternativas.forEach((alternativa, i) =>
      alternativa.forEach((condicao, j) =>
        rotulos.set(condicao, publico.alternativasRotuladas[i][j]),
      ),
    );
  }
  return rotulos;
}

/** O valor do seletor de público de volta ao filtro que ele codifica. */
export function filtroDoValor(valor: string): FiltroDePublico {
  if (valor === 'todo-candidato') return { tipo: 'todo-candidato' };
  if (valor.startsWith('modalidade:')) {
    return { tipo: 'modalidade', codigo: valor.slice('modalidade:'.length) };
  }
  if (valor.startsWith('condicao:')) {
    return { tipo: 'condicao', condicao: valor.slice('condicao:'.length) };
  }
  return { tipo: 'tudo' };
}
