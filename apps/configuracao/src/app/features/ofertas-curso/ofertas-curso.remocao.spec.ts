import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ERRO_INTERNO,
  ESCRITA,
  LISTA,
  NAO_ENCONTRADA,
  Pagina,
  SEM_PERMISSAO,
  TITULO_DA_LISTA,
  criado,
  montarPagina,
  oferta,
  problema,
  sucesso,
} from './ofertas-curso.testing';

describe('OfertasCursoPage — remoção, foco e leituras', () => {
  let p: Pagina;

  beforeEach(async () => {
    p = await montarPagina();
  });
  afterEach(() => p.encerrar());

  const mensagemDoDialogo = (): string | undefined =>
    p.elemento('cfg-confirmacao-de-remocao .field__error').textContent?.trim();

  describe('ao remover', () => {
    it('recusa por falta de permissão (403) mantém o diálogo, a mensagem e o foco no botão, sem toast', async () => {
      const primeira = await p.confirmarRemocao();
      primeira.flush(...problema(403, { code: SEM_PERMISSAO }));
      await p.propagar();

      expect(mensagemDoDialogo()).toBe('Falha');
      expect(p.edicao.confirmando()).toBe(true);
      expect(p.confirmar().getAttribute('aria-disabled')).toBeNull();
      expect(document.activeElement).toBe(p.confirmar());
      expect(p.elemento('cfg-confirmacao-de-remocao [role="status"]').textContent).toContain(
        'Não foi possível remover a oferta de curso ENG-CIV — Engenharia Civil.',
      );
      expect(p.erros).not.toHaveBeenCalled();
      expect(p.sucessos).not.toHaveBeenCalled();

      p.confirmar().click();
      await p.propagar();
      p.http.expectOne(`${ESCRITA}/${oferta.id}`).flush(...sucesso());
      await p.recarregarCom([]);
      expect(p.edicao.confirmando()).toBe(false);
      expect(p.sucessos).toHaveBeenCalledWith('Oferta de curso removida');
    });

    it('falha 5xx mantém o diálogo com a mensagem, avisa por toast e aceita nova tentativa', async () => {
      (await p.confirmarRemocao()).flush(...problema(500, { code: ERRO_INTERNO }));
      await p.propagar();

      expect(mensagemDoDialogo()).toBe('Falha');
      expect(p.erros).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(p.confirmar());
      p.cancelarDaConfirmacao().click();
      await p.propagar();
      expect(document.activeElement).toBe(p.remover());
    });

    it('oferta já removida (404) mantém o diálogo, sem toast', async () => {
      (await p.confirmarRemocao()).flush(...problema(404, { code: NAO_ENCONTRADA }));
      await p.propagar();

      expect(mensagemDoDialogo()).toBe('Falha');
      expect(p.erros).not.toHaveBeenCalled();
    });

    it('a recusa anterior some ao pedir a remoção de novo', async () => {
      (await p.confirmarRemocao()).flush(...problema(403, { code: SEM_PERMISSAO }));
      await p.propagar();
      p.cancelarDaConfirmacao().click();
      await p.propagar();

      p.remover().click();
      await p.propagar();
      expect(p.edicao.erroDaRemocao()).toBeNull();
      expect(p.edicao.anuncioDaRemocao()).toBe('');
    });
  });

  describe('foco depois da escrita', () => {
    it('edição concluída com a linha na recarga devolve o foco ao botão de editar', async () => {
      await p.abrirEdicao();
      (await p.enviar(`${ESCRITA}/${oferta.id}`)).flush(...sucesso());
      await p.recarregarCom([oferta]);
      expect(document.activeElement).toBe(p.editar());
    });

    it('cancelar a edição devolve o foco ao botão que abriu o drawer', async () => {
      await p.abrirEdicao();
      p.elemento<HTMLButtonElement>('.form-drawer__footer button').click();
      await p.propagar();
      expect(document.activeElement).toBe(p.editar());
    });

    it('cadastro concluído devolve o foco ao botão de nova oferta', async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush(...criado());
      await p.recarregarCom([oferta]);
      expect(document.activeElement).toBe(p.novo());
    });

    it('remoção concluída leva o foco ao título quando a linha some da recarga', async () => {
      (await p.confirmarRemocao()).flush(...sucesso());
      await p.recarregarCom([]);
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('escrita com falha na recarga leva o foco ao título da lista', async () => {
      (await p.confirmarRemocao()).flush(...sucesso());
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA).flush(...problema(503));
      await p.propagar();
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('cancelar a confirmação devolve o foco ao botão de remover da linha', async () => {
      p.remover().focus();
      p.remover().click();
      await p.propagar();
      p.cancelarDaConfirmacao().click();
      await p.propagar();
      expect(document.activeElement).toBe(p.remover());
    });
  });

  describe('falha de leitura', () => {
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
      expect(tentar.getAttribute('aria-disabled')).toBe('true');
      expect(tentar.getAttribute('aria-busy')).toBe('true');
      await p.recarregarCom([oferta]);
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('4xx mostra o alerta sem toast', async () => {
      p.store.recarregar();
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA).flush(...problema(403, { code: SEM_PERMISSAO }));
      await p.propagar();
      expect(p.elemento('ui-alert .list-state__retry button')).toBeTruthy();
      expect(p.erros).not.toHaveBeenCalled();
    });
  });
});
