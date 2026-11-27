import {
  codigoDuplicado,
  criado,
  ESCRITA,
  falhaInterna,
  FORMULARIO,
  nomeDuplicado,
  type PaginaDeTiposDeficiencia,
  TIPOS,
  processando,
  recusaDoCodigo,
  semConteudo,
  URL_VISUAL,
} from './tipos-deficiencia.testing';
import {
  PaginaDeCadastro,
  problema,
  type RespostaDaApi,
} from '../../shared/cadastro-em-teste/pagina-de-cadastro.testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Tipos de deficiência — escritas pela interface', () => {
  let pagina: PaginaDeTiposDeficiencia;

  beforeEach(async () => {
    pagina = await PaginaDeCadastro.montar(TIPOS);
  });

  afterEach(() => pagina.controller.verify());

  describe('formulário', () => {
    it('identifica os campos obrigatórios para tecnologias assistivas', async () => {
      await pagina.preencher();
      for (const nome of ['nome', 'codigo', 'descricao']) {
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
      for (const nome of ['nome', 'codigo', 'descricao']) {
        expect(pagina.indisponivel(`[formcontrolname="${nome}"]`)).toBe(true);
      }
      expect(pagina.campo('codigo').value).toBe('AUDITIVA');
      expect(pagina.edicao.salvando()).toBe(true);
      expect(pagina.salvar().getAttribute('aria-disabled')).toBe('true');
      expect(pagina.salvar().getAttribute('aria-busy')).toBe('true');
      expect(pagina.salvar().textContent).toContain('Salvando...');
      await pagina.aguardarFoco();
      expect(document.activeElement).toBe(pagina.salvar());
      expect(pagina.elemento('dialog .sr-only[role="status"]').textContent).toContain('Salvando');
      expect(pagina.indisponivel('.form-drawer__footer .btn--tertiary')).toBe(true);
      const dialog = pagina.elemento<HTMLDialogElement>(
        'dialog[aria-label="Formulário do tipo de deficiência"]',
      );
      expect(dialog.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled).toBe(
        true,
      );
      dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
      pagina.edicao.fechar();
      await pagina.propagar();
      expect(pagina.edicao.aberto()).toBe(true);
      post.flush(...criado);
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
      post.flush(...criado);
      await pagina.concluirRecarga();
    });

    it('com a recusa do servidor, leva o foco ao campo recusado, renova a chave e não notifica', async () => {
      await pagina.preencher();
      await pagina.enviar();
      const envio = pagina.controller.expectOne(ESCRITA);
      const primeira = envio.request.headers.get('Idempotency-Key');
      envio.flush(...recusaDoCodigo);
      await pagina.aguardarFoco();
      expect(pagina.campo('codigo').getAttribute('aria-invalid')).toBe('true');
      expect(pagina.campo('codigo').closest('label')?.textContent).toContain('Código recusado.');
      expect(pagina.erroDoServidor).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(pagina.campo('codigo'));
      expect(pagina.indisponivel('[formcontrolname="codigo"]')).toBe(false);
      pagina.edicao.form.controls.codigo.setValue('AUDITIVA_2');
      await pagina.enviar();
      const segunda = pagina.controller.expectOne(ESCRITA);
      expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(primeira);
      segunda.flush(...criado);
      await pagina.concluirRecarga();
      expect(pagina.sucesso).toHaveBeenCalledExactlyOnceWith('Tipo de deficiência criado');
      expect(document.activeElement).toBe(pagina.novo());
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

    it('com Enter num campo e falha 500, leva o foco ao botão, notifica e mantém a chave para o reenvio', async () => {
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
      reenvio.flush(...criado);
      await pagina.concluirRecarga();
    });

    it.each<[string, RespostaDaApi]>([
      ['sucesso', criado],
      ['recusa', recusaDoCodigo],
    ])('preserva o controle desabilitado por regra após %s', async (resultado, resposta) => {
      await pagina.preencher();
      pagina.edicao.form.controls.descricao.disable();
      await pagina.propagar();
      await pagina.enviar();
      pagina.controller.expectOne(ESCRITA).flush(...resposta);
      await pagina.propagar();
      if (resultado === 'sucesso') await pagina.concluirRecarga();
      else await pagina.aguardarFoco();
      expect(pagina.edicao.form.controls.descricao.disabled).toBe(true);
      expect(pagina.edicao.form.controls.nome.enabled).toBe(true);
      if (resultado === 'recusa') {
        expect(pagina.indisponivel('[formcontrolname="descricao"]')).toBe(true);
        expect(pagina.indisponivel('[formcontrolname="nome"]')).toBe(false);
        expect(pagina.edicao.aberto()).toBe(true);
      }
    });

    it('o envio barrado leva o foco ao primeiro campo inválido', async () => {
      pagina.novo().click();
      await pagina.propagar();
      await pagina.enviar();
      await pagina.aguardarFoco();
      pagina.controller.expectNone(ESCRITA);
      expect(document.activeElement).toBe(pagina.campo('nome'));
      expect(pagina.campo('nome').getAttribute('aria-invalid')).toBe('true');
    });

    it.each<[string, RespostaDaApi, string, string]>([
      [
        'código',
        codigoDuplicado,
        'codigo',
        'Já existe um tipo de deficiência ativo com este código',
      ],
      ['nome', nomeDuplicado, 'nome', 'Já existe um tipo de deficiência ativo com este nome'],
    ])(
      'a duplicidade de %s marca o pagina.campo certo, renova a chave e não notifica',
      async (_rotulo, resposta, controle, mensagem) => {
        await pagina.preencher();
        await pagina.enviar();
        const primeira = pagina.controller.expectOne(ESCRITA);
        const chave = primeira.request.headers.get('Idempotency-Key');
        primeira.flush(...resposta);
        await pagina.aguardarFoco();
        expect(pagina.campo(controle).getAttribute('aria-invalid')).toBe('true');
        expect(pagina.campo(controle).closest('label')?.textContent).toContain(mensagem);
        expect(document.activeElement).toBe(pagina.campo(controle));
        expect(pagina.erroDoServidor).not.toHaveBeenCalled();
        expect(pagina.edicao.erro()).toBeNull();
        pagina.edicao.form.controls[controle as 'nome' | 'codigo'].setValue('OUTRO_VALOR');
        await pagina.enviar();
        const segunda = pagina.controller.expectOne(ESCRITA);
        expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(chave);
        segunda.flush(...criado);
        await pagina.concluirRecarga();
      },
    );

    it('o conflito de processamento mantém a chave, mostra a mensagem e não marca o campo', async () => {
      await pagina.preencher();
      await pagina.enviar();
      const primeira = pagina.controller.expectOne(ESCRITA);
      const chave = primeira.request.headers.get('Idempotency-Key');
      primeira.flush(...processando);
      await pagina.aguardarFoco();
      expect(pagina.edicao.erro()).toBe('A requisição anterior ainda está em processamento');
      expect(pagina.campo('codigo').getAttribute('aria-invalid')).toBeNull();
      expect(pagina.campo('nome').getAttribute('aria-invalid')).toBeNull();
      expect(pagina.erroDoServidor).not.toHaveBeenCalled();
      await pagina.enviar();
      const segunda = pagina.controller.expectOne(ESCRITA);
      expect(segunda.request.headers.get('Idempotency-Key')).toBe(chave);
      segunda.flush(...criado);
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

  describe('edição recusada', () => {
    it.each([
      [
        '404',
        problema(
          404,
          'uniplus.configuracao.tipo_deficiencia.nao_encontrado',
          'Tipo de deficiência não encontrado',
        ),
        'Tipo de deficiência não encontrado',
      ],
      [
        'body_mismatch',
        problema(
          422,
          'uniplus.idempotency.body_mismatch',
          'A chave de idempotência já foi usada com outro conteúdo',
        ),
        'A chave de idempotência já foi usada com outro conteúdo',
      ],
    ])(
      'com a recusa %s, mostra o motivo sem notificar, mantém o formulário aberto e renova a chave',
      async (_rotulo, resposta, motivo) => {
        pagina.acaoDaLinha('Editar').click();
        await pagina.propagar();
        await pagina.enviar();
        const primeira = pagina.controller.expectOne(URL_VISUAL);
        const chave = primeira.request.headers.get('Idempotency-Key');
        primeira.flush(...resposta);
        await pagina.aguardarFoco();
        expect(pagina.edicao.erro()).toBe(motivo);
        expect(pagina.elemento('dialog ui-alert').textContent).toContain(motivo);
        expect(pagina.erroDoServidor).not.toHaveBeenCalled();
        expect(pagina.sucesso).not.toHaveBeenCalled();
        expect(pagina.edicao.aberto()).toBe(true);
        await pagina.enviar();
        const segunda = pagina.controller.expectOne(URL_VISUAL);
        expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(chave);
        segunda.flush(...semConteudo);
        await pagina.concluirRecarga();
      },
    );
  });
});
