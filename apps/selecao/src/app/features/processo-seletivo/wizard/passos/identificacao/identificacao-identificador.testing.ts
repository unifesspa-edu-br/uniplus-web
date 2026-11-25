/**
 * Cede o event loop para que a cadeia de `await` do componente avance até a
 * próxima requisição. `Promise.resolve()` sozinho não basta: cada fase do
 * fluxo passa por `firstValueFrom` e por mais de um microtask.
 */
export function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
