const BYTES_POR_KB = 1024;
const BYTES_POR_MB = BYTES_POR_KB * 1024;

/** Tamanho legível em pt-BR (B, KB com uma casa, MB com uma casa); sem número, "tamanho indisponível". */
export function formatarTamanhoDeArquivo(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return 'tamanho indisponível';
  if (bytes < BYTES_POR_KB) return `${bytes} B`;
  if (bytes < BYTES_POR_MB) return `${(bytes / BYTES_POR_KB).toFixed(1).replace('.', ',')} KB`;
  return `${(bytes / BYTES_POR_MB).toFixed(1).replace('.', ',')} MB`;
}
