import type {
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoDistribuicaoDeVagas,
} from '@uniplus/shared-data/selecao';

import { referenciaQueVale, type RegraEscolhida } from '../regra-escolhida';
import { decimalQueVale, inteiroQueVale, textoQueVale } from '../valor-que-vale';
import { paresPorOrigem } from './itens-por-origem';
import { comCampo, comCampoNulavel, comLista } from './secao-do-documento';

type Distribuicao = DocumentoDaConfiguracaoDistribuicaoDeVagas;
type Modalidade = NonNullable<Distribuicao['modalidades']>[number];

/**
 * O percentual da reserva legal tem três estados no documento: ausente (ainda não declarado),
 * `null` (o quadro é fixado no edital, sem reserva) e o número. A tela precisa distinguir os três.
 */
export type PercentualDaReserva =
  | { readonly estado: 'naoDeclarado' }
  | { readonly estado: 'fixadoNoEdital' }
  | { readonly estado: 'valor'; readonly texto: string };

function naOferta(
  documento: DocumentoDaConfiguracao,
  posicao: number,
  alterar: (oferta: Distribuicao) => Distribuicao,
): DocumentoDaConfiguracao {
  const ofertas = documento.distribuicaoVagas;
  if (ofertas === undefined) return documento;
  const alteradas = ofertas.map((oferta, indice) =>
    indice === posicao ? alterar(oferta) : oferta,
  );
  return { ...documento, distribuicaoVagas: alteradas };
}

/** No máximo uma distribuição por oferta: acrescentar a que já existe não muda nada. */
export function acrescentarOferta(
  documento: DocumentoDaConfiguracao,
  ofertaCodigo: string,
): DocumentoDaConfiguracao {
  const ofertas = documento.distribuicaoVagas ?? [];
  if (ofertas.some((oferta) => oferta.ofertaCursoCodigo === ofertaCodigo)) return documento;
  return { ...documento, distribuicaoVagas: [...ofertas, { ofertaCursoCodigo: ofertaCodigo }] };
}

/**
 * Tira só a distribuição da oferta. O número de opções de curso e a cascata de remanejamento
 * ficam como estão: se deixarem de fazer sentido, o diagnóstico da API os aponta.
 */
export function removerOferta(
  documento: DocumentoDaConfiguracao,
  ofertaCodigo: string,
): DocumentoDaConfiguracao {
  const restantes = (documento.distribuicaoVagas ?? []).filter(
    (oferta) => oferta.ofertaCursoCodigo !== ofertaCodigo,
  );
  return comLista(documento, 'distribuicaoVagas', restantes);
}

export function definirVagasOfertadasBase(
  documento: DocumentoDaConfiguracao,
  posicao: number,
  texto: string,
): DocumentoDaConfiguracao {
  return naOferta(documento, posicao, (oferta) =>
    comCampo(oferta, 'vagasOfertadasBase', inteiroQueVale(oferta.vagasOfertadasBase, texto)),
  );
}

function percentualDoDocumento(
  atual: number | null | undefined,
  percentual: PercentualDaReserva,
): number | null | undefined {
  if (percentual.estado === 'fixadoNoEdital') return null;
  return percentual.estado === 'valor' ? decimalQueVale(atual, percentual.texto) : undefined;
}

export function definirPercentualDaReservaLegal(
  documento: DocumentoDaConfiguracao,
  posicao: number,
  percentual: PercentualDaReserva,
): DocumentoDaConfiguracao {
  return naOferta(documento, posicao, (oferta) =>
    comCampo(
      oferta,
      'percentualDaReservaLegal',
      percentualDoDocumento(oferta.percentualDaReservaLegal, percentual),
    ),
  );
}

export function definirRegraDeDistribuicao(
  documento: DocumentoDaConfiguracao,
  posicao: number,
  regra: RegraEscolhida | null,
): DocumentoDaConfiguracao {
  return naOferta(documento, posicao, (oferta) =>
    comCampo(oferta, 'regraDistribuicao', referenciaQueVale(oferta.regraDistribuicao, regra)),
  );
}

export function definirRegraDeAjuste(
  documento: DocumentoDaConfiguracao,
  posicao: number,
  regra: RegraEscolhida | null,
): DocumentoDaConfiguracao {
  return naOferta(documento, posicao, (oferta) =>
    comCampoNulavel(oferta, 'regraAjuste', referenciaQueVale(oferta.regraAjuste, regra)),
  );
}

/** O código do censo de referência, no cadastro de referências demográficas. `null` explícito segue como está. */
export function definirReferenciaDemografica(
  documento: DocumentoDaConfiguracao,
  posicao: number,
  censo: string,
): DocumentoDaConfiguracao {
  return naOferta(documento, posicao, (oferta) =>
    comCampoNulavel(
      oferta,
      'referenciaDemograficaCodigo',
      textoQueVale(oferta.referenciaDemograficaCodigo, censo),
    ),
  );
}

/** A modalidade como o formulário a tem: o código e a quantidade que o edital fixa, em texto. */
export interface ModalidadeDoFormulario {
  readonly origem: number | null;
  readonly codigo: string;
  readonly quantidade: string;
}

function modalidadeDoFormulario(
  atual: Modalidade | undefined,
  { codigo, quantidade }: Pick<ModalidadeDoFormulario, 'codigo' | 'quantidade'>,
): Modalidade {
  const modalidade: Modalidade = atual ?? { codigo };
  const declarada = inteiroQueVale(modalidade.quantidadeDeclarada, quantidade);
  return comCampoNulavel(modalidade, 'quantidadeDeclarada', declarada);
}

function modalidadesAlteradas(
  atuais: readonly Modalidade[],
  modalidades: readonly ModalidadeDoFormulario[],
): Modalidade[] {
  const pares = paresPorOrigem(atuais, modalidades);
  return pares.map(([atual, nova]) =>
    modalidadeDoFormulario(atual?.codigo === nova.codigo ? atual : undefined, nova),
  );
}

/**
 * As modalidades que a oferta distribui, na ordem dada. A que já estava volta como estava, com a
 * descrição, e só leva a quantidade nova quando o texto mudou; sem número, a modalidade volta a ser
 * calculada pelo sistema. A nova leva só o código. O código repetido não colapsa.
 */
export function definirModalidades(
  documento: DocumentoDaConfiguracao,
  posicao: number,
  modalidades: readonly ModalidadeDoFormulario[],
): DocumentoDaConfiguracao {
  return naOferta(documento, posicao, (oferta) =>
    comLista(oferta, 'modalidades', modalidadesAlteradas(oferta.modalidades ?? [], modalidades)),
  );
}

/** A oferta que decidiu não distribuir por modalidade declara a lista vazia; ausente é "não decidiu". */
export function declararOfertaSemModalidades(
  documento: DocumentoDaConfiguracao,
  posicao: number,
): DocumentoDaConfiguracao {
  return naOferta(documento, posicao, (oferta) => comCampo(oferta, 'modalidades', []));
}
