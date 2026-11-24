import { CriterioDesempateInput, OperadorCodigo } from '@uniplus/shared-data/selecao';
import { codigoDoContrato } from '@uniplus/shared-data/utils';

import { CriterioDesempateConfigurado } from '../../processo-seletivo.models';
import { inteiroNaForma } from '../../shared/numero-do-campo';

/**
 * Códigos de `CriterioDesempateCodigo` — o discriminador do shape de args de
 * `ArgsCriterioDesempate` (`DESEMPATE_MAIOR_NOTA_ETAPA` usa `etapaRef`;
 * `DESEMPATE_IDOSO` usa `idadeMinima`; `DESEMPATE_CONDICAO_SOBRE_DADO` usa
 * `fato`+`operador`+`valor`; `DESEMPATE_MAIOR_NOTA_AREA_ENEM` usa `areas`;
 * `DESEMPATE_MAIOR_IDADE` não usa nenhum). Não é
 * rótulo do frontend: é o mesmo discriminador que
 * `DefinirCriteriosDesempateCommandHandler.MontarArgs` aplica no servidor.
 */
const DESEMPATE_MAIOR_NOTA_ETAPA = 'DESEMPATE_MAIOR_NOTA_ETAPA';
const DESEMPATE_IDOSO = 'DESEMPATE_IDOSO';
const DESEMPATE_PREDICADO_FATO = 'DESEMPATE_CONDICAO_SOBRE_DADO';
const DESEMPATE_MAIOR_NOTA_AREA_ENEM = 'DESEMPATE_MAIOR_NOTA_AREA_ENEM';

export function desempateUsaEtapa(regraCodigo: string): boolean {
  return regraCodigo === DESEMPATE_MAIOR_NOTA_ETAPA;
}

export function desempateUsaIdadeMinima(regraCodigo: string): boolean {
  return regraCodigo === DESEMPATE_IDOSO;
}

export function desempateUsaPredicadoFato(regraCodigo: string): boolean {
  return regraCodigo === DESEMPATE_PREDICADO_FATO;
}

export function desempateUsaAreas(regraCodigo: string): boolean {
  return regraCodigo === DESEMPATE_MAIOR_NOTA_AREA_ENEM;
}

const DESEMPATE_MAIOR_IDADE = 'DESEMPATE_MAIOR_IDADE';

/**
 * Se a tela sabe montar os argumentos desta regra.
 *
 * O catálogo cresce por migration, e uma regra nova aparece no seletor assim que é semeada —
 * mas os argumentos dela ficam nulos, e o servidor recusa com um erro que fala de tipo de
 * regra. Oferecer o que não se sabe configurar é pior que não oferecer: a recusa chega depois
 * de a pessoa ter escolhido, e não há campo na tela para consertar.
 */
export function desempateTemShapeConhecido(regraCodigo: string): boolean {
  return (
    regraCodigo === DESEMPATE_MAIOR_NOTA_ETAPA ||
    regraCodigo === DESEMPATE_IDOSO ||
    regraCodigo === DESEMPATE_PREDICADO_FATO ||
    regraCodigo === DESEMPATE_MAIOR_NOTA_AREA_ENEM ||
    regraCodigo === DESEMPATE_MAIOR_IDADE
  );
}

function naoVazio(texto: string): string | null {
  const limpo = texto.trim();
  return limpo === '' ? null : limpo;
}

/**
 * Converte um critério configurado no `CriterioDesempateInput` — o parâmetro não
 * aplicável ao `regraCodigo` viaja `null` explícito, nunca omitido. `ordem` é
 * a posição do item na lista (1-based), não um campo do rascunho: é o reorder
 * que decide, e a lista inteira é reenviada a cada gravação.
 */
export function comoComandoDeCriterioDesempate(
  criterio: CriterioDesempateConfigurado,
  ordem: number,
): CriterioDesempateInput {
  return {
    ordem,
    regra: { codigo: criterio.regraCodigo, versao: criterio.regraVersao },
    parametros: parametrosDoCriterio(criterio),
  };
}

type ParametrosDoCriterio = NonNullable<CriterioDesempateInput['parametros']>;

function parametrosDoCriterio(criterio: CriterioDesempateConfigurado): ParametrosDoCriterio {
  const regra = criterio.regraCodigo;
  return {
    etapaRef: desempateUsaEtapa(regra) ? naoVazio(criterio.etapaRef) : null,
    idadeMinima: desempateUsaIdadeMinima(regra) ? inteiroNaForma(criterio.idadeMinima) : null,
    ...predicadoDoCriterio(criterio),
    areas: desempateUsaAreas(regra) ? [...criterio.areas] : null,
  };
}

function predicadoDoCriterio(
  criterio: CriterioDesempateConfigurado,
): Pick<ParametrosDoCriterio, 'fato' | 'operador' | 'valor'> {
  if (!desempateUsaPredicadoFato(criterio.regraCodigo)) {
    return { fato: null, operador: null, valor: null };
  }
  return {
    fato: naoVazio(criterio.fato),
    operador: codigoDoContrato(OperadorCodigo, criterio.operador.trim()),
    valor: naoVazio(criterio.valor),
  };
}

/** Converte a lista inteira, atribuindo `ordem` pela posição. */
export function comoComandoDeCriteriosDesempate(
  criterios: readonly CriterioDesempateConfigurado[],
): readonly CriterioDesempateInput[] {
  return criterios.map((criterio, indice) => comoComandoDeCriterioDesempate(criterio, indice + 1));
}
