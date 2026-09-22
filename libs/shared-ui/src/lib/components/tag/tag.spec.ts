import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TagComponent, type UiTagVariant } from './tag';

describe('TagComponent', () => {
  let fixture: ComponentFixture<TagComponent>;

  function tag(): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector('.tag') as HTMLElement;
  }

  function montar(variant: UiTagVariant, solid = false): void {
    fixture.componentRef.setInput('variant', variant);
    fixture.componentRef.setInput('solid', solid);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TagComponent] });
    fixture = TestBed.createComponent(TagComponent);
  });

  it('declara a variante em classe própria, inclusive a neutra', () => {
    montar('neutral');
    // Sem a classe da neutra, `.tag--solid` fica sem regra de fundo e o texto
    // branco do modificador cai sobre o fundo claro de `.tag`.
    expect(tag().classList.contains('tag--neutral')).toBe(true);

    montar('success');
    expect(tag().classList.contains('tag--success')).toBe(true);
    expect(tag().classList.contains('tag--neutral')).toBe(false);
  });

  it('combina variante e modificador sólido', () => {
    montar('neutral', true);

    expect(tag().classList.contains('tag--neutral')).toBe(true);
    expect(tag().classList.contains('tag--solid')).toBe(true);
  });

  it('esconde o ponto decorativo do leitor de tela quando presente', () => {
    fixture.componentRef.setInput('dot', true);
    fixture.detectChanges();

    expect(tag().querySelector('.tag__dot')?.getAttribute('aria-hidden')).toBe('true');
  });
});
