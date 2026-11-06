import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UnidadeFormularioComponent } from './unidade-formulario.component';
import {
  ESCRITA,
  LISTA,
  Pagina,
  criado,
  instituto,
  montarPagina,
  problema,
  recusaDeCampo,
  reitoria,
  sucesso,
} from './unidades.testing';

describe('UnidadesPage — escritas pela interface', () => {
  let p: Pagina;

  beforeEach(async () => {
    p = await montarPagina([reitoria, instituto]);
  });
  afterEach(() => p.http.verify());

  const drawer = (): HTMLDialogElement => p.elemento('dialog[aria-label="Formulário de unidade"]');
  const submeter = (): void => {
    p.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
  };
  const cancelar = (): HTMLButtonElement =>
    [...p.fixture.nativeElement.querySelectorAll('.form-drawer__footer button')].find(
      (b) => (b as HTMLElement).textContent?.trim() === 'Cancelar',
    ) as HTMLButtonElement;

  describe('gravação pendente', () => {
    it('deixa o formulário somente leitura, com foco no botão, sem fechar por Cancelar, X nem Esc', async () => {
      await p.abrirCadastro();
      const post = await p.enviar();
      const botao = p.salvar();

      expect(p.campo('sigla').matches(':disabled')).toBe(true);
      expect(p.campo('sigla').value).toBe('NTEC');
      expect(p.elemento('cfg-unidade-superior-campo select').matches(':disabled')).toBe(true);
      expect(botao.getAttribute('aria-disabled')).toBe('true');
      expect(botao.getAttribute('aria-busy')).toBe('true');
      expect(botao.textContent).toContain('Salvando...');
      expect(document.activeElement).toBe(botao);
      expect(drawer().querySelector('[role="status"]')?.textContent).toContain('Salvando');
      expect(
        drawer().querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled,
      ).toBe(true);
      expect(cancelar().matches(':disabled')).toBe(true);
      drawer().dispatchEvent(new Event('cancel', { cancelable: true }));
      await p.propagar();
      expect(p.edicao.aberto()).toBe(true);

      post.flush(...criado());
      await p.recarregarCom([reitoria]);
      expect(p.edicao.aberto()).toBe(false);
    });

    it('clique e submissão repetidos não geram segundo envio', async () => {
      await p.abrirCadastro();
      const post = await p.enviar();
      const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
      p.salvar().dispatchEvent(clique);
      submeter();
      await p.propagar();

      expect(clique.defaultPrevented).toBe(true);
      p.http.expectNone(ESCRITA);
      post.flush(...criado());
      await p.recarregarCom([reitoria]);
    });

    it('a submissão repetida nem chega a pedir o salvamento ao formulário', async () => {
      await p.abrirCadastro();
      const pedidos: string[] = [];
      p.fixture.debugElement
        .query(By.directive(UnidadeFormularioComponent))
        .componentInstance.salvar.subscribe(() => pedidos.push('salvar'));
      const post = await p.enviar();
      expect(pedidos).toEqual(['salvar']);

      submeter();
      await p.propagar();

      expect(pedidos).toEqual(['salvar']);
      post.flush(...criado());
      await p.recarregarCom([reitoria]);
    });

    it('o salvamento não se apresenta como remoção, nem durante a espera pela recarga', async () => {
      await p.abrirCadastro();
      const post = await p.enviar();
      expect(p.edicao.salvando()).toBe(true);
      expect(p.edicao.removendo()).toBe(false);
      expect(p.elemento('cfg-unidades-lista').textContent).not.toContain('Removendo');

      post.flush(...criado());
      await p.propagar();
      expect(p.edicao.gravando()).toBe(true);
      expect(p.edicao.removendo()).toBe(false);
      expect(p.elemento('cfg-unidades-lista').textContent).not.toContain('Removendo');
      await p.recarregarCom([reitoria]);
    });

    it('Enter num campo leva o foco ao botão e, na falha 500, o envio segue disponível', async () => {
      await p.abrirCadastro();
      p.campo('nome').focus();
      submeter();
      await p.propagar();
      const post = p.http.expectOne(ESCRITA);

      expect(p.campo('nome').matches(':disabled')).toBe(true);
      expect(document.activeElement).toBe(p.salvar());
      post.flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();
      await p.propagar();

      expect(p.campo('nome').matches(':disabled')).toBe(false);
      expect(p.elemento('ui-drawer ui-alert').textContent).toContain('Falha');
      expect(document.activeElement).toBe(p.salvar());
      expect(p.salvar().getAttribute('aria-disabled')).toBeNull();
      submeter();
      p.http.expectOne(ESCRITA).flush(...criado());
      await p.recarregarCom([reitoria]);
    });

    it('não abre outro editor nem fecha o drawer enquanto grava', async () => {
      await p.abrirEdicao(reitoria);
      p.preencher('nome', 'Reitoria revisada');
      const put = await p.enviar(`${ESCRITA}/${reitoria.id}`);

      p.edicao.abrirEdicao(instituto);
      p.edicao.fechar();
      await p.propagar();
      expect(p.campo('sigla').value).toBe('REIT');
      expect(p.edicao.aberto()).toBe(true);

      put.flush(...sucesso());
      await p.recarregarCom([reitoria, instituto]);
      expect(p.edicao.aberto()).toBe(false);
    });
  });

  describe('campo desabilitado por regra de negócio', () => {
    it.each(['sucesso', 'recusa'] as const)('continua desabilitado após %s', async (desfecho) => {
      await p.abrirCadastro();
      p.edicao.form.controls.alias.disable();
      const post = await p.enviar();
      expect(p.edicao.form.controls.alias.disabled).toBe(true);

      if (desfecho === 'sucesso') post.flush(...criado());
      else
        post.flush(
          ...recusaDeCampo('nome', 'Nome recusado.', 'uniplus.organizacao.unidade.nome_tamanho'),
        );
      await p.propagar();

      expect(p.edicao.form.controls.alias.disabled).toBe(true);
      expect(p.edicao.form.controls.nome.enabled).toBe(true);
      expect(p.campo('alias').matches(':disabled')).toBe(true);
      if (desfecho === 'sucesso') await p.recarregarCom([reitoria]);
    });
  });

  describe('remoção pendente', () => {
    it('anuncia o andamento e deixa os acionadores indisponíveis', async () => {
      const del = await p.confirmarRemocao(reitoria);

      expect(p.edicao.removendo()).toBe(true);
      expect(p.edicao.salvando()).toBe(false);
      expect(p.fixture.nativeElement.textContent).toContain('Removendo');
      expect(p.elemento('cfg-confirmacao-de-remocao [role="status"]').textContent).toContain(
        'Removendo a unidade REIT.',
      );
      const acionadores = [p.novo(), p.editar(reitoria), p.remover(reitoria)];
      for (const botao of acionadores) {
        expect(botao.matches(':disabled') || botao.getAttribute('aria-disabled') === 'true').toBe(
          true,
        );
        botao.click();
      }
      await p.propagar();
      expect(p.edicao.aberto()).toBe(false);
      expect(p.confirmar().getAttribute('aria-disabled')).toBe('true');
      expect(p.confirmar().getAttribute('aria-busy')).toBe('true');
      expect(document.activeElement).toBe(p.confirmar());

      del.flush(...sucesso());
      await p.propagar();
      expect(p.edicao.gravando()).toBe(true);
      p.novo().click();
      expect(p.edicao.aberto()).toBe(false);
      await p.recarregarCom([instituto]);
      expect(p.edicao.gravando()).toBe(false);
    });

    it('não fecha por Cancelar, X nem Esc, e o segundo clique não envia', async () => {
      const del = await p.confirmarRemocao(reitoria);
      const dialogo = p.elemento<HTMLDialogElement>('cfg-confirmacao-de-remocao dialog');

      expect(p.cancelarDaConfirmacao().matches(':disabled')).toBe(true);
      expect(
        dialogo.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled,
      ).toBe(true);
      dialogo.dispatchEvent(new Event('cancel', { cancelable: true }));
      p.confirmar().click();
      await p.propagar();
      expect(p.edicao.confirmando()).toBe(true);
      p.http.expectNone(`${ESCRITA}/${reitoria.id}`);

      del.flush(...sucesso());
      await p.recarregarCom([instituto]);
    });

    it('"Tentar novamente" fica indisponível com a leitura falha enquanto remove', async () => {
      const del = await p.confirmarRemocao(reitoria);
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
      await p.recarregarCom([instituto]);
    });

    it('a árvore e a busca ficam indisponíveis enquanto grava', async () => {
      const del = await p.confirmarRemocao(reitoria);

      expect(p.elemento('cfg-unidades-filtros').hasAttribute('inert')).toBe(true);
      expect(p.nomeDoNo(reitoria).matches(':disabled')).toBe(true);
      del.flush(...sucesso());
      await p.recarregarCom([instituto]);
      expect(p.elemento('cfg-unidades-filtros').hasAttribute('inert')).toBe(false);
    });
  });

  describe('chamadas concorrentes', () => {
    it('salvar durante a gravação, remover durante o salvamento e salvar durante a remoção não geram requisição', async () => {
      await p.abrirCadastro();
      p.edicao.salvar();
      p.edicao.salvar();
      p.edicao.pedirRemocao(instituto);
      p.edicao.removerConfirmado();
      p.http.expectNone(`${ESCRITA}/${instituto.id}`);
      p.http.expectOne(ESCRITA).flush(...criado());
      await p.propagar();

      p.edicao.abrirCadastro();
      p.edicao.salvar();
      p.http.expectNone(ESCRITA);
      await p.recarregarCom([reitoria, instituto]);

      p.edicao.pedirRemocao(instituto);
      p.edicao.removerConfirmado();
      p.edicao.salvar();
      p.http.expectNone(ESCRITA);
      p.http.expectOne(`${ESCRITA}/${instituto.id}`).flush(...sucesso());
      await p.recarregarCom([reitoria]);
    });

    it('confirmar sem ter pedido a remoção não envia nada', () => {
      p.edicao.removerConfirmado();
      p.http.expectNone((r) => r.method === 'DELETE');
    });
  });

  describe('recarga depois da escrita', () => {
    it('mantém as ações indisponíveis até a lista refletir o que foi gravado', async () => {
      await p.abrirEdicao(reitoria);
      (await p.enviar(`${ESCRITA}/${reitoria.id}`)).flush(...sucesso());
      await p.propagar();

      expect(p.edicao.salvando()).toBe(false);
      expect(p.edicao.gravando()).toBe(true);
      expect(p.editar(reitoria).matches(':disabled')).toBe(true);
      await p.recarregarCom([reitoria]);
      expect(p.edicao.gravando()).toBe(false);
      expect(p.editar(reitoria).matches(':disabled')).toBe(false);
    });

    it.each(['salvar', 'remover'] as const)(
      'libera as ações e permite nova leitura se a recarga após %s falhar',
      async (operacao) => {
        if (operacao === 'salvar') {
          await p.abrirCadastro();
          (await p.enviar()).flush(...criado());
        } else {
          (await p.confirmarRemocao(reitoria)).flush(...sucesso());
        }
        await p.propagar();
        p.http.expectOne((r) => r.url === LISTA).flush(...problema(503));
        await p.propagar();

        expect(p.edicao.gravando()).toBe(false);
        const tentar = p.elemento<HTMLButtonElement>('ui-alert .list-state__retry button');
        expect(tentar.getAttribute('aria-disabled')).toBeNull();
        tentar.click();
        await p.propagar();
        await p.recarregarCom([reitoria]);
        expect(p.store.mensagemDeErro()).toBeNull();
      },
    );
  });
});
