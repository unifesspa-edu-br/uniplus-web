const BYTES_POR_KB = 1024;
const BYTES_POR_MB = BYTES_POR_KB * 1024;

/** Tamanho legível em pt-BR (B, KB com uma casa, MB com uma casa); sem número, "tamanho indisponível". */
export function formatarTamanhoDeArquivo(bytes: number | string | null): string {
  const valor = typeof bytes === 'string' ? Number(bytes) : bytes;
  if (valor === null || !Number.isFinite(valor)) return 'tamanho indisponível';
  if (valor < BYTES_POR_KB) return `${valor} B`;
  if (valor < BYTES_POR_MB) return `${(valor / BYTES_POR_KB).toFixed(1).replace('.', ',')} KB`;
  return `${(valor / BYTES_POR_MB).toFixed(1).replace('.', ',')} MB`;
}
