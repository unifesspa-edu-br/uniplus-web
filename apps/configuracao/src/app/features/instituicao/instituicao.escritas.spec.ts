import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InstituicaoFormularioComponent } from './instituicao-formulario.component';
import {
  ESCRITA,
  ID,
  LEITURA,
  Pagina,
  criado,
  montarPagina,
  problema,
  recusaDeCampo,
  sucesso,
  unifesspa,
} from './instituicao.testing';

describe('InstituicaoPage — escritas pela interface', () => {
  let p: Pagina;

  afterEach(() => p.http.verify());

  const drawer = (): HTMLDialogElement =>
    p.elemento('dialog[aria-label="Formulário da instituição"]');
  const dialogoDeRemocao = (): HTMLDialogElement =>
    p.confirmacao().querySelector('dialog') as HTMLDialogElement;
  const submeter = (): void => {
    p.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
  };
  const cancelarDoFormulario = (): HTMLButtonElement =>
    [...p.fixture.nativeElement.querySelectorAll('.form-drawer__footer button')].find(
      (b) => (b as HTMLElement).textContent?.trim() === 'Cancelar',
    ) as HTMLButtonElement;
  const indisponivel = (botao: HTMLButtonElement): boolean =>
    botao.matches(':disabled') || botao.getAttribute('aria-disabled') === 'true';

  describe('cadastro', () => {
    beforeEach(async () => {
      p = await montarPagina(null);
    });

    it('envia o comando completo com a chave de idempotência, avisa o sucesso e mostra a ficha', async () => {
      await p.abrirCadastro();
      p.preencher('cnpj', '  11.222.333/0001-44 ');
      const post = await p.enviar();

      expect(post.request.method).toBe('POST');
      expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
      expect(post.request.body).toMatchObject({
        codigoEmec: '3990',
        nome: unifesspa.nome,
        sigla: 'Unifesspa',
        organizacaoAcademica: 'Universidade',
        categoriaAdministrativa: 'Pública Federal',
        cnpj: '11.222.333/0001-44',
        website: null,
        unidadeRaizId: null,
      });
      post.flush(...criado());
      await p.responderLeitura(unifesspa);

      expect(p.edicao.aberto()).toBe(false);
      expect(p.sucessos).toHaveBeenCalledWith('Instituição criada');
      expect(p.statusDaPagina()).toBe('Instituição criada.');
      expect(p.elemento('.cfg-instituicao__ficha')).toBeTruthy();
    });

    it('não oferece a remoção antes de existir instituição', async () => {
      await p.abrirFormulario();

      expect(
        p.fixture.nativeElement.querySelector('.form-drawer__footer .btn--danger-ghost'),
      ).toBeNull();
    });

    it('pedir a remoção com o formulário de cadastro aberto não abre a confirmação', async () => {
      await p.abrirFormulario();
      p.edicao.pedirRemocao();
      await p.propagar();

      expect(p.edicao.confirmando()).toBe(false);
    });

    it('marca os obrigatórios sem enviar e leva o foco ao primeiro inválido', async () => {
      await p.abrirFormulario();
      p.salvar().focus();
      p.salvar().click();
      await p.propagar();
      await p.propagar();

      p.http.expectNone((r) => r.method === 'POST');
      expect(p.elemento('#cfg-instituicao-nome-erro').textContent).toContain('Campo obrigatório.');
      expect(p.campo('nome').getAttribute('aria-invalid')).toBe('true');
      expect(p.campo('nome').getAttribute('aria-describedby')).toBe('cfg-instituicao-nome-erro');
      expect(document.activeElement).toBe(p.campo('nome'));
      expect(p.edicao.aberto()).toBe(true);
    });

    it('recusa o valor acima do limite da API sem enviar', async () => {
      await p.abrirCadastro();
      p.preencher('sigla', 'S'.repeat(51));
      submeter();
      await p.propagar();

      p.http.expectNone((r) => r.method === 'POST');
      expect(p.elemento('#cfg-instituicao-sigla-erro').textContent).toContain(
        'Informe no máximo 50 caracteres.',
      );
    });
  });

  describe('edição', () => {
    beforeEach(async () => {
      p = await montarPagina();
    });

    it('atualiza pela chave da instituição, avisa o sucesso e devolve o foco ao botão Editar', async () => {
      await p.abrirFormulario();
      expect(p.campo('nome').value).toBe(unifesspa.nome);
      p.preencher('nome', 'Universidade Federal do Sul e Sudeste do Pará (revisado)');
      const put = await p.enviar(`${ESCRITA}/${ID}`);

      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toMatchObject({
        id: ID,
        nome: 'Universidade Federal do Sul e Sudeste do Pará (revisado)',
        unidadeRaizId: unifesspa.unidadeRaizId,
      });
      put.flush(...sucesso());
      await p.responderLeitura({ ...unifesspa, nome: 'Revisada' });

      expect(p.sucessos).toHaveBeenCalledWith('Instituição atualizada');
      expect(p.statusDaPagina()).toBe('Instituição atualizada.');
      expect(document.activeElement).toBe(p.acao());
    });

    it('cancelar fecha sem enviar e devolve o foco ao botão Editar', async () => {
      await p.abrirFormulario();
      cancelarDoFormulario().click();
      await p.propagar();

      expect(p.edicao.aberto()).toBe(false);
      p.http.expectNone((r) => r.method !== 'GET');
      expect(document.activeElement).toBe(p.acao());
    });
  });

  describe('gravação pendente', () => {
    beforeEach(async () => {
      p = await montarPagina();
    });

    it('deixa o formulário somente leitura, com foco no botão, sem fechar por Cancelar, X nem Esc', async () => {
      await p.abrirFormulario();
      const put = await p.enviar(`${ESCRITA}/${ID}`);
      const botao = p.salvar();

      expect(p.campo('nome').matches(':disabled')).toBe(true);
      expect(p.campo('nome').value).toBe(unifesspa.nome);
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

      put.flush(...sucesso());
      await p.responderLeitura(unifesspa);
      expect(p.edicao.aberto()).toBe(false);
    });

    it('clique e submissão repetidos não geram segundo envio', async () => {
      await p.abrirFormulario();
      const put = await p.enviar(`${ESCRITA}/${ID}`);
      const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
      p.salvar().dispatchEvent(clique);
      submeter();
      await p.propagar();

      expect(clique.defaultPrevented).toBe(true);
      p.http.expectNone((r) => r.method === 'PUT');
      put.flush(...sucesso());
      await p.responderLeitura(unifesspa);
    });

    it('a submissão repetida nem chega a pedir o salvamento ao formulário', async () => {
      await p.abrirFormulario();
      const pedidos: string[] = [];
      p.fixture.debugElement
        .query(By.directive(InstituicaoFormularioComponent))
        .componentInstance.salvar.subscribe(() => pedidos.push('salvar'));
      const put = await p.enviar(`${ESCRITA}/${ID}`);
      expect(pedidos).toEqual(['salvar']);

      submeter();
      await p.propagar();

      expect(pedidos).toEqual(['salvar']);
      put.flush(...sucesso());
      await p.responderLeitura(unifesspa);
    });

    it('durante a releitura que segue uma recusa, salvar fica indisponível e não apaga o alerta', async () => {
      await p.abrirFormulario();
      (await p.enviar(`${ESCRITA}/${ID}`)).flush(
        ...problema(404, { code: 'uniplus.organizacao.instituicao.nao_encontrada' }),
      );
      await p.propagar();
      const alerta = (): Element | null =>
        p.fixture.nativeElement.querySelector('ui-drawer ui-alert');
      expect(p.edicao.gravando()).toBe(true);
      expect(alerta()).not.toBeNull();
      expect(p.salvar().getAttribute('aria-disabled')).toBe('true');
      expect(p.salvar().textContent).not.toContain('Salvando...');

      const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
      p.salvar().dispatchEvent(clique);
      submeter();
      await p.propagar();

      expect(clique.defaultPrevented).toBe(true);
      expect(alerta()).not.toBeNull();
      p.http.expectNone((r) => r.method === 'PUT');
      await p.responderLeitura(null);
    });

    it('o salvamento não se apresenta como remoção, nem durante a espera pela recarga', async () => {
      await p.abrirFormulario();
      const put = await p.enviar(`${ESCRITA}/${ID}`);
      expect(p.edicao.salvando()).toBe(true);
      expect(p.edicao.removendo()).toBe(false);

      put.flush(...sucesso());
      await p.propagar();
      expect(p.edicao.gravando()).toBe(true);
      expect(p.edicao.salvando()).toBe(false);
      expect(p.edicao.removendo()).toBe(false);
      await p.responderLeitura(unifesspa);
    });

    it('Enter num campo leva o foco ao botão e, na falha 500, o envio segue disponível', async () => {
      await p.abrirFormulario();
      p.campo('nome').focus();
      submeter();
      await p.propagar();
      const put = p.http.expectOne((r) => r.url === `${ESCRITA}/${ID}` && r.method === 'PUT');

      expect(p.campo('nome').matches(':disabled')).toBe(true);
      expect(document.activeElement).toBe(p.salvar());
      put.flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();
      await p.propagar();

      expect(p.campo('nome').matches(':disabled')).toBe(false);
      expect(p.elemento('ui-drawer ui-alert').textContent).toContain('Falha');
      expect(document.activeElement).toBe(p.salvar());
      expect(p.salvar().getAttribute('aria-disabled')).toBeNull();
      submeter();
      p.http
        .expectOne((r) => r.url === `${ESCRITA}/${ID}` && r.method === 'PUT')
        .flush(...sucesso());
      await p.responderLeitura(unifesspa);
    });

    it('a recusa de campo devolve o foco ao campo recusado', async () => {
      await p.abrirFormulario();
      (await p.enviar(`${ESCRITA}/${ID}`)).flush(...recusaDeCampo('Cnpj', 'CNPJ inválido.'));
      await p.propagar();
      await p.propagar();

      expect(p.campo('cnpj').getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(p.campo('cnpj'));
    });
  });

  describe('campo desabilitado por regra de negócio', () => {
    beforeEach(async () => {
      p = await montarPagina();
    });

    it.each(['sucesso', 'recusa'] as const)('continua desabilitado após %s', async (desfecho) => {
      await p.abrirFormulario();
      p.edicao.form.controls.mantenedora.disable();
      const put = await p.enviar(`${ESCRITA}/${ID}`);
      expect(p.edicao.form.controls.mantenedora.disabled).toBe(true);

      if (desfecho === 'sucesso') put.flush(...sucesso());
      else put.flush(...recusaDeCampo('Cnpj', 'CNPJ inválido.'));
      await p.propagar();

      expect(p.edicao.form.controls.mantenedora.disabled).toBe(true);
      expect(p.edicao.form.controls.nome.enabled).toBe(true);
      expect(p.campo('mantenedora').matches(':disabled')).toBe(true);
      if (desfecho === 'sucesso') await p.responderLeitura(unifesspa);
    });
  });

  describe('remoção', () => {
    beforeEach(async () => {
      p = await montarPagina();
    });

    it('pede confirmação nomeando o efeito e remove só depois de confirmada', async () => {
      await p.abrirFormulario();
      p.remover().click();
      await p.propagar();

      expect(dialogoDeRemocao().textContent).toContain('libera o cadastro de uma nova Instituição');
      p.http.expectNone((r) => r.method === 'DELETE');
      p.confirmar().click();
      await p.propagar();
      const del = p.http.expectOne(`${ESCRITA}/${ID}`);
      expect(del.request.method).toBe('DELETE');
      del.flush(...sucesso());
      await p.responderLeitura(null);

      expect(p.sucessos).toHaveBeenCalledWith('Instituição removida', 'Unifesspa');
      expect(p.statusDaPagina()).toBe('Instituição Unifesspa removida.');
      expect(p.edicao.aberto()).toBe(false);
      expect(p.edicao.confirmando()).toBe(false);
      expect(p.elemento('ui-empty-state')).toBeTruthy();
    });

    it('depois de removida, devolve o foco ao botão que passou a cadastrar', async () => {
      (await p.confirmarRemocaoPeloFormulario()).flush(...sucesso());
      await p.responderLeitura(null);

      expect(p.acao().textContent).toContain('Cadastrar instituição');
      expect(document.activeElement).toBe(p.acao());
    });

    it('a remoção pendente anuncia o andamento, indisponibiliza os acionadores e não parte duas vezes', async () => {
      const del = await p.confirmarRemocaoPeloFormulario();

      expect(p.edicao.removendo()).toBe(true);
      expect(p.edicao.salvando()).toBe(false);
      expect(p.confirmacao().querySelector('[role="status"]')?.textContent).toContain(
        'Removendo a instituição Unifesspa.',
      );
      expect(p.confirmar().getAttribute('aria-disabled')).toBe('true');
      expect(p.confirmar().getAttribute('aria-busy')).toBe('true');
      expect(document.activeElement).toBe(p.confirmar());
      expect(p.cancelarDaConfirmacao().matches(':disabled')).toBe(true);
      expect(
        dialogoDeRemocao().querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')
          ?.disabled,
      ).toBe(true);
      expect(p.remover().matches(':disabled')).toBe(true);
      dialogoDeRemocao().dispatchEvent(new Event('cancel', { cancelable: true }));
      p.confirmar().click();
      await p.propagar();
      expect(p.edicao.confirmando()).toBe(true);
      p.http.expectNone(`${ESCRITA}/${ID}`);
      expect(indisponivel(p.acao())).toBe(true);

      del.flush(...sucesso());
      await p.responderLeitura(null);
      expect(p.edicao.gravando()).toBe(false);
    });

    it('"Tentar novamente" fica indisponível com a leitura falha enquanto remove', async () => {
      const del = await p.confirmarRemocaoPeloFormulario();
      p.store.recarregar();
      await p.falharLeitura(503);

      const tentar = p.elemento<HTMLButtonElement>('#cfg-instituicao-tentar-novamente');
      expect(tentar.getAttribute('aria-disabled')).toBe('true');
      tentar.click();
      await p.propagar();
      p.http.expectNone((r) => r.url === LEITURA && r.method === 'GET');

      del.flush(...sucesso());
      await p.responderLeitura(null);
    });

    it('a recusa mantém o diálogo, anuncia o motivo e aceita nova tentativa', async () => {
      (await p.confirmarRemocaoPeloFormulario()).flush(
        ...problema(409, {
          code: 'uniplus.organizacao.instituicao.remocao_recusada',
          title: 'Remoção recusada',
        }),
      );
      await p.propagar();

      expect(p.edicao.confirmando()).toBe(true);
      expect(p.confirmacao().querySelector('.field__error')?.textContent).toContain(
        'Remoção recusada',
      );
      expect(p.confirmacao().querySelector('[role="status"]')?.textContent).toContain(
        'Não foi possível remover a instituição Unifesspa.',
      );
      expect(p.confirmar().getAttribute('aria-disabled')).toBeNull();
      expect(p.erros).not.toHaveBeenCalled();
      p.confirmar().click();
      await p.propagar();
      p.http.expectOne(`${ESCRITA}/${ID}`).flush(...sucesso());
      await p.responderLeitura(null);
    });

    it('o 404 da remoção trata a instituição como já removida: fecha tudo, relê e devolve o foco', async () => {
      (await p.confirmarRemocaoPeloFormulario()).flush(
        ...problema(404, { code: 'uniplus.organizacao.instituicao.nao_encontrada' }),
      );
      await p.propagar();

      expect(p.edicao.confirmando()).toBe(false);
      expect(p.edicao.aberto()).toBe(false);
      expect(p.edicao.erroDaRemocao()).toBeNull();
      expect(p.sucessos).not.toHaveBeenCalled();
      expect(p.erros).not.toHaveBeenCalled();
      expect(p.edicao.gravando()).toBe(true);
      await p.responderLeitura(null);

      expect(p.statusDaPagina()).toBe('Instituição Unifesspa já havia sido removida.');
      expect(p.acao().textContent).toContain('Cadastrar instituição');
      expect(document.activeElement).toBe(p.acao());
    });

    it('a falha 5xx da remoção avisa também por toast', async () => {
      (await p.confirmarRemocaoPeloFormulario()).flush(
        ...problema(500, { code: 'uniplus.internal.unexpected' }),
      );
      await p.propagar();

      expect(p.erros).toHaveBeenCalledTimes(1);
      expect(p.edicao.confirmando()).toBe(true);
    });
  });

  describe('chamadas concorrentes', () => {
    beforeEach(async () => {
      p = await montarPagina();
    });

    it('salvar durante a gravação, remover durante o salvamento e salvar durante a remoção não geram requisição', async () => {
      p.edicao.abrirEdicao(unifesspa);
      p.edicao.salvar();
      p.edicao.salvar();
      p.edicao.pedirRemocao();
      p.edicao.removerConfirmado();
      p.http.expectNone((r) => r.method === 'DELETE');
      p.http
        .expectOne((r) => r.url === `${ESCRITA}/${ID}` && r.method === 'PUT')
        .flush(...sucesso());
      await p.propagar();

      p.edicao.abrirEdicao(unifesspa);
      p.edicao.salvar();
      p.http.expectNone((r) => r.method === 'PUT');
      await p.responderLeitura(unifesspa);

      p.edicao.pedirRemocao();
      p.edicao.removerConfirmado();
      p.edicao.salvar();
      p.http.expectNone((r) => r.method === 'PUT');
      p.http.expectOne(`${ESCRITA}/${ID}`).flush(...sucesso());
      await p.responderLeitura(null);
    });

    it('confirmar sem ter pedido a remoção não envia nada', () => {
      p.edicao.removerConfirmado();
      p.http.expectNone((r) => r.method === 'DELETE');
    });
  });

  describe('recarga depois da escrita', () => {
    beforeEach(async () => {
      p = await montarPagina();
    });

    it('mantém as ações indisponíveis até a tela refletir o que foi gravado', async () => {
      await p.abrirFormulario();
      (await p.enviar(`${ESCRITA}/${ID}`)).flush(...sucesso());
      await p.propagar();

      expect(p.edicao.salvando()).toBe(false);
      expect(p.edicao.gravando()).toBe(true);
      expect(indisponivel(p.acao())).toBe(true);
      p.acao().click();
      await p.propagar();
      expect(p.edicao.aberto()).toBe(false);
      await p.responderLeitura(unifesspa);
      expect(p.edicao.gravando()).toBe(false);
      expect(indisponivel(p.acao())).toBe(false);
    });

    it.each(['salvar', 'remover'] as const)(
      'libera as ações e permite nova leitura se a recarga após %s falhar',
      async (operacao) => {
        if (operacao === 'salvar') {
          await p.abrirFormulario();
          (await p.enviar(`${ESCRITA}/${ID}`)).flush(...sucesso());
        } else {
          (await p.confirmarRemocaoPeloFormulario()).flush(...sucesso());
        }
        await p.falharLeitura(503);

        expect(p.edicao.gravando()).toBe(false);
        const tentar = p.elemento<HTMLButtonElement>('#cfg-instituicao-tentar-novamente');
        expect(tentar.getAttribute('aria-disabled')).toBeNull();
        tentar.click();
        await p.responderLeitura(unifesspa);
        expect(p.store.mensagemDeErro()).toBeNull();
      },
    );

    it('com a recarga falha, leva o foco ao título da página', async () => {
      await p.abrirFormulario();
      (await p.enviar(`${ESCRITA}/${ID}`)).flush(...sucesso());
      await p.falharLeitura(503);

      expect(document.activeElement?.id).toBe('cfg-instituicao-titulo-da-pagina');
    });
  });
});
