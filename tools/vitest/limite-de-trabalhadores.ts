import { availableParallelism, totalmem } from 'node:os';

// Cada trabalhador do Vitest acumula memória até ser reciclado: um trabalhador por núcleo, sem
// olhar a memória, estoura o Node em máquina com muitos núcleos. 4 GB por trabalhador deixam folga.
export const MEMORIA_POR_TRABALHADOR_EM_GB = 4;

export function limiteDeTrabalhadores(nucleos: number, memoriaTotalEmBytes: number): number {
  const memoriaEmGB = memoriaTotalEmBytes / 1024 ** 3;
  return Math.max(1, Math.min(nucleos, Math.floor(memoriaEmGB / MEMORIA_POR_TRABALHADOR_EM_GB)));
}

export function limiteDeTrabalhadoresDestaMaquina(): number {
  return limiteDeTrabalhadores(availableParallelism(), totalmem());
}
