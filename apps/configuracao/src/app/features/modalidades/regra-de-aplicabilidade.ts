import type { FatoCandidatoView } from '@uniplus/shared-data/configuracao';
import {
  descreverAlternativas,
  fatoEscolhivel,
  fatosEscolhiveis,
  type CondicaoEmClausula,
  type FatoEscolhivel,
} from '@uniplus/shared-ui/components';

import { fatosCitaveisPelaRegra } from '../fatos-candidato/fato-candidato.regras';

/**
 * A regra de aplicabilidade decide quem concorre na modalidade, e a modalidade do candidato é a
 * união dessas regras: a regra que citasse o próprio fato da modalidade nunca resolveria.
 */
const FATO_MODALIDADE = 'MODALIDADE';

/**
 * Os fatos que o editor oferece à regra: os citáveis do catálogo e os que a regra salva já cita —
 * a API recusa só a citação nova de fato desativado, e a regra que já o citava continua valendo.
 */
export function fatosDaRegraDeAplicabilidade(
  catalogo: readonly FatoCandidatoView[],
  jaCitados: ReadonlySet<string>,
): readonly FatoEscolhivel[] {
  const citaveis = new Set(
    fatosCitaveisPelaRegra(catalogo, FATO_MODALIDADE).map((fato) => fato.codigo),
  );
  return fatosEscolhiveis(
    catalogo.filter((fato) => citaveis.has(fato.codigo) || jaCitados.has(fato.codigo)),
  );
}

/** Todo fato do catálogo pelo código, para ler a regra salva mesmo quando ela cita fato que o editor não oferece. */
export function fatosParaLeitura(
  catalogo: readonly FatoCandidatoView[],
): ReadonlyMap<string, FatoEscolhivel> {
  const porCodigo = new Map<string, FatoEscolhivel>();
  for (const view of catalogo) {
    const fato = fatoEscolhivel(view);
    if (fato !== null) porCodigo.set(fato.codigo, fato);
  }
  return porCodigo;
}

/** A leitura da regra sem condição: a modalidade vale para todo candidato. */
export const TODOS_OS_CANDIDATOS = 'Todos os candidatos';

/** A regra numa linha: a regra sem condição vale para todos; as alternativas se ligam por "ou". */
export function resumoDaRegra(
  regra: readonly CondicaoEmClausula[],
  fatos: ReadonlyMap<string, FatoEscolhivel>,
): string {
  const alternativas = descreverAlternativas(regra, fatos);
  return alternativas.length === 0 ? TODOS_OS_CANDIDATOS : alternativas.join('; ou ');
}
