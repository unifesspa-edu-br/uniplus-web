import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { FilterChipsComponent } from './filter-chips';

describe('FilterChipsComponent', () => {
  let fixture: ComponentFixture<FilterChipsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [FilterChipsComponent] });
    fixture = TestBed.createComponent(FilterChipsComponent);
    fixture.componentRef.setInput('options', [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ]);
    fixture.detectChanges();
  });

  const chips = (): HTMLButtonElement[] =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));

  it('alterna a seleção pelo clique', () => {
    chips()[0].click();
    expect(fixture.componentInstance.selected()).toBe('a');
    chips()[0].click();
    expect(fixture.componentInstance.selected()).toBeNull();
  });

  it('indisponível, ignora o clique, mantém o foco e se anuncia como indisponível', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    chips()[1].focus();

    chips()[1].click();

    expect(fixture.componentInstance.selected()).toBeNull();
    expect(chips()[1].getAttribute('aria-disabled')).toBe('true');
    expect(chips()[1].disabled).toBe(false);
    expect(document.activeElement).toBe(chips()[1]);
  });
});
