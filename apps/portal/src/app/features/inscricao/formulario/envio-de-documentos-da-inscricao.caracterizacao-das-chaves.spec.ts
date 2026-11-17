import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { okResult } from '@uniplus/shared-testing';

import {
  ALVO,
  CONFIRMADO,
  DESTINO,
  OUTRO_ALVO,
  chavesEnviadas,
  configurarEnvio,
  criarApiSimulada,
  envioDoProcesso,
  falhaDaApi,
  prepararCaminhoFeliz,
  responderDevagar,
} from './envio-de-documentos-da-inscricao.testing';

const INSCRICAO_ALTERADA = 'uniplus.selecao.documento_da_inscricao.inscricao_alterada';

describe('Envio dos documentos da inscrição: chaves de idempotência e fila', () => {
  const api = criarApiSimulada();
  const upload = { enviar: vi.fn() };
  const andamento = vi.fn();
  const laudo = new File(['%PDF-1.7'], 'laudo.pdf', { type: 'application/pdf' });
  const historico = new File(['%PDF-1.7'], 'historico.pdf', { type: 'application/pdf' });

  beforeEach(() => {
    vi.resetAllMocks();
    prepararCaminhoFeliz(api, upload);
    api.removerArquivoDeDocumento.mockReturnValue(of(okResult(undefined)));
    configurarEnvio(api, upload);
  });

  describe('iniciação e confirmação', () => {
    it('iniciação sem resposta conclusiva: a repetição usa a mesma chave', async () => {
      api.iniciarEnvioDeDocumento.mockReturnValueOnce(of(falhaDaApi(503)));
      const envio = envioDoProcesso();

      const primeira = await envio.enviar(ALVO, laudo, andamento);
      await envio.enviar(ALVO, laudo, andamento);

      const [antes, depois] = chavesEnviadas(api.iniciarEnvioDeDocumento, 2);
      expect(primeira).toMatchObject({ ok: false, podeTentarDeNovo: true });
      expect(depois).toBe(antes);
    });

    it('iniciação recusada em definitivo: a repetição troca a chave e não oferece nova tentativa', async () => {
      api.iniciarEnvioDeDocumento.mockReturnValueOnce(of(falhaDaApi(422)));
      const envio = envioDoProcesso();

      const primeira = await envio.enviar(ALVO, laudo, andamento);
      await envio.enviar(ALVO, laudo, andamento);

      const [antes, depois] = chavesEnviadas(api.iniciarEnvioDeDocumento, 2);
      expect(primeira).toMatchObject({ ok: false, podeTentarDeNovo: false });
      expect(depois).not.toBe(antes);
    });

    it('inscrição alterada por outra gravação: oferece nova tentativa sob chave nova', async () => {
      api.iniciarEnvioDeDocumento.mockReturnValueOnce(of(falhaDaApi(409, INSCRICAO_ALTERADA)));
      const envio = envioDoProcesso();

      const primeira = await envio.enviar(ALVO, laudo, andamento);
      await envio.enviar(ALVO, laudo, andamento);

      const [antes, depois] = chavesEnviadas(api.iniciarEnvioDeDocumento, 2);
      expect(primeira).toMatchObject({ ok: false, podeTentarDeNovo: true });
      expect(depois).not.toBe(antes);
    });

    it('confirmação sem resposta conclusiva: a repetição confirma sob a mesma chave', async () => {
      api.confirmarEnvioDeDocumento.mockReturnValueOnce(of(falhaDaApi(503)));
      const envio = envioDoProcesso();

      await envio.enviar(ALVO, laudo, andamento);
      await envio.enviar(ALVO, laudo, andamento);

      const [antes, depois] = chavesEnviadas(api.confirmarEnvioDeDocumento, 2);
      expect(depois).toBe(antes);
    });

    it('confirmação sem resposta conclusiva conta mudança, e a repetição bem-sucedida conta outra', async () => {
      api.confirmarEnvioDeDocumento.mockReturnValueOnce(of(falhaDaApi(503)));
      const envio = envioDoProcesso();

      await envio.enviar(ALVO, laudo, andamento);
      // Iniciar avançou a revisão e a confirmação inconclusiva pode ter avançado outra vez.
      expect(envio.mudancas()).toBe(2);
      await envio.enviar(ALVO, laudo, andamento);

      expect(envio.mudancas()).toBe(3);
    });

    it('confirmação recusada em definitivo: a repetição só confirma, sob chave nova', async () => {
      api.confirmarEnvioDeDocumento.mockReturnValueOnce(of(falhaDaApi(422)));
      const envio = envioDoProcesso();

      const primeira = await envio.enviar(ALVO, laudo, andamento);
      await envio.enviar(ALVO, laudo, andamento);

      const [antes, depois] = chavesEnviadas(api.confirmarEnvioDeDocumento, 2);
      expect(primeira).toMatchObject({ ok: false, podeTentarDeNovo: false });
      expect(depois).not.toBe(antes);
      expect(upload.enviar).toHaveBeenCalledTimes(1);
    });

    it('iniciação e confirmação do mesmo envio saem sob chaves diferentes', async () => {
      await envioDoProcesso().enviar(ALVO, laudo, andamento);

      const [iniciacao] = chavesEnviadas(api.iniciarEnvioDeDocumento, 1);
      const [confirmacao] = chavesEnviadas(api.confirmarEnvioDeDocumento, 1);
      expect(iniciacao).not.toBe(confirmacao);
    });
  });

  describe('remoção', () => {
    it('inconclusiva repete a mesma chave; a recusa definitiva a usa e a seguinte é nova', async () => {
      api.removerArquivoDeDocumento
        .mockReturnValueOnce(of(falhaDaApi(503)))
        .mockReturnValueOnce(of(falhaDaApi(422)));
      const envio = envioDoProcesso();

      await envio.remover('arquivo-1');
      await envio.remover('arquivo-1');
      await envio.remover('arquivo-1');

      const [primeira, segunda, terceira] = chavesEnviadas(api.removerArquivoDeDocumento, 3);
      expect(segunda).toBe(primeira);
      expect(terceira).not.toBe(primeira);
    });

    it('concluída: remover o mesmo arquivo de novo usa chave nova', async () => {
      const envio = envioDoProcesso();

      await envio.remover('arquivo-1');
      await envio.remover('arquivo-1');

      const [primeira, segunda] = chavesEnviadas(api.removerArquivoDeDocumento, 2);
      expect(segunda).not.toBe(primeira);
    });

    it('cada arquivo tem a sua chave', async () => {
      api.removerArquivoDeDocumento.mockReturnValue(of(falhaDaApi(503)));
      const envio = envioDoProcesso();

      await envio.remover('arquivo-1');
      await envio.remover('arquivo-2');
      await envio.remover('arquivo-1');

      const [primeira, outra, repetida] = chavesEnviadas(api.removerArquivoDeDocumento, 3);
      expect(outra).not.toBe(primeira);
      expect(repetida).toBe(primeira);
    });

    it('recusada em definitivo: devolve a mensagem, mantém o arquivo e não conta mudança', async () => {
      api.removerArquivoDeDocumento.mockReturnValueOnce(of(falhaDaApi(422)));
      const envio = envioDoProcesso();
      await envio.enviar(ALVO, laudo, andamento);
      const antes = envio.mudancas();

      const desfecho = await envio.remover('arquivo-1');

      expect(desfecho).toMatchObject({ ok: false, mensagem: expect.any(String) });
      expect(envio.arquivos()).toHaveLength(1);
      expect(envio.mudancas()).toBe(antes);
    });

    it('concluída tira só o arquivo removido da lista', async () => {
      api.iniciarEnvioDeDocumento
        .mockReturnValueOnce(of(okResult(DESTINO)))
        .mockReturnValueOnce(of(okResult({ ...DESTINO, arquivoId: 'arquivo-2' })));
      api.confirmarEnvioDeDocumento
        .mockReturnValueOnce(of(okResult(CONFIRMADO)))
        .mockReturnValueOnce(of(okResult({ ...CONFIRMADO, arquivoId: 'arquivo-2' })));
      const envio = envioDoProcesso();
      await envio.enviar(ALVO, laudo, andamento);
      await envio.enviar(OUTRO_ALVO, historico, andamento);

      await envio.remover('arquivo-1');

      expect(envio.arquivos().map((a) => a.arquivoId)).toEqual(['arquivo-2']);
    });
  });

  describe('fila das chamadas à API', () => {
    it('duas chamadas concorrentes saem em série, uma de cada vez', async () => {
      const medida = responderDevagar(api);
      const envio = envioDoProcesso();
      const todas = Promise.all([
        envio.enviar(ALVO, laudo, andamento),
        envio.enviar(OUTRO_ALVO, historico, andamento),
        envio.remover('arquivo-antigo'),
      ]);
      expect(envio.ocupado()).toBe(true);
      const [primeiro, segundo, remocao] = await todas;
      expect([primeiro.ok, segundo.ok, remocao.ok]).toEqual([true, true, true]);
      expect(medida).toMatchObject({ maxima: 1, chamadas: 5, ativas: 0 });
      expect(envio.ocupado()).toBe(false);
    });

    it('chamada que falha de vez não trava a fila: a seguinte ainda sai', async () => {
      api.iniciarEnvioDeDocumento.mockReturnValueOnce(throwError(() => new Error('rede')));
      const envio = envioDoProcesso();

      const [primeiro, segundo] = await Promise.allSettled([
        envio.enviar(ALVO, laudo, andamento),
        envio.enviar(OUTRO_ALVO, historico, andamento),
      ]);

      expect(primeiro.status).toBe('rejected');
      expect(segundo).toMatchObject({ status: 'fulfilled', value: { ok: true } });
      expect(envio.ocupado()).toBe(false);
    });
  });
});
