import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ESCRITA,
  LISTA,
  OFERTAS,
  Pagina,
  REMOCAO_BLOQUEADA,
  TITULO_DA_LISTA,
  direito,
  engCiv,
  montarPagina,
  oferta,
  problema,
  recusaDeCampo,
  sucesso,
} from './cursos.testing';

const BLOQUEIO = 'Não é possível remover um curso referenciado por uma oferta de curso ativa';

describe('CursosPage — remoção, foco e leituras', () => {
  let p: Pagina;

  beforeEach(async () => {
    p = await montarPagina([engCiv, direito]);
  });
  afterEach(() => p.encerrar());

  const mensagemDoDialogo = (): string | undefined =>
    p.elemento('cfg-confirmacao-de-remocao .field__error').textContent?.trim();
  const drawerDeOfertas = (): HTMLElement => p.elemento('cfg-ofertas-do-curso dialog');
  const fecharOfertas = async (): Promise<void> => {
    p.elemento<HTMLButtonElement>('cfg-ofertas-do-curso button[aria-label="Fechar"]').click();
    await p.propagar();
    await p.propagar();
  };

  describe('ao remover', () => {
    it('recusa por falta de permissão (403) mantém o diálogo, a mensagem e o foco no botão, sem toast', async () => {
      const primeira = await p.confirmarRemocao(engCiv);
      primeira.flush(...problema(403, { code: 'uniplus.auth.forbidden' }));
      await p.propagar();

      expect(mensagemDoDialogo()).toBe('Falha');
      expect(p.edicao.confirmando()).toBe(true);
      expect(p.confirmar().getAttribute('aria-disabled')).toBeNull();
      expect(document.activeElement).toBe(p.confirmar());
      expect(p.elemento('cfg-confirmacao-de-remocao [role="status"]').textContent).toContain(
        'Não foi possível remover o curso ENG-CIV.',
      );
      expect(p.erros).not.toHaveBeenCalled();
      expect(p.sucessos).not.toHaveBeenCalled();

      p.confirmar().click();
      await p.propagar();
      p.http.expectOne(`${ESCRITA}/${engCiv.id}`).flush(...sucesso());
      await p.recarregarCom([direito]);
      expect(p.edicao.confirmando()).toBe(false);
      expect(p.sucessos).toHaveBeenCalledWith('Curso removido', 'ENG-CIV');
    });

    it('falha 5xx mantém o diálogo com a mensagem, avisa por toast e aceita nova tentativa', async () => {
      (await p.confirmarRemocao(engCiv)).flush(
        ...problema(500, { code: 'uniplus.internal.unexpected' }),
      );
      await p.propagar();

      expect(mensagemDoDialogo()).toBe('Falha');
      expect(p.erros).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(p.confirmar());
      p.cancelarDaConfirmacao().click();
      await p.propagar();
      expect(document.activeElement).toBe(p.remover(engCiv));
    });

    it('curso já removido (404) mantém o diálogo, sem toast', async () => {
      (await p.confirmarRemocao(engCiv)).flush(
        ...problema(404, { code: 'uniplus.configuracao.curso.nao_encontrado' }),
      );
      await p.propagar();

      expect(mensagemDoDialogo()).toBe('Falha');
      expect(p.erros).not.toHaveBeenCalled();
    });

    it('bloqueio por oferta viva abre as ofertas com o motivo e, ao fechar, devolve o foco à lixeira', async () => {
      (await p.confirmarRemocao(engCiv)).flush(
        ...problema(409, { code: REMOCAO_BLOQUEADA, title: BLOQUEIO }),
      );
      await p.propagar();
      p.http.expectOne((r) => r.url === OFERTAS).flush([oferta]);
      await p.propagar();

      expect(p.edicao.confirmando()).toBe(false);
      expect(p.ofertas.aberto()).toBe(true);
      expect(drawerDeOfertas().textContent).toContain(BLOQUEIO);
      expect(drawerDeOfertas().textContent).toContain('Remova as ofertas abaixo');
      expect(p.erros).not.toHaveBeenCalled();
      expect(p.sucessos).not.toHaveBeenCalled();

      await fecharOfertas();
      expect(p.edicao.gravando()).toBe(false);
      expect(document.activeElement).toBe(p.remover(engCiv));
    });

    it('bloqueio visto sem ofertas na consulta não manda remover ofertas inexistentes', async () => {
      (await p.confirmarRemocao(engCiv)).flush(
        ...problema(409, { code: REMOCAO_BLOQUEADA, title: BLOQUEIO }),
      );
      await p.propagar();
      p.http.expectOne((r) => r.url === OFERTAS).flush([]);
      await p.propagar();

      expect(drawerDeOfertas().textContent).toContain(BLOQUEIO);
      expect(drawerDeOfertas().textContent).not.toContain('Remova as ofertas abaixo');
      expect(drawerDeOfertas().textContent).toContain('Nenhuma oferta ativa foi encontrada agora');
    });

    it('ao fechar as ofertas do bloqueio com a linha já ausente, o foco vai ao título da lista', async () => {
      (await p.confirmarRemocao(engCiv)).flush(
        ...problema(409, { code: REMOCAO_BLOQUEADA, title: BLOQUEIO }),
      );
      await p.propagar();
      p.http.expectOne((r) => r.url === OFERTAS).flush([oferta]);
      await p.propagar();
      p.store.recarregar();
      await p.recarregarCom([direito]);

      await fecharOfertas();
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('ao fechar as ofertas, não toma o foco de quem já o levou a outro controle', async () => {
      p.verOfertas(engCiv).click();
      await p.propagar();
      p.http.expectOne((r) => r.url === OFERTAS).flush([]);
      await p.propagar();
      const outro = document.createElement('button');
      document.body.appendChild(outro);

      p.elemento<HTMLElement>('cfg-ofertas-do-curso dialog').dispatchEvent(new Event('close'));
      outro.focus();
      await p.propagar();
      await p.propagar();

      expect(document.activeElement).toBe(outro);
      outro.remove();
    });

    it('as ofertas abertas pela linha devolvem o foco ao ícone de ofertas', async () => {
      p.verOfertas(direito).focus();
      p.verOfertas(direito).click();
      await p.propagar();
      p.http.expectOne((r) => r.url === OFERTAS).flush([]);
      await p.propagar();
      expect(drawerDeOfertas().textContent).toContain('Este curso não possui ofertas');

      await fecharOfertas();
      expect(document.activeElement).toBe(p.verOfertas(direito));
    });
  });

  describe('foco depois da escrita', () => {
    it('edição concluída com a linha na recarga devolve o foco ao botão de editar', async () => {
      await p.abrirEdicao(engCiv);
      (await p.enviar(`${ESCRITA}/${engCiv.id}`)).flush(...sucesso());
      await p.recarregarCom([engCiv, direito]);
      expect(document.activeElement).toBe(p.editar(engCiv));
    });

    it('cancelar a edição devolve o foco ao botão que abriu o drawer', async () => {
      await p.abrirEdicao(engCiv);
      p.elemento<HTMLButtonElement>('.form-drawer__footer button').click();
      await p.propagar();
      expect(document.activeElement).toBe(p.editar(engCiv));
    });

    it('cadastro concluído devolve o foco ao botão de novo curso', async () => {
      await p.abrirCadastro();
      (await p.enviar()).flush('novo-id', { status: 201, statusText: 'Created' });
      await p.recarregarCom([engCiv, direito]);
      expect(document.activeElement).toBe(p.novo());
    });

    it('remoção concluída leva o foco ao título quando a linha some da recarga', async () => {
      (await p.confirmarRemocao(engCiv)).flush(...sucesso());
      await p.recarregarCom([direito]);
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('escrita com falha na recarga leva o foco ao título da lista', async () => {
      (await p.confirmarRemocao(engCiv)).flush(...sucesso());
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA).flush(...problema(503));
      await p.propagar();
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('cancelar a confirmação devolve o foco ao botão de remover da linha', async () => {
      p.remover(engCiv).focus();
      p.remover(engCiv).click();
      await p.propagar();
      p.cancelarDaConfirmacao().click();
      await p.propagar();
      expect(document.activeElement).toBe(p.remover(engCiv));
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
      await p.recarregarCom([engCiv]);
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('4xx mostra o alerta sem toast', async () => {
      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA)
        .flush(...problema(403, { code: 'uniplus.auth.forbidden' }));
      await p.propagar();
      expect(p.elemento('ui-alert .list-state__retry button')).toBeTruthy();
      expect(p.erros).not.toHaveBeenCalled();
    });

    it('a falha das ofertas avisa por toast só em 5xx, e a nova tentativa devolve o foco ao drawer', async () => {
      p.verOfertas(engCiv).click();
      await p.propagar();
      p.http.expectOne((r) => r.url === OFERTAS).flush(...problema(503));
      await p.propagar();
      expect(p.erros).toHaveBeenCalledTimes(1);

      const tentar = p.elemento<HTMLButtonElement>('#cfg-ofertas-tentar');
      tentar.focus();
      tentar.click();
      await p.propagar();
      expect(tentar.getAttribute('aria-disabled')).toBe('true');
      p.http.expectOne((r) => r.url === OFERTAS).flush([oferta]);
      await p.propagar();
      await p.propagar();

      expect(drawerDeOfertas().textContent).toContain('IGE');
      expect(document.activeElement).toBe(
        p.elemento('cfg-ofertas-do-curso button[aria-label="Fechar"]'),
      );
      expect(p.erros).toHaveBeenCalledTimes(1);
    });

    it('4xx nas ofertas não avisa por toast', async () => {
      p.verOfertas(engCiv).click();
      await p.propagar();
      p.http.expectOne((r) => r.url === OFERTAS).flush(...recusaDeCampo('CursoId', 'Inválido.'));
      await p.propagar();
      expect(p.erros).not.toHaveBeenCalled();
      expect(drawerDeOfertas().textContent).toContain('Não foi possível carregar as ofertas');
    });
  });
});
