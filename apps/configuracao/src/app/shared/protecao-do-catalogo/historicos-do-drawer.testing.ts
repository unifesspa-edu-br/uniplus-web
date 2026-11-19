import type { HttpTestingController } from '@angular/common/http/testing';

/**
 * Responde, vazias, as leituras do drawer de um cadastro que o teste não confere: os atos da
 * proteção de dados e as manifestações técnicas do item. As canceladas ficam como estão.
 */
export function atenderHistoricosDoDrawer(http: HttpTestingController): void {
  const doDrawer = (url: string) =>
    url.endsWith('/protecao/atos') || url.endsWith('/protecao/manifestacoes');
  for (const req of http.match((r) => doDrawer(r.url))) {
    if (!req.cancelled) req.flush([]);
  }
}
