import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';

import {
  definirAplicacaoDoFada,
  definirBaseLegalDoFada,
  definirFatoDeElegibilidade,
  definirFatorDoFada,
  definirRegraDoFada,
  definirTetoDoFada,
} from '../edicoes/fada.edicao';
import { emSequencia, type EdicaoDoDocumento } from '../edicoes/secao-do-documento';
import { regraEscolhida, type RegraEscolhida } from '../regra-escolhida';
import { textoDoNumero } from '../texto-do-campo';

export interface ValoresDoFada {
  /** `null` é "ainda não declarado": o bloco do FADA não existe no documento. */
  readonly aplica: boolean | null;
  readonly regra: RegraEscolhida | null;
  readonly fator: string;
  readonly teto: string;
  readonly baseLegal: string | null;
  readonly fatoDeElegibilidade: string | null;
}

export function valoresDoFormulario(documento: DocumentoDaConfiguracao): ValoresDoFada {
  const fada = documento.fada;
  return {
    aplica: fada?.aplica ?? null,
    regra: regraEscolhida(fada?.regra),
    fator: textoDoNumero(fada?.fator),
    teto: textoDoNumero(fada?.teto),
    baseLegal: fada?.baseLegalCodigo ?? null,
    fatoDeElegibilidade: fada?.codigoDoDadoDeElegibilidade ?? null,
  };
}

/** A declaração vem primeiro: só com `aplica` verdadeiro os demais campos entram no documento. */
export function edicaoDoPasso(valores: ValoresDoFada): EdicaoDoDocumento {
  return emSequencia(
    (documento) => definirAplicacaoDoFada(documento, valores.aplica),
    (documento) => definirRegraDoFada(documento, valores.regra),
    (documento) => definirFatorDoFada(documento, valores.fator),
    (documento) => definirTetoDoFada(documento, valores.teto),
    (documento) => definirBaseLegalDoFada(documento, valores.baseLegal ?? ''),
    (documento) => definirFatoDeElegibilidade(documento, valores.fatoDeElegibilidade ?? ''),
  );
}
