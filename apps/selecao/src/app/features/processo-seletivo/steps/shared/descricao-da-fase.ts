import type { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';

import {
  PAPEL_PRELIMINAR,
  type FaseDoCronograma,
  type ProdutoDaFase,
} from '../processo-seletivo.models';
import { publicaResultadoDefinitivo } from '../steps/fase/configuracao-da-fase';
import { finalidadesQueAtende } from '../steps/formulario/formularios-por-finalidade';

/** Origem de data que obriga a fase a declarar janela. */
export const ORIGEM_DATA_NO_EDITAL = 'NO_EDITAL';

/**
 * O que a fase escolhida exige — nunca declarado pelo operador. É a diferença
 * entre perguntar "esta fase permite recurso?" e descobrir que ela permite
 * porque publica um resultado preliminar.
 *
 * As duas origens são distintas, e é por isso que a derivação recebe duas
 * entradas. Janela e agrupamento de etapas descrevem a **fase canônica**, e vêm
 * do catálogo (ou do que a fase congelou dele). O que a fase publica é
 * declaração da **fase do cronograma**, em `produtos`: o catálogo não sabe o que
 * este edital resolveu publicar nela.
 */
export interface ExigenciasDaFase {
  readonly janelaObrigatoria: boolean;
  /** A fase publica ao menos um produto — não necessariamente um resultado. */
  readonly publicaProduto: boolean;
  /** A fase publica ao menos um produto preliminar, que é a âncora do prazo. */
  readonly admiteRecurso: boolean;
  readonly agrupaEtapas: boolean;
}

/** Os atributos da fase canônica que decidem exigência, venham do catálogo ou do congelado. */
interface AtributosDaFaseCanonica {
  readonly origemData: string;
  readonly agrupaEtapas: boolean;
  readonly coletaInscricao: boolean;
  readonly coletaSolicitacaoIsencao: boolean;
}

export function exigenciasDe(
  canonica: AtributosDaFaseCanonica,
  produtos: readonly ProdutoDaFase[],
): ExigenciasDaFase {
  return {
    janelaObrigatoria:
      canonica.origemData === ORIGEM_DATA_NO_EDITAL ||
      canonica.coletaInscricao ||
      canonica.coletaSolicitacaoIsencao,
    publicaProduto: produtos.length > 0,
    admiteRecurso: produtos.some((produto) => produto.papel === PAPEL_PRELIMINAR),
    agrupaEtapas: canonica.agrupaEtapas,
  };
}

/**
 * A fase como o processo a conhece: rótulo, atributos e o que ela exige.
 *
 * **O que a fase congelou tem precedência sobre o catálogo**, e não o contrário.
 * O catálogo é vivo: editar a fase canônica depois que um processo a congelou
 * não pode mudar o que aquele processo exige — ligar `agrupaEtapas` faria a
 * validação cobrar etapas de um edital que nunca as teve, e desligar esconderia
 * as que ele tem. O catálogo descreve a fase que acabou de ser acrescentada, que
 * ainda não congelou nada.
 *
 * O nome é a exceção deliberada: é rótulo de tela, e mostrar o atual ajuda quem
 * lê. Sem entrada no catálogo, o código é o que identifica a fase.
 */
export function descreverFase(
  fase: FaseDoCronograma,
  fasePorId: ReadonlyMap<string, FaseCanonicaDto>,
): DescricaoDaFase {
  const canonica = fasePorId.get(fase.faseCanonicaId);
  const congelados = fase.congelados;

  if (congelados !== null) {
    return {
      nome: canonica?.nome ?? fase.codigo,
      publicaResultadoDefinitivo: publicaResultadoDefinitivo(fase.produtos),
      coletaInscricao: congelados.coletaInscricao,
      coletaSolicitacaoIsencao: congelados.coletaSolicitacaoIsencao,
      permiteComplementacao: congelados.permiteComplementacao,
      exigencias: exigenciasDe(congelados, fase.produtos),
      foraDoCatalogo: canonica === undefined,
    };
  }

  return {
    nome: canonica?.nome ?? fase.codigo,
    publicaResultadoDefinitivo: publicaResultadoDefinitivo(fase.produtos),
    coletaInscricao: canonica?.coletaInscricao ?? false,
    coletaSolicitacaoIsencao: canonica?.coletaSolicitacaoIsencao ?? false,
    permiteComplementacao: canonica?.permiteComplementacao ?? false,
    exigencias: canonica === undefined ? null : exigenciasDe(canonica, fase.produtos),
    foraDoCatalogo: canonica === undefined,
  };
}

/**
 * As finalidades cujo formulário se responde na fase, com os atributos que a fase congelou ou, na
 * fase recém-acrescentada, os do catálogo.
 */
export function finalidadesDaFase(
  fase: FaseDoCronograma,
  fasePorId: ReadonlyMap<string, FaseCanonicaDto>,
): readonly string[] {
  const { coletaInscricao, coletaSolicitacaoIsencao } = descreverFase(fase, fasePorId);
  return finalidadesQueAtende({ codigo: fase.codigo, coletaInscricao, coletaSolicitacaoIsencao });
}

/** A fase resolvida, como tela e validação precisam vê-la. */
export interface DescricaoDaFase {
  readonly nome: string;
  readonly publicaResultadoDefinitivo: boolean;
  readonly coletaInscricao: boolean;
  /** Se é nela que o candidato pede isenção da taxa — a fase do formulário de isenção. */
  readonly coletaSolicitacaoIsencao: boolean;
  /**
   * Se a fase admite reenvio depois da análise. O que a fase congelou tem precedência sobre o
   * catálogo, pela mesma razão dos demais atributos: editar a fase canônica depois não pode
   * mudar o que um edital já congelou.
   */
  readonly permiteComplementacao: boolean;
  /** `null` quando nem o catálogo nem o congelado descrevem a fase. */
  readonly exigencias: ExigenciasDaFase | null;
  readonly foraDoCatalogo: boolean;
}
