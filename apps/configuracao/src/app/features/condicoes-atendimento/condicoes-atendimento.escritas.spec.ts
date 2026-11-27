import {
  ESCRITA,
  falhaInterna,
  ledor,
  LISTA,
  URL_LEDOR,
  CONDICOES,
  type PaginaDeCondicoes,
} from './condicoes-atendimento.testing';
import {
  PaginaDeCadastro,
  problema,
} from '../../shared/cadastro-em-teste/pagina-de-cadastro.testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Condições de atendimento — escritas pela interface', () => {
  let pagina: PaginaDeCondicoes;

  beforeEach(async () => {
    pagina = await PaginaDeCadastro.montar(CONDICOES);
  });

  afterEach(() => pagina.controller.verify());

  describe('concorrência entre escritas', () => {
    it('não inicia outra escrita durante o salvamento nem durante a recarga que o segue', async () => {
      await pagina.preencher();
      pagina.edicao.salvar();
      pagina.edicao.salvar();
      pagina.edicao.pedirRemocao(ledor);
      pagina.edicao.removerConfirmado();
      pagina.controller.expectNone(URL_LEDOR);
      pagina.controller.expectOne(ESCRITA).flush('id', { status: 201, statusText: 'Created' });
      await pagina.propagar();
      expect(pagina.edicao.gravando()).toBe(true);
      expect(pagina.edicao.salvando()).toBe(false);
      pagina.edicao.salvar();
      pagina.edicao.abrirCadastro();
      pagina.edicao.abrirEdicao(ledor);
      pagina.edicao.pedirRemocao(ledor);
      pagina.edicao.removerConfirmado();
      pagina.controller.expectNone(ESCRITA);
      pagina.controller.expectNone(URL_LEDOR);
      await pagina.concluirRecarga();
      expect(pagina.edicao.gravando()).toBe(false);
    });

    it('não inicia salvamento nem outra remoção durante uma remoção', async () => {
      await pagina.confirmarRemocao();
      const delecao = pagina.controller.expectOne(URL_LEDOR);
      pagina.edicao.form.setValue({ codigo: 'DISLEXIA', nome: 'Dislexia', descricao: '' });
      pagina.edicao.salvar();
      pagina.edicao.removerConfirmado();
      pagina.edicao.abrirCadastro();
      pagina.controller.expectNone(ESCRITA);
      pagina.controller.expectNone(URL_LEDOR);
      delecao.flush(null, { status: 204, statusText: 'No Content' });
      await pagina.concluirRecarga([]);
    });
  });

  describe('remoção', () => {
    it('o pedido de remoção nomeia a condição em negrito e mostra o código', async () => {
      await pagina.pedirRemocao();
      expect(pagina.elemento('ui-dialog').textContent).toMatch(
        /Você está prestes a remover a condição\s+LEDOR\s+—\s+Ledor\./u,
      );
      expect(pagina.elemento('ui-dialog strong').textContent).toBe('Ledor.');
      expect(pagina.elemento('ui-dialog code').textContent).toBe('LEDOR');
    });

    it('pendente, anuncia o andamento, mantém o botão ocupado e deixa a tela indisponível', async () => {
      await pagina.confirmarRemocao();
      const delecao = pagina.controller.expectOne(URL_LEDOR);
      expect(pagina.edicao.removendo()).toBe(true);
      expect(pagina.edicao.salvando()).toBe(false);
      expect(pagina.elemento('ui-dialog [role="status"]').textContent).toContain(
        'Removendo a condição de atendimento Ledor.',
      );
      expect(pagina.confirmar().getAttribute('aria-disabled')).toBe('true');
      expect(pagina.confirmar().getAttribute('aria-busy')).toBe('true');
      expect(document.activeElement).toBe(pagina.confirmar());
      expect(pagina.raiz().querySelector('tr span[aria-hidden="true"]')?.textContent).toContain(
        'Removendo',
      );
      for (const botao of pagina
        .raiz()
        .querySelectorAll<HTMLButtonElement>('cfg-condicoes-atendimento-lista button')) {
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
      pagina.controller.expectOne(URL_LEDOR).flush(null, { status: 204, statusText: 'No Content' });
      await pagina.concluirRecarga([]);
      expect(pagina.edicao.confirmando()).toBe(false);
      expect(pagina.sucesso).toHaveBeenCalledExactlyOnceWith('Condição de atendimento removida');
      expect(pagina.erroDoServidor).not.toHaveBeenCalled();
      expect(pagina.elemento(':scope > [role="status"]').textContent).toBe(
        'Condição de atendimento Ledor removida.',
      );
      expect(document.activeElement).toBe(pagina.elemento('#cfg-condicoes-atendimento-list-title'));
    });

    it('concluída com a falha da recarga, leva o foco ao título da lista', async () => {
      await pagina.confirmarRemocao();
      pagina.controller.expectOne(URL_LEDOR).flush(null, { status: 204, statusText: 'No Content' });
      await pagina.propagar();
      pagina.controller
        .expectOne((r) => r.url === LISTA)
        .flush(null, { status: 500, statusText: 'Erro' });
      await pagina.aguardarFoco();
      expect(pagina.edicao.gravando()).toBe(false);
      expect(document.activeElement).toBe(pagina.elemento('#cfg-condicoes-atendimento-list-title'));
    });

    it.each([
      [
        '409',
        problema(
          409,
          'uniplus.configuracao.condicao_atendimento.remocao_bloqueada_codigo_protegido',
          'A condição reservada não pode ser removida',
        ),
        'A condição reservada não pode ser removida',
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
        expect(pagina.raiz().querySelector('ui-dialog .field__error')).toBeNull();
        pagina.controller
          .expectOne(URL_LEDOR)
          .flush(null, { status: 204, statusText: 'No Content' });
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
      delecao.flush(null, { status: 204, statusText: 'No Content' });
      await pagina.propagar();
      pagina.controller.expectOne((r) => r.url === LISTA).flush([]);
      await pagina.aguardarFoco();
    });
  });

  describe('leitura', () => {
    it('a falha 5xx da listagem notifica com o título resolvido', async () => {
      pagina.store.tentarNovamente();
      await pagina.propagar();
      pagina.controller.expectOne((r) => r.url === LISTA).flush(...falhaInterna);
      await pagina.propagar();
      expect(pagina.erroDoServidor).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ status: 500 }),
        { title: 'Erro interno' },
      );
    });

    it('a falha 4xx da listagem não notifica o servidor', async () => {
      pagina.store.tentarNovamente();
      await pagina.propagar();
      pagina.controller
        .expectOne((r) => r.url === LISTA)
        .flush(...problema(403, 'uniplus.acesso_negado', 'Acesso negado'));
      await pagina.propagar();
      expect(pagina.erroDoServidor).not.toHaveBeenCalled();
    });
  });

  describe('foco depois da recarga', () => {
    it('a edição concluída devolve o foco ao botão da linha', async () => {
      pagina.acaoDaLinha('Editar').click();
      await pagina.propagar();
      pagina.edicao.salvar();
      pagina.controller.expectOne(URL_LEDOR).flush(null, { status: 204, statusText: 'No Content' });
      await pagina.concluirRecarga();
      expect(pagina.sucesso).toHaveBeenCalledExactlyOnceWith('Condição de atendimento atualizada');
      expect(document.activeElement).toBe(pagina.acaoDaLinha('Editar'));
    });

    it('o cadastro concluído devolve o foco ao botão de nova condição', async () => {
      await pagina.preencher();
      pagina.edicao.salvar();
      pagina.controller.expectOne(ESCRITA).flush('id', { status: 201, statusText: 'Created' });
      await pagina.concluirRecarga();
      expect(pagina.sucesso).toHaveBeenCalledExactlyOnceWith('Condição de atendimento criada');
      expect(document.activeElement).toBe(pagina.novo());
    });
  });
});
