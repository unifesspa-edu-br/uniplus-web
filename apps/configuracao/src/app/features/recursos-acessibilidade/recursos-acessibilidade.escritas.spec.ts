import {
  criado,
  ESCRITA,
  falhaInterna,
  ledor,
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

  describe('concorrência entre escritas', () => {
    it('não inicia outra escrita durante o salvamento nem durante a recarga que o segue', async () => {
      await pagina.preencher();
      pagina.edicao.salvar();
      pagina.edicao.salvar();
      pagina.edicao.pedirRemocao(ledor);
      pagina.edicao.removerConfirmado();
      pagina.controller.expectNone(URL_LEDOR);
      pagina.controller.expectOne(ESCRITA).flush(...criado);
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
      pagina.edicao.form.setValue({ nome: 'Sala', codigo: 'SALA', descricao: '' });
      pagina.edicao.salvar();
      pagina.edicao.removerConfirmado();
      pagina.edicao.abrirCadastro();
      pagina.controller.expectNone(ESCRITA);
      pagina.controller.expectNone(URL_LEDOR);
      delecao.flush(...semConteudo);
      await pagina.concluirRecarga([]);
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

    it('"Tentar novamente" bem-sucedido tira o alerta e leva o foco ao título da lista', async () => {
      pagina.store.tentarNovamente();
      await pagina.propagar();
      pagina.controller
        .expectOne((r) => r.url === LISTA)
        .flush(null, { status: 500, statusText: 'Erro' });
      await pagina.propagar();
      pagina.retentar().focus();
      pagina.retentar().click();
      await pagina.propagar();
      await pagina.listar([ledor]);
      await pagina.aguardarFoco();
      expect(pagina.raiz().querySelector('.list-state__retry')).toBeNull();
      expect(document.activeElement).toBe(pagina.elemento(TITULO));
    });
  });

  describe('foco depois da recarga', () => {
    it('a edição concluída notifica e devolve o foco ao botão da linha', async () => {
      pagina.acaoDaLinha('Editar').click();
      await pagina.propagar();
      pagina.edicao.salvar();
      pagina.controller.expectOne(URL_LEDOR).flush(...semConteudo);
      await pagina.concluirRecarga();
      expect(pagina.sucesso).toHaveBeenCalledExactlyOnceWith(
        'Recurso de acessibilidade atualizado',
      );
      expect(pagina.erroDoServidor).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(pagina.acaoDaLinha('Editar'));
    });

    it('a edição concluída, com falha na recarga, leva o foco ao título da lista', async () => {
      pagina.acaoDaLinha('Editar').click();
      await pagina.propagar();
      pagina.edicao.salvar();
      pagina.controller.expectOne(URL_LEDOR).flush(...semConteudo);
      await pagina.propagar();
      pagina.controller
        .expectOne((r) => r.url === LISTA)
        .flush(null, { status: 500, statusText: 'Erro' });
      await pagina.aguardarFoco();
      expect(document.activeElement).toBe(pagina.elemento(TITULO));
    });

    it('o cadastro concluído notifica e devolve o foco ao botão de novo recurso', async () => {
      await pagina.preencher();
      pagina.edicao.salvar();
      pagina.controller.expectOne(ESCRITA).flush(...criado);
      await pagina.concluirRecarga();
      expect(pagina.sucesso).toHaveBeenCalledExactlyOnceWith('Recurso de acessibilidade criado');
      expect(document.activeElement).toBe(pagina.novo());
    });
  });
});
