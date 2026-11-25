const LIMITE_DO_CODIGO = 60;

export type CodigoDeReserva = 'TERMO' | 'GRUPO';

function limitarCodigo(codigo: string, limite = LIMITE_DO_CODIGO): string {
  return codigo.slice(0, limite).replace(/_+$/u, '');
}

export function codigoDoNome(nome: string, reserva: CodigoDeReserva): string {
  const codigo = limitarCodigo(
    nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/gu, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/gu, '_')
      .replace(/^[0-9_]+/u, ''),
  );
  return codigo === '' ? reserva : codigo;
}

export function codigoLivre(
  nome: string,
  reserva: CodigoDeReserva,
  usados: ReadonlySet<string>,
): string {
  const base = limitarCodigo(codigoDoNome(nome, reserva));
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
