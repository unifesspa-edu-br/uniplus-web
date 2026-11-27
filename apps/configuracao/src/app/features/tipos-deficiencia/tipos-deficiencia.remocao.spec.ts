import {
  falhaInterna,
  LISTA,
  semConteudo,
  TITULO,
  URL_VISUAL,
  TIPOS,
  type PaginaDeTiposDeficiencia,
} from './tipos-deficiencia.testing';
import {
  PaginaDeCadastro,
  problema,
} from '../../shared/cadastro-em-teste/pagina-de-cadastro.testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Tipos de deficiência — escritas pela interface', () => {
  let pagina: PaginaDeTiposDeficiencia;

  beforeEach(async () => {
    pagina = await PaginaDeCadastro.montar(TIPOS);
  });

  afterEach(() => pagina.controller.verify());

  describe('remoção', () => {
    it('o pedido de remoção nomeia o tipo na confirmação', async () => {
      await pagina.pedirRemocao();
      expect(pagina.elemento('ui-dialog').textContent).toMatch(
        /Você está prestes a remover o tipo de deficiência\s+VISUAL\s+—\s+Visual\./u,
      );
      expect(pagina.elemento('ui-dialog strong').textContent).toBe('Visual.');
      expect(pagina.elemento('ui-dialog code').textContent).toBe('VISUAL');
      pagina.confirmar().click();
      await pagina.propagar();
      pagina.controller.expectOne(URL_VISUAL).flush(...semConteudo);
      await pagina.concluirRecarga([]);
    });

    it('pendente, anuncia o andamento, mantém o botão ocupado e deixa a tela indisponível', async () => {
      await pagina.confirmarRemocao();
      const delecao = pagina.controller.expectOne(URL_VISUAL);
      expect(pagina.edicao.removendo()).toBe(true);
      expect(pagina.edicao.salvando()).toBe(false);
      expect(pagina.elemento('ui-dialog [role="status"]').textContent).toContain(
        'Removendo o tipo de deficiência Visual.',
      );
      expect(pagina.confirmar().getAttribute('aria-disabled')).toBe('true');
      expect(pagina.confirmar().getAttribute('aria-busy')).toBe('true');
      expect(document.activeElement).toBe(pagina.confirmar());
      expect(
        pagina.elementoDaPagina().querySelector('tr span[aria-hidden="true"]')?.textContent,
      ).toContain('Removendo');
      for (const botao of pagina
        .elementoDaPagina()
        .querySelectorAll<HTMLButtonElement>('cfg-tipos-deficiencia-lista button')) {
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
      pagina.controller.expectOne(URL_VISUAL).flush(...semConteudo);
      await pagina.concluirRecarga([]);
      expect(pagina.edicao.confirmando()).toBe(false);
      expect(pagina.sucesso).toHaveBeenCalledExactlyOnceWith('Tipo de deficiência removido');
      expect(pagina.erroDoServidor).not.toHaveBeenCalled();
      expect(pagina.elemento(':scope > [role="status"]').textContent).toBe(
        'Tipo de deficiência Visual removido.',
      );
      expect(document.activeElement).toBe(pagina.elemento(TITULO));
    });

    it('concluída com a falha da recarga, leva o foco ao título da lista', async () => {
      await pagina.confirmarRemocao();
      pagina.controller.expectOne(URL_VISUAL).flush(...semConteudo);
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
          'uniplus.configuracao.tipo_deficiencia.nao_encontrado',
          'Tipo de deficiência não encontrado',
        ),
        'Tipo de deficiência não encontrado',
      ],
      ['500', falhaInterna, 'Erro interno'],
    ])(
      'recusada (%s), mantém o diálogo aberto com o motivo, o foco no botão e aceita nova tentativa',
      async (nome, resposta, motivo) => {
        await pagina.confirmarRemocao();
        await pagina.responder(URL_VISUAL, resposta);
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
        pagina.controller.expectOne(URL_VISUAL).flush(...semConteudo);
        await pagina.concluirRecarga([]);
      },
    );

    it('o "Tentar novamente" da listagem fica indisponível com a remoção pendente', async () => {
      await pagina.confirmarRemocao();
      const delecao = pagina.controller.expectOne(URL_VISUAL);
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
