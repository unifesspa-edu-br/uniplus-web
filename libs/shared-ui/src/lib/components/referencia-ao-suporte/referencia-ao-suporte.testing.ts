import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { ReferenciaAoSuporte } from '@uniplus/shared-core/http';

import { ReferenciaAoSuporteComponent } from './referencia-ao-suporte';

/** Monta o componente; `clipboard` ausente simula o navegador sem área de transferência. */
export function montar(
  referencia: ReferenciaAoSuporte,
  passo: string | null = null,
  clipboard: Pick<Clipboard, 'writeText'> | undefined = undefined,
): ComponentFixture<ReferenciaAoSuporteComponent> {
  Object.defineProperty(window.navigator, 'clipboard', { value: clipboard, configurable: true });
  const fixture = TestBed.createComponent(ReferenciaAoSuporteComponent);
  fixture.componentRef.setInput('referencia', referencia);
  fixture.componentRef.setInput('passo', passo);
  fixture.detectChanges();
  return fixture;
}
