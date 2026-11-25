import { afterEach, expect, it, vi } from 'vitest';
import { baixarJson } from './baixar-json';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function prepararDownload() {
  vi.useFakeTimers();
  const criar = vi.fn((_arquivo: Blob) => 'blob:exemplo');
  const liberar = vi.fn();
  vi.stubGlobal('URL', { createObjectURL: criar, revokeObjectURL: liberar });
  const clique = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    expect(this.download).toBe('formulário.json');
    expect(this.href).toBe('blob:exemplo');
  });
  return { criar, liberar, clique };
}

it('baixa JSON com nome solicitado e libera o endereço', () => {
  const { criar, liberar, clique } = prepararDownload();
  baixarJson('formulário.json', { resposta: 'Sim' });
  const arquivo = criar.mock.calls[0][0];
  expect(arquivo.type).toBe('application/json');
  expect(clique).toHaveBeenCalledOnce();
  vi.runAllTimers();
  expect(liberar).toHaveBeenCalledWith('blob:exemplo');
});

it('serializa o conteúdo com indentação e quebra de linha final', async () => {
  const { criar } = prepararDownload();
  baixarJson('formulário.json', { resposta: 'Sim' });
  vi.useRealTimers();
  const leitor = new FileReader();
  const texto = new Promise<string>((resolve) => {
    leitor.onload = () => resolve(String(leitor.result));
    leitor.readAsText(criar.mock.calls[0][0]);
  });
  await expect(texto).resolves.toBe('{\n  "resposta": "Sim"\n}\n');
});
