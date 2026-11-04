import { DistribuicaoDeVagas } from '../../processo-seletivo.models';

import { ModalidadeDoCatalogo } from './modalidades-da-distribuicao';

export const REGRA_LEI_12711 = 'DISTRIB-VAGAS-LEI-12711';
export const REGRA_LEI_12711_COM_AC_PCD = 'DISTRIB-VAGAS-LEI-12711-COM-AC-PCD';

export const AC = modalidade({ id: 'm-ac', codigo: 'AC', composicaoVagas: 'RESIDUAL_DO_VO' });
export const LI_PPI = modalidade({
  id: 'm-li-ppi',
  codigo: 'LI_PPI',
  composicaoVagas: 'DENTRO_DO_VR',
});
export const AC_PCD = modalidade({
  id: 'm-pcd',
  codigo: 'AC_PCD',
  composicaoVagas: 'RETIRA_DE',
  composicaoOrigemCodigo: 'AC',
});
export const INSTITUCIONAL = modalidade({
  id: 'm-inst',
  codigo: 'AC_I',
  composicaoVagas: 'SUPLEMENTAR_AO_TOTAL',
});

export const CATALOGO = catalogo([AC, LI_PPI, AC_PCD, INSTITUCIONAL]);

export function modalidade(
  base: Partial<ModalidadeDoCatalogo> & { id: string; codigo: string },
): ModalidadeDoCatalogo {
  return {
    composicaoVagas: 'DENTRO_DO_VR',
    composicaoOrigemCodigo: null,
    regraRemanejamento: null,
    remanejamentoDestino: null,
    remanejamentoPar: null,
    remanejamentoFallback: null,
    ...base,
  };
}

/** A oferta guarda o par id+código; o código é como as demais dimensões a nomeiam. */
export function par(modalidade: ModalidadeDoCatalogo): { id: string; codigo: string } {
  return { id: modalidade.id, codigo: modalidade.codigo };
}

/** O texto de cada recusa, sem o escopo que diz onde ela deve ser dita. */
export function mensagens(problemas: readonly { readonly mensagem: string }[]): string[] {
  return problemas.map((problema) => problema.mensagem);
}

export function catalogo(
  itens: readonly ModalidadeDoCatalogo[],
): ReadonlyMap<string, ModalidadeDoCatalogo> {
  return new Map(itens.map((item) => [item.id, item]));
}

export function distribuicao(base: Partial<DistribuicaoDeVagas> = {}): DistribuicaoDeVagas {
  return {
    ofertaCursoId: 'oferta-1',
    voBase: '40',
    pr: '0,5',
    regraDistribuicaoCodigo: 'DISTRIB-VAGAS-INSTITUCIONAL',
    regraDistribuicaoVersao: '1.0',
    regraAjusteCodigo: null,
    regraAjusteVersao: null,
    referenciaReservaDemograficaId: null,
    modalidades: [par(INSTITUCIONAL)],
    quadro: [{ modalidadeId: INSTITUCIONAL.id, quantidade: '10' }],
    ...base,
  };
}

export function federal(base: Partial<DistribuicaoDeVagas> = {}): DistribuicaoDeVagas {
  return distribuicao({
    regraDistribuicaoCodigo: REGRA_LEI_12711,
    regraAjusteCodigo: 'AJUSTE-ART-11',
    regraAjusteVersao: '1.0',
    referenciaReservaDemograficaId: 'ref-1',
    modalidades: [par(AC), par(LI_PPI)],
    quadro: [],
    ...base,
  });
}
