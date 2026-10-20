import { TestBed } from '@angular/core/testing';
import type { AtoDoProcessoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { ArquivosDoAtoComponent } from './arquivos-do-ato.component';

function documento(id: string) {
  return {
    documentoAPublicarId: id,
    nomeArquivo: `${id}.pdf`,
    nomeDeExibicao: null,
    tipoDeMidia: 'application/pdf',
    hashSha256: 'a'.repeat(64),
  };
}

function render(quantidadeDeAnexos: number): HTMLElement {
  const fixture = TestBed.createComponent(ArquivosDoAtoComponent);
  const ato = {
    id: 'ato-1',
    tipoNome: 'Aviso',
    numero: null,
    documentoPrincipal: documento('principal'),
    anexos: Array.from({ length: quantidadeDeAnexos }, (_, i) => documento(`anexo-${i + 1}`)),
  } as unknown as AtoDoProcessoDto;
  fixture.componentRef.setInput('ato', ato);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ArquivosDoAtoComponent', () => {
  it('agrupa os anexos sob um único título com a contagem, sem repetir o rótulo por linha', () => {
    const el = render(3);
    const texto = el.textContent ?? '';

    expect(texto.match(/Documento principal/g)).toHaveLength(1);
    expect(texto).toContain('Anexos (3)');
    expect(texto.match(/Anexo(?!s)/g)).toBeNull();
    expect(el.querySelectorAll('button')).toHaveLength(4);
    expect(el.querySelector('button[aria-label^="Abrir o anexo anexo-1"]')?.getAttribute('aria-label')).toContain(
      'abre em nova aba',
    );
  });

  it('omite o grupo de anexos quando o ato não tem anexos', () => {
    const el = render(0);

    expect(el.textContent).not.toContain('Anexos');
    expect(el.querySelectorAll('button')).toHaveLength(1);
  });
});
