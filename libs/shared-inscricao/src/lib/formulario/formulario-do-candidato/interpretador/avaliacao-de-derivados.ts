import type { GrupoAvaliadoInterno } from './avaliacao-interna';
import type { DefinicaoAgregado, DefinicaoDerivacao } from './definicao-do-formulario';
import {
  codigosDa,
  FATO_INDETERMINADO,
  type FatoResolvido,
  type Fatos,
  INDETERMINADO,
  RESOLVIDO,
  resolvido,
  VERDADEIRO,
} from './logica';
import { avaliarPredicado } from './predicado';
import type { ValorJson } from './regras-do-formulario';
import { codigosEmOrdem } from './restricoes';

/**
 * O derivado: indeterminado enquanto alguma dependência está; senão, verdadeiro se alguma regra ativa
 * (booleano) ou a união ordenada do que as ativas contribuem. A regra que não se sabe avaliar deixa o
 * derivado indeterminado.
 */
export function derivar(derivacao: DefinicaoDerivacao, fatos: Fatos): FatoResolvido {
  if (derivacao.dependencias.some((d) => (fatos.get(d)?.estado ?? INDETERMINADO) === INDETERMINADO))
    return FATO_INDETERMINADO;

  const ativas = regrasAtivas(derivacao, fatos);
  return ativas === null ? FATO_INDETERMINADO : resolvido(valorDoDerivado(derivacao, ativas));
}

function regrasAtivas(
  derivacao: DefinicaoDerivacao,
  fatos: Fatos,
): DefinicaoDerivacao['regras'] | null {
  const ativas: DefinicaoDerivacao['regras'][number][] = [];
  for (const regra of derivacao.regras) {
    const ativa =
      regra.quando.clausulas.length === 0 ? VERDADEIRO : avaliarPredicado(regra.quando, fatos);
    if (ativa === INDETERMINADO) return null;
    if (ativa === VERDADEIRO) ativas.push(regra);
  }
  return ativas;
}

function valorDoDerivado(
  derivacao: DefinicaoDerivacao,
  ativas: DefinicaoDerivacao['regras'],
): boolean | string[] {
  if (derivacao.booleano) return ativas.length > 0;
  return codigosEmOrdem(
    ativas.flatMap((regra) => (regra.contribui === null ? [] : [regra.contribui])),
  );
}

/** O agregado sobre o grupo: se algum membro responde verdadeiro, ou os códigos presentes entre eles. */
export function agregar(grupo: GrupoAvaliadoInterno, agregado: DefinicaoAgregado): FatoResolvido {
  if (grupo.estado === INDETERMINADO) return FATO_INDETERMINADO;
  const respostas =
    grupo.estado === RESOLVIDO
      ? grupo.ocorrencias
          .map((o) => o.fatos.get(agregado.fatoDeMembro)?.valor)
          .filter((v): v is ValorJson => v !== undefined && v !== null)
      : [];
  return resolvido(
    agregado.operacao === 'EXISTE'
      ? respostas.some((r) => r === true)
      : codigosEmOrdem(respostas.flatMap((r) => codigosDa(r) ?? [])),
  );
}
