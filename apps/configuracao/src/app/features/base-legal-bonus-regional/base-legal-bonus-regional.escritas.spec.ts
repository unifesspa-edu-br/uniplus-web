import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BaseLegalBonusRegionalFormularioComponent } from './base-legal-bonus-regional-formulario.component';
import {
  ESCRITA,
  LISTA,
  MARABA,
  Pagina,
  criado,
  decreto,
  montarPagina,
  portaria,
  problema,
  recusaDeCampo,
  sucesso,
} from './base-legal-bonus-regional.testing';

describe('BaseLegalBonusRegionalPage — escritas pela interface', () => {
  let p: Pagina;

  beforeEach(async () => {
    p = await montarPagina([portaria, decreto]);
  });
  afterEach(() => p.http.verify());

  const drawer = (): HTMLDialogElement =>
    p.elemento('dialog[aria-label="Formulário de base legal de bônus regional"]');
  const submeter = (): void => {
    p.formulario().dispatchEvent(new Event('submit', { cancelable: true }));
  };
  const cancelarDoFormulario = (): HTMLButtonElement =>
    [...p.fixture.nativeElement.querySelectorAll('.form-drawer__footer button')].find(
      (b) => (b as HTMLElement).textContent?.trim() === 'Cancelar',
    ) as HTMLButtonElement;

  describe('envio', () => {
    it('cria a base legal com os municípios escolhidos, a chave de idempotência, o aviso e o anúncio', async () => {
      await p.abrirCadastro();
      const post = await p.enviar();

      expect(post.request.method).toBe('POST');
      expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
      expect(post.request.body).toEqual({
        tipoInstrumento: 'PORTARIA',
        identificacao: 'Portaria de teste',
        descricao: 'Descrição de teste válida.',
        municipios: [{ codigoIbge: MARABA.codigoIbge, nome: MARABA.nome, uf: MARABA.uf }],
      });
      post.flush(...criado());
      await p.recarregarCom([portaria]);

      expect(p.edicao.aberto()).toBe(false);
      expect(p.sucessos).toHaveBeenCalledWith('Base legal criada');
      expect(p.statusDaPagina()).toBe('Base legal criada.');
    });

    it('atualiza a base com o id no corpo e na rota e a chave de idempotência', async () => {
      await p.abrirEdicao(portaria);
      p.preencher('identificacao', 'Portaria revisada');
      const put = await p.enviar(`${ESCRITA}/${portaria.id}`);

      expect(put.request.method).toBe('PUT');
      expect(put.request.headers.get('Idempotency-Key')).toBeTruthy();
      expect(put.request.body).toMatchObject({
        id: portaria.id,
        identificacao: 'Portaria revisada',
        municipios: portaria.municipios,
      });
      put.flush(...sucesso());
      await p.recarregarCom([portaria, decreto]);

      expect(p.sucessos).toHaveBeenCalledWith('Base legal atualizada');
      expect(p.statusDaPagina()).toBe('Base legal atualizada.');
    });

    it('aparta os espaços das bordas dos textos antes de enviar', async () => {
      await p.abrirCadastro();
      p.preencher('identificacao', '  Portaria de teste  ');
      const post = await p.enviar();

      expect(post.request.body).toMatchObject({ identificacao: 'Portaria de teste' });
      post.flush(...criado());
      await p.recarregarCom([portaria]);
    });
  });

  describe('gravação pendente', () => {
    it('deixa o formulário somente leitura, com foco no botão, sem fechar por Cancelar, X nem Esc', async () => {
      await p.abrirCadastro();
      const post = await p.enviar();
      const botao = p.salvar();

      expect(p.campo('identificacao').matches(':disabled')).toBe(true);
      expect(p.edicao.form.controls.identificacao.value).toBe('Portaria de teste');
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
      await p.recarregarCom([portaria]);
      expect(p.edicao.aberto()).toBe(false);
    });

    it('a escolha de municípios também fica fora de alcance: a busca e cada "Remover"', async () => {
      await p.abrirCadastro();
      const post = await p.enviar();

      expect(p.buscaDeMunicipio().matches(':disabled')).toBe(true);
      expect(p.elemento('button[aria-label="Remover Marabá"]').matches(':disabled')).toBe(true);
      expect(p.campo('tipoInstrumento').matches(':disabled')).toBe(true);
      expect(p.campo('descricao').matches(':disabled')).toBe(true);
      post.flush(...criado());
      await p.recarregarCom([portaria]);
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
      await p.recarregarCom([portaria]);
    });

    it('a submissão repetida nem chega a pedir o salvamento ao formulário', async () => {
      await p.abrirCadastro();
      const pedidos: string[] = [];
      p.fixture.debugElement
        .query(By.directive(BaseLegalBonusRegionalFormularioComponent))
        .componentInstance.salvar.subscribe(() => pedidos.push('salvar'));
      const post = await p.enviar();
      expect(pedidos).toEqual(['salvar']);

      submeter();
      await p.propagar();

      expect(pedidos).toEqual(['salvar']);
      post.flush(...criado());
      await p.recarregarCom([portaria]);
    });

    it('o salvamento não se apresenta como remoção, nem durante a espera pela recarga', async () => {
      await p.abrirCadastro();
      const post = await p.enviar();
      expect(p.edicao.salvando()).toBe(true);
      expect(p.edicao.removendo()).toBe(false);
      expect(p.elemento('cfg-base-legal-bonus-regional-lista').textContent).not.toContain(
        'Removendo',
      );

      post.flush(...criado());
      await p.propagar();
      expect(p.edicao.gravando()).toBe(true);
      expect(p.edicao.removendo()).toBe(false);
      expect(p.elemento('cfg-base-legal-bonus-regional-lista').textContent).not.toContain(
        'Removendo',
      );
      await p.recarregarCom([portaria]);
    });

    it('Enter num campo leva o foco ao botão e, na falha 500, o envio segue disponível', async () => {
      await p.abrirCadastro();
      p.campo('identificacao').focus();
      submeter();
      await p.propagar();
      const post = p.http.expectOne(ESCRITA);

      expect(p.campo('identificacao').matches(':disabled')).toBe(true);
      expect(document.activeElement).toBe(p.salvar());
      post.flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();
      await p.propagar();

      expect(p.campo('identificacao').matches(':disabled')).toBe(false);
      expect(p.elemento('ui-drawer ui-alert').textContent).toContain('Falha');
      expect(document.activeElement).toBe(p.salvar());
      expect(p.salvar().getAttribute('aria-disabled')).toBeNull();
      submeter();
      p.http.expectOne(ESCRITA).flush(...criado());
      await p.recarregarCom([portaria]);
    });

    it('não abre outro editor nem fecha o drawer enquanto grava', async () => {
      await p.abrirEdicao(portaria);
      p.preencher('identificacao', 'Portaria revisada');
      const put = await p.enviar(`${ESCRITA}/${portaria.id}`);

      p.edicao.abrirEdicao(decreto);
      p.edicao.fechar();
      await p.propagar();
      expect(p.campo('identificacao').value).toBe('Portaria revisada');
      expect(p.edicao.aberto()).toBe(true);

      put.flush(...sucesso());
      await p.recarregarCom([portaria, decreto]);
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
      else post.flush(...recusaDeCampo('identificacao', 'Identificação recusada.'));
      await p.propagar();

      expect(p.edicao.form.controls.descricao.disabled).toBe(true);
      expect(p.edicao.form.controls.identificacao.enabled).toBe(true);
      expect(p.campo('descricao').matches(':disabled')).toBe(true);
      expect(p.campo('identificacao').matches(':disabled')).toBe(false);
      if (desfecho === 'sucesso') await p.recarregarCom([portaria]);
    });
  });

  describe('remoção pendente', () => {
    it('anuncia o andamento e deixa os acionadores indisponíveis', async () => {
      const del = await p.confirmarRemocao(portaria);

      expect(p.edicao.removendo()).toBe(true);
      expect(p.edicao.salvando()).toBe(false);
      expect(p.elemento('cfg-base-legal-bonus-regional-lista').textContent).toContain('Removendo');
      expect(p.elemento('cfg-confirmacao-de-remocao [role="status"]').textContent).toContain(
        'Removendo a base legal Portaria Unifesspa nº 2514/2023.',
      );
      for (const botao of [p.novo(), p.editar(portaria), p.remover(portaria)]) {
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
      await p.recarregarCom([decreto]);
      expect(p.edicao.gravando()).toBe(false);
    });

    it('não fecha por Cancelar, X nem Esc, e o segundo clique não envia', async () => {
      const del = await p.confirmarRemocao(portaria);
      const dialogo = p.elemento<HTMLDialogElement>('cfg-confirmacao-de-remocao dialog');

      expect(p.cancelarDaConfirmacao().matches(':disabled')).toBe(true);
      expect(
        dialogo.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled,
      ).toBe(true);
      dialogo.dispatchEvent(new Event('cancel', { cancelable: true }));
      p.confirmar().click();
      await p.propagar();
      expect(p.edicao.confirmando()).toBe(true);
      p.http.expectNone(`${ESCRITA}/${portaria.id}`);

      del.flush(...sucesso());
      await p.recarregarCom([decreto]);
    });

    it('a busca fica fora de alcance enquanto remove', async () => {
      const del = await p.confirmarRemocao(portaria);

      expect(p.elemento('ui-filter-bar').hasAttribute('inert')).toBe(true);
      del.flush(...sucesso());
      await p.recarregarCom([decreto]);
    });

    it('"Tentar novamente" fica indisponível com a leitura falha enquanto remove', async () => {
      const del = await p.confirmarRemocao(portaria);
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
      await p.recarregarCom([decreto]);
    });

    it('remove após a confirmação, avisa o sucesso e anuncia o desfecho na página', async () => {
      const del = await p.confirmarRemocao(portaria);
      expect(del.request.method).toBe('DELETE');
      del.flush(...sucesso());
      await p.recarregarCom([decreto]);

      expect(p.edicao.confirmando()).toBe(false);
      expect(p.sucessos).toHaveBeenCalledWith(
        'Base legal removida',
        'Portaria Unifesspa nº 2514/2023',
      );
      expect(p.statusDaPagina()).toBe('Base legal Portaria Unifesspa nº 2514/2023 removida.');
    });
  });

  describe('chamadas concorrentes', () => {
    it('salvar durante a gravação, remover durante o salvamento e salvar durante a remoção não geram requisição', async () => {
      await p.abrirCadastro();
      p.edicao.salvar();
      p.edicao.salvar();
      p.edicao.pedirRemocao(portaria);
      expect(p.edicao.confirmando()).toBe(false);
      p.edicao.removerConfirmado();
      p.http.expectNone(`${ESCRITA}/${portaria.id}`);
      p.http.expectOne(ESCRITA).flush(...criado());
      await p.propagar();

      p.edicao.abrirCadastro();
      p.edicao.salvar();
      p.http.expectNone(ESCRITA);
      await p.recarregarCom([portaria]);

      p.edicao.pedirRemocao(portaria);
      p.edicao.removerConfirmado();
      p.edicao.salvar();
      p.http.expectNone(ESCRITA);
      p.http.expectOne(`${ESCRITA}/${portaria.id}`).flush(...sucesso());
      await p.recarregarCom([decreto]);
    });

    it('confirmar sem ter pedido a remoção não envia nada', () => {
      p.edicao.removerConfirmado();
      p.http.expectNone((r) => r.method === 'DELETE');
    });
  });

  describe('recarga depois da escrita', () => {
    it('mantém as ações indisponíveis até a lista refletir o que foi gravado', async () => {
      await p.abrirEdicao(portaria);
      (await p.enviar(`${ESCRITA}/${portaria.id}`)).flush(...sucesso());
      await p.propagar();

      expect(p.edicao.salvando()).toBe(false);
      expect(p.edicao.gravando()).toBe(true);
      expect(p.editar(portaria).matches(':disabled')).toBe(true);
      await p.recarregarCom([portaria]);
      expect(p.edicao.gravando()).toBe(false);
      expect(p.editar(portaria).matches(':disabled')).toBe(false);
    });

    it.each(['salvar', 'remover'] as const)(
      'libera as ações e permite nova leitura se a recarga após %s falhar',
      async (operacao) => {
        if (operacao === 'salvar') {
          await p.abrirCadastro();
          (await p.enviar()).flush(...criado());
        } else {
          (await p.confirmarRemocao(portaria)).flush(...sucesso());
        }
        await p.propagar();
        p.http.expectOne((r) => r.url === LISTA).flush(...problema(503));
        await p.propagar();

        expect(p.edicao.gravando()).toBe(false);
        const tentar = p.elemento<HTMLButtonElement>('ui-alert .list-state__retry button');
        expect(tentar.getAttribute('aria-disabled')).toBeNull();
        tentar.click();
        await p.propagar();
        await p.recarregarCom([portaria]);
        expect(p.store.mensagemDeErro()).toBeNull();
      },
    );
  });
});
