import { TestBed } from '@angular/core/testing';
import { FileUploadComponent, type ArquivoEmEnvio } from './file-upload';

export function montarModoControlado(entradas: Record<string, unknown> = {}) {
  const fixture = TestBed.createComponent(FileUploadComponent);
  fixture.componentRef.setInput('itens', []);
  fixture.componentRef.setInput('multiple', true);
  for (const [nome, valor] of Object.entries(entradas)) fixture.componentRef.setInput(nome, valor);
  const escolhidos: (readonly File[])[] = [];
  const retirados: string[] = [];
  const repetidos: string[] = [];
  const baixados: string[] = [];
  fixture.componentInstance.arquivosEscolhidos.subscribe((f) => escolhidos.push(f));
  fixture.componentInstance.itemRetirado.subscribe((id) => retirados.push(id));
  fixture.componentInstance.tentarDeNovo.subscribe((id) => repetidos.push(id));
  fixture.componentInstance.itemBaixado.subscribe((id) => baixados.push(id));
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;

  const escolher = (...arquivos: File[]) => {
    const input = host.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: arquivos, configurable: true });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };
  return { fixture, host, escolhidos, retirados, repetidos, baixados, escolher };
}

export const pdf = (nome: string, bytes = 1024) =>
  new File([new ArrayBuffer(bytes)], nome, { type: 'application/pdf' });
export const item = (extra: Partial<ArquivoEmEnvio> = {}): ArquivoEmEnvio => ({
  id: 'a1',
  nome: 'edital.pdf',
  fase: 'enviando',
  progresso: 40,
  ...extra,
});
