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

  it.each([
    ['claro', ['unifesspa-horizontal-extenso.png']],
    ['escuro', ['unifesspa-horizontal-branca.png']],
    ['tema', ['unifesspa-horizontal-extenso.png', 'unifesspa-horizontal-branca.png']],
  ] as const)('sobre fundo %s, traz a versão oficial que cabe ao fundo', (fundo, arquivos) => {
    const fixture = TestBed.createComponent(MarcaInstitucionalComponent);
    fixture.componentRef.setInput('fundo', fundo);
    fixture.detectChanges();
    const imagens = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('img'));

    expect(imagens.map((imagem) => imagem.getAttribute('src')?.split('/').pop())).toEqual(arquivos);
  });

  it('rotulada, toda versão visível tem o nome da instituição como texto alternativo', () => {
    const fixture = TestBed.createComponent(MarcaInstitucionalComponent);
    fixture.componentRef.setInput('fundo', 'tema');
    fixture.detectChanges();
    const imagens = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('img'));

    expect(imagens.map((imagem) => imagem.alt)).toEqual([
      'Unifesspa — Universidade Federal do Sul e Sudeste do Pará',
      'Unifesspa — Universidade Federal do Sul e Sudeste do Pará',
    ]);
  });
});
