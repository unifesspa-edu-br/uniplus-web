import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TipoProcessoFormularioComponent } from './tipo-processo-formulario.component';
import {
  LISTA,
  Pagina,
  criado,
  montarPagina,
  problema,
  recusaDeCampo,
  sisu,
  sucesso,
  vestibular,
} from './tipos-processo.testing';

describe('TiposProcessoPage — escritas pela interface', () => {
  let p: Pagina;

  beforeEach(async () => {
    p = await montarPagina();
  });
  afterEach(() => p.http.verify());

  const drawer = (): HTMLDialogElement =>
    p.elemento('dialog[aria-label="Formulário de tipo de processo"]');
  const submeter = (): void => {
    p.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
  };
  const dialogoDe = (qual: 'desativar' | 'ativar'): HTMLDialogElement =>
    p.confirmacao(qual).querySelector('dialog') as HTMLDialogElement;
  const marcado = (seletor: string): string | null =>
    p.elemento(seletor).getAttribute('aria-required');

  describe('gravação pendente', () => {
    it('deixa o formulário somente leitura, com foco no botão, sem fechar por Cancelar, X nem Esc', async () => {
      await p.abrirCadastro();
      const post = await p.enviar();
      const botao = p.salvar();

      expect(p.campo('nome').matches(':disabled')).toBe(true);
      expect(p.campo('nome').value).toBe('Processo seletivo');
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
      await p.recarregarCom([sisu]);
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
      p.http.expectNone((r) => r.method === 'POST');
      post.flush(...criado());
      await p.recarregarCom([sisu]);
    });

    it('a submissão repetida nem chega a pedir o salvamento ao formulário', async () => {
      await p.abrirCadastro();
      const pedidos: string[] = [];
      p.fixture.debugElement
        .query(By.directive(TipoProcessoFormularioComponent))
        .componentInstance.salvar.subscribe(() => pedidos.push('salvar'));
      const post = await p.enviar();
      expect(pedidos).toEqual(['salvar']);

      submeter();
      await p.propagar();

      expect(pedidos).toEqual(['salvar']);
      post.flush(...criado());
      await p.recarregarCom([sisu]);
    });

    it('o salvamento não se apresenta como desativação, nem durante a espera pela recarga', async () => {
      await p.abrirCadastro();
      const post = await p.enviar();
      expect(p.edicao.salvando()).toBe(true);
      expect(p.edicao.removendo()).toBe(false);
      expect(p.elemento('cfg-tipos-processo-lista').textContent).not.toContain('Desativando');

      post.flush(...criado());
      await p.propagar();
      expect(p.edicao.gravando()).toBe(true);
      expect(p.edicao.removendo()).toBe(false);
      expect(p.edicao.reativando()).toBe(false);
      expect(p.elemento('cfg-tipos-processo-lista').textContent).not.toContain('Desativando');
      await p.recarregarCom([sisu]);
    });

    it('Enter num campo leva o foco ao botão e, na falha 500, o envio segue disponível', async () => {
      await p.abrirCadastro();
      p.campo('nome').focus();
      submeter();
      await p.propagar();
      const post = p.http.expectOne((r) => r.url === LISTA && r.method === 'POST');

      expect(p.campo('nome').matches(':disabled')).toBe(true);
      expect(document.activeElement).toBe(p.salvar());
      post.flush(...problema(500, { code: 'uniplus.erro_interno' }));
      await p.propagar();
      await p.propagar();

      expect(p.campo('nome').matches(':disabled')).toBe(false);
      expect(p.elemento('ui-drawer ui-alert').textContent).toContain('Falha');
      expect(document.activeElement).toBe(p.salvar());
      expect(p.salvar().getAttribute('aria-disabled')).toBeNull();
      submeter();
      p.http.expectOne((r) => r.url === LISTA && r.method === 'POST').flush(...criado());
      await p.recarregarCom([sisu]);
    });

    it('não abre outro editor nem fecha o drawer enquanto grava', async () => {
      await p.abrirEdicao(sisu);
      p.preencher('nome', 'SiSU revisado');
      const put = await p.enviar(`${LISTA}/${sisu.id}`);

      p.edicao.abrirEdicao(vestibular);
      p.edicao.fechar();
      await p.propagar();
      expect(p.campo('codigo').value).toBe('SISU');
      expect(p.edicao.aberto()).toBe(true);

      put.flush(...sucesso());
      await p.recarregarCom([sisu, vestibular]);
      expect(p.edicao.aberto()).toBe(false);
    });
  });

  describe('campos obrigatórios e somente leitura', () => {
    it('marca o código e o nome como obrigatórios para a tecnologia assistiva, e a descrição não', async () => {
      await p.abrirCadastro();
      expect(marcado('input[formcontrolname="codigo"]')).toBe('true');
      expect(marcado('input[formcontrolname="nome"]')).toBe('true');
      expect(marcado('textarea[formcontrolname="descricao"]')).toBeNull();
    });

    it('torna o código somente leitura na edição e não o envia na atualização', async () => {
      await p.abrirEdicao(sisu);
      expect(p.campo('codigo').readOnly).toBe(true);
      p.preencher('nome', 'Sistema de Seleção Unificada');
      const put = await p.enviar(`${LISTA}/${sisu.id}`);

      expect(put.request.method).toBe('PUT');
      expect(put.request.body).not.toHaveProperty('codigo');
      expect(put.request.body).toMatchObject({ id: sisu.id, nome: 'Sistema de Seleção Unificada' });
      put.flush(...sucesso());
      await p.recarregarCom([sisu]);
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
      if (desfecho === 'sucesso') await p.recarregarCom([sisu]);
    });
  });

  describe('desativação pendente', () => {
    it('anuncia o andamento, rotula a linha e deixa os acionadores indisponíveis', async () => {
      const del = await p.confirmarDesativacao(sisu);

      expect(p.edicao.removendo()).toBe(true);
      expect(p.edicao.salvando()).toBe(false);
      expect(p.fixture.nativeElement.textContent).toContain('Desativando...');
      expect(p.confirmacao('desativar').querySelector('[role="status"]')?.textContent).toContain(
        'Desativando o tipo de processo SISU.',
      );
      for (const botao of [p.novo(), p.editar(sisu), p.desativar(sisu), p.ativar(vestibular)]) {
        expect(botao.matches(':disabled') || botao.getAttribute('aria-disabled') === 'true').toBe(
          true,
        );
        botao.click();
      }
      await p.propagar();
      expect(p.edicao.aberto()).toBe(false);
      expect(p.edicao.confirmandoReativacao()).toBe(false);
      expect(p.confirmar().getAttribute('aria-disabled')).toBe('true');
      expect(p.confirmar().getAttribute('aria-busy')).toBe('true');
      expect(document.activeElement).toBe(p.confirmar());

      del.flush(...sucesso());
      await p.propagar();
      expect(p.edicao.gravando()).toBe(true);
      p.novo().click();
      expect(p.edicao.aberto()).toBe(false);
      await p.recarregarCom([{ ...sisu, ativo: false }, vestibular]);
      expect(p.edicao.gravando()).toBe(false);
    });

    it('não fecha por Cancelar, X nem Esc, e o segundo clique não envia', async () => {
      const del = await p.confirmarDesativacao(sisu);

      expect(p.cancelarDaConfirmacao().matches(':disabled')).toBe(true);
      expect(
        dialogoDe('desativar').querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')
          ?.disabled,
      ).toBe(true);
      dialogoDe('desativar').dispatchEvent(new Event('cancel', { cancelable: true }));
      p.confirmar().click();
      await p.propagar();
      expect(p.edicao.confirmando()).toBe(true);
      p.http.expectNone(`${LISTA}/${sisu.id}`);

      del.flush(...sucesso());
      await p.recarregarCom([vestibular]);
    });

    it('"Tentar novamente" fica indisponível com a leitura falha enquanto desativa', async () => {
      const del = await p.confirmarDesativacao(sisu);
      p.store.recarregar();
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA && r.method === 'GET').flush(...problema(503));
      await p.propagar();

      const tentar = p.elemento<HTMLButtonElement>('ui-alert .list-state__retry button');
      expect(tentar.getAttribute('aria-disabled')).toBe('true');
      tentar.click();
      await p.propagar();
      p.http.expectNone((r) => r.url === LISTA && r.method === 'GET');

      del.flush(...sucesso());
      await p.recarregarCom([vestibular]);
    });
  });

  describe('cor dos botões de confirmação', () => {
    it('desativar confirma em perigo e ativar confirma em primário', async () => {
      await p.confirmarDesativacao(sisu);
      expect(p.confirmar('desativar').classList.contains('btn--danger')).toBe(true);
      expect(p.confirmar('desativar').classList.contains('btn--primary')).toBe(false);
    });

    it('ativar confirma em primário, não em perigo', async () => {
      await p.confirmarAtivacao(vestibular);
      expect(p.confirmar('ativar').classList.contains('btn--primary')).toBe(true);
      expect(p.confirmar('ativar').classList.contains('btn--danger')).toBe(false);
    });
  });

  describe('ativação pendente', () => {
    it('anuncia o andamento, rotula a linha e mantém o foco no botão do diálogo', async () => {
      const post = await p.confirmarAtivacao(vestibular);

      expect(p.edicao.reativando()).toBe(true);
      expect(p.edicao.removendo()).toBe(false);
      expect(p.fixture.nativeElement.textContent).toContain('Ativando...');
      expect(p.confirmacao('ativar').querySelector('[role="status"]')?.textContent).toContain(
        'Ativando o tipo de processo VESTIBULAR_TRAD.',
      );
      expect(p.confirmar('ativar').getAttribute('aria-busy')).toBe('true');
      expect(document.activeElement).toBe(p.confirmar('ativar'));
      expect(p.editar(sisu).matches(':disabled')).toBe(true);

      post.flush(...sucesso());
      await p.recarregarCom([sisu, { ...vestibular, ativo: true }]);
      expect(p.edicao.gravando()).toBe(false);
    });

    it('não fecha por Cancelar nem Esc e o segundo clique não envia', async () => {
      const post = await p.confirmarAtivacao(vestibular);

      expect(p.cancelarDaConfirmacao('ativar').matches(':disabled')).toBe(true);
      dialogoDe('ativar').dispatchEvent(new Event('cancel', { cancelable: true }));
      p.confirmar('ativar').click();
      await p.propagar();
      expect(p.edicao.confirmandoReativacao()).toBe(true);
      p.http.expectNone((r) => r.url.endsWith('/ativacao'));

      post.flush(...sucesso());
      await p.recarregarCom([sisu, { ...vestibular, ativo: true }]);
    });
  });

  describe('chamadas concorrentes', () => {
    it('salvar durante a gravação, desativar durante o salvamento e salvar durante a desativação não geram requisição', async () => {
      await p.abrirCadastro();
      p.edicao.salvar();
      p.edicao.salvar();
      p.edicao.pedirRemocao(sisu);
      p.edicao.removerConfirmado();
      p.edicao.pedirReativacao(vestibular);
      p.edicao.reativarConfirmado();
      p.http.expectNone((r) => r.method === 'DELETE' || r.url.endsWith('/ativacao'));
      p.http.expectOne((r) => r.url === LISTA && r.method === 'POST').flush(...criado());
      await p.propagar();

      p.edicao.abrirCadastro();
      p.edicao.salvar();
      p.http.expectNone((r) => r.method === 'POST');
      await p.recarregarCom([sisu]);

      p.edicao.pedirRemocao(sisu);
      p.edicao.removerConfirmado();
      p.edicao.salvar();
      p.edicao.reativarConfirmado();
      p.http.expectNone((r) => r.method === 'POST');
      p.http.expectOne(`${LISTA}/${sisu.id}`).flush(...sucesso());
      await p.recarregarCom([vestibular]);
    });

    it('confirmar sem ter pedido a desativação ou a ativação não envia nada', () => {
      p.edicao.removerConfirmado();
      p.edicao.reativarConfirmado();
      p.http.expectNone((r) => r.method === 'DELETE' || r.method === 'POST');
    });
  });

  describe('recarga depois da escrita', () => {
    it('mantém as ações indisponíveis até a lista refletir o que foi gravado', async () => {
      await p.abrirEdicao(sisu);
      (await p.enviar(`${LISTA}/${sisu.id}`)).flush(...sucesso());
      await p.propagar();

      expect(p.edicao.salvando()).toBe(false);
      expect(p.edicao.gravando()).toBe(true);
      expect(p.editar(sisu).matches(':disabled')).toBe(true);
      await p.recarregarCom([sisu]);
      expect(p.edicao.gravando()).toBe(false);
      expect(p.editar(sisu).matches(':disabled')).toBe(false);
    });

    it.each(['salvar', 'desativar', 'ativar'] as const)(
      'libera as ações e permite nova leitura se a recarga após %s falhar',
      async (operacao) => {
        if (operacao === 'salvar') {
          await p.abrirCadastro();
          (await p.enviar()).flush(...criado());
        } else if (operacao === 'desativar') {
          (await p.confirmarDesativacao(sisu)).flush(...sucesso());
        } else {
          (await p.confirmarAtivacao(vestibular)).flush(...sucesso());
        }
        await p.propagar();
        p.http.expectOne((r) => r.url === LISTA && r.method === 'GET').flush(...problema(503));
        await p.propagar();

        expect(p.edicao.gravando()).toBe(false);
        const tentar = p.elemento<HTMLButtonElement>('ui-alert .list-state__retry button');
        expect(tentar.getAttribute('aria-disabled')).toBeNull();
        tentar.click();
        await p.propagar();
        await p.recarregarCom([sisu]);
        expect(p.store.mensagemDeErro()).toBeNull();
      },
    );
  });
});
