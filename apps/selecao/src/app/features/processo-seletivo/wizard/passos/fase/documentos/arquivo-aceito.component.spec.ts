import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { CatalogoDosFormatosPermitidos } from '../../cronograma/catalogos/catalogo-dos-formatos-permitidos.service';
import { ArquivoAceitoComponent } from './arquivo-aceito.component';

function montar() {
  const catalogo = {
    carregar: vi.fn(),
    repetir: vi.fn(),
    erro: signal(null),
    situacao: signal('pronto'),
    formatos: signal([
      { codigo: 'PDF', rotulo: 'PDF' },
      { codigo: 'PNG', rotulo: 'PNG' },
    ]),
  };
  TestBed.overrideComponent(ArquivoAceitoComponent, {
    set: { providers: [{ provide: CatalogoDosFormatosPermitidos, useValue: catalogo }] },
  });
  const tela = TestBed.createComponent(ArquivoAceitoComponent);
  tela.componentRef.setInput('idBase', 'arquivo');
  tela.componentRef.setInput('tamanho', 5 * 1024 * 1024);
  tela.componentRef.setInput('formatos', { tipo: 'qualquer' });
  tela.detectChanges();
  return tela;
}

describe('ArquivoAceitoComponent', () => {
  it('oferece os formatos carregados e informa quando a lista está vazia', () => {
    const tela = montar();
    tela.componentRef.setInput('formatos', { tipo: 'lista', itens: [] });
    tela.detectChanges();
    const elemento = tela.nativeElement as HTMLElement;
    expect(elemento.textContent).toContain('Selecione ao menos um formato');
    expect(elemento.textContent).toContain('PDF');
    expect(elemento.textContent).toContain('PNG');
  });

  it('exibe a seleção recebida e indica tamanho maior que o permitido', () => {
    const tela = montar();
    tela.componentRef.setInput('formatos', {
      tipo: 'lista',
      itens: [{ formato: 'PDF', tamanhoMaximoBytes: 6 * 1024 * 1024 }],
    });
    tela.detectChanges();
    const elemento = tela.nativeElement as HTMLElement;
    expect(elemento.querySelector<HTMLInputElement>('input[type=checkbox]')?.checked).toBe(true);
    expect(elemento.querySelector<HTMLInputElement>('#arquivo-PDF')?.value).toBe('6');
    expect(
      elemento.querySelector<HTMLInputElement>('#arquivo-PDF')?.getAttribute('aria-invalid'),
    ).toBe('true');
  });

  it('emite a lista selecionada e descarta seus itens ao aceitar qualquer formato', () => {
    const tela = montar();
    const receber = vi.fn();
    tela.componentInstance.formatosChange.subscribe(receber);
    tela.componentInstance.escolherLista();
    expect(receber).toHaveBeenLastCalledWith({ tipo: 'lista', itens: [] });
    tela.componentRef.setInput('formatos', { tipo: 'lista', itens: [] });
    const caixa = document.createElement('input');
    caixa.checked = true;
    caixa.addEventListener('change', (evento) => tela.componentInstance.alternar('PDF', evento));
    caixa.dispatchEvent(new Event('change'));
    expect(receber).toHaveBeenLastCalledWith({
      tipo: 'lista',
      itens: [{ formato: 'PDF', tamanhoMaximoBytes: null }],
    });
    tela.componentInstance.escolherQualquer();
    expect(receber).toHaveBeenLastCalledWith({ tipo: 'qualquer' });
  });
});
