import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ESCRITA,
  LISTA,
  TITULO_DA_LISTA,
  banca,
  montarPaginaDeRecusas,
  problema,
  sucesso,
  type PaginaDeRecusas,
} from './tipos-banca.recusas.testing';

describe('TiposBancaPage — remoção com recusa e foco', () => {
  let p: PaginaDeRecusas;

  beforeEach(async () => {
    p = await montarPaginaDeRecusas();
  });
  afterEach(() => p.controller.verify());

  describe('diálogo de remoção', () => {
    it('pendente: o botão mantém o foco, indisponível; Cancelar e X recusados; Esc não fecha', async () => {
      const requisicao = await p.confirmarRemocao();
      expect(document.activeElement).toBe(p.confirmar());
      expect(p.confirmar().getAttribute('aria-disabled')).toBe('true');
      expect(p.confirmar().getAttribute('aria-busy')).toBe('true');
      expect(p.botaoDoDialogo('Cancelar').matches(':disabled')).toBe(true);
      expect(p.botaoDoDialogo('Fechar').matches(':disabled')).toBe(true);
      p.elemento('cfg-confirmacao-de-remocao dialog').dispatchEvent(
        new Event('cancel', { cancelable: true }),
      );
      await p.propagar();
      expect(p.edicao.confirmando()).toBe(true);
      expect(p.elemento('cfg-confirmacao-de-remocao [role="status"]').textContent).toContain(
        'Removendo',
      );
      p.confirmar().click();
      p.controller.expectNone(ESCRITA);
      requisicao.flush(...sucesso());
      await p.recarregarCom([]);
    });

    it.each([409, 500])(
      'recusa %s mantém o diálogo aberto com o foco no botão, a mensagem e o botão disponível de novo',
      async (status) => {
        const primeira = await p.confirmarRemocao();
        primeira.flush(...problema(status, { code: 'uniplus.idempotency.processing_conflict' }));
        await p.propagar();
        expect(p.edicao.confirmando()).toBe(true);
        expect(p.elemento('cfg-confirmacao-de-remocao .field__error').textContent).toContain(
          p.edicao.erroRemocao(),
        );
        expect(p.elemento('cfg-confirmacao-de-remocao [role="status"]').textContent).toContain(
          'Não foi possível remover',
        );
        expect(p.confirmar().getAttribute('aria-disabled')).toBeNull();
        expect(document.activeElement).toBe(p.confirmar());
        expect(p.statusDaPagina()).toBe('');
        p.confirmar().click();
        await p.propagar();
        expect(
          p.fixture.nativeElement.querySelector('cfg-confirmacao-de-remocao .field__error'),
        ).toBeNull();
        p.controller.expectOne(ESCRITA).flush(...sucesso());
        await p.recarregarCom([]);
        expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
      },
    );

    it('remoção concluída com a linha ausente da recarga leva o foco ao título da lista', async () => {
      (await p.confirmarRemocao()).flush(...sucesso());
      await p.propagar();
      expect(p.edicao.gravando()).toBe(true);
      expect(p.edicao.confirmando()).toBe(false);
      await p.recarregarCom([]);
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
      expect(p.statusDaPagina()).toBe(`Tipo de banca ${banca.codigo.codigo} removido.`);
    });

    it('remoção concluída com falha na recarga leva o foco ao título da lista', async () => {
      (await p.confirmarRemocao()).flush(...sucesso());
      await p.propagar();
      p.controller
        .expectOne((r) => r.url === LISTA)
        .flush(...problema(503, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('cancelar a confirmação devolve o foco à lixeira da linha', async () => {
      p.lixeira().focus();
      p.lixeira().click();
      await p.propagar();
      p.botaoDoDialogo('Cancelar').click();
      await p.propagar();
      expect(document.activeElement).toBe(p.lixeira());
    });
  });
});
