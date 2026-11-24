import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';

import {
  definirAplicacaoDoBonus,
  definirBaseLegalDoBonus,
  definirFatoDeElegibilidade,
  definirFatorDoBonus,
  definirRegraDoBonus,
  definirTetoDoBonus,
} from '../edicoes/bonus-regional.edicao';
import { emSequencia, type EdicaoDoDocumento } from '../edicoes/secao-do-documento';
import { regraEscolhida, type RegraEscolhida } from '../regra-escolhida';
import { textoDoNumero } from '../texto-do-campo';

export interface ValoresDoBonus {
  /** `null` é "ainda não declarado": o bloco do bônus não existe no documento. */
  readonly aplica: boolean | null;
  readonly regra: RegraEscolhida | null;
  readonly fator: string;
  readonly teto: string;
  readonly baseLegal: string | null;
  readonly fatoDeElegibilidade: string | null;
}

export function valoresDoFormulario(documento: DocumentoDaConfiguracao): ValoresDoBonus {
  const bonus = documento.bonusRegional;
  return {
    aplica: bonus?.aplica ?? null,
    regra: regraEscolhida(bonus?.regra),
    fator: textoDoNumero(bonus?.fator),
    teto: textoDoNumero(bonus?.teto),
    baseLegal: bonus?.baseLegalBonusRegionalCodigo ?? null,
    fatoDeElegibilidade: bonus?.codigoDoDadoDeElegibilidade ?? null,
  };
}

/** A declaração vem primeiro: só com `aplica` verdadeiro os demais campos entram no documento. */
export function edicaoDoPasso(valores: ValoresDoBonus): EdicaoDoDocumento {
  return emSequencia(
    (documento) => definirAplicacaoDoBonus(documento, valores.aplica),
    (documento) => definirRegraDoBonus(documento, valores.regra),
    (documento) => definirFatorDoBonus(documento, valores.fator),
    (documento) => definirTetoDoBonus(documento, valores.teto),
    (documento) => definirBaseLegalDoBonus(documento, valores.baseLegal ?? ''),
    (documento) => definirFatoDeElegibilidade(documento, valores.fatoDeElegibilidade ?? ''),
  );
}
