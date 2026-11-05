import {
  OPERADOR_DIFERENTE,
  OPERADOR_NAO_EM,
  fatosEscolhiveis,
  type FatoEscolhivel,
} from '../../editor-de-condicoes/condicoes-de-fatos';
import { primeiraOrdemDaEtapa } from './ordem-das-entradas';
import { ConteudoDoFormulario, FatoDoFormulario, ItemDoFormulario, PredicadoNoWire } from './tipos';

/**
 * Os fatos que as condições de um item podem citar: os dos itens anteriores a ele — os dados
 * básicos inclusive — e os pressupostos, nunca o próprio. Uma condição sobre fato posterior
 * dependeria de resposta que o candidato ainda não deu.
 */
export function fatosCitaveisPeloItem(
  conteudo: ConteudoDoFormulario,
  fatoCodigo: string,
): ReadonlySet<string> {
  const item = (conteudo.itens ?? []).find((i) => i.fatoCodigo === fatoCodigo);
  const limite = item === undefined ? -Infinity : item.ordem;
  return citaveisAntesDe(conteudo, limite, fatoCodigo);
}

/** Os fatos que a exibição de uma seção pode citar: os das seções anteriores e os pressupostos. */
export function fatosCitaveisPelaSecao(
  conteudo: ConteudoDoFormulario,
  etapaCodigo: string,
): ReadonlySet<string> {
  const etapa = (conteudo.etapas ?? []).find((e) => e.codigo === etapaCodigo);
  const limite = etapa === undefined ? -Infinity : primeiraOrdemDaEtapa(conteudo, etapa.ordem);
  return citaveisAntesDe(conteudo, limite, null);
}

/**
 * Os fatos cujo campo precisa ser obrigatório sempre: o citado por negação (`DIFERENTE`, `NAO_EM`)
 * em qualquer regra, e o que tem impedimento. Sem resposta, todo operador dá falso, e a negação ou
 * o impedimento dariam resultado que o candidato não declarou (UNI-REQ-0074).
 */
export function fatosQueExigemResposta(conteudo: ConteudoDoFormulario): ReadonlySet<string> {
  const fatos = new Set<string>();
  for (const predicado of todosOsPredicados(conteudo)) {
    for (const condicao of (predicado ?? []).flat()) {
      if (condicao.operador === OPERADOR_DIFERENTE || condicao.operador === OPERADOR_NAO_EM)
        fatos.add(condicao.fato);
    }
  }
  for (const campo of todosOsCampos(conteudo)) {
    if (campo.impedimento != null) fatos.add(campo.fatoCodigo);
  }
  return fatos;
}

/**
 * Os fatos que um termo pode citar: todos os campos do formulário e os pressupostos — o termo é
 * aceito na revisão e aceite, depois de tudo respondido.
 */
export function fatosCitaveisPelosTermos(conteudo: ConteudoDoFormulario): ReadonlySet<string> {
  return citaveisAntesDe(conteudo, Infinity, null);
}

/**
 * Os fatos que um editor de condições oferece: os citáveis e os que as condições já citam — para a
 * condição gravada aparecer mesmo que o fato tenha deixado de ser citável.
 */
export function fatosOferecidos(
  catalogo: readonly FatoDoFormulario[],
  citaveis: ReadonlySet<string>,
  predicados: readonly PredicadoNoWire[],
  comMunicipios = false,
): readonly FatoEscolhivel[] {
  const citados = new Set(predicados.flatMap(fatosDoPredicado));
  return fatosEscolhiveis(
    catalogo.filter((fato) => citaveis.has(fato.codigo) || citados.has(fato.codigo)),
    new Map(),
    [],
    comMunicipios,
  );
}

/**
 * O conteúdo com os fatos de outro formulário conhecidos antes de tudo — no processo, os da
 * inscrição, que as outras finalidades citam sem coletar. Serve só às citações: nunca é gravado.
 */
export function comFatosConhecidosAntes(
  conteudo: ConteudoDoFormulario,
  fatos: readonly string[],
): ConteudoDoFormulario {
  return fatos.length === 0
    ? conteudo
    : { ...conteudo, pressupostos: [...new Set([...(conteudo.pressupostos ?? []), ...fatos])] };
}

export function citaveisAntesDe(
  conteudo: ConteudoDoFormulario,
  limite: number,
  excluido: string | null,
): ReadonlySet<string> {
  const fatos = new Set(conteudo.pressupostos ?? []);
  for (const item of conteudo.itens ?? []) {
    if (item.ordem < limite) fatos.add(item.fatoCodigo);
  }
  if (excluido !== null) fatos.delete(excluido);
  return fatos;
}

/** Todos os campos: os itens e os campos dos grupos. */
export function todosOsCampos(conteudo: ConteudoDoFormulario): readonly ItemDoFormulario[] {
  return [...(conteudo.itens ?? []), ...(conteudo.grupos ?? []).flatMap((grupo) => grupo.subitens)];
}

/**
 * Os fatos que alguma regra do próprio formulário cita: exibição, obrigatoriedade, impedimento e
 * restrições dos campos, e a exibição e a obrigatoriedade das seções, dos grupos e dos termos.
 */
export function fatosCitadosPeloConteudo(conteudo: ConteudoDoFormulario): ReadonlySet<string> {
  return new Set([
    ...todosOsPredicados(conteudo).flatMap(fatosDoPredicado),
    ...todosOsCampos(conteudo).flatMap((campo) =>
      (campo.restricoes ?? []).flatMap((restricao) => restricao.fatos ?? []),
    ),
  ]);
}

/**
 * Os predicados do campo que citam só respostas anteriores a ele: a exibição, a obrigatoriedade e a
 * condição de cada grupo de opções. O impedimento fica de fora: cita a resposta do próprio campo.
 */
export function predicadosSobreRespostasAnteriores(
  campo: ItemDoFormulario,
): readonly PredicadoNoWire[] {
  return [
    campo.precondicao,
    campo.predicadoObrigatoriedade ?? null,
    ...(campo.restricoes ?? []).flatMap((restricao) =>
      (restricao.entradas ?? []).map((entrada) => entrada.quando),
    ),
  ];
}

function predicadosDoCampo(campo: ItemDoFormulario): readonly PredicadoNoWire[] {
  return [...predicadosSobreRespostasAnteriores(campo), campo.impedimento?.quando ?? null];
}

export function fatosCitadosPeloCampo(campo: ItemDoFormulario): readonly string[] {
  return [
    ...predicadosDoCampo(campo).flatMap(fatosDoPredicado),
    ...(campo.restricoes ?? []).flatMap((restricao) => restricao.fatos ?? []),
  ];
}

export function fatosDoPredicado(predicado: PredicadoNoWire): readonly string[] {
  return (predicado ?? []).flat().map((condicao) => condicao.fato);
}

function todosOsPredicados(conteudo: ConteudoDoFormulario): readonly PredicadoNoWire[] {
  return [
    ...todosOsCampos(conteudo).flatMap(predicadosDoCampo),
    ...(conteudo.etapas ?? []).map((etapa) => etapa.exibicao ?? null),
    ...(conteudo.grupos ?? []).flatMap((grupo) => [grupo.exibicao, grupo.predicadoObrigatoriedade]),
    ...(conteudo.termos ?? []).flatMap((termo) => [termo.exibicao, termo.predicadoObrigatoriedade]),
    ...(conteudo.documentosExigidos ?? []).map((documento) => documento.quando),
  ];
}

interface Citante {
  /** O fato do campo que cita, quando quem cita é um campo. */
  readonly fatoCodigo: string | null;
  /** Quem cita, para a frase de recusa. */
  readonly descricao: string;
}

interface PossivelCitante {
  readonly citados: readonly string[];
  readonly citante: Citante;
}

function possiveisCitantes(conteudo: ConteudoDoFormulario): readonly PossivelCitante[] {
  const dePredicados = (predicados: readonly PredicadoNoWire[]): readonly string[] =>
    predicados.flatMap(fatosDoPredicado);
  return [
    ...todosOsCampos(conteudo).map((campo) => ({
      citados: fatosCitadosPeloCampo(campo),
      citante: { fatoCodigo: campo.fatoCodigo, descricao: `o campo “${campo.rotulo}”` },
    })),
    ...(conteudo.etapas ?? []).map((etapa) => ({
      citados: dePredicados([etapa.exibicao ?? null]),
      citante: { fatoCodigo: null, descricao: `a seção “${etapa.titulo}”` },
    })),
    ...(conteudo.grupos ?? []).map((grupo) => ({
      citados: dePredicados([grupo.exibicao, grupo.predicadoObrigatoriedade]),
      citante: { fatoCodigo: null, descricao: `o grupo “${grupo.rotulo}”` },
    })),
    ...(conteudo.termos ?? []).map((termo) => ({
      citados: dePredicados([termo.exibicao, termo.predicadoObrigatoriedade]),
      citante: { fatoCodigo: null, descricao: `o termo ${termo.codigo}` },
    })),
    ...(conteudo.documentosExigidos ?? []).map((documento) => ({
      citados: dePredicados([documento.quando]),
      citante: {
        fatoCodigo: null,
        descricao: `o documento exigido ${documento.tipoDocumentoCodigo}`,
      },
    })),
  ];
}

export function quemCita(conteudo: ConteudoDoFormulario, fato: string): readonly Citante[] {
  return possiveisCitantes(conteudo)
    .filter((possivel) => possivel.citados.includes(fato))
    .map((possivel) => possivel.citante);
}
