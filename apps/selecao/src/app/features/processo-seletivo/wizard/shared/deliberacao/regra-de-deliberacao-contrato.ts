import type { RegraDeDeliberacaoDto, RegraDeDeliberacaoInput } from '@uniplus/shared-data/selecao';

import type { RegraDeDeliberacaoDaBanca } from '../../modelos/deliberacao.models';
import { comoTexto } from '../hidratacao/campos-lidos';
import { inteiroDoCampo } from '../numero-do-campo';
import { ehColegiada } from './regra-de-deliberacao';

/** A regra que a API devolveu, no formato do rascunho; banca sem regra volta `null`. */
export function regraDoDto(
  dto: RegraDeDeliberacaoDto | null | undefined,
): RegraDeDeliberacaoDaBanca | null {
  if (dto === null || dto === undefined) return null;
  return {
    modo: dto.modo,
    integrantes: comoTexto(dto.integrantes),
    suplentes: comoTexto(dto.suplentes),
    quorum: comoTexto(dto.quorum),
    criterio: dto.criterio ?? '',
    desempate: dto.desempate ?? '',
    encerramento: dto.encerramento ?? '',
    semUnanimidade: dto.semUnanimidade ?? '',
  };
}

/** O que a votação carrega: só os campos preenchidos, e nenhum no ato individual. */
function votacaoDaRegra(regra: RegraDeDeliberacaoDaBanca): Partial<RegraDeDeliberacaoInput> {
  if (!ehColegiada(regra)) return {};
  return {
    quorum: inteiroDoCampo(regra.quorum),
    criterio: regra.criterio || null,
    desempate: regra.desempate || null,
    encerramento: regra.encerramento || null,
    semUnanimidade: regra.semUnanimidade || null,
  };
}

/** A regra no comando; um número que não é inteiro viaja como zero, e a conferência já o apontou. */
export function regraComoInput(
  regra: RegraDeDeliberacaoDaBanca | null,
): RegraDeDeliberacaoInput | null {
  if (regra === null) return null;
  return {
    modo: regra.modo,
    integrantes: inteiroDoCampo(regra.integrantes) ?? 0,
    suplentes: inteiroDoCampo(regra.suplentes) ?? 0,
    ...votacaoDaRegra(regra),
  };
}
