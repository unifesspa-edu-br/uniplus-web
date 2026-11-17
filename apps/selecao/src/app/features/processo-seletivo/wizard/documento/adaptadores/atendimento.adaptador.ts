import type {
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoAtendimento,
} from '@uniplus/shared-data/selecao';

import { rotuloDoCodigo, type CatalogoPorCodigo } from '../catalogos-por-codigo';
import {
  definirCondicoesDeAtendimento,
  definirRecursosDeAtendimento,
  definirTiposDeDeficiencia,
  desfazerDecisaoDeAtendimento,
  garantirDecisaoDeAtendimento,
} from '../edicoes/atendimento.edicao';
import { emSequencia, type EdicaoDoDocumento } from '../edicoes/secao-do-documento';

/** O item que o processo atende: o código vai ao documento; o nome só serve para mostrar. */
export interface ItemDeAtendimento {
  readonly origem?: number;
  readonly codigo: string;
  readonly nome: string;
}

export interface ValoresDoAtendimento {
  /** Falso é "ainda não decidiu"; verdadeiro com as listas vazias é "não oferece atendimento". */
  readonly decidido: boolean;
  readonly condicoes: readonly ItemDeAtendimento[];
  readonly recursos: readonly ItemDeAtendimento[];
  readonly tiposDeficiencia: readonly ItemDeAtendimento[];
}

export interface CatalogosDoAtendimento {
  readonly condicoes: CatalogoPorCodigo;
  readonly recursos: CatalogoPorCodigo;
  readonly tiposDeficiencia: CatalogoPorCodigo;
}

function itemDe(
  codigo: string,
  nome: string | undefined,
  catalogo: CatalogoPorCodigo,
): ItemDeAtendimento {
  return { codigo, nome: rotuloDoCodigo(catalogo, codigo, nome) };
}

function condicoesDe(
  atendimento: DocumentoDaConfiguracaoAtendimento | undefined,
  catalogo: CatalogoPorCodigo,
): readonly ItemDeAtendimento[] {
  return (atendimento?.condicoes ?? []).map((item, origem) => ({
    ...itemDe(item.condicaoCodigo, item.condicaoNome, catalogo),
    origem,
  }));
}

function recursosDe(
  atendimento: DocumentoDaConfiguracaoAtendimento | undefined,
  catalogo: CatalogoPorCodigo,
): readonly ItemDeAtendimento[] {
  return (atendimento?.recursos ?? []).map((item, origem) => ({
    ...itemDe(item.recursoCodigo, item.recursoNome, catalogo),
    origem,
  }));
}

function tiposDeDeficienciaDe(
  atendimento: DocumentoDaConfiguracaoAtendimento | undefined,
  catalogo: CatalogoPorCodigo,
): readonly ItemDeAtendimento[] {
  return (atendimento?.tiposDeficiencia ?? []).map((item, origem) => ({
    ...itemDe(item.tipoDeficienciaCodigo, item.tipoDeficienciaNome, catalogo),
    origem,
  }));
}

export function valoresDoFormulario(
  documento: DocumentoDaConfiguracao,
  catalogos: CatalogosDoAtendimento,
): ValoresDoAtendimento {
  const atendimento = documento.atendimento;
  return {
    decidido: atendimento !== undefined,
    condicoes: condicoesDe(atendimento, catalogos.condicoes),
    recursos: recursosDe(atendimento, catalogos.recursos),
    tiposDeficiencia: tiposDeDeficienciaDe(atendimento, catalogos.tiposDeficiencia),
  };
}

export function edicaoDoPasso(valores: ValoresDoAtendimento): EdicaoDoDocumento {
  if (!valores.decidido) return desfazerDecisaoDeAtendimento;
  return emSequencia(
    garantirDecisaoDeAtendimento,
    (documento) => definirCondicoesDeAtendimento(documento, valores.condicoes),
    (documento) => definirRecursosDeAtendimento(documento, valores.recursos),
    (documento) => definirTiposDeDeficiencia(documento, valores.tiposDeficiencia),
  );
}
