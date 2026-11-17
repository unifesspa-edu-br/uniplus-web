import { errorResult, mockProblemDetails, okResult } from '@uniplus/shared-testing';
import { AnuncioDaConclusao } from '@uniplus/shared-ui/components';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PROCESSO_ID,
  MONTAGEM_LENTA,
  detalhe,
  montar,
  propagar,
} from './processo-seletivo.retomada.testing';

describe('ProcessoSeletivoPage — falhas de leitura', MONTAGEM_LENTA, () => {
  beforeEach(() => TestBed.resetTestingModule());

  /**
   * Um id inexistente não pode virar cadastro novo — o operador
   * preencheria tudo de novo e criaria uma duplicata no passo 2.
   */
  it('404 informa o não encontrado sem inicializar rascunho', async () => {
    const cenario = montar({
      obter: vi.fn(() =>
        of(errorResult(mockProblemDetails({ status: 404, title: 'Processo não encontrado' }))),
      ),
    });
    await propagar();
    cenario.fixture.detectChanges();

    expect(cenario.store.falhaDeLeitura()?.motivo).toBe('naoEncontrado');
    expect(cenario.store.processoSeletivoId()).toBeNull();
    expect(cenario.store.remoteSnapshot()).toBeNull();
    expect(cenario.host.textContent).toContain('não encontrado');
  });

  it('403 distingue a falta de permissão', async () => {
    const cenario = montar({
      obter: vi.fn(() => of(errorResult(mockProblemDetails({ status: 403 })))),
    });
    await propagar();

    expect(cenario.store.falhaDeLeitura()?.motivo).toBe('semPermissao');
  });

  /** Falha temporária é a única que oferece repetir a leitura. */
  it('5xx oferece nova tentativa', async () => {
    const cenario = montar({
      obter: vi.fn(() => of(errorResult(mockProblemDetails({ status: 503 })))),
    });
    await propagar();
    cenario.fixture.detectChanges();

    expect(cenario.store.falhaDeLeitura()?.motivo).toBe('falhaTemporaria');
    const botao = Array.from(
      cenario.host.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent?.includes('Tentar novamente'));
    expect(botao).toBeDefined();
  });

  it('não oferece nova tentativa quando o processo não existe', async () => {
    const cenario = montar({
      obter: vi.fn(() => of(errorResult(mockProblemDetails({ status: 404 })))),
    });
    await propagar();
    cenario.fixture.detectChanges();

    const botao = Array.from(
      cenario.host.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent?.includes('Tentar novamente'));
    expect(botao).toBeUndefined();
  });

  it('sempre oferece o caminho de volta à listagem', async () => {
    const cenario = montar({
      obter: vi.fn(() => of(errorResult(mockProblemDetails({ status: 404 })))),
    });
    await propagar();
    cenario.fixture.detectChanges();

    const voltar = Array.from(
      cenario.host.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>,
    ).find((a) => a.textContent?.includes('Voltar à listagem'));
    expect(voltar?.getAttribute('href')).toBe('/processo-seletivo');
  });

  /** Endereço malformado é recusado antes de gastar uma ida ao servidor. */
  it('id fora do formato UUID não chega à API', async () => {
    const cenario = montar({ id: 'nao-e-uuid' });
    await propagar();

    expect(cenario.obter).not.toHaveBeenCalled();
    expect(cenario.store.falhaDeLeitura()?.motivo).toBe('idInvalido');
  });

  it('repete a leitura pelo botão de nova tentativa', async () => {
    const obter = vi
      .fn()
      .mockReturnValueOnce(of(errorResult(mockProblemDetails({ status: 503 }))))
      .mockReturnValueOnce(of(okResult(detalhe())));
    const cenario = montar({ obter });
    await propagar();
    cenario.fixture.detectChanges();

    const botao = Array.from(
      cenario.host.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent?.includes('Tentar novamente')) as HTMLButtonElement;
    botao.click();
    await propagar();

    expect(obter).toHaveBeenCalledTimes(2);
    expect(cenario.store.falhaDeLeitura()).toBeNull();
    expect(cenario.store.processoSeletivoId()).toBe(PROCESSO_ID);
  });
});

describe('ProcessoSeletivoPage — recusa na nova tentativa', MONTAGEM_LENTA, () => {
  beforeEach(() => TestBed.resetTestingModule());

  it.each([
    ['404', 404],
    ['403', 403],
  ])('503 seguido de %s fica na tela da recusa, sem anunciar a conclusão', async (_, status) => {
    const obter = vi
      .fn()
      .mockReturnValueOnce(of(errorResult(mockProblemDetails({ status: 503 }))))
      .mockReturnValueOnce(of(errorResult(mockProblemDetails({ status }))));
    const cenario = montar({ obter });
    const anunciar = vi.spyOn(TestBed.inject(AnuncioDaConclusao), 'anunciar');
    await propagar();
    cenario.fixture.detectChanges();

    const botao = Array.from(
      cenario.host.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent?.includes('Tentar novamente')) as HTMLButtonElement;
    botao.click();
    cenario.fixture.detectChanges();
    await propagar();
    cenario.fixture.detectChanges();
    await propagar();
    cenario.fixture.detectChanges();

    expect(cenario.store.falhaDeLeitura()?.motivo).not.toBe('falhaTemporaria');
    expect(anunciar).not.toHaveBeenCalled();
  });
});
