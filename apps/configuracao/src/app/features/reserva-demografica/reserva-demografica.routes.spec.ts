import { describe, expect, it } from 'vitest';
import { ReservaDemograficaListPage } from './reserva-demografica-list.page';
import { RESERVA_DEMOGRAFICA_ROUTES } from './reserva-demografica.routes';

describe('RESERVA_DEMOGRAFICA_ROUTES', () => {
  it('carrega a página da tela na rota raiz', async () => {
    const [raiz] = RESERVA_DEMOGRAFICA_ROUTES;
    expect(raiz.path).toBe('');
    expect(await (raiz.loadComponent as () => Promise<unknown>)()).toBe(ReservaDemograficaListPage);
  });
});
