import { afterEach, describe, expect, it } from 'vitest';
import {
  CenarioDaPaginaDeUnidades,
  LISTA,
  TITULO_DA_LISTA,
  problema,
  reitoria,
} from './unidades.testing';

describe('UnidadesPage — falha de leitura', () => {
  let p: CenarioDaPaginaDeUnidades;

  afterEach(() => p.http.verify());

  it('5xx avisa por toast e "Tentar novamente" devolve o foco ao título', async () => {
    p = await CenarioDaPaginaDeUnidades.abrir();
    p.store.recarregar();
    await p.propagar();
    p.http.expectOne((r) => r.url === LISTA).flush(...problema(503));
    await p.propagar();
    expect(p.erros).toHaveBeenCalledTimes(1);

    const tentar = p.elemento<HTMLButtonElement>('ui-alert .list-state__retry button');
    tentar.focus();
    tentar.click();
    await p.propagar();
    expect(tentar.getAttribute('aria-disabled')).toBe('true');
    expect(tentar.getAttribute('aria-busy')).toBe('true');
    await p.responderAConsultaDasUnidades([reitoria]);
    expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
  });

  it('4xx mostra o alerta sem toast', async () => {
    p = await CenarioDaPaginaDeUnidades.abrir();
    p.store.recarregar();
    await p.propagar();
    p.http
      .expectOne((r) => r.url === LISTA)
      .flush(...problema(403, { code: 'uniplus.auth.forbidden' }));
    await p.propagar();

    expect(p.elemento('ui-alert .list-state__retry button')).toBeTruthy();
    expect(p.erros).not.toHaveBeenCalled();
  });

  it('as ações das linhas ficam indisponíveis enquanto a lista recarrega', async () => {
    p = await CenarioDaPaginaDeUnidades.abrir();
    p.store.recarregar();
    await p.propagar();

    expect(p.editar().matches(':disabled')).toBe(true);
    expect(p.remover().matches(':disabled')).toBe(true);
    expect(p.nomeDoNo(reitoria).matches(':disabled')).toBe(true);
    p.http.expectOne((r) => r.url === LISTA).flush([reitoria]);
    await p.propagar();
    expect(p.editar().matches(':disabled')).toBe(false);
  });
});
