import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ESCRITA,
  LISTA,
  TITULO_DA_LISTA,
  banca,
  montarPaginaDeRecusas,
  problema,
  sucesso,
  type PaginaDeRecusas,
} from './tipos-banca.recusas.testing';

describe('TiposBancaPage — recusas e foco', () => {
  let p: PaginaDeRecusas;

  beforeEach(async () => {
    p = await montarPaginaDeRecusas();
  });
  afterEach(() => p.controller.verify());

  describe('conflito de idempotência ao salvar', () => {
    it('conflito de processamento mantém a chave e mostra a mensagem no alerta, sem marcar campo', async () => {
      await p.abrirEdicao();
      const primeira = await p.enviar();
      const chave = primeira.request.headers.get('Idempotency-Key');
      primeira.flush(...problema(409, { code: 'uniplus.idempotency.processing_conflict' }));
      await p.propagar();
      expect(p.edicao.erro()).not.toBeNull();
      expect(p.elemento('ui-drawer ui-alert').textContent).toContain(p.edicao.erro());
      expect(p.fixture.nativeElement.querySelector('.field.is-error')).toBeNull();
      const segunda = await p.enviar();
      expect(segunda.request.headers.get('Idempotency-Key')).toBe(chave);
      segunda.flush(...sucesso());
      await p.recarregarCom([banca]);
    });

    it('corpo divergente renova a chave', async () => {
      await p.abrirEdicao();
      const primeira = await p.enviar();
      const chave = primeira.request.headers.get('Idempotency-Key');
      primeira.flush(...problema(422, { code: 'uniplus.idempotency.body_mismatch' }));
      await p.propagar();
      const segunda = await p.enviar();
      expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(chave);
      segunda.flush(...sucesso());
      await p.recarregarCom([banca]);
    });

    it('falha de validação do servidor renova a chave', async () => {
      await p.abrirEdicao();
      const primeira = await p.enviar();
      const chave = primeira.request.headers.get('Idempotency-Key');
      primeira.flush(
        ...problema(422, {
          code: 'uniplus.validacao',
          errors: [
            {
              field: 'Nome',
              code: 'uniplus.configuracao.tipo_banca.nome_tamanho',
              message: 'Nome longo.',
            },
          ],
        }),
      );
      await p.propagar();
      p.edicao.form.controls.nome.setValue('Banca de Entrevista (revisada)');
      const segunda = await p.enviar();
      expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(chave);
      segunda.flush(...sucesso());
      await p.recarregarCom([banca]);
    });

    it('reenviar sem editar o campo recusado volta a enviar o formulário à API', async () => {
      const recusaDoNome = problema(422, {
        code: 'uniplus.validacao',
        errors: [
          {
            field: 'Nome',
            code: 'uniplus.configuracao.tipo_banca.nome_tamanho',
            message: 'Nome longo.',
          },
        ],
      });
      await p.abrirEdicao();
      (await p.enviar()).flush(...recusaDoNome);
      await p.propagar();

      (await p.enviar()).flush(...recusaDoNome);
      await p.propagar();
    });
  });

  describe('escrita em curso', () => {
    it('salvar pendente não se apresenta como remoção, e o clique em Salvar nem chega a submeter', async () => {
      await p.abrirEdicao();
      const requisicao = await p.enviar();
      expect(p.edicao.salvando()).toBe(true);
      expect(p.edicao.removendo()).toBe(false);
      expect(p.elemento('cfg-tipos-banca-lista').textContent).not.toContain('Removendo');
      let submissoes = 0;
      p.elemento('#cfg-tipo-banca-form').addEventListener('submit', () => (submissoes += 1));
      p.salvar().click();
      expect(submissoes).toBe(0);
      requisicao.flush(...sucesso());
      await p.recarregarCom([banca]);
    });

    it('depois de remover, a espera pela recarga não se apresenta como remoção', async () => {
      (await p.confirmarRemocao()).flush(...sucesso());
      await p.propagar();
      expect(p.edicao.gravando()).toBe(true);
      expect(p.edicao.removendo()).toBe(false);
      await p.recarregarCom([]);
    });

    it('confirmar sem ter pedido a remoção não envia nada', () => {
      p.edicao.removerConfirmado();
      p.controller.expectNone(ESCRITA);
    });
  });

  describe('anúncios do salvamento', () => {
    it('anuncia no drawer o andamento e a recusa dos campos, e não repete na página', async () => {
      await p.abrirEdicao();
      const requisicao = await p.enviar();
      expect(p.elemento('ui-drawer [role="status"]').textContent).toContain('Salvando');
      requisicao.flush(
        ...problema(422, {
          code: 'uniplus.validacao',
          errors: [
            {
              field: 'Nome',
              code: 'uniplus.configuracao.tipo_banca.nome_tamanho',
              message: 'Nome longo.',
            },
          ],
        }),
      );
      await p.propagar();
      expect(p.elemento('ui-drawer [role="status"]').textContent).toContain('Revise os campos');
      expect(p.statusDaPagina()).toBe('');
    });

    it('falha geral é anunciada só pelo alerta, não pela região de status', async () => {
      await p.abrirEdicao();
      (await p.enviar()).flush(...problema(500, { code: 'uniplus.erro' }));
      await p.propagar();
      expect(p.elemento('ui-drawer [role="status"]').textContent?.trim()).toBe('');
      expect(p.elemento('ui-drawer ui-alert').textContent).toContain(p.edicao.erro());
    });

    it('anuncia na página o desfecho do salvamento depois de o drawer fechar', async () => {
      await p.abrirEdicao();
      (await p.enviar()).flush(...sucesso());
      await p.recarregarCom([banca]);
      expect(p.statusDaPagina()).toBe('Tipo de banca atualizado.');
      await p.abrirEdicao();
      expect(p.statusDaPagina()).toBe('');
    });
  });

  describe('recarga depois da escrita', () => {
    it('mantém as ações indisponíveis até a lista refletir o que foi gravado', async () => {
      await p.abrirEdicao();
      (await p.enviar()).flush(...sucesso());
      await p.propagar();
      expect(p.edicao.salvando()).toBe(false);
      expect(p.edicao.gravando()).toBe(true);
      expect(p.editar().matches(':disabled')).toBe(true);
      await p.recarregarCom([banca]);
      expect(p.edicao.gravando()).toBe(false);
      expect(p.editar().matches(':disabled')).toBe(false);
    });

    it('libera as ações quando a recarga falha', async () => {
      await p.abrirEdicao();
      (await p.enviar()).flush(...sucesso());
      await p.propagar();
      p.controller
        .expectOne((r) => r.url === LISTA)
        .flush(...problema(503, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();
      expect(p.edicao.gravando()).toBe(false);
    });
  });

  describe('foco depois de salvar', () => {
    const campoNome = (): HTMLInputElement => p.elemento('input[formcontrolname="nome"]');
    const enviarComEnter = async (): Promise<void> => {
      campoNome().focus();
      p.elemento<HTMLFormElement>('#cfg-tipo-banca-form').dispatchEvent(
        new Event('submit', { cancelable: true }),
      );
      await p.propagar();
    };

    it('Enter no campo, com o envio em curso, leva o foco ao botão de salvar', async () => {
      await p.abrirEdicao();
      await enviarComEnter();
      p.controller.expectOne(ESCRITA);
      expect(campoNome().matches(':disabled')).toBe(true);
      expect(document.activeElement).toBe(p.salvar());
    });

    it('Enter no campo, com o envio barrado pela validação, mantém o foco no campo', async () => {
      await p.abrirEdicao();
      p.edicao.form.controls.nome.setValue('');
      await enviarComEnter();
      p.controller.expectNone(ESCRITA);
      expect(document.activeElement).toBe(campoNome());
    });

    it('envio barrado com o foco no botão de salvar leva o foco ao primeiro campo inválido', async () => {
      await p.abrirEdicao();
      p.edicao.form.controls.nome.setValue('');
      p.salvar().focus();
      p.elemento<HTMLFormElement>('#cfg-tipo-banca-form').dispatchEvent(
        new Event('submit', { cancelable: true }),
      );
      await p.propagar();
      await p.propagar();
      p.controller.expectNone(ESCRITA);
      expect(document.activeElement).toBe(campoNome());
    });

    it('cancelar devolve o foco ao botão que abriu o drawer', async () => {
      await p.abrirEdicao();
      const cancelar = [...p.fixture.nativeElement.querySelectorAll('button')].find(
        (botao: HTMLButtonElement) => botao.textContent?.trim() === 'Cancelar',
      ) as HTMLButtonElement;
      cancelar.click();
      await p.propagar();
      expect(document.activeElement).toBe(p.editar());
    });

    it('salvar com a linha ainda presente na recarga devolve o foco ao botão da linha', async () => {
      await p.abrirEdicao();
      (await p.enviar()).flush(...sucesso());
      await p.recarregarCom([banca]);
      expect(document.activeElement).toBe(p.editar());
    });

    it('salvar com a recarga sem a linha leva o foco ao título da lista', async () => {
      await p.abrirEdicao();
      (await p.enviar()).flush(...sucesso());
      await p.recarregarCom([]);
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('salvar com falha na recarga leva o foco ao título da lista', async () => {
      await p.abrirEdicao();
      (await p.enviar()).flush(...sucesso());
      await p.propagar();
      p.controller
        .expectOne((r) => r.url === LISTA)
        .flush(...problema(503, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });
  });
});
