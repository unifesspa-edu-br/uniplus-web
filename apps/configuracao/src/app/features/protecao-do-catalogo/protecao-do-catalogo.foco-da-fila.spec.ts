import { TestBed } from '@angular/core/testing';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtecaoDoCatalogoStore } from './protecao-do-catalogo.store';
import {
  SEM_CONTEUDO,
  URL_DA_FILA,
  botaoPorTexto,
  clicar,
  laudo,
  montarPagina,
  problema,
  type PaginaMontada,
} from './protecao-do-catalogo.testing';

const APROVAR = 'configuracao:protecao-do-catalogo:aprovar';
const ERRO_INTERNO = problema(500, 'uniplus.internal.unexpected', 'Erro interno');

describe('ProtecaoDoCatalogoPage — foco e leitura da fila depois da decisão', () => {
  let pagina: PaginaMontada;
  let avisoDeErro: MockInstance<NotificationService['errorFromProblem']>;

  beforeEach(async () => {
    pagina = montarPagina([APROVAR]);
    const avisos = TestBed.inject(NotificationService);
    avisoDeErro = vi.spyOn(avisos, 'errorFromProblem');
    await pagina.carregarFila([laudo]);
  });

  afterEach(() => pagina.encerrar());

  const drawer = (): HTMLDialogElement =>
    pagina.tela.querySelector('dialog[aria-label^="Detalhe do item"]') as HTMLDialogElement;
  const umaPostagem = () =>
    pagina.controller.expectOne((r) => r.method === 'POST' && r.url === URL_DA_FILA);
  const leituraDaFila = () =>
    pagina.controller.expectOne((r) => r.method === 'GET' && r.url === URL_DA_FILA);
  const tituloDaFila = (): HTMLElement =>
    pagina.tela.querySelector('#cfg-protecao-titulo') as HTMLElement;

  async function abrirComAprovacaoPendente() {
    await pagina.abrirDetalhe();
    clicar(botaoPorTexto(drawer(), 'Aprovar'));
    await pagina.assentar();
    const aprovar = botaoPorTexto(
      pagina.tela.querySelector('ui-dialog') as HTMLElement,
      'Aprovar item',
    );
    aprovar.focus();
    clicar(aprovar);
    await pagina.assentar();
    return { aprovar, envio: umaPostagem() };
  }

  describe('foco depois da recarga', () => {
    it('recarga que falha depois do sucesso deixa o foco no título e oferece nova tentativa', async () => {
      const { envio } = await abrirComAprovacaoPendente();

      envio.flush(null, SEM_CONTEUDO);
      await pagina.assentar();
      leituraDaFila().flush(...ERRO_INTERNO);
      await pagina.assentar();
      await pagina.assentar();

      expect(document.activeElement).toBe(tituloDaFila());
      expect(botaoPorTexto(pagina.tela, 'Tentar novamente')).toBeDefined();
      expect(avisoDeErro).toHaveBeenCalledTimes(1);
    });

    it('não toma o foco de quem o levou a outro controle durante a recarga', async () => {
      const { envio } = await abrirComAprovacaoPendente();
      envio.flush(null, SEM_CONTEUDO);
      await pagina.assentar();
      const outro = document.createElement('button');
      document.body.appendChild(outro);
      outro.focus();

      leituraDaFila().flush([]);
      await pagina.assentar();
      await pagina.assentar();

      expect(document.activeElement).toBe(outro);
      outro.remove();
    });
  });

  describe('"Tentar novamente" da fila', () => {
    it('fica indisponível enquanto a decisão grava e a leitura falha, e volta a funcionar depois', async () => {
      const { envio } = await abrirComAprovacaoPendente();
      pagina.fixture.debugElement.injector.get(ProtecaoDoCatalogoStore).carregar();
      await pagina.assentar();
      leituraDaFila().flush(...ERRO_INTERNO);
      await pagina.assentar();
      const tentar = botaoPorTexto(pagina.tela, 'Tentar novamente');

      expect(tentar.getAttribute('aria-disabled')).toBe('true');
      expect(tentar.matches(':disabled')).toBe(false);
      clicar(tentar);
      await pagina.assentar();
      pagina.controller.expectNone((r) => r.method === 'GET' && r.url === URL_DA_FILA);

      envio.flush(null, SEM_CONTEUDO);
      await pagina.assentar();
      leituraDaFila().flush([]);
      await pagina.assentar();
    });

    it('que dá certo leva o foco, que estava no botão, ao título da fila', async () => {
      pagina.fixture.debugElement.injector.get(ProtecaoDoCatalogoStore).carregar();
      await pagina.assentar();
      leituraDaFila().flush(...ERRO_INTERNO);
      await pagina.assentar();
      const tentar = botaoPorTexto(pagina.tela, 'Tentar novamente');
      tentar.focus();
      clicar(tentar);
      await pagina.assentar();
      await pagina.assentar();
      expect(tentar.getAttribute('aria-busy')).toBe('true');
      expect(document.activeElement).toBe(tentar);

      leituraDaFila().flush([laudo]);
      await pagina.assentar();
      await pagina.assentar();

      expect(document.activeElement).toBe(tituloDaFila());
    });

    it('do detalhe leva o foco à região dos dados do item', async () => {
      clicar(pagina.tela.querySelector(`td button[aria-label="Ver o detalhe de ${laudo.nome}"]`));
      await pagina.assentar();
      pagina.controller
        .expectOne(`${URL_DA_FILA}/tipos-documento/${laudo.id}`)
        .flush(...ERRO_INTERNO);
      await pagina.assentar();
      const tentar = botaoPorTexto(drawer(), 'Tentar novamente');
      tentar.focus();
      clicar(tentar);
      await pagina.assentar();
      await pagina.assentar();
      expect(tentar.getAttribute('aria-disabled')).toBe('true');

      pagina.controller.expectOne(`${URL_DA_FILA}/tipos-documento/${laudo.id}`).flush({
        ...laudo,
        descricao: 'Laudo',
        fato: null,
        tipoDocumento: null,
        atos: [],
        manifestacoesVigentes: [],
      });
      await pagina.assentar();
      await pagina.assentar();

      expect(document.activeElement?.id).toBe('cfg-protecao-dados-do-item');
    });
  });

  describe('avisos da leitura da fila', () => {
    it('erro do servidor na releitura avisa uma vez', async () => {
      pagina.fixture.debugElement.injector.get(ProtecaoDoCatalogoStore).carregar();
      await pagina.assentar();
      leituraDaFila().flush(...ERRO_INTERNO);
      await pagina.assentar();

      expect(avisoDeErro).toHaveBeenCalledTimes(1);
    });

    it('recusa 4xx na releitura não avisa por toast nem oferece nova tentativa, só no alerta da tela', async () => {
      pagina.fixture.debugElement.injector.get(ProtecaoDoCatalogoStore).carregar();
      await pagina.assentar();
      leituraDaFila().flush(...problema(403, 'uniplus.auth.proibido', 'Sem permissão'));
      await pagina.assentar();

      expect(avisoDeErro).not.toHaveBeenCalled();
      expect(pagina.tela.textContent).toContain('Sem permissão');
      expect(pagina.tela.textContent).not.toContain('Tentar novamente');
    });
  });
});
