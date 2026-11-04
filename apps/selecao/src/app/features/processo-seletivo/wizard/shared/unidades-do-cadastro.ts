import { rotuloDaUnidade, type UnidadeDto } from '@uniplus/shared-data/organizacao';

/** A unidade como o seletor a oferece: o id de origem e o rótulo que o operador reconhece. */
export interface OpcaoDeUnidade {
  readonly id: string;
  readonly rotulo: string;
}

/** A cópia da unidade que o processo guardou ao gravar. */
export interface UnidadeGravada {
  readonly origemId: string;
  readonly sigla: string;
  readonly nome: string;
}

export const UNIDADE_FORA_DO_CADASTRO = 'Unidade não encontrada no cadastro';
export const UNIDADE_EM_CARGA = 'Carregando unidade…';
export const UNIDADE_SEM_CADASTRO_CARREGADO = 'Cadastro de unidades indisponível';

export function comoOpcaoDeUnidade(unidade: UnidadeDto): OpcaoDeUnidade {
  return { id: unidade.id, rotulo: rotuloDaUnidade(unidade) };
}

/**
 * O cadastro e, quando faltarem nele, as unidades que o processo guardou: uma unidade que saiu
 * do cadastro continua sendo a gravada, e aparece uma vez só, qualquer que seja o número de
 * fases que a referenciam.
 */
export function opcoesComAsGravadas(
  cadastro: readonly OpcaoDeUnidade[],
  gravadas: readonly UnidadeGravada[],
): readonly OpcaoDeUnidade[] {
  const conhecidas = new Set(cadastro.map((opcao) => opcao.id));
  const ausentes: OpcaoDeUnidade[] = [];
  for (const unidade of gravadas) {
    if (conhecidas.has(unidade.origemId)) continue;
    conhecidas.add(unidade.origemId);
    ausentes.push({ id: unidade.origemId, rotulo: rotuloDaUnidade(unidade) });
  }
  return [...ausentes, ...cadastro];
}
