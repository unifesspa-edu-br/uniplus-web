import { TestBed } from '@angular/core/testing';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ESCRITA,
  PaginaDeLocais,
  abrirCadastroPreenchido,
  mensagemDoEndereco,
  montarPaginaComListaCarregada,
  raizDa,
} from './locais-oferta.pagina.testing';

describe('Recusas do servidor ao enviar o formulário de locais de oferta', () => {
  let pagina: PaginaDeLocais;

  beforeEach(async () => {
    pagina = await montarPaginaComListaCarregada();
  });
  afterEach(() => pagina.controller.verify());

  function recusar(status: number, corpo: Record<string, unknown>): void {
    pagina.controller
      .expectOne(ESCRITA)
      .flush(JSON.stringify({ type: 'about:blank', title: 'Recusado', status, ...corpo }), {
        status,
        statusText: 'Erro',
        headers: { 'content-type': 'application/problem+json' },
      });
  }

  async function enviarRecusado(status: number, corpo: Record<string, unknown>): Promise<string> {
    await abrirCadastroPreenchido(pagina);
    const chave = pagina.edicao.idempotencyKeyAtual();
    pagina.edicao.salvar();
    await pagina.propagar();
    recusar(status, corpo);
    await pagina.propagar();
    return chave;
  }

  it('mantém a chave de idempotência e mostra a mensagem quando a execução anterior ainda corre', async () => {
    const { edicao, elemento } = pagina;
    const chave = await enviarRecusado(409, {
      title: 'Requisição ainda em processamento',
      code: 'uniplus.idempotency.processing_conflict',
    });
    expect(edicao.idempotencyKeyAtual()).toBe(chave);
    expect(edicao.formError()).toBeTruthy();
    expect(elemento('dialog ui-alert').textContent).toContain(edicao.formError() as string);
  });

  it('renova a chave após recusa definitiva do servidor, mesmo com 409', async () => {
    const chave = await enviarRecusado(409, { code: 'uniplus.configuracao.conflito' });
    expect(pagina.edicao.idempotencyKeyAtual()).not.toBe(chave);
    expect(pagina.edicao.formError()).toBeTruthy();
  });

  it('mantém a chave e notifica quando o servidor falha (5xx)', async () => {
    const { edicao } = pagina;
    const notificar = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
    const chave = await enviarRecusado(500, { code: 'uniplus.internal.unexpected' });
    expect(notificar).toHaveBeenCalledTimes(1);
    expect(notificar).toHaveBeenCalledWith(
      expect.objectContaining({ status: 500, code: 'uniplus.internal.unexpected' }),
    );
    expect(edicao.idempotencyKeyAtual()).toBe(chave);
    expect(edicao.formError()).toBeTruthy();
    expect(edicao.gravando()).toBe(false);
  });

  it('reenviar sem editar o campo recusado volta a enviar o formulário à API', async () => {
    const recusaDoCodigo = {
      code: 'uniplus.validacao',
      errors: [
        {
          field: 'CodigoEmec',
          code: 'uniplus.configuracao.local.codigo_invalido',
          message: 'Código inválido.',
        },
      ],
    };
    await enviarRecusado(422, recusaDoCodigo);

    pagina.edicao.salvar();
    await pagina.propagar();

    recusar(422, recusaDoCodigo);
  });

  it('avisa quando a recusa 422 não aponta nenhum campo conhecido', async () => {
    await enviarRecusado(422, {
      code: 'uniplus.validacao',
      errors: [{ field: 'Desconhecido', code: 'x', message: 'Sem destino.' }],
    });
    expect(pagina.edicao.formError()).toBe(
      'Não foi possível mapear os erros de validação. Revise os campos.',
    );
  });

  it('apresenta a recusa de endereço no bloco do endereço e leva o foco a ela', async () => {
    const chave = await enviarRecusado(422, {
      code: 'uniplus.validacao',
      errors: [{ field: 'Endereco.Cep', code: 'cep', message: 'CEP inválido.' }],
    });
    await pagina.propagar();
    expect(mensagemDoEndereco(pagina).textContent?.trim()).toBe('CEP inválido.');
    expect(document.activeElement).toBe(mensagemDoEndereco(pagina));
    expect(raizDa(pagina).querySelector('dialog ui-alert')).toBeNull();
    expect(pagina.edicao.idempotencyKeyAtual()).not.toBe(chave);
  });

  it('apresenta a falha de endereço informada só pelo código do problema e leva o foco a ela', async () => {
    await enviarRecusado(400, { code: 'EnderecoReferencia.CepFormatoInvalido' });
    await pagina.propagar();
    expect(mensagemDoEndereco(pagina).textContent?.trim()).toBeTruthy();
    expect(document.activeElement).toBe(mensagemDoEndereco(pagina));
    expect(raizDa(pagina).querySelector('dialog ui-alert')).toBeNull();
  });
});
