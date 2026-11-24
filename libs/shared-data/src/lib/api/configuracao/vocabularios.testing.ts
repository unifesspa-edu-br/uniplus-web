export function valorDeTeste<T extends string>(codigo: T): { codigo: T; rotulo: string } {
  return { codigo, rotulo: `Rótulo de teste: ${codigo}` };
}
