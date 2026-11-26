import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LISTA,
  NAO_ENCONTRADA,
  Pagina,
  TITULO_DA_LISTA,
  inscricaoHomologacao,
  montarPagina,
  problema,
} from './precedencias-fase.testing';

describe('PrecedenciasFasePage — falha de leitura da lista', () => {
  let p: Pagina;

  beforeEach(async () => {
    p = await montarPagina();
  });
  afterEach(() => p.http.verify());

  it('5xx avisa por toast e oferece "Tentar novamente", que devolve o foco ao título', async () => {
    p.store.recarregar();
    await p.propagar();
    p.http.expectOne((r) => r.url === LISTA).flush(...problema(503));
    await p.propagar();
    expect(p.erros).toHaveBeenCalledTimes(1);

    const tentar = p.elemento<HTMLButtonElement>('ui-alert .list-state__retry button');
    tentar.focus();
    tentar.click();
    await p.propagar();
    await p.recarregarCom([inscricaoHomologacao]);
    expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
  });

  it('4xx mostra o alerta sem toast', async () => {
    p.store.recarregar();
    await p.propagar();
    p.http.expectOne((r) => r.url === LISTA).flush(...problema(404, NAO_ENCONTRADA));
    await p.propagar();
    expect(p.elemento('ui-alert .list-state__retry button')).toBeTruthy();
    expect(p.erros).not.toHaveBeenCalled();
  });
});
