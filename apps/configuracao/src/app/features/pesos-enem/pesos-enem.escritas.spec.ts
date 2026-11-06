import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CRIADO,
  ESCRITA,
  PaginaDeTeste,
  RES_805,
  SEM_CORPO,
  linhas805,
  recusa,
  indisponivel,
} from './pesos-enem.testing';

const DRAWER = 'dialog[aria-label="Formulário de nova resolução de pesos do ENEM"]';

describe('PesosEnemPage — escritas pela interface', () => {
  let t: PaginaDeTeste;

  beforeEach(() => {
    t = new PaginaDeTeste();
  });
  afterEach(() => t.verificar());

  const submeter = (): void => {
    t.elemento('#cfg-pesos-enem-form').dispatchEvent(new Event('submit', { cancelable: true }));
  };
  const cancelarDoDrawer = (): HTMLButtonElement =>
    [...t.raiz.querySelectorAll<HTMLButtonElement>('.form-drawer__footer button')].find(
      (botao) => botao.textContent?.trim() === 'Cancelar',
    ) as HTMLButtonElement;
  const responderCadastro = async (
    envios: ReturnType<typeof t.controller.match>,
  ): Promise<void> => {
    envios.forEach((envio, indice) => envio.flush(`novo-id-${indice}`, CRIADO));
    await t.propagar();
  };

  describe('cadastro pendente', () => {
    beforeEach(async () => {
      await t.carregarUmaPagina([...linhas805]);
    });

    it('deixa o formulário somente leitura, com foco no botão, sem fechar por Cancelar, X nem Esc', async () => {
      await t.abrirCadastro();
      const envios = await t.enviarCadastro();
      const botao = t.elemento<HTMLButtonElement>('button[form="cfg-pesos-enem-form"]');

      expect(envios).toHaveLength(4);
      expect(
        t.elemento<HTMLInputElement>('[formcontrolname="resolucao"]').matches(':disabled'),
      ).toBe(true);
      expect(t.elemento<HTMLInputElement>('[formcontrolname="resolucao"]').value).toBe(
        'Res. 900/2026',
      );
      expect(botao.getAttribute('aria-disabled')).toBe('true');
      expect(botao.getAttribute('aria-busy')).toBe('true');
      expect(botao.textContent).toContain('Salvando...');
      expect(document.activeElement).toBe(botao);
      expect(t.elemento(`${DRAWER} [role="status"]`).textContent).toContain('Criando a resolução');
      expect(t.elemento<HTMLButtonElement>(`${DRAWER} button[aria-label="Fechar"]`).disabled).toBe(
        true,
      );
      expect(cancelarDoDrawer().matches(':disabled')).toBe(true);
      t.elemento(DRAWER).dispatchEvent(new Event('cancel', { cancelable: true }));
      await t.propagar();
      expect(t.criacao.aberto()).toBe(true);

      await responderCadastro(envios);
      await t.recarregarCom([...linhas805]);
      expect(t.criacao.aberto()).toBe(false);
    });

    it('clique e submissão repetidos não geram segundo envio', async () => {
      await t.abrirCadastro();
      const envios = await t.enviarCadastro();
      const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
      t.elemento('button[form="cfg-pesos-enem-form"]').dispatchEvent(clique);
      submeter();
      await t.propagar();

      expect(clique.defaultPrevented).toBe(true);
      t.controller.expectNone((r) => r.method === 'POST');
      await responderCadastro(envios);
      await t.recarregarCom([...linhas805]);
    });

    it('o cadastro não se apresenta como edição nem como remoção, mesmo na espera pela recarga', async () => {
      await t.abrirCadastro();
      const envios = await t.enviarCadastro();
      expect(t.gravacao.criando()).toBe(true);
      expect(t.gravacao.salvandoEdicao()).toBe(false);
      expect(t.gravacao.removendo()).toBe(false);

      await responderCadastro(envios);
      expect(t.gravacao.criando()).toBe(false);
      expect(t.gravacao.gravando()).toBe(true);
      expect(indisponivel(t.botao('Editar parâmetros'))).toBe(true);
      expect(t.botao('Editar parâmetros').textContent).not.toContain('Salvando');
      await t.recarregarCom([...linhas805]);
      expect(t.gravacao.gravando()).toBe(false);
    });

    it('Enter num campo leva o foco ao botão e, na falha 500, o envio segue disponível', async () => {
      await t.abrirCadastro();
      t.elemento<HTMLInputElement>('[formcontrolname="resolucao"]').focus();
      submeter();
      await t.propagar();
      const envios = t.controller.match((r) => r.url === ESCRITA && r.method === 'POST');
      const botao = t.elemento<HTMLButtonElement>('button[form="cfg-pesos-enem-form"]');

      expect(envios).toHaveLength(4);
      expect(t.elemento('[formcontrolname="resolucao"]').matches(':disabled')).toBe(true);
      expect(document.activeElement).toBe(botao);
      for (const envio of envios) {
        envio.flush(...recusa(500, 'uniplus.internal.unexpected'));
      }
      await t.propagar();
      await t.propagar();

      expect(t.elemento('[formcontrolname="resolucao"]').matches(':disabled')).toBe(false);
      expect(t.elemento(`${DRAWER} ui-alert`).textContent).toContain('4 de 4 grupo(s)');
      expect(document.activeElement).toBe(botao);
      expect(botao.getAttribute('aria-disabled')).toBeNull();
      submeter();
      const reenvio = t.controller.match((r) => r.url === ESCRITA && r.method === 'POST');
      await responderCadastro(reenvio);
      await t.recarregarCom([...linhas805]);
    });

    it('recusa de campo leva o foco ao campo recusado e a mensagem fica visível', async () => {
      await t.abrirCadastro();
      const envios = await t.enviarCadastro();
      for (const envio of envios) {
        envio.flush(
          ...recusa(422, 'uniplus.configuracao.peso_area_enem.resolucao_tamanho', [
            {
              field: 'resolucao',
              code: 'uniplus.configuracao.peso_area_enem.resolucao_tamanho',
              message: 'Resolução longa demais.',
            },
          ]),
        );
      }
      await t.propagar();
      await t.propagar();

      const campo = t.elemento<HTMLInputElement>('[formcontrolname="resolucao"]');
      expect(campo.getAttribute('aria-invalid')).toBe('true');
      expect(t.elemento(`${DRAWER} .field__error`).textContent).toContain(
        'Resolução longa demais.',
      );
      expect(document.activeElement).toBe(campo);
    });

    it('envio barrado localmente leva o foco ao primeiro campo inválido', async () => {
      await t.abrirCadastro();
      t.preencher('[formcontrolname="resolucao"]', '');
      t.elemento<HTMLButtonElement>('button[form="cfg-pesos-enem-form"]').focus();
      submeter();
      await t.propagar();
      await t.propagar();

      t.controller.expectNone((r) => r.method === 'POST');
      const campo = t.elemento<HTMLInputElement>('[formcontrolname="resolucao"]');
      expect(campo.getAttribute('aria-invalid')).toBe('true');
      expect(campo.getAttribute('aria-required')).toBe('true');
      expect(document.activeElement).toBe(campo);
    });

    it('um novo envio, ainda que barrado pela validação, retira a recusa anterior da tela', async () => {
      await t.abrirCadastro();
      for (const envio of await t.enviarCadastro()) {
        envio.flush(...recusa(500, 'uniplus.internal.unexpected'));
      }
      await t.propagar();
      expect(t.raiz.querySelector(`${DRAWER} ui-alert`)).not.toBeNull();

      t.preencher('[formcontrolname="resolucao"]', '');
      submeter();
      await t.propagar();

      expect(t.raiz.querySelector(`${DRAWER} ui-alert`)).toBeNull();
      t.controller.expectNone((r) => r.method === 'POST');
    });
  });

  describe('campo desabilitado por regra de negócio', () => {
    it.each(['sucesso', 'recusa'] as const)('continua desabilitado após %s', async (desfecho) => {
      await t.carregarUmaPagina([...linhas805]);
      await t.abrirCadastro();
      t.criacao.form.controls.baseLegalGlobal.disable();
      const envios = await t.enviarCadastro();
      expect(t.criacao.form.controls.baseLegalGlobal.disabled).toBe(true);

      for (const envio of envios) {
        if (desfecho === 'sucesso') envio.flush('novo-id', CRIADO);
        else envio.flush(...recusa(500, 'uniplus.internal.unexpected'));
      }
      await t.propagar();

      expect(t.criacao.form.controls.baseLegalGlobal.disabled).toBe(true);
      expect(t.criacao.form.controls.resolucao.enabled).toBe(true);
      if (desfecho === 'sucesso') await t.recarregarCom([...linhas805]);
    });
  });

  describe('edição em linha pendente', () => {
    beforeEach(async () => {
      await t.carregarUmaPagina([...linhas805]);
      await t.abrirEdicao();
    });

    it('deixa a grade somente leitura, com foco no botão, sem fechar por Cancelar nem Esc', async () => {
      const envios = await t.enviarEdicao();
      const salvar = t.botao('Salvando...');

      expect(envios).toHaveLength(4);
      expect(t.inputDaEdicao('peso', 0, 0).matches(':disabled')).toBe(true);
      expect(t.inputDaEdicao('peso', 0, 0).value).toBe('1');
      expect(salvar.getAttribute('aria-disabled')).toBe('true');
      expect(salvar.getAttribute('aria-busy')).toBe('true');
      expect(document.activeElement).toBe(salvar);
      expect(t.botao('Cancelar').matches(':disabled')).toBe(true);
      expect(t.gravacao.salvandoEdicao()).toBe(true);
      t.elemento('.pe-grid').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      await t.propagar();
      expect(t.edicao.emEdicao()).toBe(RES_805);

      envios.forEach((envio) => envio.flush(null, SEM_CORPO));
      await t.propagar();
      expect(t.edicao.emEdicao()).toBeNull();
    });

    it('o segundo clique em Salvar não reenvia', async () => {
      const envios = await t.enviarEdicao();
      const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
      t.elemento('#grid-pe-bar .btn--primary').dispatchEvent(clique);
      await t.propagar();

      t.controller.expectNone((r) => r.method === 'PUT');
      envios.forEach((envio) => envio.flush(null, SEM_CORPO));
      await t.propagar();
    });

    it('deixa indisponíveis editar, remover e cadastrar enquanto grava, sem abrir nada', async () => {
      const envios = await t.enviarEdicao();
      const editar = t.elemento<HTMLButtonElement>('#pe-editar-res-805-2024');
      const remover = t.elemento<HTMLButtonElement>('#pe-remover-res-805-2024');
      const cadastrar = t.botao('Cadastrar nova resolução');

      for (const botao of [editar, remover, cadastrar]) {
        expect(indisponivel(botao)).toBe(true);
        botao.click();
      }
      await t.propagar();

      expect(t.criacao.aberto()).toBe(false);
      expect(t.remocao.confirmando()).toBe(false);
      envios.forEach((envio) => envio.flush(null, SEM_CORPO));
      await t.propagar();
    });

    it('após o sucesso o foco volta ao botão que abriu a edição', async () => {
      const envios = await t.enviarEdicao();
      envios.forEach((envio) => envio.flush(null, SEM_CORPO));
      await t.propagar();
      await t.propagar();

      expect(document.activeElement).toBe(t.elemento('#pe-editar-res-805-2024'));
    });

    it('cancelar devolve o foco ao botão que abriu a edição', async () => {
      await t.acionar(t.botao('Cancelar'));
      await t.propagar();

      expect(t.edicao.emEdicao()).toBeNull();
      expect(document.activeElement).toBe(t.elemento('#pe-editar-res-805-2024'));
    });

    it('a recusa de um campo leva o foco a ele e o botão de salvar volta a ficar disponível', async () => {
      const envios = await t.enviarEdicao();
      envios[0]?.flush(
        ...recusa(422, 'uniplus.configuracao.peso_area_enem.corte_excede_maximo', [
          {
            field: 'areas[3].corte',
            code: 'uniplus.configuracao.peso_area_enem.corte_excede_maximo',
            message: 'Corte acima do máximo.',
          },
        ]),
      );
      envios.slice(1).forEach((envio) => envio.flush(null, SEM_CORPO));
      await t.propagar();
      await t.propagar();

      const campo = t.inputDaEdicao('corte', 0, 3);
      expect(campo.getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(campo);
      expect(t.botao('Salvar').getAttribute('aria-disabled')).toBeNull();
    });

    it('a recusa sem campo mantém o foco no botão de salvar', async () => {
      const envios = await t.enviarEdicao();
      envios.forEach((envio) => envio.flush(...recusa(500, 'uniplus.internal.unexpected')));
      await t.propagar();
      await t.propagar();

      expect(t.elemento('#grid-pe-bar ui-alert').textContent).toContain('4 de 4 grupo(s)');
      expect(document.activeElement).toBe(t.botao('Salvar'));
    });

    it('envio barrado localmente leva o foco ao primeiro campo inválido', async () => {
      t.inputDaEdicao('peso', 0, 1).value = '-1';
      t.inputDaEdicao('peso', 0, 1).dispatchEvent(new Event('input'));
      await t.acionar(t.botao('Salvar'));
      await t.propagar();

      t.controller.expectNone((r) => r.method === 'PUT');
      expect(document.activeElement).toBe(t.inputDaEdicao('peso', 0, 1));
      expect(t.inputDaEdicao('peso', 0, 1).getAttribute('aria-required')).toBe('true');
    });
  });

  describe('escritas concorrentes', () => {
    it('salvar durante o cadastro, cadastrar durante a edição e remover durante qualquer uma não geram requisição', async () => {
      await t.carregarUmaPagina([...linhas805]);
      await t.abrirCadastro();
      const envios = await t.enviarCadastro();

      t.criacao.criar();
      t.edicao.pedirEdicao(RES_805);
      t.edicao.salvar();
      t.remocao.pedir(RES_805);
      t.remocao.confirmar();
      t.controller.expectNone(
        (r) => r.method === 'POST' || r.method === 'PUT' || r.method === 'DELETE',
      );
      expect(t.edicao.emEdicao()).toBeNull();
      expect(t.remocao.confirmando()).toBe(false);

      await responderCadastro(envios);
      await t.recarregarCom([...linhas805]);
    });

    it('confirmar sem ter pedido a remoção não envia nada', async () => {
      await t.carregarUmaPagina([...linhas805]);
      t.remocao.confirmar();
      t.controller.expectNone((r) => r.method === 'DELETE');
    });
  });

  describe('recarga depois da escrita', () => {
    it('mantém as ações indisponíveis até a lista refletir o que foi gravado', async () => {
      await t.carregarUmaPagina([...linhas805]);
      await t.abrirCadastro();
      await responderCadastro(await t.enviarCadastro());

      expect(t.gravacao.criando()).toBe(false);
      expect(t.gravacao.gravando()).toBe(true);
      expect(indisponivel(t.botao('Editar parâmetros'))).toBe(true);
      await t.recarregarCom([...linhas805]);
      expect(indisponivel(t.botao('Editar parâmetros'))).toBe(false);
    });

    it('libera as ações e permite nova leitura se a recarga após o cadastro falhar', async () => {
      await t.carregarUmaPagina([...linhas805]);
      await t.abrirCadastro();
      await responderCadastro(await t.enviarCadastro());
      await t.propagar();
      t.expectListagem().flush(...recusa(503, 'uniplus.internal.unexpected'));
      await t.propagar();

      expect(t.gravacao.gravando()).toBe(false);
      const tentar = t.elemento<HTMLButtonElement>('#cfg-pesos-enem-registros-tentar');
      expect(tentar.getAttribute('aria-disabled')).toBeNull();
      await t.acionar(tentar);
      await t.recarregarCom([...linhas805]);
      expect(t.store.mensagemDeErro()).toBeNull();
    });

    it('"Tentar novamente" da listagem fica indisponível enquanto grava', async () => {
      await t.carregarUmaPagina([...linhas805]);
      await t.abrirEdicao();
      t.store.recarregar();
      await t.propagar();
      t.expectListagem().flush(...recusa(503, 'uniplus.internal.unexpected'));
      await t.propagar();
      const envios = await t.enviarEdicao();

      const tentar = t.elemento<HTMLButtonElement>('#cfg-pesos-enem-registros-tentar');
      expect(tentar.getAttribute('aria-disabled')).toBe('true');
      await t.acionar(tentar);
      t.controller.expectNone((r) => r.method === 'GET' && r.url.endsWith('pesos-area-enem'));
      envios.forEach((envio) => envio.flush(null, SEM_CORPO));
      await t.propagar();
    });
  });
});
