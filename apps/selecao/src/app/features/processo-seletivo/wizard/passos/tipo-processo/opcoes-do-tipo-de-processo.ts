import { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import { TipoProcessoOption } from '../../processo-seletivo.models';

type TipoDoProcesso = ProcessoSeletivoDto['tipoProcesso'];

/**
 * Catálogo vivo mais, quando faltar, o tipo que o processo retomado declara.
 *
 * O catálogo lista só tipos ativos; um processo criado antes de o tipo ser
 * desativado continua apontando para ele. Sem esta opção o passo abriria sem
 * seleção alguma, e como o cadastro inicial fica congelado o operador não
 * teria como identificar nem corrigir o que está lá — o snapshot devolvido
 * por Seleção é a única fonte desse rótulo (ADR-0122).
 */
export function incluirTipoRetomado(
  catalogo: readonly TipoProcessoOption[],
  tipoDoProcesso: TipoDoProcesso | undefined,
): readonly TipoProcessoOption[] {
  if (tipoDoProcesso === undefined) return catalogo;
  if (catalogo.some((opcao) => opcao.value === tipoDoProcesso.origemId)) return catalogo;
  return [comoOpcaoRetomada(tipoDoProcesso), ...catalogo];
}

function comoOpcaoRetomada(tipo: TipoDoProcesso): TipoProcessoOption {
  return {
    value: tipo.origemId,
    codigo: tipo.codigo,
    name: tipo.nome,
    description: 'Tipo não disponível no catálogo atual — preservado deste processo.',
    tags: [tipo.codigo],
  };
}
