import type { BancaDeclarada } from '../../modelos/banca.models';
import { regraComoInput } from '../deliberacao/regra-de-deliberacao-contrato';

export type Casamento<T> = { confere: true; lista: T[] } | { confere: false };

export function comOsIdentificadoresLidos<T extends BancaDeclarada>(
  enviadas: readonly T[],
  lidas: readonly BancaDeclarada[],
): Casamento<T> {
  if (enviadas.length !== lidas.length) return { confere: false };
  const restantes = [...lidas];
  const lista: T[] = [];
  for (const banca of enviadas) {
    const lida = encontrarBanca(banca, enviadas, restantes);
    if (!lida) return { confere: false };
    lista.push({ ...banca, id: lida.id, copiaDoTipo: lida.copiaDoTipo });
  }
  return { confere: true, lista };
}

function encontrarBanca(
  banca: BancaDeclarada,
  enviadas: readonly BancaDeclarada[],
  restantes: BancaDeclarada[],
): BancaDeclarada | null {
  const candidatas = restantes.filter(
    (lida) =>
      corresponde(banca, lida, enviadas) &&
      (lida.posicaoNoTipo === undefined || lida.posicaoNoTipo === posicao(enviadas, banca)),
  );
  if (candidatas.length !== 1) return null;
  const lida = candidatas[0];
  restantes.splice(restantes.indexOf(lida), 1);
  return lida;
}

function corresponde(
  banca: BancaDeclarada,
  lida: BancaDeclarada,
  enviadas: readonly BancaDeclarada[],
): boolean {
  if (banca.id !== null) return banca.id === lida.id && mesmoConteudo(banca, lida);
  if (enviadas.some((outra) => outra.id !== null && outra.id === lida.id)) return false;
  return mesmoConteudo(banca, lida);
}

function mesmoConteudo(primeira: BancaDeclarada, segunda: BancaDeclarada): boolean {
  return (
    primeira.tipoBancaId === segunda.tipoBancaId &&
    JSON.stringify(regraComoInput(primeira.regraDeDeliberacao)) ===
      JSON.stringify(regraComoInput(segunda.regraDeDeliberacao)) &&
    JSON.stringify(categorias(primeira)) === JSON.stringify(categorias(segunda))
  );
}

function categorias(banca: BancaDeclarada): string[] {
  return 'categoriasDocumentoIds' in banca && Array.isArray(banca.categoriasDocumentoIds)
    ? [...banca.categoriasDocumentoIds].sort()
    : [];
}

function posicao(bancas: readonly BancaDeclarada[], banca: BancaDeclarada): number {
  return bancas
    .slice(0, bancas.indexOf(banca) + 1)
    .filter((item) => item.tipoBancaId === banca.tipoBancaId).length;
}
