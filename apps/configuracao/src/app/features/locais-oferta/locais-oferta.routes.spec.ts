import { describe, expect, it } from 'vitest';
import { LOCAIS_OFERTA_ROUTES } from './locais-oferta.routes';
import { LocaisOfertaPage } from './locais-oferta.page';

describe('LOCAIS_OFERTA_ROUTES', () => {
  it('carrega a página da tela na rota raiz', async () => {
    const [raiz] = LOCAIS_OFERTA_ROUTES;
    expect(raiz.path).toBe('');
    expect(await (raiz.loadComponent as () => Promise<unknown>)()).toBe(LocaisOfertaPage);
  });
});
