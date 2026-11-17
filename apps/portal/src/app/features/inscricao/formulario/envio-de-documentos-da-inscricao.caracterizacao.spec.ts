import { HttpEventType } from '@angular/common/http';
import { concat, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { okResult } from '@uniplus/shared-testing';

import {
  ALVO,
  ENDERECO_VENCIDO,
  FALHA_NO_ARMAZENAMENTO,
  FORMATO_NAO_ACEITO,
  OUTRO_ALVO,
  PRAZO_VALIDO,
  PRAZO_VENCIDO,
  chavesEnviadas,
  configurarEnvio,
  criarApiSimulada,
  destinoComPrazo,
  envioDoProcesso,
  falhaDaApi,
  falhaDoArmazenamento,
  prepararCaminhoFeliz,
  respostaDoArmazenamento,
} from './envio-de-documentos-da-inscricao.testing';

describe('Envio dos documentos da inscrição: retomada da tentativa', () => {
  const api = criarApiSimulada();
  const upload = { enviar: vi.fn() };
  const andamento = vi.fn();
  const laudo = new File(['%PDF-1.7'], 'laudo.pdf', { type: 'application/pdf' });

  const fasesAvisadas = () => andamento.mock.calls.map(([fase]) => fase);

  beforeEach(() => {
    vi.resetAllMocks();
    prepararCaminhoFeliz(api, upload);
    configurarEnvio(api, upload);
  });

  describe('armazenamento que falha', () => {
    it.each([0, 500, 503])(
      'status %i: oferece nova tentativa com a mensagem de conexão',
      async (status) => {
        upload.enviar.mockReturnValueOnce(falhaDoArmazenamento(status));

        const desfecho = await envioDoProcesso().enviar(ALVO, laudo, andamento);

        expect(desfecho).toEqual({
          ok: false,
          mensagem: FALHA_NO_ARMAZENAMENTO,
          podeTentarDeNovo: true,
        });
        expect(api.confirmarEnvioDeDocumento).not.toHaveBeenCalled();
      },
    );

    it.each([400, 404, 413, 499])(
      'status %i: recusa o conteúdo e não oferece nova tentativa',
      async (status) => {
        upload.enviar.mockReturnValueOnce(falhaDoArmazenamento(status));

        const desfecho = await envioDoProcesso().enviar(ALVO, laudo, andamento);

        expect(desfecho).toEqual({
          ok: false,
          mensagem: FALHA_NO_ARMAZENAMENTO,
          podeTentarDeNovo: false,
        });
      },
    );

    it('403: avisa que o endereço venceu e oferece nova tentativa', async () => {
      upload.enviar.mockReturnValueOnce(falhaDoArmazenamento(403));

      const desfecho = await envioDoProcesso().enviar(ALVO, laudo, andamento);

      expect(desfecho).toEqual({ ok: false, mensagem: ENDERECO_VENCIDO, podeTentarDeNovo: true });
    });

    it('não guarda arquivo confirmado nem conta mudança além da iniciação', async () => {
      upload.enviar.mockReturnValueOnce(falhaDoArmazenamento(500));
      const envio = envioDoProcesso();

      await envio.enviar(ALVO, laudo, andamento);

      expect(envio.arquivos()).toEqual([]);
      expect(envio.mudancas()).toBe(1);
    });

    it('repassa o percentual do envio dos bytes', async () => {
      upload.enviar.mockReturnValueOnce(
        concat(
          of({ type: HttpEventType.UploadProgress, loaded: 50, total: 100 }),
          respostaDoArmazenamento(),
        ),
      );

      await envioDoProcesso().enviar(ALVO, laudo, andamento);

      expect(andamento).toHaveBeenCalledWith('enviando', 50);
    });
  });

  describe('destino da tentativa', () => {
    it('ainda válido é reaproveitado: a repetição não chama iniciar de novo', async () => {
      upload.enviar.mockReturnValueOnce(falhaDoArmazenamento(500));
      const envio = envioDoProcesso();

      await envio.enviar(ALVO, laudo, andamento);
      const repeticao = await envio.enviar(ALVO, laudo, andamento);

      expect(repeticao.ok).toBe(true);
      expect(api.iniciarEnvioDeDocumento).toHaveBeenCalledTimes(1);
      expect(upload.enviar.mock.calls.map(([url]) => url)).toEqual([
        'http://storage/laudo',
        'http://storage/laudo',
      ]);
    });

    it('reaproveitado: a repetição não avisa "iniciando"', async () => {
      upload.enviar.mockReturnValueOnce(falhaDoArmazenamento(500));
      const envio = envioDoProcesso();
      await envio.enviar(ALVO, laudo, andamento);
      andamento.mockClear();

      await envio.enviar(ALVO, laudo, andamento);

      expect(fasesAvisadas()).toEqual(['enviando', 'enviando', 'confirmando']);
    });

    it('vencido é descartado: a repetição chama iniciar de novo e envia à nova URL', async () => {
      api.iniciarEnvioDeDocumento
        .mockReturnValueOnce(of(okResult(destinoComPrazo(PRAZO_VENCIDO, 1))))
        .mockReturnValueOnce(of(okResult(destinoComPrazo(PRAZO_VALIDO, 2))));
      upload.enviar.mockReturnValueOnce(falhaDoArmazenamento(500));
      const envio = envioDoProcesso();

      await envio.enviar(ALVO, laudo, andamento);
      await envio.enviar(ALVO, laudo, andamento);

      expect(api.iniciarEnvioDeDocumento).toHaveBeenCalledTimes(2);
      expect(upload.enviar.mock.calls[1][0]).toBe('http://storage/laudo-2');
      expect(api.confirmarEnvioDeDocumento.mock.calls[0][1]).toBe('arquivo-2');
    });

    it('vencido na primeira tentativa: os bytes ainda saem para a URL recebida', async () => {
      api.iniciarEnvioDeDocumento.mockReturnValueOnce(of(okResult(destinoComPrazo(PRAZO_VENCIDO))));

      const desfecho = await envioDoProcesso().enviar(ALVO, laudo, andamento);

      expect(desfecho.ok).toBe(true);
      expect(api.iniciarEnvioDeDocumento).toHaveBeenCalledTimes(1);
      expect(upload.enviar).toHaveBeenCalledWith(
        'http://storage/laudo-1',
        laudo,
        'application/pdf',
      );
    });

    it('recusado pelo armazenamento com 403: a repetição pede outra URL', async () => {
      upload.enviar.mockReturnValueOnce(falhaDoArmazenamento(403));
      const envio = envioDoProcesso();

      await envio.enviar(ALVO, laudo, andamento);
      await envio.enviar(ALVO, laudo, andamento);

      expect(fasesAvisadas().filter((fase) => fase === 'iniciando')).toHaveLength(2);
    });
  });

  describe('alvo do envio', () => {
    it('o mesmo arquivo em outra exigência começa tentativa nova, com chaves novas', async () => {
      upload.enviar.mockReturnValueOnce(falhaDoArmazenamento(500));
      const envio = envioDoProcesso();

      await envio.enviar(ALVO, laudo, andamento);
      const outra = await envio.enviar(OUTRO_ALVO, laudo, andamento);

      const [primeira, segunda] = chavesEnviadas(api.iniciarEnvioDeDocumento, 2);
      expect(api.iniciarEnvioDeDocumento.mock.calls[1][1]).toMatchObject({ exigenciaId: 'e2' });
      expect(segunda).not.toBe(primeira);
      expect(outra).toMatchObject({ ok: true, arquivo: { chave: 'e2:' } });
    });

    it('a confirmação pendente de uma exigência não vale para outra: os bytes saem de novo', async () => {
      api.confirmarEnvioDeDocumento.mockReturnValueOnce(of(falhaDaApi(503)));
      const envio = envioDoProcesso();

      await envio.enviar(ALVO, laudo, andamento);
      await envio.enviar(OUTRO_ALVO, laudo, andamento);

      expect(upload.enviar).toHaveBeenCalledTimes(2);
      expect(api.iniciarEnvioDeDocumento).toHaveBeenCalledTimes(2);
    });

    it('voltar à primeira exigência também recomeça: só a última tentativa do arquivo é guardada', async () => {
      upload.enviar.mockReturnValueOnce(falhaDoArmazenamento(500));
      const envio = envioDoProcesso();

      await envio.enviar(ALVO, laudo, andamento);
      await envio.enviar(OUTRO_ALVO, laudo, andamento);
      await envio.enviar(ALVO, laudo, andamento);

      expect(api.iniciarEnvioDeDocumento).toHaveBeenCalledTimes(3);
    });

    it('outro arquivo na mesma exigência tem tentativa própria', async () => {
      const historico = new File(['%PDF-1.7'], 'historico.pdf');
      upload.enviar.mockReturnValueOnce(falhaDoArmazenamento(500));
      const envio = envioDoProcesso();

      await envio.enviar(ALVO, laudo, andamento);
      await envio.enviar(ALVO, historico, andamento);

      expect(api.iniciarEnvioDeDocumento).toHaveBeenCalledTimes(2);
    });

    it('arquivo confirmado não é reaproveitado: enviá-lo outra vez inicia de novo', async () => {
      const envio = envioDoProcesso();

      await envio.enviar(ALVO, laudo, andamento);
      await envio.enviar(ALVO, laudo, andamento);

      expect(api.iniciarEnvioDeDocumento).toHaveBeenCalledTimes(2);
      expect(envio.arquivos()).toHaveLength(2);
    });
  });

  describe('formato do arquivo', () => {
    it('não aceito é recusado sem chamar a API nem o armazenamento', async () => {
      const envio = envioDoProcesso();

      const desfecho = await envio.enviar(ALVO, new File(['MZ'], 'programa.exe'), andamento);

      expect(desfecho).toEqual({
        ok: false,
        mensagem: FORMATO_NAO_ACEITO,
        podeTentarDeNovo: false,
      });
      expect(api.iniciarEnvioDeDocumento).not.toHaveBeenCalled();
      expect(upload.enviar).not.toHaveBeenCalled();
      expect(andamento).not.toHaveBeenCalled();
      expect(envio.mudancas()).toBe(0);
    });

    it('a extensão em maiúsculas é aceita e o tipo de mídia sai pela extensão', async () => {
      const desfecho = await envioDoProcesso().enviar(
        ALVO,
        new File(['x'], 'FOTO.JPEG'),
        andamento,
      );

      expect(desfecho.ok).toBe(true);
      expect(api.iniciarEnvioDeDocumento.mock.calls[0][1]).toMatchObject({
        tipoDeMidia: 'image/jpeg',
      });
    });
  });

  describe('resposta do armazenamento', () => {
    it('sem ETag: a repetição reenvia os bytes à mesma URL, sem nova iniciação', async () => {
      upload.enviar.mockReturnValueOnce(respostaDoArmazenamento(null));
      const envio = envioDoProcesso();

      const primeira = await envio.enviar(ALVO, laudo, andamento);
      await envio.enviar(ALVO, laudo, andamento);

      expect(primeira).toEqual({
        ok: false,
        mensagem: FALHA_NO_ARMAZENAMENTO,
        podeTentarDeNovo: true,
      });
      expect(api.iniciarEnvioDeDocumento).toHaveBeenCalledTimes(1);
      expect(upload.enviar).toHaveBeenCalledTimes(2);
    });

    it('sem ETag numa chamada concorrente não apaga o ETag da outra: a repetição só confirma', async () => {
      upload.enviar
        .mockReturnValueOnce(respostaDoArmazenamento())
        .mockReturnValueOnce(respostaDoArmazenamento(null));
      api.confirmarEnvioDeDocumento.mockReturnValueOnce(of(falhaDaApi(503)));
      const envio = envioDoProcesso();

      await Promise.all([
        envio.enviar(ALVO, laudo, andamento),
        envio.enviar(ALVO, laudo, andamento),
      ]);
      const repeticao = await envio.enviar(ALVO, laudo, andamento);

      expect(repeticao.ok).toBe(true);
      expect(upload.enviar).toHaveBeenCalledTimes(2);
    });

    it('conteúdo recusado: repetir à mão reaproveita o destino e reenvia os bytes', async () => {
      upload.enviar.mockReturnValueOnce(falhaDoArmazenamento(413));
      const envio = envioDoProcesso();

      const recusado = await envio.enviar(ALVO, laudo, andamento);
      const repetido = await envio.enviar(ALVO, laudo, andamento);

      expect(recusado).toMatchObject({ ok: false, podeTentarDeNovo: false });
      expect(repetido.ok).toBe(true);
      expect(api.iniciarEnvioDeDocumento).toHaveBeenCalledTimes(1);
    });
  });
});
