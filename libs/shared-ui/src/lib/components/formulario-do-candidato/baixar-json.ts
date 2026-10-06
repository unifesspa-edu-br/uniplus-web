/**
 * Baixa o conteúdo como arquivo JSON, sem passar pelo servidor: o navegador grava o arquivo a partir
 * de um endereço local. O link entra na página para o clique valer em todo navegador, e o endereço só
 * é liberado depois que o download começa.
 */
export function baixarJson(
  nomeDoArquivo: string,
  conteudo: unknown,
  documento: Document = document,
): void {
  const endereco = URL.createObjectURL(
    new Blob([`${JSON.stringify(conteudo, null, 2)}\n`], { type: 'application/json' }),
  );
  const link = documento.createElement('a');
  link.href = endereco;
  link.download = nomeDoArquivo;
  link.hidden = true;
  documento.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(endereco));
}
