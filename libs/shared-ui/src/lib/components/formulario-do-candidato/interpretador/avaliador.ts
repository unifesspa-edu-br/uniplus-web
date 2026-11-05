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
  DefinicaoEtapa,
  DefinicaoFormulario,
  DefinicaoGrupo,
  DefinicaoItem,
} from './definicao-do-formulario';
import { FALSO, FATO_INDETERMINADO, type FatoResolvido, type Fatos, INDETERMINADO } from './logica';
import { type No, ordenar, PRIORIDADE_DERIVADO } from './ordem-de-avaliacao';
import { avaliarOuVerdadeiro, fatosCitadosPor } from './predicado';

export type {
  AvaliacaoInterna,
  EntradaDaAvaliacao,
  GrupoAvaliadoInterno,
  ItemAvaliado,
  OcorrenciaAvaliadaInterna,
  OcorrenciaRespondida,
} from './avaliacao-interna';

interface ItemDaEtapa {
  readonly etapa: DefinicaoEtapa;
  readonly item: DefinicaoItem;
}

interface GrupoDaEtapa {
  readonly etapa: DefinicaoEtapa;
  readonly grupo: DefinicaoGrupo;
}

/** O formulário indexado pelos códigos que a avaliação resolve, na ordem em que as regras os declaram. */
interface Indice {
  readonly itens: readonly ItemDaEtapa[];
  readonly grupos: readonly GrupoDaEtapa[];
  readonly itemPorFato: ReadonlyMap<string, ItemDaEtapa>;
  readonly grupoPorCodigo: ReadonlyMap<string, GrupoDaEtapa>;
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
  const { ordem, foraDeOrdem } = ordenar(nosDa(definicao, indice));
  const andamento: Andamento = {
    fatos: new Map(entrada.fatosConhecidos),
    itens: new Map(),
    grupos: new Map(),
  };
  for (const codigo of ordem) resolverNo(codigo, indice, entrada, andamento);
  for (const codigo of foraDeOrdem) deixarIndeterminado(codigo, indice, andamento);
  return montarAvaliacao(definicao, indice, andamento);
}

function indexar(definicao: DefinicaoFormulario): Indice {
  const itens = definicao.etapas.flatMap((etapa) => etapa.itens.map((item) => ({ etapa, item })));
  const grupos = definicao.etapas.flatMap((etapa) =>
    etapa.grupos.map((grupo) => ({ etapa, grupo })),
  );
  return {
    itens,
    grupos,
    itemPorFato: new Map(itens.map((par) => [par.item.fatoCodigo, par])),
    grupoPorCodigo: new Map(grupos.map((par) => [par.grupo.codigo, par])),
    derivacaoPorFato: new Map(definicao.derivacoes.map((d) => [d.fatoCodigo, d])),
    agregadoPorFato: new Map(definicao.agregados.map((a) => [a.codigo, a])),
  };
}

function nosDa(definicao: DefinicaoFormulario, { itens, grupos }: Indice): readonly No[] {
  const citadosPelaEtapa = (etapa: DefinicaoEtapa): readonly string[] =>
    fatosCitadosPor(etapa.exibicao);
  return [
    ...itens.map((par, posicao) => ({
      codigo: par.item.fatoCodigo,
      citados: [...citadosPelaEtapa(par.etapa), ...par.item.fatosCitados],
      prioridade: posicao,
    })),
    ...grupos.map((par, posicao) => ({
      codigo: par.grupo.codigo,
      citados: [...citadosPelaEtapa(par.etapa), ...par.grupo.fatosDoCandidatoCitados],
      prioridade: itens.length + posicao,
    })),
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

function resolverNo(
  codigo: string,
  indice: Indice,
  entrada: EntradaDaAvaliacao,
  andamento: Andamento,
): void {
  const { fatos, itens, grupos } = andamento;
  const derivacao = indice.derivacaoPorFato.get(codigo);
  if (derivacao) {
    fatos.set(codigo, derivar(derivacao, fatos));
    return;
  }
  const agregado = indice.agregadoPorFato.get(codigo);
  if (agregado) {
    fatos.set(codigo, agregar(grupos.get(agregado.grupoCodigo) as GrupoAvaliadoInterno, agregado));
    return;
  }
  const doGrupo = indice.grupoPorCodigo.get(codigo);
  if (doGrupo) {
    grupos.set(codigo, avaliarGrupo(doGrupo.etapa, doGrupo.grupo, entrada, fatos));
    return;
  }
  const avaliado = avaliarItemDaEtapa(
    indice.itemPorFato.get(codigo) as ItemDaEtapa,
    entrada,
    fatos,
  );
  fatos.set(codigo, avaliado.fato);
  itens.set(codigo, avaliado.avaliacao);
}

function avaliarItemDaEtapa(
  { etapa, item }: ItemDaEtapa,
  entrada: EntradaDaAvaliacao,
  fatos: Fatos,
): ItemResolvido {
  return avaliarItem(item, entrada.respostas.get(item.fatoCodigo), {
    etapaCodigo: etapa.codigo,
    visivelDoContentor: avaliarOuVerdadeiro(etapa.exibicao, fatos),
    etapaConcluida: entrada.etapasConcluidas.has(etapa.codigo),
    diaDoEnvio: entrada.diaDoEnvio,
    fatos,
    fixo: entrada.fatosFixos?.has(item.fatoCodigo) ?? false,
  });
}

/** O que não se consegue ordenar não é decidido: o grupo e o campo ficam indeterminados. */
function deixarIndeterminado(codigo: string, indice: Indice, andamento: Andamento): void {
  const doGrupo = indice.grupoPorCodigo.get(codigo);
  if (doGrupo) {
    andamento.grupos.set(codigo, {
      codigo,
      etapaCodigo: doGrupo.etapa.codigo,
      visivel: INDETERMINADO,
      obrigatorio: INDETERMINADO,
      estado: INDETERMINADO,
      contagemValida: true,
      ocorrenciaDoCandidatoValida: true,
      ocorrencias: [],
    });
    return;
  }
  andamento.fatos.set(codigo, FATO_INDETERMINADO);
  const par = indice.itemPorFato.get(codigo);
  if (par) {
    andamento.itens.set(codigo, {
      fatoCodigo: codigo,
      etapaCodigo: par.etapa.codigo,
      visivel: INDETERMINADO,
      obrigatorio: INDETERMINADO,
      restricoesVioladas: [],
      impedido: par.item.impedimento ? INDETERMINADO : FALSO,
      opcoes: null,
    });
  }
}

function montarAvaliacao(
  definicao: DefinicaoFormulario,
  indice: Indice,
  { fatos, itens, grupos }: Andamento,
): AvaliacaoInterna {
  return {
    fatos,
    etapas: definicao.etapas.map((etapa) => ({
      codigo: etapa.codigo,
      visivel: avaliarOuVerdadeiro(etapa.exibicao, fatos),
    })),
    itens: indice.itens.map((par) => itens.get(par.item.fatoCodigo) as ItemAvaliado),
    grupos: indice.grupos.map((par) => grupos.get(par.grupo.codigo) as GrupoAvaliadoInterno),
    termos: definicao.termos.map((termo) => {
      const visivel = avaliarOuVerdadeiro(termo.exibicao, fatos);
      return {
        codigo: termo.codigo,
        visivel,
        obrigatorio: obrigatorioSeVisivel(visivel, termo.obrigatoriedade, fatos),
      };
    }),
  };
}
