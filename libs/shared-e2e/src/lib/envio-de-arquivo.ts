/** PDF mínimo válido: a API confere a assinatura `%PDF-` do conteúdo. */
export const PDF_MINIMO = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/MediaBox[0 0 200 200]/Parent 2 0 R>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF\n',
  'utf-8',
);

/**
 * Envia os bytes direto ao armazenamento pela URL assinada, com o content type que entrou na
 * assinatura, e devolve o ETag que a API pede na confirmação.
 */
export async function enviarPelaUrlAssinada(urlUpload: string, contentType: string, bytes: Buffer<ArrayBuffer>): Promise<string> {
  const subida = await fetch(urlUpload, { method: 'PUT', headers: { 'content-type': contentType }, body: bytes });
  if (!subida.ok) {
    throw new Error(`Envio ao armazenamento: ${subida.status} ${(await subida.text()).slice(0, 300)}`);
  }
  return subida.headers.get('etag') ?? '';
}
