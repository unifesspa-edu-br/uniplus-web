import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PaginaDosModelos, URL, modelo } from './modelos-formulario.escritas.testing';

describe('ModelosFormularioPage — "Tentar novamente"', () => {
  const pagina = new PaginaDosModelos();

  beforeEach(async () => {
    await pagina.montar();
    await pagina.carregar(true);
  });
  afterEach(() => pagina.desmontar());

  const tentarNovamente = (): HTMLButtonElement => pagina.elemento('ui-alert .btn--secondary');

  it('devolve o foco ao título da lista quando a nova tentativa dá certo e o alerta sai', async () => {
    const tentar = tentarNovamente();
    tentar.focus();

    tentar.click();
    await pagina.propagar();
    pagina.controller.expectOne((r) => r.url === URL).flush([modelo]);
    await pagina.propagar();

    expect(document.activeElement).toBe(pagina.elemento('#cfg-modelos-list-title'));
  });

  it('fica indisponível, sem refazer a leitura, enquanto uma troca de situação está pendente', async () => {
    pagina.edicao.desativar(modelo);
    const troca = pagina.controller.expectOne(`${URL}/${modelo.id}`);
    await pagina.propagar();
    const tentar = tentarNovamente();

    expect(tentar.getAttribute('aria-disabled')).toBe('true');
    expect(tentar.disabled).toBe(false);
    tentar.click();
    pagina.controller.expectNone((r) => r.url === URL);

    troca.flush(null, { status: 204, statusText: 'No Content' });
    await pagina.propagar();
    pagina.controller.expectOne((r) => r.url === URL).flush([modelo]);
  });
});
