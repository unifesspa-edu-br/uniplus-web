import { clicarEmLinkTransitorio } from './link-transitorio';

/**
 * Grava o conteúdo como arquivo a partir de um endereço local, liberado só depois que o download
 * começa.
 */
export function salvarArquivo(conteudo: Blob, nome: string): void {
  const endereco = URL.createObjectURL(conteudo);
  clicarEmLinkTransitorio(endereco, (link) => (link.download = nome));
  setTimeout(() => URL.revokeObjectURL(endereco));
}
