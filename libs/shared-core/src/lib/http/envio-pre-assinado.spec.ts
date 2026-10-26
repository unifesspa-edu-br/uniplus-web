import { describe, expect, it, vi } from 'vitest';
import { errorResult, mockProblemDetails, okResult } from './api-result.testing';
import { type ArquivoBaixado, baixarPeloAcesso, nomeDaDisposicao } from './envio-pre-assinado';

describe('baixarPeloAcesso', () => {
  const arquivo: ArquivoBaixado = { conteudo: new Blob(['%PDF']), nome: 'Arquivo 1.pdf' };
  const acesso = () =>
    Promise.resolve(okResult({ url: 'https://armazenamento.exemplo/arquivo?assinatura=x' }));

  it('busca o conteúdo na URL assinada e o salva', async () => {
    const buscar = vi.fn().mockResolvedValue(arquivo);
    const salvar = vi.fn();

    const desfecho = await baixarPeloAcesso(acesso, buscar, salvar);

    expect(desfecho).toEqual({ situacao: 'iniciado' });
    expect(buscar).toHaveBeenCalledWith('https://armazenamento.exemplo/arquivo?assinatura=x');
    expect(salvar).toHaveBeenCalledWith(arquivo);
  });

  it('acesso recusado: devolve o problema e não busca', async () => {
    const buscar = vi.fn();
    const problem = mockProblemDetails({ status: 404 });

    const desfecho = await baixarPeloAcesso(() => Promise.resolve(errorResult(problem)), buscar);

    expect(desfecho).toEqual({ situacao: 'recusado', problem });
    expect(buscar).not.toHaveBeenCalled();
  });

  it('armazenamento que recusa ou não responde: falha sem salvar nada', async () => {
    const salvar = vi.fn();

    const desfecho = await baixarPeloAcesso(acesso, () => Promise.resolve(null), salvar);

    expect(desfecho).toEqual({ situacao: 'falhou' });
    expect(salvar).not.toHaveBeenCalled();
  });
});

describe('nomeDaDisposicao', () => {
  it('lê o nome assinado e o decodifica', () => {
    expect(
      nomeDaDisposicao(
        "attachment; filename*=UTF-8''Arquivo%201%20-%20CADASTRO_ACADEMICO%20-%205c58f250.pdf",
      ),
    ).toBe('Arquivo 1 - CADASTRO_ACADEMICO - 5c58f250.pdf');
  });

  it('sem nome legível, devolve nulo', () => {
    expect(nomeDaDisposicao(null)).toBeNull();
    expect(nomeDaDisposicao('attachment')).toBeNull();
    expect(nomeDaDisposicao("attachment; filename*=UTF-8''%E0%A4%A")).toBeNull();
  });
});
