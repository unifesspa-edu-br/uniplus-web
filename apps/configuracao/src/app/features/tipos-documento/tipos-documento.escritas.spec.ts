import { afterEach, describe, expect, it } from 'vitest';
import {
  ESCRITA,
  LISTA,
  Pagina,
  TITULO_DA_LISTA,
  criado,
  laudo,
  montarPagina,
  problema,
  recusaDeCampo,
  rg,
  sucesso,
} from './tipos-documento.testing';

const NAO_ENCONTRADO = {
  code: 'uniplus.configuracao.tipo_documento.nao_encontrado',
  title: 'Tipo de documento não encontrado',
};

describe('TiposDocumentoPage — escritas', () => {
  let p: Pagina;
  afterEach(() => p.encerrar());

  const dialogo = (): HTMLElement => p.elemento('cfg-confirmacao-de-remocao');

  describe('formulário', () => {
    it('cancelar fecha sem requisição e devolve o foco a "Novo tipo"', async () => {
      p = await montarPagina([rg]);
      await p.acionarNovo();
      const cancelar = [...p.fixture.nativeElement.querySelectorAll('ui-drawer button')].find(
        (b: HTMLElement) => b.textContent?.trim() === 'Cancelar',
      ) as HTMLButtonElement;
      cancelar.click();
      await p.propagar();

      expect(p.edicao.aberto()).toBe(false);
      expect(document.activeElement).toBe(p.novo());
    });

    it('a edição devolve o foco ao botão Editar da linha ao concluir', async () => {
      p = await montarPagina([rg]);
      await p.abrirEdicao(rg);
      p.preencher('nome', 'Registro Geral revisado');
      (await p.enviar(`${ESCRITA}/${rg.id}`)).flush(...sucesso());
      await p.recarregarCom([rg]);

      expect(document.activeElement).toBe(p.editar(rg));
    });

    it('enquanto grava, o salvar fica indisponível e diz "Salvando..."', async () => {
      p = await montarPagina([rg]);
      await p.abrirEdicao(rg);
      const put = await p.enviar(`${ESCRITA}/${rg.id}`);

      const salvar = p.salvar();
      expect(salvar.getAttribute('aria-disabled')).toBe('true');
      expect(salvar.getAttribute('aria-busy')).toBe('true');
      expect(salvar.textContent).toContain('Salvando');
      expect(p.edicao.salvando()).toBe(true);
      const fechar = p.fixture.nativeElement.querySelector(
        'cfg-tipo-documento-formulario button[aria-label="Fechar"]',
      ) as HTMLButtonElement;
      expect(fechar.matches(':disabled')).toBe(true);
      for (const nome of ['codigo', 'nome', 'categoria', 'finalidadeTratamento']) {
        expect(p.campo(nome).matches(':disabled'), nome).toBe(true);
      }
      put.flush(...sucesso());
      await p.recarregarCom([rg]);
      expect(p.edicao.salvando()).toBe(false);
    });

    it('depois da gravação e até a lista voltar, as ações seguem indisponíveis sem dizer "Salvando"', async () => {
      p = await montarPagina([rg]);
      await p.abrirEdicao(rg);
      (await p.enviar(`${ESCRITA}/${rg.id}`)).flush(...sucesso());
      await p.propagar();

      expect(p.edicao.salvando()).toBe(false);
      expect(p.edicao.gravando()).toBe(true);
      expect(p.editar(rg).matches(':disabled')).toBe(true);
      expect(p.remover(rg).matches(':disabled')).toBe(true);
      await p.recarregarCom([rg]);
      expect(p.edicao.gravando()).toBe(false);
      expect(p.editar(rg).matches(':disabled')).toBe(false);
    });

    it('um segundo envio durante a gravação não dispara outra requisição', async () => {
      p = await montarPagina([rg]);
      await p.abrirEdicao(rg);
      const put = await p.enviar(`${ESCRITA}/${rg.id}`);
      p.salvar().click();
      p.edicao.salvar();
      await p.propagar();
      p.http.expectNone((r) => r.url.startsWith(ESCRITA) && r.method !== 'GET');
      put.flush(...sucesso());
      await p.recarregarCom([rg]);
    });
  });

  describe('remoção', () => {
    it('o texto da confirmação cita nome, código e a nota de congelamento dos parâmetros', async () => {
      p = await montarPagina([rg]);
      p.remover(rg).click();
      await p.propagar();

      const texto = dialogo().textContent ?? '';
      expect(texto).toContain('Registro Geral');
      expect(texto).toContain('RG');
      expect(texto).toContain('Editais já publicados que o referenciam não são afetados');
      expect(texto).toContain('parâmetros foram congelados na configuração do edital');
      expect(texto).not.toMatch(/inativ/i);
    });

    it('cancelar a confirmação não remove e devolve o foco ao botão da linha', async () => {
      p = await montarPagina([rg]);
      p.remover(rg).focus();
      p.remover(rg).click();
      await p.propagar();
      p.cancelarDaConfirmacao().click();
      await p.propagar();

      p.http.expectNone(`${ESCRITA}/${rg.id}`);
      expect(document.activeElement).toBe(p.remover(rg));
    });

    it('confirmar remove, anuncia, relê a lista e leva o foco ao título quando a linha some', async () => {
      p = await montarPagina([rg, laudo]);
      p.remover(rg).focus();
      p.remover(rg).click();
      await p.propagar();
      p.confirmar().click();
      await p.propagar();
      const del = p.http.expectOne(`${ESCRITA}/${rg.id}`);
      expect(del.request.method).toBe('DELETE');
      del.flush(...sucesso());
      await p.recarregarCom([laudo]);

      expect(p.sucessos).toHaveBeenCalledWith('Tipo de documento removido', 'RG');
      expect(p.statusDaPagina()).toBe('Tipo de documento RG removido.');
      expect(p.fixture.nativeElement.textContent).not.toContain('Registro Geral');
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('o 404 mantém o diálogo com a recusa e sem toast', async () => {
      p = await montarPagina([rg]);
      p.remover(rg).click();
      await p.propagar();
      p.confirmar().click();
      await p.propagar();
      p.http.expectOne(`${ESCRITA}/${rg.id}`).flush(...problema(404, NAO_ENCONTRADO));
      await p.propagar();

      expect(dialogo().textContent).toContain('Tipo de documento não encontrado');
      expect(p.erros).not.toHaveBeenCalled();
      expect(p.sucessos).not.toHaveBeenCalled();
    });

    it('o 5xx mantém o diálogo com a recusa e avisa também por toast', async () => {
      p = await montarPagina([rg]);
      p.remover(rg).click();
      await p.propagar();
      p.confirmar().click();
      await p.propagar();
      p.http.expectOne(`${ESCRITA}/${rg.id}`).flush(...problema(503, { title: 'Indisponível' }));
      await p.propagar();

      expect(dialogo().textContent).toContain('Indisponível');
      expect(p.erros).toHaveBeenCalledTimes(1);
      expect(p.edicao.confirmando()).toBe(true);
    });

    const indisponivel = (b: HTMLButtonElement): boolean =>
      b.matches(':disabled') || b.getAttribute('aria-disabled') === 'true';
    const iniciarRemocao = async () => {
      p.remover(rg).click();
      await p.propagar();
      p.confirmar().click();
      await p.propagar();
      return p.http.expectOne(`${ESCRITA}/${rg.id}`);
    };

    it('com a remoção em curso, a lista anuncia e todo acionador fica indisponível e inerte', async () => {
      p = await montarPagina([rg, laudo]);
      const del = await iniciarRemocao();

      expect(p.edicao.removendo()).toBe(true);
      expect(p.edicao.gravando()).toBe(true);
      expect(p.edicao.salvando()).toBe(false);
      expect(p.elemento('.list-state__loading').textContent).toContain('Removendo');
      const acionadores = [
        p.novo(),
        p.editar(rg),
        p.remover(rg),
        p.editar(laudo),
        p.remover(laudo),
      ];
      for (const botao of acionadores) {
        expect(indisponivel(botao), botao.getAttribute('aria-label') ?? 'Novo tipo').toBe(true);
        botao.click();
      }
      await p.propagar();
      expect(p.edicao.aberto()).toBe(false);
      expect(p.edicao.confirmando()).toBe(true);
      p.http.expectNone(`${ESCRITA}/${laudo.id}`);

      del.flush(...sucesso());
      await p.recarregarCom([laudo]);
      expect(p.edicao.gravando()).toBe(false);
      expect(indisponivel(p.editar(laudo))).toBe(false);
    });

    it('"Tentar novamente" fica indisponível com a leitura em falha enquanto remove', async () => {
      p = await montarPagina([rg]);
      const del = await iniciarRemocao();
      p.store.recarregar();
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA).flush(...problema(503));
      await p.propagar();

      const tentar = p.elemento<HTMLButtonElement>('ui-alert .list-state__retry button');
      expect(tentar.getAttribute('aria-disabled')).toBe('true');
      tentar.click();
      await p.propagar();
      p.http.expectNone((r) => r.url === LISTA);

      del.flush(...sucesso());
      await p.recarregarCom([]);
    });
  });

  describe('campo desabilitado por regra de negócio', () => {
    it.each(['sucesso', 'recusa'] as const)('continua desabilitado após %s', async (desfecho) => {
      p = await montarPagina([]);
      await p.abrirCadastro();
      p.edicao.form.controls.descricao.disable();
      const post = await p.enviar();
      expect(p.edicao.form.controls.descricao.disabled).toBe(true);

      if (desfecho === 'sucesso') post.flush(...criado());
      else post.flush(...recusaDeCampo('nome', 'Nome recusado.'));
      await p.propagar();

      expect(p.edicao.form.controls.descricao.disabled).toBe(true);
      expect(p.edicao.form.controls.nome.enabled).toBe(true);
      if (desfecho === 'recusa') {
        expect(p.campo('descricao').matches(':disabled')).toBe(true);
      } else {
        await p.recarregarCom([rg]);
      }
    });
  });
});
