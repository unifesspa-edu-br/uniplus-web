import type { BaseLegalConfig, DocumentoDefinicao } from '../../processo-seletivo.models';
import type { RepeticaoDaExigencia } from '../../shared/exigencias/consulta-das-exigencias';
import type { GrupoDaProducao } from '../../shared/producao-dos-fatos';
import type { NormaDescrita, PublicoDaExigencia } from './resumo-da-exigencia';

/** A repetição do documento na fase e o que o campo "Repetir por" oferece. */
export interface RepeticaoDoDocumento {
  readonly atual: RepeticaoDaExigencia | null;
  /** O rótulo do grupo da repetição atual; o código, quando o grupo saiu dos formulários. */
  readonly rotulo: string;
  /** Se nenhum formulário do processo tem grupo repetível. */
  readonly semGrupo: boolean;
  readonly oferecidos: readonly GrupoDaProducao[];
  /** Os grupos que o documento não pode escolher aqui, com o motivo. */
  readonly naoOferecidos: readonly string[];
  /** O que fazer quando a repetição atual deixou de valer. */
  readonly erro: string | null;
}

export const SEM_REPETICAO: RepeticaoDoDocumento = {
  atual: null,
  rotulo: '',
  semGrupo: true,
  oferecidos: [],
  naoOferecidos: [],
  erro: null,
};

/** O que a consulta lê de um documento, como texto. */
export interface DetalheLidoDoDocumento {
  readonly descricao: string | null;
  readonly formatos: string | null;
  readonly situacao: string | null;
  readonly formulario: string | null;
  readonly exigidoEm: string;
  readonly modelo: string | null;
}

/** O que a conferência mostra de um documento exigido. */
export interface ResumoDoDocumento {
  readonly id: string;
  readonly nome: string;
  readonly documento: DocumentoDefinicao;
  readonly publico: PublicoDaExigencia;
  readonly aplicaA: string;
  readonly entrega: string;
  /** Como o documento compõe um grupo; vazio quando é exigido por si. */
  readonly composicao: string;
  /** Pelas ocorrências de que grupo do formulário o documento se repete; vazio quando é um por candidato. */
  readonly repeticao: string;
  readonly consequencia: string;
  readonly coleta: string;
  readonly bases: readonly BaseLegalConfig[];
  readonly normas: readonly NormaDescrita[];
  readonly faltaNorma: boolean;
  readonly repetido: string;
  /** O formulário em que o documento é apresentado; `null` enquanto a fase dividida pede a escolha. */
  readonly finalidade: string | null;
  /** O que orienta quem edita, já completo. */
  readonly orientacao: string | null;
  /** O aviso dos formatos do cadastro que a exigência não declara; `null` quando não há. */
  readonly avisoDeFormatos: string | null;
  /** Só existe em consulta, único modo que o lê. */
  readonly detalhe: DetalheLidoDoDocumento | null;
}
