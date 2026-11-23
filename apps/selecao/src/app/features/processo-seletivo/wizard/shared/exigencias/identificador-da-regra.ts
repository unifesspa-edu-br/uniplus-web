let ultimoIdentificador = 0;

export function criarIdentificadorDaRegra(): string {
  ultimoIdentificador += 1;
  return String(ultimoIdentificador);
}
