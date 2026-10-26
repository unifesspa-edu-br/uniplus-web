/**
 * Grava o conteúdo como arquivo a partir de um endereço local. O link entra na página para o clique
 * valer em todo navegador, e o endereço só é liberado depois que o download começa.
 */
export function salvarArquivo(conteudo: Blob, nome: string): void {
  const endereco = URL.createObjectURL(conteudo);
  const link = document.createElement('a');
  link.href = endereco;
  link.download = nome;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(endereco));
}
