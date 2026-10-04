import type { TermoConsentimentoDto } from '@uniplus/shared-data/configuracao';
import type { TermoDisponivel } from '@uniplus/shared-ui/components';

const DATA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * O termo de consentimento como o editor o oferece: as versões promovidas, a mais nova primeiro —
 * é a que um termo recém-exigido recebe —, nomeadas pela data da promoção.
 */
export function termoDisponivelDe(termo: TermoConsentimentoDto): TermoDisponivel {
  return {
    termoId: termo.id,
    nome: termo.nome,
    versoes: [...termo.versoes]
      .sort((a, b) => b.promovidaEm.localeCompare(a.promovidaEm))
      .map((versao) => ({ versaoId: versao.id, rotulo: `Versão de ${DATA.format(new Date(versao.promovidaEm))}` })),
  };
}
