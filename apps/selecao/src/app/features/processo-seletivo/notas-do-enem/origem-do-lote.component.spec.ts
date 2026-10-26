import { TestBed } from '@angular/core/testing';
import type { LoteDeNotasDoEnemDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { OrigemDoLoteComponent } from './origem-do-lote.component';

describe('OrigemDoLoteComponent', () => {
  it('mostra só a versão e o hash curto, com o hash inteiro na dica e nomeado para o leitor de tela', () => {
    const fixture = TestBed.createComponent(OrigemDoLoteComponent);
    const hash = '04e827af9c1d5b7a'.padEnd(64, '0');
    fixture.componentRef.setInput('lote', {
      leiauteCodigo: 'INEP_ENEM_RETORNO',
      leiauteVersao: 'v1',
      arquivoHash: hash,
    } as LoteDeNotasDoEnemDto);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Leiaute v1 · hash do arquivo 04e827af',
    );
    expect(host.textContent).not.toContain('INEP_ENEM_RETORNO');
    expect(host.querySelector('[title]')?.getAttribute('title')).toBe(hash);
  });
});
