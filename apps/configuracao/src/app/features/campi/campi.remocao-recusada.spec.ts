import { LISTA_URL, ESCRITA_URL, campusSeed, PaginaDeCampi } from './campi.testing';
import { TestBed } from '@angular/core/testing';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

/** Escritas de campi atravessando os componentes da página: cliques e digitação, como o operador. */
describe('CampiPage — escritas pela interface', () => {
  let pagina: PaginaDeCampi;

  beforeEach(async () => {
    pagina = await PaginaDeCampi.montar();
  });

  afterEach(() => pagina.controller.verify());

  describe('remoção recusada', () => {
    let erroDoServidor: MockInstance<NotificationService['errorFromProblem']>;
    beforeEach(() => {
      erroDoServidor = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
    });

    async function recusarRemocao(status: number, code: string, title: string): Promise<void> {
      await pagina.pedirRemocao();
      pagina.controller
        .expectOne(`${ESCRITA_URL}/${campusSeed.id}`)
        .flush(JSON.stringify({ type: 'about:blank', title, status, code }), {
          status,
          statusText: 'Erro',
          headers: { 'content-type': 'application/problem+json' },
        });
      await pagina.propagar();
    }

    it('mantém o diálogo aberto com a recusa e o botão disponível para nova tentativa', async () => {
      const titulo = 'Não é possível remover um campus responsável por locais de oferta ativos';
      await recusarRemocao(
        409,
        'uniplus.configuracao.campus.remocao_bloqueada_por_local_oferta',
        titulo,
      );

      expect(erroDoServidor).not.toHaveBeenCalled();
      expect(pagina.elemento('cfg-confirmacao-de-remocao dialog').hasAttribute('open')).toBe(true);
      expect(pagina.elemento('cfg-confirmacao-de-remocao .field__error').textContent?.trim()).toBe(
        titulo,
      );
      expect(pagina.elemento('cfg-confirmacao-de-remocao [role="status"]').textContent).toContain(
        'Não foi possível remover o campus MARABA.',
      );
      const confirmar = pagina.elemento('[data-testid="confirm-dialog-confirm"]');
      expect(confirmar.getAttribute('aria-disabled')).toBeNull();
      confirmar.click();
      pagina.controller.expectOne(`${ESCRITA_URL}/${campusSeed.id}`).flush(null, {
        status: 204,
        statusText: 'No Content',
      });
      await pagina.propagar();
      pagina.controller.expectOne((r) => r.url === LISTA_URL).flush([]);
    });

    it('com 500, notifica o servidor com o título resolvido', async () => {
      await recusarRemocao(500, 'uniplus.internal.unexpected', 'Falha ao remover');

      expect(erroDoServidor).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ status: 500, code: 'uniplus.internal.unexpected' }),
        { title: 'Falha ao remover' },
      );
    });

    it('a recusa não aparece ao abrir a confirmação de novo', async () => {
      await recusarRemocao(500, 'uniplus.internal.unexpected', 'Falha ao remover');
      pagina.edicao.confirmando.set(false);
      pagina.edicao.pedirRemocao(campusSeed);
      await pagina.propagar();

      expect(
        pagina.fixture.nativeElement.querySelector('cfg-confirmacao-de-remocao .field__error'),
      ).toBeNull();
    });
  });
});
