import {
  falhaInterna,
  LISTA,
  semConteudo,
  TITULO,
  URL_LEDOR,
  RECURSOS,
  type PaginaDeRecursos,
} from './recursos-acessibilidade.testing';
import {
  PaginaDeCadastro,
  problema,
} from '../../shared/cadastro-em-teste/pagina-de-cadastro.testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Recursos de acessibilidade — escritas pela interface', () => {
  let pagina: PaginaDeRecursos;

  beforeEach(async () => {
    pagina = await PaginaDeCadastro.montar(RECURSOS);
  });

  afterEach(() => pagina.controller.verify());

  describe('remoção', () => {
    it('o pedido de remoção nomeia o recurso na confirmação', async () => {
      await pagina.pedirRemocao();
      expect(pagina.elemento('ui-dialog').textContent).toMatch(
        /Você está prestes a remover o recurso\s+Ledor\./u,
      );
      expect(pagina.elemento('ui-dialog strong').textContent).toBe('Ledor.');
      pagina.confirmar().click();
      await pagina.propagar();
      pagina.controller.expectOne(URL_LEDOR).flush(...semConteudo);
      await pagina.concluirRecarga([]);
    });

    it('pendente, anuncia o andamento, mantém o botão ocupado e deixa a tela indisponível', async () => {
      await pagina.confirmarRemocao();
      const delecao = pagina.controller.expectOne(URL_LEDOR);
      expect(pagina.edicao.removendo()).toBe(true);
      expect(pagina.edicao.salvando()).toBe(false);
      expect(pagina.elemento('ui-dialog [role="status"]').textContent).toContain(
        'Removendo o recurso de acessibilidade Ledor.',
      );
      expect(pagina.confirmar().getAttribute('aria-disabled')).toBe('true');
      expect(pagina.confirmar().getAttribute('aria-busy')).toBe('true');
      expect(document.activeElement).toBe(pagina.confirmar());
      expect(
        pagina.elementoDaPagina().querySelector('tr span[aria-hidden="true"]')?.textContent,
      ).toContain('Removendo');
      for (const botao of pagina
        .elementoDaPagina()
        .querySelectorAll<HTMLButtonElement>('cfg-recursos-acessibilidade-lista button')) {
        expect(botao.matches(':disabled'), botao.textContent ?? '').toBe(true);
      }
      expect(pagina.indisponivel('[data-testid="confirm-dialog-cancel"]')).toBe(true);
      pagina.novo().click();
      expect(pagina.edicao.aberto()).toBe(false);
      delecao.flush(...semConteudo);
      await pagina.propagar();
      expect(pagina.edicao.gravando()).toBe(true);
      await pagina.concluirRecarga([]);
      expect(pagina.edicao.gravando()).toBe(false);
    });

    it('concluída, notifica o sucesso, anuncia o resultado na página e leva o foco ao título da lista', async () => {
      await pagina.confirmarRemocao();
      pagina.controller.expectOne(URL_LEDOR).flush(...semConteudo);
      await pagina.concluirRecarga([]);
      expect(pagina.edicao.confirmando()).toBe(false);
      expect(pagina.sucesso).toHaveBeenCalledExactlyOnceWith('Recurso de acessibilidade removido');
      expect(pagina.erroDoServidor).not.toHaveBeenCalled();
      expect(pagina.elemento(':scope > [role="status"]').textContent).toBe(
        'Recurso de acessibilidade Ledor removido.',
      );
      expect(document.activeElement).toBe(pagina.elemento(TITULO));
    });

    it('concluída com a falha da recarga, leva o foco ao título da lista', async () => {
      await pagina.confirmarRemocao();
      pagina.controller.expectOne(URL_LEDOR).flush(...semConteudo);
      await pagina.propagar();
      pagina.controller
        .expectOne((r) => r.url === LISTA)
        .flush(null, { status: 500, statusText: 'Erro' });
      await pagina.aguardarFoco();
      expect(pagina.edicao.gravando()).toBe(false);
      expect(document.activeElement).toBe(pagina.elemento(TITULO));
    });

    it.each([
      [
        '404',
        problema(
          404,
          'uniplus.configuracao.recurso_acessibilidade.nao_encontrado',
          'Recurso de acessibilidade não encontrado',
        ),
        'Recurso de acessibilidade não encontrado',
      ],
      ['500', falhaInterna, 'Erro interno'],
    ])(
      'recusada (%s), mantém o diálogo aberto com o motivo, o foco no botão e aceita nova tentativa',
      async (nome, resposta, motivo) => {
        await pagina.confirmarRemocao();
        await pagina.responder(URL_LEDOR, resposta);
        expect(pagina.edicao.confirmando()).toBe(true);
        if (nome === '500') {
          expect(pagina.erroDoServidor).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({ title: motivo }),
            { title: motivo },
          );
        } else {
          expect(pagina.erroDoServidor).not.toHaveBeenCalled();
        }
        expect(pagina.sucesso).not.toHaveBeenCalled();
        expect(pagina.elemento('ui-dialog .field__error').textContent).toBe(motivo);
        expect(pagina.elemento('ui-dialog [role="status"]').textContent).toContain(motivo);
        expect(pagina.confirmar().getAttribute('aria-disabled')).toBeNull();
        expect(document.activeElement).toBe(pagina.confirmar());
        expect(pagina.edicao.gravando()).toBe(false);
        pagina.confirmar().click();
        await pagina.propagar();
        expect(pagina.elementoDaPagina().querySelector('ui-dialog .field__error')).toBeNull();
        pagina.controller.expectOne(URL_LEDOR).flush(...semConteudo);
        await pagina.concluirRecarga([]);
      },
    );

    it('o "Tentar novamente" da listagem fica indisponível com a remoção pendente', async () => {
      await pagina.confirmarRemocao();
      const delecao = pagina.controller.expectOne(URL_LEDOR);
      pagina.store.tentarNovamente();
      await pagina.propagar();
      pagina.controller
        .expectOne((r) => r.url === LISTA)
        .flush(null, { status: 500, statusText: 'Erro' });
      await pagina.propagar();
      expect(pagina.retentar().getAttribute('aria-disabled')).toBe('true');
      pagina.retentar().click();
      pagina.controller.expectNone((r) => r.url === LISTA);
      delecao.flush(...semConteudo);
      await pagina.propagar();
      pagina.controller.expectOne((r) => r.url === LISTA).flush([]);
      await pagina.aguardarFoco();
    });
  });
});
