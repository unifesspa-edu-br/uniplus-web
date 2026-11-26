import { CODIGO_TAMANHO_MAXIMO, sugerirCodigoDeCadastro } from '@uniplus/shared-utils';

const LIMITE_DO_CODIGO = Math.min(60, CODIGO_TAMANHO_MAXIMO);

// O editor mantém o corte até a mudança de desenho dele.
function limitarCodigo(codigo: string, limite: number): string {
  return codigo.slice(0, limite).replace(/_+$/u, '');
}

export type CodigoDeReserva = 'TERMO' | 'GRUPO';

export function codigoDoNome(nome: string, reserva: CodigoDeReserva): string {
  const nomeSemIniciais = nome.normalize('NFD').replace(/^[^a-zA-Z]+/u, '');
  return limitarCodigo(sugerirCodigoDeCadastro(nomeSemIniciais), LIMITE_DO_CODIGO) || reserva;
}

export function codigoLivre(
  nome: string,
  reserva: CodigoDeReserva,
  usados: ReadonlySet<string>,
): string {
  const base = codigoDoNome(nome, reserva);
  let codigo = base;
  for (let numero = 2; usados.has(codigo); numero++) {
    const sufixo = `_${numero}`;
    codigo = limitarCodigo(base, LIMITE_DO_CODIGO - sufixo.length) + sufixo;
  }
  return codigo;
}

export function nomeDoFato(nomes: ReadonlyMap<string, string>, fato: string): string {
  return nomes.get(fato) ?? fato;
}
