import { agregar, derivar } from './avaliacao-de-derivados';
import { avaliarGrupo } from './avaliacao-do-grupo';
import { avaliarItem, type ItemResolvido, obrigatorioSeVisivel } from './avaliacao-do-item';
import type {
  AvaliacaoInterna,
  EntradaDaAvaliacao,
  GrupoAvaliadoInterno,
  ItemAvaliado,
} from './avaliacao-interna';
import type {
  DefinicaoAgregado,
  DefinicaoDerivacao,
  DefinicaoPagina,
  DefinicaoFormulario,
  DefinicaoGrupo,
  DefinicaoItem,
} from './definicao-do-formulario';
import { FALSO, FATO_INDETERMINADO, type FatoResolvido, type Fatos, INDETERMINADO } from './logica';
import { type FatoOuGrupoAOrdenar, ordenar, PRIORIDADE_DERIVADO } from './ordem-de-avaliacao';
import { avaliarOuVerdadeiro, fatosCitadosPor } from './predicado';

export type {
  AvaliacaoInterna,
  EntradaDaAvaliacao,
  GrupoAvaliadoInterno,
  ItemAvaliado,
  OcorrenciaAvaliadaInterna,
  OcorrenciaRespondida,
} from './avaliacao-interna';

interface ItemDaPagina {
  readonly pagina: DefinicaoPagina;
  readonly item: DefinicaoItem;
}

interface GrupoDaPagina {
  readonly pagina: DefinicaoPagina;
  readonly grupo: DefinicaoGrupo;
}

/** O formulário indexado pelos códigos que a avaliação resolve, na ordem em que as regras os declaram. */
interface Indice {
  readonly itens: readonly ItemDaPagina[];
  readonly grupos: readonly GrupoDaPagina[];
  readonly itemPorFato: ReadonlyMap<string, ItemDaPagina>;
  readonly grupoPorCodigo: ReadonlyMap<string, GrupoDaPagina>;
  readonly derivacaoPorFato: ReadonlyMap<string, DefinicaoDerivacao>;
  readonly agregadoPorFato: ReadonlyMap<string, DefinicaoAgregado>;
}

/** O que a avaliação já resolveu, preenchido na ordem topológica. */
interface Andamento {
  readonly fatos: Map<string, FatoResolvido>;
  readonly itens: Map<string, ItemAvaliado>;
  readonly grupos: Map<string, GrupoAvaliadoInterno>;
}

/**
 * Avalia o formulário contra as respostas, como o avaliador da API: resolve cada fato em ordem
 * topológica, com derivados e agregados assim que as dependências ficam prontas, e diz por campo se
 * aparece, se é obrigatório, quais restrições a resposta viola, se impede e quais opções valem; por
 * grupo, o mesmo para cada ocorrência; por termo, se aparece e se é obrigatório.
 *
 * O estado do fato de um campo segue esta ordem: oculto, não aplicável; exibição indeterminada,
 * indeterminado; resposta que atende, resolvido; validade que depende de resposta desconhecida,
 * indeterminado; sem resposta que valha, pendente se obrigatório ou com a seção aberta, e não
 * informado no opcional de seção concluída. O que pertence a um ciclo, ou depende de um, fica
 * indeterminado: o avaliador não decide sobre o que não consegue ordenar.
 */
export function avaliar(
  definicao: DefinicaoFormulario,
  entrada: EntradaDaAvaliacao,
): AvaliacaoInterna {
  const indice = indexar(definicao);
  const { ordem, foraDeOrdem } = ordenar(fatosEGruposAOrdenarDa(definicao, indice));
  const andamento: Andamento = {
    fatos: new Map(entrada.fatosConhecidos),
    itens: new Map(),
    grupos: new Map(),
  };
  for (const codigo of ordem) resolverFatoOuGrupo(codigo, indice, entrada, andamento);
  for (const codigo of foraDeOrdem) deixarIndeterminado(codigo, indice, andamento);
  return montarAvaliacao(definicao, indice, andamento);
}

function indexar(definicao: DefinicaoFormulario): Indice {
  const itens = itensComAPagina(definicao);
  const grupos = gruposComAPagina(definicao);
  return {
    itens,
    grupos,
    itemPorFato: new Map(itens.map((par) => [par.item.fatoCodigo, par])),
    grupoPorCodigo: new Map(grupos.map((par) => [par.grupo.codigo, par])),
    derivacaoPorFato: new Map(definicao.derivacoes.map((d) => [d.fatoCodigo, d])),
    agregadoPorFato: new Map(definicao.agregados.map((a) => [a.codigo, a])),
  };
}

function itensComAPagina(definicao: DefinicaoFormulario): ItemDaPagina[] {
  return definicao.paginas.flatMap((pagina) => pagina.itens.map((item) => ({ pagina, item })));
}

function gruposComAPagina(definicao: DefinicaoFormulario): GrupoDaPagina[] {
  return definicao.paginas.flatMap((pagina) => pagina.grupos.map((grupo) => ({ pagina, grupo })));
}

function fatosEGruposAOrdenarDa(
  definicao: DefinicaoFormulario,
  { itens, grupos }: Indice,
): readonly FatoOuGrupoAOrdenar[] {
  return [
    ...dependenciasDosCampos(itens),
    ...dependenciasDosGrupos(grupos, itens.length),
    ...dependenciasDosDerivados(definicao),
  ];
}

function dependenciasDosCampos(itens: readonly ItemDaPagina[]): FatoOuGrupoAOrdenar[] {
  return itens.map((par, posicao) => ({
    codigo: par.item.fatoCodigo,
    citados: [...fatosCitadosPor(par.pagina.exibicao), ...par.item.fatosCitados],
    prioridade: posicao,
  }));
}

function dependenciasDosGrupos(
  grupos: readonly GrupoDaPagina[],
  primeiraPrioridade: number,
): FatoOuGrupoAOrdenar[] {
  return grupos.map((par, posicao) => ({
    codigo: par.grupo.codigo,
    citados: [...fatosCitadosPor(par.pagina.exibicao), ...par.grupo.fatosDoCandidatoCitados],
    prioridade: primeiraPrioridade + posicao,
  }));
}

function dependenciasDosDerivados(definicao: DefinicaoFormulario): FatoOuGrupoAOrdenar[] {
  return [
    ...definicao.derivacoes.map((d) => ({
      codigo: d.fatoCodigo,
      citados: d.dependencias,
      prioridade: PRIORIDADE_DERIVADO,
    })),
    ...definicao.agregados.map((a) => ({
      codigo: a.codigo,
      citados: [a.grupoCodigo],
      prioridade: PRIORIDADE_DERIVADO,
    })),
  ];
}

function resolverFatoOuGrupo(
  codigo: string,
  indice: Indice,
  entrada: EntradaDaAvaliacao,
  andamento: Andamento,
): void {
  const derivado = fatoDerivado(codigo, indice, andamento);
  if (derivado) andamento.fatos.set(codigo, derivado);
  else if (indice.grupoPorCodigo.has(codigo)) {
    const par = indice.grupoPorCodigo.get(codigo) as GrupoDaPagina;
    andamento.grupos.set(codigo, avaliarGrupo(par.pagina, par.grupo, entrada, andamento.fatos));
  } else resolverCampo(codigo, indice, entrada, andamento);
}

function fatoDerivado(
  codigo: string,
  indice: Indice,
  { fatos, grupos }: Andamento,
): FatoResolvido | undefined {
  const derivacao = indice.derivacaoPorFato.get(codigo);
  if (derivacao) return derivar(derivacao, fatos);
  const agregado = indice.agregadoPorFato.get(codigo);
  if (agregado) return agregar(grupos.get(agregado.grupoCodigo) as GrupoAvaliadoInterno, agregado);
  return undefined;
}

function resolverCampo(
  codigo: string,
  indice: Indice,
  entrada: EntradaDaAvaliacao,
  andamento: Andamento,
): void {
  const avaliado = avaliarItemDaPagina(
    indice.itemPorFato.get(codigo) as ItemDaPagina,
    entrada,
    andamento.fatos,
  );
  andamento.fatos.set(codigo, avaliado.fato);
  andamento.itens.set(codigo, avaliado.avaliacao);
}

function avaliarItemDaPagina(
  { pagina, item }: ItemDaPagina,
  entrada: EntradaDaAvaliacao,
  fatos: Fatos,
): ItemResolvido {
  return avaliarItem(item, entrada.respostas.get(item.fatoCodigo), {
    paginaCodigo: pagina.codigo,
    visivelDoContentor: avaliarOuVerdadeiro(pagina.exibicao, fatos),
    paginaConcluida: entrada.paginasConcluidas.has(pagina.codigo),
    diaDoEnvio: entrada.diaDoEnvio,
    fatos,
    fixo: entrada.fatosFixos?.has(item.fatoCodigo) ?? false,
  });
}

/** O que não se consegue ordenar não é decidido: o grupo e o campo ficam indeterminados. */
function deixarIndeterminado(codigo: string, indice: Indice, andamento: Andamento): void {
  const doGrupo = indice.grupoPorCodigo.get(codigo);
  if (doGrupo) {
    andamento.grupos.set(codigo, grupoIndeterminado(codigo, doGrupo.pagina.codigo));
    return;
  }
  andamento.fatos.set(codigo, FATO_INDETERMINADO);
  const par = indice.itemPorFato.get(codigo);
  if (par) andamento.itens.set(codigo, campoIndeterminado(codigo, par));
}

function grupoIndeterminado(codigo: string, paginaCodigo: string): GrupoAvaliadoInterno {
  return {
    codigo,
    paginaCodigo,
    visivel: INDETERMINADO,
    obrigatorio: INDETERMINADO,
    estado: INDETERMINADO,
    contagemValida: true,
    ocorrenciaDoCandidatoValida: true,
    ocorrencias: [],
  };
}

function campoIndeterminado(codigo: string, par: ItemDaPagina): ItemAvaliado {
  return {
    fatoCodigo: codigo,
    paginaCodigo: par.pagina.codigo,
    visivel: INDETERMINADO,
    obrigatorio: INDETERMINADO,
    restricoesVioladas: [],
    impedido: par.item.impedimento ? INDETERMINADO : FALSO,
    opcoes: null,
  };
}

function montarAvaliacao(
  definicao: DefinicaoFormulario,
  indice: Indice,
  { fatos, itens, grupos }: Andamento,
): AvaliacaoInterna {
  return {
    fatos,
    paginas: paginasAvaliadas(definicao.paginas, fatos),
    itens: indice.itens.map((par) => itens.get(par.item.fatoCodigo) as ItemAvaliado),
    grupos: indice.grupos.map((par) => grupos.get(par.grupo.codigo) as GrupoAvaliadoInterno),
    termos: termosAvaliados(definicao.termos, fatos),
  };
}

function paginasAvaliadas(
  paginas: DefinicaoFormulario['paginas'],
  fatos: Fatos,
): AvaliacaoInterna['paginas'] {
  return paginas.map((pagina) => ({
    codigo: pagina.codigo,
    visivel: avaliarOuVerdadeiro(pagina.exibicao, fatos),
  }));
}

function termosAvaliados(
  termos: DefinicaoFormulario['termos'],
  fatos: Fatos,
): AvaliacaoInterna['termos'] {
  return termos.map((termo) => {
    const visivel = avaliarOuVerdadeiro(termo.exibicao, fatos);
    return {
      codigo: termo.codigo,
      visivel,
      obrigatorio: obrigatorioSeVisivel(visivel, termo.obrigatoriedade, fatos),
    };
  });
}
