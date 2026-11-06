import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CursoFormularioComponent } from './curso-formulario.component';
import {
  ESCRITA,
  LISTA,
  Pagina,
  criado,
  direito,
  engCiv,
  montarPagina,
  problema,
  recusaDeCampo,
  sucesso,
} from './cursos.testing';

describe('CursosPage — escritas pela interface', () => {
  let p: Pagina;

  beforeEach(async () => {
    p = await montarPagina([engCiv, direito]);
  });
  afterEach(() => p.encerrar());

  const drawer = (): HTMLDialogElement => p.elemento('dialog[aria-label="Formulário de curso"]');
  const submeter = (): void => {
    p.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
  };
  const cancelarDoFormulario = (): HTMLButtonElement =>
    [...p.fixture.nativeElement.querySelectorAll('.form-drawer__footer button')].find(
      (b) => (b as HTMLElement).textContent?.trim() === 'Cancelar',
    ) as HTMLButtonElement;

  it('identifica os campos obrigatórios de input nativo para tecnologias assistivas', async () => {
    await p.abrirCadastro();
    for (const campo of ['codigo', 'nome', 'grau', 'nivelEnsino']) {
      expect(p.campo(campo).getAttribute('aria-required')).toBe('true');
    }
    expect(p.campo('grupoAreaEnem').getAttribute('aria-required')).toBeNull();
  });

  describe('gravação pendente', () => {
    it('deixa o formulário somente leitura, com foco no botão, sem fechar por Cancelar, X nem Esc', async () => {
      await p.abrirCadastro();
      const post = await p.enviar();
      const botao = p.salvar();

      expect(p.campo('codigo').matches(':disabled')).toBe(true);
      expect(p.campo('codigo').value).toBe('DIR');
      expect(botao.getAttribute('aria-disabled')).toBe('true');
      expect(botao.getAttribute('aria-busy')).toBe('true');
      expect(botao.textContent).toContain('Salvando...');
      expect(document.activeElement).toBe(botao);
      expect(drawer().querySelector('[role="status"]')?.textContent).toContain('Salvando');
      expect(
        drawer().querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled,
      ).toBe(true);
      expect(cancelarDoFormulario().matches(':disabled')).toBe(true);
      drawer().dispatchEvent(new Event('cancel', { cancelable: true }));
      await p.propagar();
      expect(p.edicao.aberto()).toBe(true);

      post.flush(...criado());
      await p.recarregarCom([engCiv]);
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
      await p.recarregarCom([engCiv]);
    });

    it('a submissão repetida nem chega a pedir o salvamento ao formulário', async () => {
      await p.abrirCadastro();
      const pedidos: string[] = [];
      p.fixture.debugElement
        .query(By.directive(CursoFormularioComponent))
        .componentInstance.salvar.subscribe(() => pedidos.push('salvar'));
      const post = await p.enviar();
      expect(pedidos).toEqual(['salvar']);

      submeter();
      await p.propagar();

      expect(pedidos).toEqual(['salvar']);
      post.flush(...criado());
      await p.recarregarCom([engCiv]);
    });

    it('o salvamento não se apresenta como remoção, nem durante a espera pela recarga', async () => {
      await p.abrirCadastro();
      const post = await p.enviar();
      expect(p.edicao.salvando()).toBe(true);
      expect(p.edicao.removendo()).toBe(false);
      expect(p.elemento('cfg-cursos-lista').textContent).not.toContain('Removendo');

      post.flush(...criado());
      await p.propagar();
      expect(p.edicao.gravando()).toBe(true);
      expect(p.edicao.removendo()).toBe(false);
      expect(p.elemento('cfg-cursos-lista').textContent).not.toContain('Removendo');
      await p.recarregarCom([engCiv]);
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
      await p.recarregarCom([engCiv]);
    });

    it('outra edição não abre enquanto o envio corre', async () => {
      await p.abrirEdicao(engCiv);
      p.preencher('nome', 'Engenharia Civil revisada');
      const put = await p.enviar(`${ESCRITA}/${engCiv.id}`);

      p.edicao.abrirEdicao(direito);
      p.edicao.abrirCadastro();
      expect(p.campo('codigo').value).toBe('ENG-CIV');

      put.flush(...sucesso());
      await p.recarregarCom([engCiv]);
    });
  });

  describe('remoção pendente', () => {
    it('anuncia o andamento e deixa os acionadores indisponíveis, sem virar salvamento', async () => {
      const del = await p.confirmarRemocao(engCiv);

      expect(p.edicao.removendo()).toBe(true);
      expect(p.edicao.salvando()).toBe(false);
      expect(p.elemento('.panel-head').textContent).toContain('Removendo');
      expect(p.elemento('cfg-confirmacao-de-remocao [role="status"]').textContent).toContain(
        'Removendo o curso ENG-CIV.',
      );
      for (const botao of [p.novo(), p.editar(engCiv), p.remover(engCiv), p.verOfertas(engCiv)]) {
        expect(botao.matches(':disabled') || botao.getAttribute('aria-disabled') === 'true').toBe(
          true,
        );
        botao.click();
      }
      await p.propagar();
      expect(p.edicao.aberto()).toBe(false);
      expect(p.ofertas.aberto()).toBe(false);
      expect(p.confirmar().getAttribute('aria-disabled')).toBe('true');
      expect(p.confirmar().getAttribute('aria-busy')).toBe('true');
      expect(document.activeElement).toBe(p.confirmar());

      del.flush(...sucesso());
      await p.propagar();
      expect(p.edicao.gravando()).toBe(true);
      await p.recarregarCom([direito]);
      expect(p.edicao.gravando()).toBe(false);
      expect(p.statusDaPagina()).toBe('Curso ENG-CIV removido.');
      expect(p.novo().getAttribute('aria-disabled')).toBeNull();
    });

    it('não fecha por Cancelar, X nem Esc, e o segundo clique não envia', async () => {
      const del = await p.confirmarRemocao(engCiv);
      const dialogo = p.elemento<HTMLDialogElement>('cfg-confirmacao-de-remocao dialog');

      expect(p.cancelarDaConfirmacao().matches(':disabled')).toBe(true);
      expect(
        dialogo.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled,
      ).toBe(true);
      dialogo.dispatchEvent(new Event('cancel', { cancelable: true }));
      p.confirmar().click();
      await p.propagar();
      expect(p.edicao.confirmando()).toBe(true);
      p.http.expectNone(`${ESCRITA}/${engCiv.id}`);

      del.flush(...sucesso());
      await p.recarregarCom([direito]);
    });

    it('"Tentar novamente" fica indisponível com a leitura falha enquanto remove', async () => {
      const del = await p.confirmarRemocao(engCiv);
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
      await p.recarregarCom([direito]);
    });
  });

  describe('chamadas concorrentes', () => {
    it('salvar durante a gravação, remover durante o salvamento e salvar durante a remoção não geram requisição', async () => {
      await p.abrirCadastro();
      p.edicao.salvar();
      p.edicao.salvar();
      p.edicao.pedirRemocao(engCiv);
      p.edicao.removerConfirmado();
      p.http.expectNone(`${ESCRITA}/${engCiv.id}`);
      p.http.expectOne(ESCRITA).flush(...criado());
      await p.propagar();

      p.edicao.abrirCadastro();
      p.edicao.salvar();
      p.http.expectNone(ESCRITA);
      await p.recarregarCom([engCiv]);

      p.edicao.pedirRemocao(engCiv);
      p.edicao.removerConfirmado();
      p.edicao.salvar();
      p.http.expectNone(ESCRITA);
      p.http.expectOne(`${ESCRITA}/${engCiv.id}`).flush(...sucesso());
      await p.recarregarCom([direito]);
    });

    it('confirmar sem ter pedido a remoção não envia nada', () => {
      p.edicao.removerConfirmado();
      p.http.expectNone((r) => r.method === 'DELETE');
    });
  });

  describe('recarga depois da escrita', () => {
    it('mantém as ações indisponíveis até a lista refletir o que foi gravado', async () => {
      await p.abrirEdicao(engCiv);
      (await p.enviar(`${ESCRITA}/${engCiv.id}`)).flush(...sucesso());
      await p.propagar();

      expect(p.edicao.salvando()).toBe(false);
      expect(p.edicao.gravando()).toBe(true);
      expect(p.editar(engCiv).matches(':disabled')).toBe(true);
      await p.recarregarCom([engCiv]);
      expect(p.edicao.gravando()).toBe(false);
      expect(p.editar(engCiv).matches(':disabled')).toBe(false);
    });

    it.each(['salvar', 'remover'] as const)(
      'libera as ações e permite nova leitura se a recarga após %s falhar',
      async (operacao) => {
        if (operacao === 'salvar') {
          await p.abrirCadastro();
          (await p.enviar()).flush(...criado());
        } else {
          (await p.confirmarRemocao(engCiv)).flush(...sucesso());
        }
        await p.propagar();
        p.http.expectOne((r) => r.url === LISTA).flush(...problema(503));
        await p.propagar();

        expect(p.edicao.gravando()).toBe(false);
        const tentar = p.elemento<HTMLButtonElement>('ui-alert .list-state__retry button');
        expect(tentar.getAttribute('aria-disabled')).toBeNull();
        tentar.click();
        await p.propagar();
        await p.recarregarCom([engCiv]);
        expect(p.store.mensagemDeErro()).toBeNull();
      },
    );
  });

  describe('campo desabilitado por regra de negócio', () => {
    it('continua desabilitado depois do sucesso, e os demais seguem habilitados', async () => {
      await p.abrirCadastro();
      p.edicao.form.controls.grau.disable();
      const post = await p.enviar();
      expect(p.campo('grau').matches(':disabled')).toBe(true);
      post.flush(...criado());
      await p.recarregarCom([engCiv]);

      expect(p.edicao.form.controls.grau.disabled).toBe(true);
      expect(p.edicao.form.controls.nome.enabled).toBe(true);
    });

    it('continua desabilitado depois da recusa do servidor', async () => {
      await p.abrirCadastro();
      p.edicao.form.controls.grau.disable();
      (await p.enviar()).flush(...recusaDeCampo('Nome', 'Recusado.'));
      await p.propagar();

      expect(p.campo('grau').matches(':disabled')).toBe(true);
      expect(p.campo('nome').matches(':disabled')).toBe(false);
      expect(p.campo('nome').getAttribute('aria-invalid')).toBe('true');
    });
  });
});
