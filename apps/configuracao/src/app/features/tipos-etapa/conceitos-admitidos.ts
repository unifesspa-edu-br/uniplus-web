import type { TipoConceitoDto } from '@uniplus/shared-data/configuracao';

/** Um conceito que o tipo de etapa pode admitir, como a tela o oferece. */
export interface OpcaoDeConceito {
  readonly codigo: string;
  readonly nome: string;
  /** Admitido pelo tipo, mas fora do catálogo ativo: a API recusa a gravação enquanto ele constar. */
  readonly inativo: boolean;
}

const porNome = (a: OpcaoDeConceito, b: OpcaoDeConceito): number =>
  a.nome.localeCompare(b.nome, 'pt-BR');

/**
 * Os conceitos ativos do catálogo, mais os já admitidos pelo tipo que o catálogo ativo não traz
 * (desativados ou desconhecidos), marcados como inativos para a pessoa poder retirá-los.
 */
export function opcoesDeConceito(
  catalogo: readonly TipoConceitoDto[],
  admitidos: readonly string[],
): readonly OpcaoDeConceito[] {
  const ativos = catalogo
    .filter((conceito) => conceito.ativo)
    .map((conceito) => ({ codigo: conceito.codigo, nome: conceito.nome, inativo: false }));
  const codigosAtivos = new Set(ativos.map((conceito) => conceito.codigo));
  const nomes = new Map(catalogo.map((conceito) => [conceito.codigo, conceito.nome] as const));
  const foraDoCatalogo = admitidos
    .filter((codigo) => !codigosAtivos.has(codigo))
    .map((codigo) => ({ codigo, nome: nomes.get(codigo) ?? codigo, inativo: true }));
  return [...ativos.sort(porNome), ...foraDoCatalogo.sort(porNome)];
}

/** O conjunto de códigos depois de marcar ou desmarcar um conceito, sem repetir nenhum. */
export function alternarConceito(
  admitidos: readonly string[],
  codigo: string,
  marcado: boolean,
): readonly string[] {
  const restantes = admitidos.filter((admitido) => admitido !== codigo);
  return marcado ? [...restantes, codigo] : restantes;
}
