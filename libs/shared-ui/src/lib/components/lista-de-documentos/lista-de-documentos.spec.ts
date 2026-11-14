import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { type DocumentoExigido, ListaDeDocumentosComponent } from './lista-de-documentos';

function documento(outros: Partial<DocumentoExigido> = {}): DocumentoExigido {
  return {
    rotulo: 'Comprovante de residência',
    aplicabilidade: 'CONDICIONAL',
    obrigatorio: false,
    formatos: { qualquer: false, lista: ['PDF', 'JPG'] },
    modelo: null,
    ...outros,
  };
}

function renderizar(documentos: readonly DocumentoExigido[]): HTMLElement {
  const fixture = TestBed.createComponent(ListaDeDocumentosComponent);
  fixture.componentRef.setInput('documentos', documentos);
  fixture.componentRef.setInput('semDocumentos', 'Nada a enviar.');
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ListaDeDocumentosComponent', () => {
  /** A obrigatoriedade é escrita, não só pela cor da etiqueta (WCAG 1.4.1). */
  it('mostra o nome como título, a obrigatoriedade escrita, a quem se aplica e os formatos', () => {
    const tela = renderizar([documento()]);

    const item = tela.querySelector('li') as HTMLElement;
    expect(item.querySelector('h4')?.textContent).toBe('Comprovante de residência');
    const texto = item.textContent?.replace(/\s+/g, ' ');
    expect(texto).toContain('Facultativo');
    expect(texto).toContain('Só para quem está na situação descrita no edital · PDF, JPG');
  });

  describe('modelo do documento', () => {
    const modelo = { nomeArquivo: 'declaracao.odt', formato: 'ODT', urlDownload: null };

    it('oferece o link de download quando o arquivo já está no acervo', () => {
      const endereco = 'https://acervo.exemplo.test/declaracao.odt';
      const tela = renderizar([documento({ modelo: { ...modelo, urlDownload: endereco } })]);

      const link = tela.querySelector('a') as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe(endereco);
      expect(link.textContent).toContain('Baixar o modelo (ODT)');
    });

    it('avisa que o arquivo ainda está sendo disponibilizado, sem link quebrado', () => {
      const tela = renderizar([documento({ modelo })]);

      expect(tela.querySelector('a')).toBeNull();
      expect(tela.textContent).toContain('ainda está sendo disponibilizado');
    });
  });

  it('com a lista vazia, diz o que quem hospeda informar', () => {
    const tela = renderizar([]);

    expect(tela.querySelector('ul')).toBeNull();
    expect(tela.textContent?.trim()).toBe('Nada a enviar.');
  });
});
