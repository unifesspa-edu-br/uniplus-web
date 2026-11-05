import type { ItemAvaliado } from './avaliacao-interna';
import type { DefinicaoItem, Obrigatoriedade } from './definicao-do-formulario';
import {
  e,
  estaVazia,
  FALSO,
  FATO_INDETERMINADO,
  FATO_NAO_APLICAVEL,
  FATO_NAO_INFORMADO,
  type FatoResolvido,
  type Fatos,
  INDETERMINADO,
  resolvido,
  type Ternario,
  VERDADEIRO,
} from './logica';
import { avaliarOuVerdadeiro, avaliarPredicado } from './predicado';
import type { ValorJson } from './regras-do-formulario';
import { juntarOpcoes, type OpcoesDaRestricao, type Restricao } from './restricoes';

/** Onde o campo está: a seção, se já foi concluída, o dia do envio e os fatos conhecidos até ele. */
export interface ContextoDaEtapa {
  readonly etapaCodigo: string;
  readonly etapaConcluida: boolean;
  readonly diaDoEnvio: string | null;
  readonly fatos: Fatos;
}

export interface ContextoDoItem extends ContextoDaEtapa {
  /** Se quem contém o campo (a seção ou o grupo) aparece. */
  readonly visivelDoContentor: Ternario;
  /** O campo de resposta fixa, que vem da conta, vale como está. */
  readonly fixo?: boolean;
}

export interface ItemResolvido {
  readonly fato: FatoResolvido;
  readonly avaliacao: ItemAvaliado;
}

interface Aparencia {
  readonly visivel: Ternario;
  readonly obrigatorio: Ternario;
  readonly opcoes: OpcoesDaRestricao | null;
}

/** Um campo — da seção ou da ocorrência —, visível quando quem o contém aparece e a exibição dele é verdadeira. */
export function avaliarItem(
  item: DefinicaoItem,
  resposta: ValorJson | undefined,
  contexto: ContextoDoItem,
): ItemResolvido {
  const { fatos } = contexto;
  const visivel = e(contexto.visivelDoContentor, avaliarOuVerdadeiro(item.exibicao, fatos));
  const obrigatorio = obrigatorioSeVisivel(visivel, item.obrigatoriedade, fatos);
  const aparencia = {
    visivel,
    obrigatorio,
    opcoes: visivel === FALSO ? null : opcoesDoItem(item, fatos),
  };
  const concluir = (fato: FatoResolvido, violadas: readonly Restricao[] = []): ItemResolvido =>
    resolverItem(item, contexto, aparencia, { fato, violadas });

  if (visivel === FALSO) return concluir(FATO_NAO_APLICAVEL);
  if (visivel === INDETERMINADO) return concluir(FATO_INDETERMINADO);

  const conferida = conferirResposta(item, resposta, contexto);
  if (conferida.fato !== null) return concluir(conferida.fato);

  // Sem resposta que valha: o candidato ainda deve a resposta, salvo o opcional numa seção concluída,
  // que resolve como não informado e não trava as regras seguintes.
  return concluir(
    obrigatorio === FALSO && contexto.etapaConcluida ? FATO_NAO_INFORMADO : FATO_INDETERMINADO,
    conferida.violadas,
  );
}

/** Obrigatório só o que aparece; a obrigatoriedade já falsa decide mesmo com a exibição indeterminada. */
export function obrigatorioSeVisivel(
  visivel: Ternario,
  obrigatoriedade: Obrigatoriedade,
  fatos: Fatos,
): Ternario {
  const obrigatoria =
    obrigatoriedade.tipo === 'QUANDO'
      ? avaliarPredicado(obrigatoriedade.predicado, fatos)
      : obrigatoriedade.tipo === 'SEMPRE'
        ? VERDADEIRO
        : FALSO;
  return e(visivel, obrigatoria);
}

/** As opções do campo que aparece ou pode aparecer: a interseção das restrições que limitam a escolha. */
function opcoesDoItem(item: DefinicaoItem, fatos: Fatos): OpcoesDaRestricao | null {
  return item.restricoesDaResposta
    .map((r) => r.opcoes(fatos))
    .reduce<OpcoesDaRestricao | null>(
      (juntas, uma) => (uma === null ? juntas : juntas === null ? uma : juntarOpcoes(juntas, uma)),
      null,
    );
}

/**
 * Confere a resposta contra as restrições: o fato resolvido quando nenhuma é violada, e nulo quando
 * não há resposta que valha.
 */
function conferirResposta(
  item: DefinicaoItem,
  resposta: ValorJson | undefined,
  contexto: ContextoDoItem,
): { fato: FatoResolvido | null; violadas: readonly Restricao[] } {
  if (resposta === undefined || estaVazia(resposta)) return { fato: null, violadas: [] };
  const { fatos, diaDoEnvio } = contexto;
  const violadas: Restricao[] = [];
  let algumaIndeterminada = false;
  for (const restricao of contexto.fixo ? [] : item.restricoesDaResposta) {
    const atende = restricao.avaliar(resposta, { fatos, diaDoEnvio });
    if (atende === FALSO) violadas.push(restricao);
    else if (atende === INDETERMINADO) algumaIndeterminada = true;
  }
  if (violadas.length > 0) return { fato: null, violadas };
  return { fato: algumaIndeterminada ? FATO_INDETERMINADO : resolvido(resposta), violadas };
}

/**
 * O impedimento se avalia com a resposta do próprio campo já resolvida: o campo oculto ou sem
 * resposta não impede, porque nenhuma condição se cumpre sobre ele.
 */
function resolverItem(
  item: DefinicaoItem,
  contexto: ContextoDoItem,
  aparencia: Aparencia,
  { fato, violadas }: { fato: FatoResolvido; violadas: readonly Restricao[] },
): ItemResolvido {
  return {
    fato,
    avaliacao: {
      fatoCodigo: item.fatoCodigo,
      etapaCodigo: contexto.etapaCodigo,
      ...aparencia,
      restricoesVioladas: violadas.map((r) => r.tipo),
      impedido: item.impedimento
        ? avaliarPredicado(item.impedimento, new Map(contexto.fatos).set(item.fatoCodigo, fato))
        : FALSO,
    },
  };
}
