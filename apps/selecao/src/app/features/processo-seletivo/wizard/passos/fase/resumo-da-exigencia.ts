import { OperadorCodigo } from '@uniplus/shared-data/selecao';
import { descreverCondicao } from '@uniplus/shared-ui/components';

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
   * Se alguma alternativa não depende de fato além da modalidade: por ela, o documento é
   * cobrado de quem concorre na modalidade, qualquer que seja a outra resposta.
   */
  readonly independeDeOutroFato: boolean;
  /** Se o documento pode ser cobrado de quem concorre na modalidade (regra do domínio). */
  readonly alcancaModalidade: (codigo: string) => boolean;
}

export function publicoDaExigencia(
  exigencia: ExigenciaDeDocumento,
  fatoPorCodigo: ReadonlyMap<string, FatoEscolhivel>,
): PublicoDaExigencia {
  if (exigidoDeTodos(exigencia)) {
    return {
      deTodos: true,
      modalidades: null,
      alternativas: [],
      independeDeOutroFato: true,
      alcancaModalidade: (codigo) => podeAlcancarModalidade(exigencia, codigo),
    };
  }
  return publicoCondicional(exigencia, fatoPorCodigo);
}

function publicoCondicional(
  exigencia: ExigenciaDeDocumento,
  fatoPorCodigo: ReadonlyMap<string, FatoEscolhivel>,
): PublicoDaExigencia {
  const modalidades = modalidadesUniformes(exigencia);
  const porAlternativa = condicoesPorAlternativa(exigencia);
  return {
    deTodos: false,
    alcancaModalidade: (codigo) => podeAlcancarModalidade(exigencia, codigo),
    modalidades,
    alternativas: descreverAlternativas(porAlternativa, modalidades, fatoPorCodigo),
    independeDeOutroFato: porAlternativa.some((itens) => itens.every(ehCondicaoDeModalidade)),
  };
}

function ehCondicaoDeModalidade(condicao: CondicaoDeFato): boolean {
  return condicao.fato === FATO_MODALIDADE;
}

/** Se uma alternativa só exige a modalidade, as outras não restringem o público dela. */
function descreverAlternativas(
  porAlternativa: readonly CondicaoDeFato[][],
  modalidades: readonly string[] | null,
  fatoPorCodigo: ReadonlyMap<string, FatoEscolhivel>,
): readonly (readonly string[])[] {
  const descritas = porAlternativa.map((condicoes) =>
    descreverAlternativa(condicoes, modalidades, fatoPorCodigo),
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
): string[] {
  return condicoes
    .filter((condicao) => !ehRestricaoDeModalidades(condicao, modalidades))
    .map((condicao) =>
      ehCondicaoDeModalidade(condicao)
        ? descreverCondicaoDeModalidade(condicao)
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

/** A condição sobre a modalidade como frase, nos códigos do quadro de vagas. */
export function descreverCondicaoDeModalidade(condicao: CondicaoDeFato): string {
  const codigos =
    condicao.operador === OperadorCodigo.ALGUM_DE || condicao.operador === OperadorCodigo.NENHUM_DE
      ? valoresDeListaDe(condicao)
      : [valorEscalarDe(condicao)].filter((codigo) => codigo !== '');
  const lista = codigos.length > 0 ? codigos.join(', ') : '(valor não escolhido)';
  const nega =
    condicao.operador === OperadorCodigo.DIFERENTE ||
    condicao.operador === OperadorCodigo.NENHUM_DE;

  if (nega) return `Modalidades exceto ${lista}`;
  return codigos.length > 1 ? `Modalidades ${lista}` : `Modalidade ${lista}`;
}

/**
 * A quem a exigência se aplica, numa frase. A exigência "de quem satisfaz" sem restrição nem
 * condição não é cobrada de ninguém, e a conferência precisa dizê-lo em vez de calar.
 */
export function descreverPublico(publico: PublicoDaExigencia): string {
  if (publico.deTodos) return 'Todo candidato';

  const condicoes = publico.alternativas
    .map((alternativa) => alternativa.join(' e '))
    .join(', ou ');
  const modalidades =
    publico.modalidades === null ? '' : `Modalidades ${publico.modalidades.join(', ')}`;

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
export function opcaoDoFiltro(valor: string): OpcaoDoFiltro {
  const filtro = filtroDoValor(valor);
  switch (filtro.tipo) {
    case 'modalidade':
      return { valor, rotulo: `Candidato de ${filtro.codigo}` };
    case 'condicao':
      return { valor, rotulo: `Candidato com: ${filtro.condicao}` };
    case 'todo-candidato':
      return { valor, rotulo: 'Exigidos de todo candidato' };
    case 'tudo':
      return { valor, rotulo: 'Todos os documentos da fase' };
  }
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
