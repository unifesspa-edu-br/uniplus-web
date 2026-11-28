import { RegraRemanejamentoModalidadeCodigo } from '@uniplus/shared-data/selecao';
import { codigoComNome } from '@uniplus/shared-utils';

import { DistribuicaoDeVagas } from '../../processo-seletivo.models';

import { semGrafia } from './composicao-de-vagas';

/** O texto "código — nome" de cada modalidade, pelo código; sem nome, só o código. */
export type RotulosPorCodigo = ReadonlyMap<string, string>;

export function rotulosPorCodigo(
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
): RotulosPorCodigo {
  return new Map(
    [...catalogo.values()].map((modalidade) => [
      modalidade.codigo,
      codigoComNome(modalidade.codigo, modalidade.nome),
    ]),
  );
}

/** O nome que o processo gravou vale primeiro; sem ele, o do catálogo vigente. */
export function nomeDaModalidade(gravado: string | undefined, vigente: string | undefined): string {
  return gravado?.trim() ? gravado : (vigente ?? '');
}

/** Código que o catálogo não conhece continua identificado pelo próprio código. */
export function rotuloDaModalidade(rotulos: RotulosPorCodigo, codigo: string): string {
  return rotulos.get(codigo) ?? codigo;
}

/**
 * O que a tela precisa saber de uma modalidade para validar a distribuição:
 * como sua quantidade é obtida e de quais outras modalidades ela depende.
 * Tudo vem do catálogo de Configuração; nada é decidido aqui.
 */
export interface ModalidadeDoCatalogo {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
  readonly composicaoVagas: string;
  readonly composicaoOrigemCodigo: string | null;
  readonly regraRemanejamento: string | null;
  readonly remanejamentoDestino: string | null;
  readonly remanejamentoPar: string | null;
  readonly remanejamentoFallback: string | null;
}

const REGRAS_DE_REMANEJAMENTO = Object.values(RegraRemanejamentoModalidadeCodigo);

/** O detalhe pode serializar o nome do membro do enum (`SegueOrdemDeRemanejamento`); a tela compara o token canônico. */
function canonicaDaRegraDeRemanejamento(valor: string | null): string | null {
  if (valor === null) return null;
  const procurada = semGrafia(valor);
  return REGRAS_DE_REMANEJAMENTO.find((regra) => semGrafia(regra) === procurada) ?? valor;
}

/**
 * As modalidades como o processo as gravou, por id. É o que a consulta lê: o catálogo vigente
 * pode ter mudado desde a publicação, e uma modalidade gravada que saiu dele continua sendo do
 * processo. O catálogo só completa a composição de vagas que o snapshot não diz; as regras de
 * remanejamento valem como gravadas, inclusive quando nulas, porque nulo é a resposta do snapshot.
 */
export function modalidadesGravadasPorId(
  ofertas: readonly DistribuicaoDeVagas[],
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
): ReadonlyMap<string, ModalidadeDoCatalogo> {
  const mapa = new Map(catalogo);
  for (const modalidade of ofertas.flatMap((oferta) => oferta.modalidades)) {
    const gravada = modalidade.gravada;
    if (gravada === undefined) continue;

    const normalizada = modalidadeGravada({ ...modalidade, gravada }, catalogo.get(modalidade.id));
    mapa.set(modalidade.id, normalizada);
  }

  return mapa;
}

type ModalidadeGravada = DistribuicaoDeVagas['modalidades'][number] & {
  gravada: NonNullable<DistribuicaoDeVagas['modalidades'][number]['gravada']>;
};

function modalidadeGravada(modalidade: ModalidadeGravada, vigente?: ModalidadeDoCatalogo) {
  const gravada = modalidade.gravada;
  return {
    id: modalidade.id,
    codigo: modalidade.codigo,
    nome: nomeDaModalidade(modalidade.nome, vigente?.nome),
    composicaoVagas: gravada.composicaoVagas ?? vigente?.composicaoVagas ?? '',
    composicaoOrigemCodigo: gravada.composicaoOrigemCodigo,
    regraRemanejamento: canonicaDaRegraDeRemanejamento(gravada.regraRemanejamento),
    remanejamentoDestino: gravada.remanejamentoDestino,
    remanejamentoPar: gravada.remanejamentoPar,
    remanejamentoFallback: gravada.remanejamentoFallback,
  };
}

/**
 * As modalidades do catálogo que o rol admitido de uma regra reconhece.
 *
 * A regra determina o rol — não filtra uma escolha do operador dentro dele.
 * `null` é rol aberto (`DISTRIB-VAGAS-INSTITUCIONAL`, ou nenhuma regra ainda
 * escolhida): devolve o catálogo inteiro, mantendo a seleção livre.
 */
export function modalidadesDoRol<T extends { readonly codigo: string }>(
  catalogo: readonly T[],
  rol: readonly string[] | null,
): readonly T[] {
  return rol === null ? catalogo : catalogo.filter((modalidade) => rol.includes(modalidade.codigo));
}
