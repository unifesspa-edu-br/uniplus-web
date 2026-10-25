import { describe, expect, it, vi } from 'vitest';
import { errorResult, mockProblemDetails, okResult } from './api-result.testing';
import { baixarPeloAcesso } from './envio-pre-assinado';

describe('baixarPeloAcesso', () => {
  it('leva a navegação até a URL assinada do acesso', async () => {
    const navegar = vi.fn();

    const desfecho = await baixarPeloAcesso(
      () =>
        Promise.resolve(okResult({ url: 'https://armazenamento.exemplo/arquivo?assinatura=x' })),
      navegar,
    );

    expect(desfecho).toEqual({ situacao: 'iniciado' });
    expect(navegar).toHaveBeenCalledWith('https://armazenamento.exemplo/arquivo?assinatura=x');
  });

  it('acesso recusado: devolve o problema e não navega', async () => {
    const navegar = vi.fn();
    const problem = mockProblemDetails({ status: 404 });

    const desfecho = await baixarPeloAcesso(() => Promise.resolve(errorResult(problem)), navegar);

    expect(desfecho).toEqual({ situacao: 'recusado', problem });
    expect(navegar).not.toHaveBeenCalled();
  });
});
