import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ESCRITA,
  abrirEdicao,
  botaoPorTexto,
  botaoSalvar,
  concluirRecarga,
  elemento,
  falhaDoServidor,
  fase,
  montarPaginaComFase,
  problema,
  propagarRenderizando,
  recusaDeNome,
  statusDaPagina,
} from './fases-canonicas.escritas.testing';
import { CenaDaPagina, URL_DA_LISTA } from './fases-canonicas.testing';

describe('FasesCanonicasPage — escritas pela interface', () => {
  let cena: CenaDaPagina;

  beforeEach(async () => {
    cena = await montarPaginaComFase();
  });

  afterEach(() => cena.controller.verify());

  it('identifica os campos obrigatórios para tecnologias assistivas', async () => {
    await abrirEdicao(cena);
    for (const campo of ['codigo', 'nome', 'origemData']) {
      expect(elemento(cena, `[formcontrolname="${campo}"]`).getAttribute('aria-required')).toBe(
        'true',
      );
    }
  });

  it('envio mantém valores e foco, desabilita fieldset e impede fechar', async () => {
    await abrirEdicao(cena);
    cena.edicao.form.controls.descricao.disable();
    botaoSalvar(cena).focus();
    botaoSalvar(cena).click();
    const requisicao = cena.controller.expectOne(ESCRITA);
    await propagarRenderizando(cena);
    expect(elemento<HTMLFieldSetElement>(cena, '.form-drawer__campos').disabled).toBe(true);
    expect(elemento<HTMLInputElement>(cena, 'input[formcontrolname="nome"]').value).toBe(
      'Avaliação',
    );
    expect(cena.edicao.form.controls.nome.enabled).toBe(true);
    expect(botaoSalvar(cena).getAttribute('aria-disabled')).toBe('true');
    expect(botaoSalvar(cena).getAttribute('aria-busy')).toBe('true');
    expect(botaoSalvar(cena).textContent).toContain('Salvando...');
    expect(document.activeElement).toBe(botaoSalvar(cena));
    expect(elemento<HTMLButtonElement>(cena, '.form-drawer__footer button').disabled).toBe(true);
    const dialogo = elemento<HTMLDialogElement>(
      cena,
      'dialog[aria-label="Formulário de fase canônica"]',
    );
    expect(dialogo.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled).toBe(
      true,
    );
    dialogo.dispatchEvent(new Event('cancel', { cancelable: true }));
    await propagarRenderizando(cena);
    expect(cena.edicao.aberto()).toBe(true);
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await concluirRecarga(cena);
    expect(cena.edicao.aberto()).toBe(false);
    expect(elemento(cena, '[formcontrolname="descricao"]').matches(':disabled')).toBe(true);
  });

  it('clique e submit durante envio recusam nova ativação', async () => {
    await abrirEdicao(cena);
    const chamada = vi.spyOn(cena.edicao, 'salvar');
    botaoSalvar(cena).click();
    const requisicao = cena.controller.expectOne(ESCRITA);
    await propagarRenderizando(cena);
    botaoSalvar(cena).click();
    elemento<HTMLFormElement>(cena, '#cfg-fase-canonica-form').dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    expect(chamada).toHaveBeenCalledTimes(1);
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await concluirRecarga(cena);
  });

  it('recusa no campo devolve foco ao campo e preserva controles desabilitados', async () => {
    await abrirEdicao(cena);
    cena.edicao.form.controls.descricao.disable();
    botaoSalvar(cena).click();
    await propagarRenderizando(cena);
    cena.controller.expectOne(ESCRITA).flush(
      JSON.stringify({
        type: 'about:blank',
        title: 'Dados inválidos',
        status: 422,
        code: 'uniplus.validacao',
        traceId: 'teste',
        errors: [
          {
            field: 'Nome',
            code: 'uniplus.configuracao.fase_canonica.invalido',
            message: 'Nome recusado.',
          },
        ],
      }),
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagarRenderizando(cena);
    await propagarRenderizando(cena);
    expect(elemento(cena, 'input[formcontrolname="nome"]').getAttribute('aria-invalid')).toBe(
      'true',
    );
    expect(document.activeElement).toBe(elemento(cena, 'input[formcontrolname="nome"]'));
    expect(elemento(cena, '[formcontrolname="descricao"]').matches(':disabled')).toBe(true);
  });

  it('salvamento bloqueia escritas concorrentes e mantém a trava durante recarga', async () => {
    await abrirEdicao(cena);
    cena.edicao.salvar();
    cena.edicao.salvar();
    cena.edicao.pedirRemocao(fase);
    cena.edicao.removerConfirmado();
    const requisicao = cena.controller.expectOne(ESCRITA);
    expect(requisicao.request.method).toBe('PUT');
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await propagarRenderizando(cena);
    const recarga = cena.controller.expectOne((r) => r.url === URL_DA_LISTA);
    expect(cena.edicao.gravando()).toBe(true);
    expect(cena.edicao.salvando()).toBe(false);
    cena.edicao.abrirEdicao(fase);
    cena.edicao.pedirRemocao(fase);
    cena.edicao.salvar();
    cena.edicao.removerConfirmado();
    cena.controller.expectNone(ESCRITA);
    recarga.flush([fase]);
    await propagarRenderizando(cena);
    expect(cena.edicao.gravando()).toBe(false);
  });

  it('não repete na página a recusa do formulário depois de Cancelar', async () => {
    await abrirEdicao(cena);
    botaoSalvar(cena).click();
    cena.controller.expectOne(ESCRITA).flush(...recusaDeNome());
    await propagarRenderizando(cena);
    expect(elemento(cena, 'ui-drawer [role="status"]').textContent).toContain(
      'Revise os campos indicados.',
    );
    elemento<HTMLButtonElement>(cena, '.form-drawer__footer button').click();
    await propagarRenderizando(cena);
    expect(cena.edicao.aberto()).toBe(false);
    expect(statusDaPagina(cena)).toBe('');
    await abrirEdicao(cena);
    expect(elemento(cena, 'ui-drawer [role="status"]').textContent?.trim()).toBe('');
  });

  it('falha geral do salvamento é anunciada só pelo alerta, não pela região de status', async () => {
    await abrirEdicao(cena);
    botaoSalvar(cena).click();
    cena.controller.expectOne(ESCRITA).flush(...falhaDoServidor());
    await propagarRenderizando(cena);
    expect(elemento(cena, 'ui-drawer ui-alert').textContent).toContain('Falha');
    expect(elemento(cena, 'ui-drawer [role="status"]').textContent?.trim()).toBe('');
  });

  describe('chave de idempotência após recusa do servidor', () => {
    async function chavesDoEnvioRecusado(status: number, corpo: object): Promise<[string, string]> {
      await abrirEdicao(cena);
      botaoSalvar(cena).click();
      const primeira = cena.controller.expectOne(ESCRITA);
      const chaveEnviada = primeira.request.headers.get('Idempotency-Key') as string;
      primeira.flush(...problema(status, corpo));
      await propagarRenderizando(cena);
      botaoSalvar(cena).click();
      const segunda = cena.controller.expectOne(ESCRITA);
      const chaveReenviada = segunda.request.headers.get('Idempotency-Key') as string;
      segunda.flush(...falhaDoServidor());
      await propagarRenderizando(cena);
      return [chaveEnviada, chaveReenviada];
    }

    it('mantém a chave quando a execução anterior ainda corre (409 de processamento)', async () => {
      const [enviada, reenviada] = await chavesDoEnvioRecusado(409, {
        code: 'uniplus.idempotency.processing_conflict',
      });
      expect(enviada).toBeTruthy();
      expect(reenviada).toBe(enviada);
    });

    it('renova a chave após recusa definitiva do servidor, mesmo com 409', async () => {
      const [enviada, reenviada] = await chavesDoEnvioRecusado(409, {
        code: 'uniplus.configuracao.conflito',
      });
      expect(reenviada).not.toBe(enviada);
    });

    it('mantém a chave quando o servidor falha (5xx)', async () => {
      const [enviada, reenviada] = await chavesDoEnvioRecusado(500, { code: 'uniplus.erro' });
      expect(reenviada).toBe(enviada);
    });
  });

  describe('foco do envio e da nova tentativa', () => {
    const campoNome = (): HTMLInputElement => elemento(cena, 'input[formcontrolname="nome"]');
    const submeter = (): void => {
      elemento<HTMLFormElement>(cena, '#cfg-fase-canonica-form').dispatchEvent(
        new Event('submit', { cancelable: true }),
      );
    };

    it('Enter num campo leva o foco ao botão de salvar e a falha do servidor o mantém ali', async () => {
      await abrirEdicao(cena);
      campoNome().focus();
      submeter();
      await propagarRenderizando(cena);
      expect(campoNome().matches(':disabled')).toBe(true);
      expect(document.activeElement).toBe(botaoSalvar(cena));

      cena.controller.expectOne(ESCRITA).flush(...falhaDoServidor());
      await propagarRenderizando(cena);
      await propagarRenderizando(cena);

      expect(cena.edicao.aberto()).toBe(true);
      expect(document.activeElement).toBe(botaoSalvar(cena));
    });

    it('envio barrado com o foco no botão de salvar leva o foco ao primeiro campo inválido', async () => {
      await abrirEdicao(cena);
      cena.edicao.form.controls.nome.setValue('');
      cena.edicao.form.controls.origemData.setValue('');
      botaoSalvar(cena).focus();
      submeter();
      await propagarRenderizando(cena);
      await propagarRenderizando(cena);
      cena.controller.expectNone(ESCRITA);
      expect(document.activeElement).toBe(campoNome());
    });

    it('"Tentar novamente" que dá certo leva o foco, que estava no botão, ao título da lista', async () => {
      cena.store.recarregar();
      await propagarRenderizando(cena);
      cena.controller.expectOne((r) => r.url === URL_DA_LISTA).flush(...falhaDoServidor());
      await propagarRenderizando(cena);
      const tentar = botaoPorTexto(cena, 'Tentar novamente') as HTMLButtonElement;
      tentar.focus();
      tentar.click();
      await propagarRenderizando(cena);

      cena.controller.expectOne((r) => r.url === URL_DA_LISTA).flush([fase]);
      await propagarRenderizando(cena);
      await propagarRenderizando(cena);

      expect(document.activeElement).toBe(elemento(cena, '#cfg-fases-canonicas-list-title'));
    });
  });
});
