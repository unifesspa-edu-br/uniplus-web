function luminancia(cor: string): number {
  const [vermelho, verde, azul] = [1, 3, 5].map((indice) => {
    const canal = Number.parseInt(cor.slice(indice, indice + 2), 16) / 255;
    return canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * vermelho + 0.7152 * verde + 0.0722 * azul;
}

export function razaoDeContraste(corA: string, corB: string): number {
  const [claro, escuro] = [luminancia(corA), luminancia(corB)].sort((a, b) => b - a);
  return (claro + 0.05) / (escuro + 0.05);
}
