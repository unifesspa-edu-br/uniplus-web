import { Signal, computed } from '@angular/core';
import type { LeiauteDoInepDto, LeiauteEscolhido } from '@uniplus/shared-data/selecao';
import { acompanharLeitura, type LeituraAcompanhada } from '@uniplus/shared-ui/components';

import { estaLendo, mensagemDaFalha, type Leitura } from '../leitura';

/** O valor da opção no select: o par que identifica o leiaute no catálogo. */
export function chaveDoLeiaute(leiaute: Pick<LeiauteDoInepDto, 'codigo' | 'versao'>): string {
  return `${leiaute.codigo}|${leiaute.versao}`;
}

export function rotuloDoLeiaute(leiaute: Pick<LeiauteDoInepDto, 'descricao' | 'versao'>): string {
  return `${leiaute.descricao} (${leiaute.versao})`;
}

/** O leiaute que a chave escolhida designa no catálogo; nulo sem escolha ou com leiaute que saiu dele. */
export function leiauteDaChave(
  catalogo: readonly LeiauteDoInepDto[],
  chave: string,
): LeiauteEscolhido | null {
  const leiaute = catalogo.find((l) => chaveDoLeiaute(l) === chave);
  return leiaute === undefined
    ? null
    : { leiauteCodigo: leiaute.codigo, leiauteVersao: leiaute.versao };
}

/**
 * A leitura do catálogo de leiautes de um card, com o aviso de falha e a nova tentativa. O foco
 * volta ao campo do leiaute quando a nova tentativa dá certo. Chamar em contexto de injeção.
 */
export function acompanharLeiautes(opcoes: {
  readonly catalogo: Signal<Leitura<readonly LeiauteDoInepDto[]>>;
  readonly idDoCampo: string;
  readonly recarregar: () => void;
}): LeituraAcompanhada {
  const { catalogo, idDoCampo, recarregar } = opcoes;
  return acompanharLeitura({
    falha: computed(() => {
      const falha = mensagemDaFalha(catalogo());
      return falha === null ? null : `${falha} Sem eles não é possível usar esta etapa.`;
    }),
    pendente: computed(() => estaLendo(catalogo())),
    recarregar,
    destino: () => document.getElementById(idDoCampo),
  });
}
