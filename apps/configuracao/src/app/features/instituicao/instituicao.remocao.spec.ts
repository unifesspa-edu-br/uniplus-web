import {
  ESCRITA,
  ID,
  indisponivel,
  LEITURA,
  montarPagina,
  Pagina,
  problema,
  sucesso,
  unifesspa,
} from './instituicao.testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('InstituicaoPage — escritas pela interface', () => {
  let p: Pagina;

  afterEach(() => p.http.verify());

  describe('remoção', () => {
    beforeEach(async () => {
      p = await montarPagina();
    });

    it('pede confirmação nomeando o efeito e remove só depois de confirmada', async () => {
      await p.abrirFormulario();
      p.remover().click();
      await p.propagar();

      expect(p.dialogoDeRemocao().textContent).toContain(
        'libera o cadastro de uma nova Instituição',
      );
      p.http.expectNone((r) => r.method === 'DELETE');
      p.confirmar().click();
      await p.propagar();
      const del = p.http.expectOne(`${ESCRITA}/${ID}`);
      expect(del.request.method).toBe('DELETE');
      del.flush(...sucesso());
      await p.responderLeitura(null);

      expect(p.sucessos).toHaveBeenCalledWith('Instituição removida', 'Unifesspa');
      expect(p.statusDaPagina()).toBe('Instituição Unifesspa removida.');
      expect(p.edicao.aberto()).toBe(false);
      expect(p.edicao.confirmando()).toBe(false);
      expect(p.elemento('ui-empty-state')).toBeTruthy();
    });

    it('depois de removida, devolve o foco ao botão que passou a cadastrar', async () => {
      (await p.confirmarRemocaoPeloFormulario()).flush(...sucesso());
      await p.responderLeitura(null);

      expect(p.acao().textContent).toContain('Cadastrar instituição');
      expect(document.activeElement).toBe(p.acao());
    });

    it('a remoção pendente anuncia o andamento, indisponibiliza os acionadores e não parte duas vezes', async () => {
      const del = await p.confirmarRemocaoPeloFormulario();

      expect(p.edicao.removendo()).toBe(true);
      expect(p.edicao.salvando()).toBe(false);
      expect(p.confirmacao().querySelector('[role="status"]')?.textContent).toContain(
        'Removendo a instituição Unifesspa.',
      );
      expect(p.confirmar().getAttribute('aria-disabled')).toBe('true');
      expect(p.confirmar().getAttribute('aria-busy')).toBe('true');
      expect(document.activeElement).toBe(p.confirmar());
      expect(p.cancelarDaConfirmacao().matches(':disabled')).toBe(true);
      expect(
        p.dialogoDeRemocao().querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')
          ?.disabled,
      ).toBe(true);
      expect(p.remover().matches(':disabled')).toBe(true);
      p.dialogoDeRemocao().dispatchEvent(new Event('cancel', { cancelable: true }));
      p.confirmar().click();
      await p.propagar();
      expect(p.edicao.confirmando()).toBe(true);
      p.http.expectNone(`${ESCRITA}/${ID}`);
      expect(indisponivel(p.acao())).toBe(true);

      del.flush(...sucesso());
      await p.responderLeitura(null);
      expect(p.edicao.gravando()).toBe(false);
    });

    it('"Tentar novamente" fica indisponível com a leitura falha enquanto remove', async () => {
      const del = await p.confirmarRemocaoPeloFormulario();
      p.store.recarregar();
      await p.falharLeitura(503);

      const tentar = p.elemento<HTMLButtonElement>('#cfg-instituicao-tentar-novamente');
      expect(tentar.getAttribute('aria-disabled')).toBe('true');
      tentar.click();
      await p.propagar();
      p.http.expectNone((r) => r.url === LEITURA && r.method === 'GET');

      del.flush(...sucesso());
      await p.responderLeitura(null);
    });

    it('a recusa mantém o diálogo, anuncia o motivo e aceita nova tentativa', async () => {
      (await p.confirmarRemocaoPeloFormulario()).flush(
        ...problema(409, {
          code: 'uniplus.organizacao.instituicao.remocao_recusada',
          title: 'Remoção recusada',
        }),
      );
      await p.propagar();

      expect(p.edicao.confirmando()).toBe(true);
      expect(p.confirmacao().querySelector('.field__error')?.textContent).toContain(
        'Remoção recusada',
      );
      expect(p.confirmacao().querySelector('[role="status"]')?.textContent).toContain(
        'Não foi possível remover a instituição Unifesspa.',
      );
      expect(p.confirmar().getAttribute('aria-disabled')).toBeNull();
      expect(p.erros).not.toHaveBeenCalled();
      p.confirmar().click();
      await p.propagar();
      p.http.expectOne(`${ESCRITA}/${ID}`).flush(...sucesso());
      await p.responderLeitura(null);
    });

    it('o 404 da remoção trata a instituição como já removida: fecha tudo, relê e devolve o foco', async () => {
      (await p.confirmarRemocaoPeloFormulario()).flush(
        ...problema(404, { code: 'uniplus.organizacao.instituicao.nao_encontrada' }),
      );
      await p.propagar();

      expect(p.edicao.confirmando()).toBe(false);
      expect(p.edicao.aberto()).toBe(false);
      expect(p.edicao.erroDaRemocao()).toBeNull();
      expect(p.sucessos).not.toHaveBeenCalled();
      expect(p.erros).not.toHaveBeenCalled();
      expect(p.edicao.gravando()).toBe(true);
      await p.responderLeitura(null);

      expect(p.statusDaPagina()).toBe('Instituição Unifesspa já havia sido removida.');
      expect(p.acao().textContent).toContain('Cadastrar instituição');
      expect(document.activeElement).toBe(p.acao());
    });

    it('a falha 5xx da remoção avisa também por toast', async () => {
      (await p.confirmarRemocaoPeloFormulario()).flush(
        ...problema(500, { code: 'uniplus.internal.unexpected' }),
      );
      await p.propagar();

      expect(p.erros).toHaveBeenCalledTimes(1);
      expect(p.edicao.confirmando()).toBe(true);
    });
  });

  describe('chamadas concorrentes', () => {
    beforeEach(async () => {
      p = await montarPagina();
    });

    it('salvar durante a gravação, remover durante o salvamento e salvar durante a remoção não geram requisição', async () => {
      p.edicao.abrirEdicao(unifesspa);
      p.edicao.salvar();
      p.edicao.salvar();
      p.edicao.pedirRemocao();
      p.edicao.removerConfirmado();
      p.http.expectNone((r) => r.method === 'DELETE');
      p.http
        .expectOne((r) => r.url === `${ESCRITA}/${ID}` && r.method === 'PUT')
        .flush(...sucesso());
      await p.propagar();

      p.edicao.abrirEdicao(unifesspa);
      p.edicao.salvar();
      p.http.expectNone((r) => r.method === 'PUT');
      await p.responderLeitura(unifesspa);

      p.edicao.pedirRemocao();
      p.edicao.removerConfirmado();
      p.edicao.salvar();
      p.http.expectNone((r) => r.method === 'PUT');
      p.http.expectOne(`${ESCRITA}/${ID}`).flush(...sucesso());
      await p.responderLeitura(null);
    });

    it('confirmar sem ter pedido a remoção não envia nada', () => {
      p.edicao.removerConfirmado();
      p.http.expectNone((r) => r.method === 'DELETE');
    });
  });
});
