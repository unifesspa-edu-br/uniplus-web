import { DistribuicaoDeVagas } from '../../processo-seletivo.models';

import { semGrafia } from './composicao-de-vagas';

/**
 * O que a tela precisa saber de uma modalidade para validar a distribuição:
 * como sua quantidade é obtida e de quais outras modalidades ela depende.
 * Tudo vem do catálogo de Configuração; nada é decidido aqui.
 */
export interface ModalidadeDoCatalogo {
  readonly id: string;
  readonly codigo: string;
  readonly composicaoVagas: string;
  readonly composicaoOrigemCodigo: string | null;
  readonly regraRemanejamento: string | null;
  readonly remanejamentoDestino: string | null;
  readonly remanejamentoPar: string | null;
  readonly remanejamentoFallback: string | null;
}

const REGRAS_DE_REMANEJAMENTO = ['SEGUE_CASCATA', 'DESTINO_UNICO', 'CRUZADO'];

/** O detalhe pode serializar o nome do membro do enum (`SegueCascata`); a tela compara o token canônico. */
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

    const vigente = catalogo.get(modalidade.id);
    mapa.set(modalidade.id, {
      id: modalidade.id,
      codigo: modalidade.codigo,
      composicaoVagas: gravada.composicaoVagas ?? vigente?.composicaoVagas ?? '',
      composicaoOrigemCodigo: gravada.composicaoOrigemCodigo,
      regraRemanejamento: canonicaDaRegraDeRemanejamento(gravada.regraRemanejamento),
      remanejamentoDestino: gravada.remanejamentoDestino,
      remanejamentoPar: gravada.remanejamentoPar,
      remanejamentoFallback: gravada.remanejamentoFallback,
    });
  }

  return mapa;
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
