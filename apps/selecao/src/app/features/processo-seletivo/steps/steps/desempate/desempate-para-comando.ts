import { CriterioDesempateInput } from '@uniplus/shared-data/selecao';

import { CriterioDesempateConfigurado } from '../../processo-seletivo.models';

/**
 * Códigos de `CriterioDesempateCodigo` — o discriminador do shape de args de
 * `ArgsCriterioDesempate` (`DESEMPATE-MAIOR-NOTA-ETAPA` usa `etapaRef`;
 * `DESEMPATE-IDOSO` usa `idadeMinima`; `DESEMPATE-PREDICADO-FATO` usa
 * `fato`+`operador`+`valor`; `DESEMPATE-MAIOR-IDADE` não usa nenhum). Não é
 * rótulo do frontend: é o mesmo discriminador que
 * `DefinirCriteriosDesempateCommandHandler.MontarArgs` aplica no servidor.
 */
const DESEMPATE_MAIOR_NOTA_ETAPA = 'DESEMPATE-MAIOR-NOTA-ETAPA';
const DESEMPATE_IDOSO = 'DESEMPATE-IDOSO';
const DESEMPATE_PREDICADO_FATO = 'DESEMPATE-PREDICADO-FATO';

export function desempateUsaEtapa(regraCodigo: string): boolean {
  return regraCodigo === DESEMPATE_MAIOR_NOTA_ETAPA;
}

export function desempateUsaIdadeMinima(regraCodigo: string): boolean {
  return regraCodigo === DESEMPATE_IDOSO;
}

export function desempateUsaPredicadoFato(regraCodigo: string): boolean {
  return regraCodigo === DESEMPATE_PREDICADO_FATO;
}

function naoVazio(texto: string): string | null {
  const limpo = texto.trim();
  return limpo === '' ? null : limpo;
}

function inteiro(texto: string): number | null {
  const limpo = texto.trim();
  return /^\d+$/.test(limpo) ? Number(limpo) : null;
}

/**
 * Converte um critério configurado no `CriterioDesempateInput` — o campo não
 * aplicável ao `regraCodigo` viaja `null` explícito, nunca omitido. `ordem` é
 * a posição do item na lista (1-based), não um campo do rascunho: é o reorder
 * que decide, e a lista inteira é reenviada a cada gravação.
 */
export function comoComandoDeCriterioDesempate(
  criterio: CriterioDesempateConfigurado,
  ordem: number,
): CriterioDesempateInput {
  const usaEtapa = desempateUsaEtapa(criterio.regraCodigo);
  const usaIdade = desempateUsaIdadeMinima(criterio.regraCodigo);
  const usaPredicado = desempateUsaPredicadoFato(criterio.regraCodigo);

  return {
    ordem,
    regraCodigo: criterio.regraCodigo,
    regraVersao: criterio.regraVersao,
    etapaRef: usaEtapa ? naoVazio(criterio.etapaRef) : null,
    idadeMinima: usaIdade ? inteiro(criterio.idadeMinima) : null,
    fato: usaPredicado ? naoVazio(criterio.fato) : null,
    operador: usaPredicado ? naoVazio(criterio.operador) : null,
    valor: usaPredicado ? naoVazio(criterio.valor) : null,
  };
}

/** Converte a lista inteira, atribuindo `ordem` pela posição. */
export function comoComandoDeCriteriosDesempate(
  criterios: readonly CriterioDesempateConfigurado[],
): readonly CriterioDesempateInput[] {
  return criterios.map((criterio, indice) => comoComandoDeCriterioDesempate(criterio, indice + 1));
}
