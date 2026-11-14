import type Keycloak from 'keycloak-js';
import type { AuthService } from './auth.service';

/** Espia a fábrica privada do cliente Keycloak, que os testes de `init()` substituem por um duplo. */
export function espiarCriacaoDoKeycloak(service: AuthService) {
  return vi.spyOn(service as unknown as { createKeycloak: () => Keycloak }, 'createKeycloak');
}

/**
 * Serve a página sob um mount point (`<base href>`) até o fim do teste; devolve a limpeza
 * que o `beforeEach` do Vitest executa ao terminar.
 */
export function instalarBase(href: string): () => void {
  const base = document.createElement('base');
  base.href = href;
  document.head.appendChild(base);
  return () => base.remove();
}
