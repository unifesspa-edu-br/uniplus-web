import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CODIGO_PROTECAO_MUDOU,
  URL_DA_FILA,
  botaoPorTexto,
  clicar,
  laudo,
  montarPagina,
  problema,
  type PaginaMontada,
  compilarPaginaUmaVez,
} from './protecao-do-catalogo.testing';

const APROVAR = 'configuracao:protecao-do-catalogo:aprovar';

describe('ProtecaoDoCatalogoPage — recusa com causa geral', () => {
  beforeAll(compilarPaginaUmaVez);
  let pagina: PaginaMontada;

  beforeEach(async () => {
    pagina = montarPagina([APROVAR]);
    await pagina.carregarFila([laudo]);
  });

  afterEach(() => pagina.encerrar());

  it('a causa geral do código que relê a fila é mostrada e a fila é relida', async () => {
    await pagina.abrirDetalhe();
    const drawer = pagina.tela.querySelector('dialog[aria-label^="Detalhe do item"]');
    clicar(botaoPorTexto(drawer as HTMLElement, 'Aprovar'));
    await pagina.assentar();
    const dialogo = pagina.tela.querySelector('ui-dialog') as HTMLElement;
    clicar(botaoPorTexto(dialogo, 'Aprovar item'));
    await pagina.assentar();
    const envio = pagina.controller.expectOne((r) => r.method === 'POST' && r.url === URL_DA_FILA);

    envio.flush(
      JSON.stringify({
        ...JSON.parse(problema(409, CODIGO_PROTECAO_MUDOU, 'A proteção do item mudou')[0]),
        errors: [{ code: CODIGO_PROTECAO_MUDOU, message: 'Outra pessoa alterou a proteção.' }],
      }),
      problema(409, CODIGO_PROTECAO_MUDOU, 'x')[1],
    );
    await pagina.assentar();
    pagina.controller.expectOne((r) => r.method === 'GET' && r.url === URL_DA_FILA).flush([laudo]);
    await pagina.assentar();

    expect(pagina.tela.textContent).toContain('Outra pessoa alterou a proteção.');
  });
});
