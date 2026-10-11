import type { FatoCandidatoView } from '@uniplus/shared-data/configuracao';
import { fatosEscolhiveis, type FatoEscolhivel } from '@uniplus/shared-ui/components';

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
