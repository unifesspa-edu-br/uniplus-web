import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { MarcaInstitucionalComponent } from './marca-institucional';

describe('MarcaInstitucionalComponent', () => {
  it('é a imagem oficial com dimensões declaradas e o nome da instituição como texto alternativo', () => {
    const fixture = TestBed.createComponent(MarcaInstitucionalComponent);
    fixture.detectChanges();
    const imagem = (fixture.nativeElement as HTMLElement).querySelector('img') as HTMLImageElement;

    expect(imagem.getAttribute('src')).toBe(
      'assets/shared-ui/marca/unifesspa-horizontal-extenso.png',
    );
    expect(imagem.getAttribute('width')).toBe('512');
    expect(imagem.getAttribute('height')).toBe('180');
    expect(imagem.alt).toBe('Unifesspa — Universidade Federal do Sul e Sudeste do Pará');
  });

  it('sem rótulo, é decorativa', () => {
    const fixture = TestBed.createComponent(MarcaInstitucionalComponent);
    fixture.componentRef.setInput('rotulada', false);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('img')?.getAttribute('alt')).toBe(
      '',
    );
  });
});
