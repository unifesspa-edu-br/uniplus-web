import {
  duplicado,
  ESCRITA,
  falhaInterna,
  FORMULARIO,
  pcd,
  processando,
  recusaDoCodigo,
  URL_PCD,
  CONDICOES,
  type PaginaDeCondicoes,
} from './condicoes-atendimento.testing';
import {
  PaginaDeCadastro,
  problema,
} from '../../shared/cadastro-em-teste/pagina-de-cadastro.testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Condições de atendimento — escritas pela interface', () => {
  let pagina: PaginaDeCondicoes;

  beforeEach(async () => {
    pagina = await PaginaDeCadastro.montar(CONDICOES);
  });

  afterEach(() => pagina.controller.verify());

  describe('formulário', () => {
    it('identifica os campos obrigatórios para tecnologias assistivas', async () => {
      await pagina.preencher();
      for (const nome of ['codigo', 'nome']) {
        expect(pagina.campo(nome).getAttribute('aria-required')).toBe('true');
      }
    });

    it('durante o envio fica somente leitura, mantém o foco no botão e recusa fechar', async () => {
      await pagina.preencher();
      await pagina.enviar();
      const post = pagina.controller.expectOne(ESCRITA);
      expect(pagina.elemento<HTMLFieldSetElement>('fieldset.form-drawer__campos').disabled).toBe(
        true,
      );
      for (const nome of ['codigo', 'nome', 'descricao']) {
        expect(pagina.indisponivel(`[formcontrolname="${nome}"]`)).toBe(true);
      }
      expect(pagina.campo('codigo').value).toBe('DISLEXIA');
      expect(pagina.edicao.salvando()).toBe(true);
      expect(pagina.salvar().getAttribute('aria-disabled')).toBe('true');
      expect(pagina.salvar().getAttribute('aria-busy')).toBe('true');
      expect(pagina.salvar().textContent).toContain('Salvando...');
      await pagina.aguardarFoco();
      expect(document.activeElement).toBe(pagina.salvar());
      expect(pagina.elemento('dialog .sr-only[role="status"]').textContent).toContain('Salvando');
      expect(pagina.indisponivel('.form-drawer__footer .btn--tertiary')).toBe(true);
      const dialog = pagina.elemento<HTMLDialogElement>(
        'dialog[aria-label="Formulário da condição de atendimento"]',
      );
      expect(dialog.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled).toBe(
        true,
      );
      dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
      pagina.edicao.fechar();
      await pagina.propagar();
      expect(pagina.edicao.aberto()).toBe(true);
      post.flush('novo-id', { status: 201, statusText: 'Created' });
      await pagina.concluirRecarga();
      expect(pagina.edicao.aberto()).toBe(false);
    });

    it('recusa clique e submissão enquanto o envio está em curso', async () => {
      const chamada = vi.spyOn(pagina.edicao, 'salvar');
      await pagina.preencher();
      await pagina.enviar();
      const post = pagina.controller.expectOne(ESCRITA);
      const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
      pagina.salvar().dispatchEvent(clique);
      pagina
        .elemento<HTMLFormElement>(FORMULARIO)
        .dispatchEvent(new Event('submit', { cancelable: true }));
      await pagina.propagar();
      expect(clique.defaultPrevented).toBe(true);
      expect(chamada).toHaveBeenCalledTimes(1);
      post.flush('novo-id', { status: 201, statusText: 'Created' });
      await pagina.concluirRecarga();
    });

    it('com a recusa do servidor, leva o foco ao campo recusado e renova a chave', async () => {
      await pagina.preencher();
      await pagina.enviar();
      const chave = pagina.controller.expectOne(ESCRITA);
      const primeira = chave.request.headers.get('Idempotency-Key');
      chave.flush(...recusaDoCodigo);
      await pagina.aguardarFoco();
      expect(pagina.campo('codigo').getAttribute('aria-invalid')).toBe('true');
      expect(pagina.campo('codigo').closest('label')?.textContent).toContain('Código recusado.');
      expect(pagina.erroDoServidor).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(pagina.campo('codigo'));
      expect(pagina.indisponivel('[formcontrolname="codigo"]')).toBe(false);
      pagina.edicao.form.controls.codigo.setValue('DISLEXIA2');
      await pagina.enviar();
      const segunda = pagina.controller.expectOne(ESCRITA);
      expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(primeira);
      segunda.flush('id', { status: 201, statusText: 'Created' });
      await pagina.concluirRecarga();
    });

    it('reenviar sem editar o campo recusado volta a enviar o formulário à API', async () => {
      await pagina.preencher();
      await pagina.enviar();
      pagina.controller.expectOne(ESCRITA).flush(...recusaDoCodigo);
      await pagina.aguardarFoco();

      await pagina.enviar();

      pagina.controller.expectOne(ESCRITA).flush(...recusaDoCodigo);
      await pagina.aguardarFoco();
    });

    it('a edição do código reservado continua travada depois da recusa e do sucesso', async () => {
      pagina.edicao.abrirEdicao(pcd);
      pagina.edicao.salvar();
      await pagina.propagar();
      expect(pagina.indisponivel('[formcontrolname="codigo"]')).toBe(true);
      await pagina.responder(
        URL_PCD,
        problema(422, 'uniplus.validacao', 'Dados inválidos', [
          { field: 'Nome', code: 'x', message: 'Nome recusado.' },
        ]),
      );
      expect(pagina.edicao.form.controls.codigo.disabled).toBe(true);
      expect(pagina.indisponivel('[formcontrolname="codigo"]')).toBe(true);
      expect(pagina.indisponivel('[formcontrolname="nome"]')).toBe(false);
      expect(document.activeElement).toBe(pagina.campo('nome'));
      pagina.edicao.form.controls.nome.setValue('Pcd revisada');
      pagina.edicao.salvar();
      pagina.controller.expectOne(URL_PCD).flush(null, { status: 204, statusText: 'No Content' });
      await pagina.concluirRecarga([pcd]);
      expect(pagina.edicao.form.controls.codigo.disabled).toBe(true);
    });

    it('com Enter num campo e falha 500, leva o foco ao botão e mantém a chave para o reenvio', async () => {
      await pagina.preencher();
      pagina.campo('nome').focus();
      pagina
        .elemento<HTMLFormElement>(FORMULARIO)
        .dispatchEvent(new Event('submit', { cancelable: true }));
      await pagina.propagar();
      await pagina.aguardarFoco();
      expect(document.activeElement).toBe(pagina.salvar());
      const requisicao = pagina.controller.expectOne(ESCRITA);
      const chave = requisicao.request.headers.get('Idempotency-Key');
      requisicao.flush(...falhaInterna);
      await pagina.aguardarFoco();
      expect(pagina.edicao.erro()).toBe('Erro interno');
      expect(pagina.erroDoServidor).toHaveBeenCalledTimes(1);
      expect(pagina.erroDoServidor.mock.calls[0][0]).toMatchObject({
        status: 500,
        code: 'uniplus.internal.unexpected',
      });
      expect(pagina.sucesso).not.toHaveBeenCalled();
      expect(pagina.elemento('dialog ui-alert').textContent).toContain('Erro interno');
      expect(pagina.indisponivel('[formcontrolname="nome"]')).toBe(false);
      expect(pagina.salvar().getAttribute('aria-disabled')).toBeNull();
      await pagina.enviar();
      const reenvio = pagina.controller.expectOne(ESCRITA);
      expect(reenvio.request.headers.get('Idempotency-Key')).toBe(chave);
      reenvio.flush('id', { status: 201, statusText: 'Created' });
      await pagina.concluirRecarga();
    });

    it('o envio barrado leva o foco ao primeiro campo inválido', async () => {
      pagina.novo().click();
      await pagina.propagar();
      await pagina.enviar();
      await pagina.aguardarFoco();
      pagina.controller.expectNone(ESCRITA);
      expect(document.activeElement).toBe(pagina.campo('codigo'));
      expect(pagina.campo('codigo').getAttribute('aria-invalid')).toBe('true');
    });

    it('só o código de duplicidade marca o campo e renova a chave', async () => {
      await pagina.preencher();
      await pagina.enviar();
      const primeira = pagina.controller.expectOne(ESCRITA);
      const chave = primeira.request.headers.get('Idempotency-Key');
      primeira.flush(...duplicado);
      await pagina.aguardarFoco();
      expect(pagina.campo('codigo').getAttribute('aria-invalid')).toBe('true');
      expect(pagina.campo('codigo').closest('label')?.textContent).toContain('Já existe');
      expect(pagina.erroDoServidor).not.toHaveBeenCalled();
      expect(pagina.edicao.erro()).toBeNull();
      pagina.edicao.form.controls.codigo.setValue('DISLEXIA2');
      await pagina.enviar();
      const segunda = pagina.controller.expectOne(ESCRITA);
      expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(chave);
      segunda.flush('id', { status: 201, statusText: 'Created' });
      await pagina.concluirRecarga();
    });

    it('o conflito de processamento mantém a chave, mostra a mensagem e não marca o campo', async () => {
      await pagina.preencher();
      await pagina.enviar();
      const primeira = pagina.controller.expectOne(ESCRITA);
      const chave = primeira.request.headers.get('Idempotency-Key');
      primeira.flush(...processando);
      await pagina.aguardarFoco();
      expect(pagina.edicao.erro()).toBe('A requisição anterior ainda está em processamento');
      expect(pagina.campo('codigo').getAttribute('aria-invalid')).toBeNull();
      expect(pagina.erroDoServidor).not.toHaveBeenCalled();
      await pagina.enviar();
      const segunda = pagina.controller.expectOne(ESCRITA);
      expect(segunda.request.headers.get('Idempotency-Key')).toBe(chave);
      segunda.flush('id', { status: 201, statusText: 'Created' });
      await pagina.concluirRecarga();
    });

    it('a recusa sem campo reconhecido vira mensagem geral', async () => {
      await pagina.preencher();
      await pagina.enviar();
      pagina.controller
        .expectOne(ESCRITA)
        .flush(
          ...problema(422, 'uniplus.validacao', 'Dados inválidos', [
            { field: 'Outro', code: 'x', message: 'Recusado.' },
          ]),
        );
      await pagina.aguardarFoco();
      expect(pagina.edicao.erro()).toContain('Não foi possível mapear');
    });
  });
});
