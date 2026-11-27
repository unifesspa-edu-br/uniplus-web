import {
  duplicado,
  ESCRITA,
  falhaInterna,
  FORMULARIO,
  processando,
  recusaDoPercentual,
  referencia,
  URL_DA_REFERENCIA,
  RESERVA,
  type PaginaDeReservaDemografica,
} from './reserva-demografica.testing';
import {
  PaginaDeCadastro,
  problema,
} from '../../shared/cadastro-em-teste/pagina-de-cadastro.testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Reserva demográfica — escritas pela interface', () => {
  let pagina: PaginaDeReservaDemografica;

  beforeEach(async () => {
    pagina = await PaginaDeCadastro.montar(RESERVA);
  });

  afterEach(() => pagina.controller.verify());

  describe('formulário', () => {
    it('durante o envio fica somente leitura, mantém o foco no botão e recusa fechar', async () => {
      await pagina.preencher();
      await pagina.enviar();
      const post = pagina.controller.expectOne(ESCRITA);
      expect(pagina.elemento<HTMLFieldSetElement>('fieldset.form-drawer__campos').disabled).toBe(
        true,
      );
      for (const nome of ['censoReferencia', 'ppiPercentual', 'baseLegal']) {
        expect(pagina.indisponivel(`[formcontrolname="${nome}"]`)).toBe(true);
      }
      expect(pagina.campo('censoReferencia').value).toBe('2010');
      expect(pagina.edicao.salvando()).toBe(true);
      expect(pagina.salvar().getAttribute('aria-disabled')).toBe('true');
      expect(pagina.salvar().getAttribute('aria-busy')).toBe('true');
      expect(pagina.salvar().textContent).toContain('Salvando...');
      await pagina.aguardarFoco();
      expect(document.activeElement).toBe(pagina.salvar());
      expect(pagina.elemento('dialog .sr-only[role="status"]').textContent).toContain('Salvando');
      expect(pagina.indisponivel('.form-drawer__footer .btn--tertiary')).toBe(true);
      const dialog = pagina.elemento<HTMLDialogElement>(
        'dialog[aria-label="Formulário de referência demográfica"]',
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

    it('com a recusa do servidor, leva o foco ao campo recusado, renova a chave e não notifica', async () => {
      await pagina.preencher();
      await pagina.enviar();
      const primeira = pagina.controller.expectOne(ESCRITA);
      const chave = primeira.request.headers.get('Idempotency-Key');
      primeira.flush(...recusaDoPercentual);
      await pagina.aguardarFoco();
      expect(pagina.campo('ppiPercentual').getAttribute('aria-invalid')).toBe('true');
      expect(pagina.campo('ppiPercentual').closest('label')?.textContent).toContain(
        'Percentual recusado.',
      );
      expect(pagina.erroDoServidor).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(pagina.campo('ppiPercentual'));
      expect(pagina.indisponivel('[formcontrolname="ppiPercentual"]')).toBe(false);
      pagina.edicao.form.controls.ppiPercentual.setValue(60);
      await pagina.enviar();
      const segunda = pagina.controller.expectOne(ESCRITA);
      expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(chave);
      segunda.flush('id', { status: 201, statusText: 'Created' });
      await pagina.concluirRecarga();
    });

    it('reenviar sem editar o campo recusado volta a enviar o formulário à API', async () => {
      await pagina.preencher();
      await pagina.enviar();
      pagina.controller.expectOne(ESCRITA).flush(...recusaDoPercentual);
      await pagina.aguardarFoco();

      await pagina.enviar();

      pagina.controller.expectOne(ESCRITA).flush(...recusaDoPercentual);
      await pagina.aguardarFoco();
    });

    it('o censo travado na edição continua travado depois da recusa e do sucesso', async () => {
      pagina.edicao.abrirEdicao(referencia);
      pagina.edicao.salvar();
      await pagina.propagar();
      expect(pagina.indisponivel('[formcontrolname="censoReferencia"]')).toBe(true);
      await pagina.responder(URL_DA_REFERENCIA, recusaDoPercentual);
      expect(pagina.edicao.form.controls.censoReferencia.disabled).toBe(true);
      expect(pagina.indisponivel('[formcontrolname="censoReferencia"]')).toBe(true);
      expect(pagina.indisponivel('[formcontrolname="ppiPercentual"]')).toBe(false);
      expect(document.activeElement).toBe(pagina.campo('ppiPercentual'));
      pagina.edicao.form.controls.ppiPercentual.setValue(60);
      pagina.edicao.salvar();
      pagina.controller
        .expectOne(URL_DA_REFERENCIA)
        .flush(null, { status: 204, statusText: 'No Content' });
      await pagina.concluirRecarga();
      expect(pagina.edicao.form.controls.censoReferencia.disabled).toBe(true);
      expect(pagina.sucesso).toHaveBeenCalledExactlyOnceWith('Referência atualizada');
    });

    it('com Enter num campo e falha 500, leva o foco ao botão, notifica e mantém a chave para o reenvio', async () => {
      await pagina.preencher();
      pagina.campo('baseLegal').focus();
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
      expect(pagina.indisponivel('[formcontrolname="baseLegal"]')).toBe(false);
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
      expect(document.activeElement).toBe(pagina.campo('censoReferencia'));
      expect(pagina.campo('censoReferencia').getAttribute('aria-invalid')).toBe('true');
    });

    it('só o código de duplicidade marca o campo do censo, renova a chave e não notifica', async () => {
      await pagina.preencher();
      await pagina.enviar();
      const primeira = pagina.controller.expectOne(ESCRITA);
      const chave = primeira.request.headers.get('Idempotency-Key');
      primeira.flush(...duplicado);
      await pagina.aguardarFoco();
      expect(pagina.campo('censoReferencia').getAttribute('aria-invalid')).toBe('true');
      expect(pagina.campo('censoReferencia').closest('label')?.textContent).toContain('Já existe');
      expect(document.activeElement).toBe(pagina.campo('censoReferencia'));
      expect(pagina.erroDoServidor).not.toHaveBeenCalled();
      expect(pagina.edicao.erro()).toBeNull();
      pagina.edicao.form.controls.censoReferencia.setValue('2011');
      await pagina.enviar();
      const segunda = pagina.controller.expectOne(ESCRITA);
      expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(chave);
      segunda.flush('id', { status: 201, statusText: 'Created' });
      await pagina.concluirRecarga();
    });

    it('a duplicidade na edição, com o censo travado, vira mensagem geral e não invalida o formulário', async () => {
      pagina.edicao.abrirEdicao(referencia);
      pagina.edicao.salvar();
      await pagina.propagar();
      await pagina.responder(URL_DA_REFERENCIA, duplicado);
      expect(pagina.edicao.erro()).toBe('Já existe uma referência ativa para este Censo');
      expect(pagina.edicao.form.controls.censoReferencia.errors).toBeNull();
      expect(pagina.edicao.form.invalid).toBe(false);
      expect(pagina.erroDoServidor).not.toHaveBeenCalled();
      pagina.edicao.salvar();
      pagina.controller
        .expectOne(URL_DA_REFERENCIA)
        .flush(null, { status: 204, statusText: 'No Content' });
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
      expect(pagina.campo('censoReferencia').getAttribute('aria-invalid')).toBeNull();
      expect(pagina.erroDoServidor).not.toHaveBeenCalled();
      await pagina.enviar();
      const segunda = pagina.controller.expectOne(ESCRITA);
      expect(segunda.request.headers.get('Idempotency-Key')).toBe(chave);
      segunda.flush('id', { status: 201, statusText: 'Created' });
      await pagina.concluirRecarga();
    });

    it('outro 409 renova a chave e mostra a mensagem geral sem notificar', async () => {
      await pagina.preencher();
      await pagina.enviar();
      const primeira = pagina.controller.expectOne(ESCRITA);
      const chave = primeira.request.headers.get('Idempotency-Key');
      primeira.flush(...problema(409, 'uniplus.idempotency.body_mismatch', 'Corpo divergente'));
      await pagina.aguardarFoco();
      expect(pagina.edicao.erro()).toBe('Corpo divergente');
      expect(pagina.campo('censoReferencia').getAttribute('aria-invalid')).toBeNull();
      expect(pagina.erroDoServidor).not.toHaveBeenCalled();
      await pagina.enviar();
      const segunda = pagina.controller.expectOne(ESCRITA);
      expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(chave);
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

    it('limpa a mensagem geral no início de um novo envio, mesmo barrado localmente', async () => {
      await pagina.preencher();
      await pagina.enviar();
      pagina.controller.expectOne(ESCRITA).flush(...falhaInterna);
      await pagina.aguardarFoco();
      expect(pagina.edicao.erro()).toBe('Erro interno');
      pagina.edicao.form.controls.censoReferencia.setValue('');
      await pagina.enviar();
      await pagina.aguardarFoco();
      expect(pagina.edicao.erro()).toBeNull();
      pagina.controller.expectNone(ESCRITA);
      expect(document.activeElement).toBe(pagina.campo('censoReferencia'));
    });
  });
});
