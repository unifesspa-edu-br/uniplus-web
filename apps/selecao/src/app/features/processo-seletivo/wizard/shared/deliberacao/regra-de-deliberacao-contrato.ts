import type { RegraDeDeliberacaoDto, RegraDeDeliberacaoInput } from '@uniplus/shared-data/selecao';

import type { RegraDeDeliberacaoDaBanca } from '../../modelos/deliberacao.models';
import { comoTexto } from '../hidratacao/campos-lidos';
import { inteiroDoCampo } from '../numero-do-campo';

function codigoDoValor<T extends string>(valor: { readonly codigo: T } | null | undefined): T | '' {
  return valor?.codigo ?? '';
}

function rotulosDoDto(dto: RegraDeDeliberacaoDto): RegraDeDeliberacaoDaBanca['rotulos'] {
  return Object.fromEntries(
    (['modo', 'criterio', 'desempate', 'encerramento', 'semUnanimidade'] as const).flatMap(
      (campo) => (dto[campo] ? [[campo, dto[campo]]] : []),
    ),
  );
}

function composicaoDoDto(dto: RegraDeDeliberacaoDto) {
  return { integrantes: comoTexto(dto.integrantes), suplentes: comoTexto(dto.suplentes) };
}

/** A regra que a API devolveu, no formato do rascunho; banca sem regra volta `null`. */
export function regraDoDto(
  dto: RegraDeDeliberacaoDto | null | undefined,
): RegraDeDeliberacaoDaBanca | null {
  if (dto === null || dto === undefined) return null;
  return {
    rotulos: rotulosDoDto(dto),
    modo: dto.modo.codigo,
    ...composicaoDoDto(dto),
    quorum: comoTexto(dto.quorum),
    criterio: codigoDoValor(dto.criterio),
    desempate: codigoDoValor(dto.desempate),
    encerramento: codigoDoValor(dto.encerramento),
    semUnanimidade: codigoDoValor(dto.semUnanimidade),
  };
}

/** Os campos da votação declarada, inclusive os que aguardam preenchimento. */
function votacaoDaRegra(regra: RegraDeDeliberacaoDaBanca): Partial<RegraDeDeliberacaoInput> {
  return {
    quorum: inteiroDoCampo(regra.quorum),
    criterio: (regra.criterio || null) as RegraDeDeliberacaoInput['criterio'],
    desempate: (regra.desempate || null) as RegraDeDeliberacaoInput['desempate'],
    encerramento: (regra.encerramento || null) as RegraDeDeliberacaoInput['encerramento'],
    semUnanimidade: (regra.semUnanimidade || null) as RegraDeDeliberacaoInput['semUnanimidade'],
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
