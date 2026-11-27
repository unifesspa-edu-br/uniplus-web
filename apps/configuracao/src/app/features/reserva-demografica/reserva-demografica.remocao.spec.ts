import {
  falhaInterna,
  LISTA,
  naoEncontrada,
  URL_DA_REFERENCIA,
  RESERVA,
  type PaginaDeReservaDemografica,
} from './reserva-demografica.testing';
import { PaginaDeCadastro } from '../../shared/cadastro-em-teste/pagina-de-cadastro.testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Reserva demográfica — escritas pela interface', () => {
  let pagina: PaginaDeReservaDemografica;

  beforeEach(async () => {
    pagina = await PaginaDeCadastro.montar(RESERVA);
  });

  afterEach(() => pagina.controller.verify());

  describe('remoção', () => {
    it('pendente, anuncia o andamento, mantém o botão ocupado e deixa a tela indisponível', async () => {
      await pagina.confirmarRemocao();
      const delecao = pagina.controller.expectOne(URL_DA_REFERENCIA);
      expect(pagina.edicao.removendo()).toBe(true);
      expect(pagina.edicao.salvando()).toBe(false);
      expect(pagina.elemento('ui-dialog [role="status"]').textContent).toContain(
        'Removendo a referência do Censo 2022.',
      );
      expect(pagina.confirmar().getAttribute('aria-disabled')).toBe('true');
      expect(pagina.confirmar().getAttribute('aria-busy')).toBe('true');
      expect(document.activeElement).toBe(pagina.confirmar());
      expect(
        pagina.elementoDaPagina().querySelector('tr span[aria-hidden="true"]')?.textContent,
      ).toContain('Removendo');
      for (const botao of pagina
        .elementoDaPagina()
        .querySelectorAll<HTMLButtonElement>('cfg-reserva-demografica-lista button')) {
        expect(botao.matches(':disabled'), botao.textContent ?? '').toBe(true);
      }
      expect(pagina.indisponivel('[data-testid="confirm-dialog-cancel"]')).toBe(true);
      pagina.novo().click();
      expect(pagina.edicao.aberto()).toBe(false);
      delecao.flush(null, { status: 204, statusText: 'No Content' });
      await pagina.propagar();
      expect(pagina.edicao.gravando()).toBe(true);
      await pagina.concluirRecarga([]);
      expect(pagina.edicao.gravando()).toBe(false);
    });

    it('concluída, anuncia o resultado na página e leva o foco ao título da lista', async () => {
      await pagina.confirmarRemocao();
      pagina.controller
        .expectOne(URL_DA_REFERENCIA)
        .flush(null, { status: 204, statusText: 'No Content' });
      await pagina.concluirRecarga([]);
      expect(pagina.edicao.confirmando()).toBe(false);
      expect(pagina.sucesso).toHaveBeenCalledExactlyOnceWith('Referência removida', '2022');
      expect(pagina.erroDoServidor).not.toHaveBeenCalled();
      expect(pagina.elemento(':scope > [role="status"]').textContent).toBe(
        'Referência do Censo 2022 removida.',
      );
      expect(document.activeElement).toBe(pagina.elemento('#cfg-reserva-list-title'));
    });

    it('concluída com a falha da recarga, leva o foco ao título da lista', async () => {
      await pagina.confirmarRemocao();
      pagina.controller
        .expectOne(URL_DA_REFERENCIA)
        .flush(null, { status: 204, statusText: 'No Content' });
      await pagina.propagar();
      pagina.controller
        .expectOne((r) => r.url === LISTA)
        .flush(null, { status: 500, statusText: 'Erro' });
      await pagina.aguardarFoco();
      expect(pagina.edicao.gravando()).toBe(false);
      expect(document.activeElement).toBe(pagina.elemento('#cfg-reserva-list-title'));
    });

    it('recusada (404), mantém o diálogo aberto com o motivo e o foco no botão, sem notificar', async () => {
      await pagina.confirmarRemocao();
      await pagina.responder(URL_DA_REFERENCIA, naoEncontrada);
      expect(pagina.edicao.confirmando()).toBe(true);
      expect(pagina.erroDoServidor).not.toHaveBeenCalled();
      expect(pagina.sucesso).not.toHaveBeenCalled();
      expect(pagina.elemento('ui-dialog .field__error').textContent).toBe(
        'Referência de reserva demográfica não encontrada',
      );
      expect(pagina.elemento('ui-dialog [role="status"]').textContent).toContain(
        'Referência de reserva demográfica não encontrada',
      );
      expect(pagina.confirmar().getAttribute('aria-disabled')).toBeNull();
      expect(document.activeElement).toBe(pagina.confirmar());
      expect(pagina.edicao.gravando()).toBe(false);
    });

    it('recusada por falha do servidor (500), notifica, mantém o diálogo aberto e aceita nova tentativa', async () => {
      await pagina.confirmarRemocao();
      await pagina.responder(URL_DA_REFERENCIA, falhaInterna);
      expect(pagina.edicao.confirmando()).toBe(true);
      expect(pagina.erroDoServidor).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ status: 500 }),
        { title: 'Não foi possível remover a referência' },
      );
      expect(pagina.sucesso).not.toHaveBeenCalled();
      expect(pagina.elemento('ui-dialog .field__error').textContent).toBe('Erro interno');
      expect(document.activeElement).toBe(pagina.confirmar());
      pagina.confirmar().click();
      await pagina.propagar();
      expect(pagina.elementoDaPagina().querySelector('ui-dialog .field__error')).toBeNull();
      pagina.controller
        .expectOne(URL_DA_REFERENCIA)
        .flush(null, { status: 204, statusText: 'No Content' });
      await pagina.concluirRecarga([]);
    });

    it('o "Tentar novamente" da listagem fica indisponível com a remoção pendente', async () => {
      await pagina.confirmarRemocao();
      const delecao = pagina.controller.expectOne(URL_DA_REFERENCIA);
      pagina.store.tentarNovamente();
      await pagina.propagar();
      pagina.controller
        .expectOne((r) => r.url === LISTA)
        .flush(null, { status: 500, statusText: 'Erro' });
      await pagina.propagar();
      expect(pagina.retentar().getAttribute('aria-disabled')).toBe('true');
      pagina.retentar().click();
      pagina.controller.expectNone((r) => r.url === LISTA);
      delecao.flush(null, { status: 204, statusText: 'No Content' });
      await pagina.propagar();
      pagina.controller.expectOne((r) => r.url === LISTA).flush([]);
      await pagina.aguardarFoco();
    });
  });
});
