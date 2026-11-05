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
import { compararOrdinal } from './restricoes';

/**
 * O derivado: indeterminado enquanto alguma dependência está; senão, verdadeiro se alguma regra ativa
 * (booleano) ou a união ordenada do que as ativas contribuem. A regra que não se sabe avaliar deixa o
 * derivado indeterminado.
 */
export function derivar(derivacao: DefinicaoDerivacao, fatos: Fatos): FatoResolvido {
  if (derivacao.dependencias.some((d) => (fatos.get(d)?.estado ?? INDETERMINADO) === INDETERMINADO))
    return FATO_INDETERMINADO;

  const contribuidos = new Set<string>();
  let algumaAtiva = false;
  for (const regra of derivacao.regras) {
    const ativa =
      regra.quando.clausulas.length === 0 ? VERDADEIRO : avaliarPredicado(regra.quando, fatos);
    if (ativa === INDETERMINADO) return FATO_INDETERMINADO;
    if (ativa === VERDADEIRO) {
      algumaAtiva = true;
      if (regra.contribui !== null) contribuidos.add(regra.contribui);
    }
  }
  return resolvido(derivacao.booleano ? algumaAtiva : [...contribuidos].sort(compararOrdinal));
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
      : [...new Set(respostas.flatMap((r) => codigosDa(r) ?? []))].sort(compararOrdinal),
  );
}
