export async function json<T>(resposta: Response, esperado: number, contexto: string): Promise<T> {
  const texto = await resposta.text();
  if (resposta.status < esperado || resposta.status >= esperado + 100) {
    throw new Error(`${contexto}: ${resposta.status} ${texto.slice(0, 400)}`);
  }
  return (texto === '' ? null : JSON.parse(texto)) as T;
}
