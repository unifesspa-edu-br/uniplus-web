import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TipoEtapaFormularioComponent } from './tipo-etapa-formulario.component';
import {
  ESCRITA,
  LISTA,
  Pagina,
  analiseDocumental,
  criado,
  montarPagina,
  problema,
  prova,
  recusaDeCampo,
  sucesso,
} from './tipos-etapa.testing';

describe('TiposEtapaPage — escritas pela interface', () => {
  let p: Pagina;

  beforeEach(async () => {
    p = await montarPagina([prova, analiseDocumental]);
  });
  afterEach(() => p.http.verify());

  const drawer = (): HTMLDialogElement =>
    p.elemento('dialog[aria-label="Formulário de tipo de etapa"]');
  const submeter = (): void => {
    p.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
  };

  describe('gravação pendente', () => {
    it('deixa o formulário somente leitura, com foco no botão, sem fechar por Cancelar, X nem Esc', async () => {
      await p.abrirCadastro();
      const post = await p.enviar();
      const botao = p.salvar();

      expect(p.campo('codigo').matches(':disabled')).toBe(true);
      expect(p.campo('codigo').value).toBe('NOVA_PROVA');
      expect(botao.getAttribute('aria-disabled')).toBe('true');
      expect(botao.getAttribute('aria-busy')).toBe('true');
      expect(botao.textContent).toContain('Salvando...');
      expect(document.activeElement).toBe(botao);
      expect(drawer().querySelector('[role="status"]')?.textContent).toContain('Salvando');
      expect(
        drawer().querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled,
      ).toBe(true);
      const cancelar = [
        ...p.fixture.nativeElement.querySelectorAll('.form-drawer__footer button'),
      ].find((b) => (b as HTMLElement).textContent?.trim() === 'Cancelar') as HTMLButtonElement;
      expect(cancelar.matches(':disabled')).toBe(true);
      drawer().dispatchEvent(new Event('cancel', { cancelable: true }));
      await p.propagar();
      expect(p.edicao.aberto()).toBe(true);

      post.flush(...criado());
      await p.recarregarCom([prova]);
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
      await p.recarregarCom([prova]);
    });

    it('a submissão repetida nem chega a pedir o salvamento ao formulário', async () => {
      await p.abrirCadastro();
      const pedidos: string[] = [];
      p.fixture.debugElement
        .query(By.directive(TipoEtapaFormularioComponent))
        .componentInstance.salvar.subscribe(() => pedidos.push('salvar'));
      const post = await p.enviar();
      expect(pedidos).toEqual(['salvar']);

      submeter();
      await p.propagar();

      expect(pedidos).toEqual(['salvar']);
      post.flush(...criado());
      await p.recarregarCom([prova]);
    });

    it('o salvamento não se apresenta como remoção, nem durante a espera pela recarga', async () => {
      await p.abrirCadastro();
      const post = await p.enviar();
      expect(p.edicao.salvando()).toBe(true);
      expect(p.edicao.removendo()).toBe(false);
      expect(p.elemento('cfg-tipos-etapa-lista').textContent).not.toContain('Removendo');

      post.flush(...criado());
      await p.propagar();
      expect(p.edicao.gravando()).toBe(true);
      expect(p.edicao.removendo()).toBe(false);
      expect(p.elemento('cfg-tipos-etapa-lista').textContent).not.toContain('Removendo');
      await p.recarregarCom([prova]);
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
      await p.recarregarCom([prova]);
    });

    it('não abre outro editor nem fecha o drawer enquanto grava', async () => {
      await p.abrirEdicao(prova);
      p.preencher('nome', 'Prova revisada');
      const put = await p.enviar(`${ESCRITA}/${prova.id}`);

      p.edicao.abrirEdicao(analiseDocumental);
      p.edicao.fechar();
      await p.propagar();
      expect(p.campo('codigo').value).toBe('PROVA');
      expect(p.edicao.aberto()).toBe(true);

      put.flush(...sucesso());
      await p.recarregarCom([prova, analiseDocumental]);
      expect(p.edicao.aberto()).toBe(false);
    });
  });

  describe('campo desabilitado por regra de negócio', () => {
    it.each(['sucesso', 'recusa'] as const)('continua desabilitado após %s', async (desfecho) => {
      await p.abrirCadastro();
      p.edicao.form.controls.descricao.disable();
      const post = await p.enviar();
      expect(p.edicao.form.controls.descricao.disabled).toBe(true);

      if (desfecho === 'sucesso') post.flush(...criado());
      else post.flush(...recusaDeCampo('Nome', 'Nome recusado.'));
      await p.propagar();

      expect(p.edicao.form.controls.descricao.disabled).toBe(true);
      expect(p.edicao.form.controls.nome.enabled).toBe(true);
      expect(p.campo('descricao').matches(':disabled')).toBe(true);
      if (desfecho === 'sucesso') await p.recarregarCom([prova]);
    });
  });

  describe('remoção pendente', () => {
    it('anuncia o andamento, rotula a linha e deixa os acionadores indisponíveis', async () => {
      const del = await p.confirmarRemocao(prova);

      expect(p.edicao.removendo()).toBe(true);
      expect(p.edicao.salvando()).toBe(false);
      expect(p.fixture.nativeElement.textContent).toContain('Removendo...');
      expect(p.elemento('cfg-confirmacao-de-remocao [role="status"]').textContent).toContain(
        'Removendo o tipo de etapa PROVA.',
      );
      for (const botao of [p.novo(), p.editar(prova), p.remover(prova)]) {
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
      await p.recarregarCom([analiseDocumental]);
      expect(p.edicao.gravando()).toBe(false);
    });

    it('não fecha por Cancelar, X nem Esc, e o segundo clique não envia', async () => {
      const del = await p.confirmarRemocao(prova);
      const dialogo = p.elemento<HTMLDialogElement>('cfg-confirmacao-de-remocao dialog');

      expect(p.cancelarDaConfirmacao().matches(':disabled')).toBe(true);
      expect(
        dialogo.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled,
      ).toBe(true);
      dialogo.dispatchEvent(new Event('cancel', { cancelable: true }));
      p.confirmar().click();
      await p.propagar();
      expect(p.edicao.confirmando()).toBe(true);
      p.http.expectNone(`${ESCRITA}/${prova.id}`);

      del.flush(...sucesso());
      await p.recarregarCom([analiseDocumental]);
    });

    it('"Tentar novamente" fica indisponível com a leitura falha enquanto remove', async () => {
      const del = await p.confirmarRemocao(prova);
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
      await p.recarregarCom([analiseDocumental]);
    });
  });

  describe('chamadas concorrentes', () => {
    it('salvar durante a gravação, remover durante o salvamento e salvar durante a remoção não geram requisição', async () => {
      await p.abrirCadastro();
      p.edicao.salvar();
      p.edicao.salvar();
      p.edicao.pedirRemocao(prova);
      p.edicao.removerConfirmado();
      p.http.expectNone(`${ESCRITA}/${prova.id}`);
      p.http.expectOne(ESCRITA).flush(...criado());
      await p.propagar();

      p.edicao.abrirCadastro();
      p.edicao.salvar();
      p.http.expectNone(ESCRITA);
      await p.recarregarCom([prova]);

      p.edicao.pedirRemocao(prova);
      p.edicao.removerConfirmado();
      p.edicao.salvar();
      p.http.expectNone(ESCRITA);
      p.http.expectOne(`${ESCRITA}/${prova.id}`).flush(...sucesso());
      await p.recarregarCom([analiseDocumental]);
    });

    it('confirmar sem ter pedido a remoção não envia nada', () => {
      p.edicao.removerConfirmado();
      p.http.expectNone((r) => r.method === 'DELETE');
    });
  });

  describe('recarga depois da escrita', () => {
    it('mantém as ações indisponíveis até a lista refletir o que foi gravado', async () => {
      await p.abrirEdicao(prova);
      (await p.enviar(`${ESCRITA}/${prova.id}`)).flush(...sucesso());
      await p.propagar();

      expect(p.edicao.salvando()).toBe(false);
      expect(p.edicao.gravando()).toBe(true);
      expect(p.editar(prova).matches(':disabled')).toBe(true);
      await p.recarregarCom([prova]);
      expect(p.edicao.gravando()).toBe(false);
      expect(p.editar(prova).matches(':disabled')).toBe(false);
    });

    it.each(['salvar', 'remover'] as const)(
      'libera as ações e permite nova leitura se a recarga após %s falhar',
      async (operacao) => {
        if (operacao === 'salvar') {
          await p.abrirCadastro();
          (await p.enviar()).flush(...criado());
        } else {
          (await p.confirmarRemocao(prova)).flush(...sucesso());
        }
        await p.propagar();
        p.http.expectOne((r) => r.url === LISTA).flush(...problema(503));
        await p.propagar();

        expect(p.edicao.gravando()).toBe(false);
        const tentar = p.elemento<HTMLButtonElement>('ui-alert .list-state__retry button');
        expect(tentar.getAttribute('aria-disabled')).toBeNull();
        tentar.click();
        await p.propagar();
        await p.recarregarCom([prova]);
        expect(p.store.mensagemDeErro()).toBeNull();
      },
    );
  });
});
