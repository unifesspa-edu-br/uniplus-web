import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EstadoDoVinculo, ResolucaoDeVinculo } from '@uniplus/shared-core/http';
import { beforeEach, describe, expect, it } from 'vitest';

import { LookupLabelComponent } from './lookup-label';

describe('LookupLabelComponent', () => {
  let fixture: ComponentFixture<LookupLabelComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [LookupLabelComponent] });
    fixture = TestBed.createComponent(LookupLabelComponent);
  });

  function render(resolucao: ResolucaoDeVinculo): HTMLElement {
    fixture.componentRef.setInput('resolucao', resolucao);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('exibe o rótulo cru, sem marcação, quando o vínculo resolveu', () => {
    const host = render({ estado: 'resolvido', rotulo: 'ENG-CIV — Engenharia Civil' });

    expect(host.textContent?.trim()).toBe('ENG-CIV — Engenharia Civil');
    expect(host.querySelector('.lookup-label')).toBeNull();
  });

  /**
   * O ponto da issue #579: os três desfechos que não resolvem precisam ser
   * distinguíveis entre si na tela, não colapsados num "Vinculado" só.
   */
  it.each<[EstadoDoVinculo, string, string]>([
    ['carregando', 'Carregando…', 'lookup-label--pending'],
    ['falhou', 'Não carregado', 'lookup-label--failed'],
    ['ausente', 'Não identificado', 'lookup-label--missing'],
  ])('marca o estado %s com texto e classe próprios', (estado, texto, classe) => {
    const host = render({ estado, rotulo: '' });
    const marcador = host.querySelector('.lookup-label');

    expect(marcador?.textContent?.trim()).toBe(texto);
    expect(marcador?.classList.contains(classe)).toBe(true);
  });

  it('não oferece ação de nova tentativa — ela cabe à tela, uma vez só', () => {
    const host = render({ estado: 'falhou', rotulo: '' });

    expect(host.querySelector('button')).toBeNull();
  });
});
