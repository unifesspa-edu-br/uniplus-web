import { SituacaoDoProcessoSeletivoCodigo } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  PaginaDePublicacoes,
  ROTA_ATOS,
  item,
  previstos,
  tick,
} from './publicacoes-do-processo.page.testing';

describe('PublicacoesDoProcessoPage — falhas de leitura', () => {
  let pagina: PaginaDePublicacoes;

  beforeEach(() => {
    pagina = new PaginaDePublicacoes();
  });

  afterEach(() => pagina.controller.verify());

  it('a falha do catálogo de tipos oferece tentar de novo e relê só os tipos', async () => {
    await pagina.abrirPublicadoComFalhaEm('tipos');
    expect(pagina.host.textContent).toContain('Sem eles não é possível publicar um documento');

    pagina.botaoDe('Tentar novamente')?.click();
    pagina.fixture.detectChanges();
    pagina.responderTipos();
    await tick();
    await pagina.fixture.whenStable();
    pagina.fixture.detectChanges();
    pagina.fixture.detectChanges();

    expect(pagina.host.textContent).not.toContain('Sem eles não é possível publicar um documento');
  });

  it('a falha da leitura do processo oferece tentar de novo e relê o processo', async () => {
    pagina.iniciar();
    pagina.falharProcesso();
    pagina.controller.expectOne(ROTA_ATOS).flush([]);
    pagina.responderTipos();
    await pagina.fixture.whenStable();
    pagina.fixture.detectChanges();

    const tentar = Array.from(pagina.host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Tentar novamente'),
    );
    expect(tentar).toBeDefined();
    tentar?.click();
    pagina.responderProcesso(SituacaoDoProcessoSeletivoCodigo.RASCUNHO);
    await pagina.fixture.whenStable();
    pagina.fixture.detectChanges();

    expect(pagina.host.textContent).toContain('Medicina 2027');
  });

  it('a falha dos itens do edital oferece tentar de novo e relê só os itens', async () => {
    await pagina.abrirPublicadoComFalhaEm('previstos');
    expect(pagina.host.textContent).toContain('Não foi possível carregar os documentos previstos');

    pagina.botaoDe('Tentar novamente')?.click();
    await tick();
    pagina.responderPrevistos(previstos(item('preliminar')));
    await tick();
    await pagina.fixture.whenStable();
    pagina.fixture.detectChanges();

    expect(pagina.host.textContent).not.toContain(
      'Não foi possível carregar os documentos previstos',
    );
  });
});
