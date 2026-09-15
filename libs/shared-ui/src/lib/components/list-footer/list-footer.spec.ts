import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ListFooterComponent } from './list-footer';

describe('ListFooterComponent (rodapé de lista paginada)', () => {
  let fixture: ComponentFixture<ListFooterComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ListFooterComponent] });
    fixture = TestBed.createComponent(ListFooterComponent);
  });

  function pager(): HTMLElement | null {
    const el = fixture.debugElement.query(By.css('ui-pager'));
    return el ? (el.nativeElement as HTMLElement) : null;
  }

  it('não renderiza nada sem linhas nem cursores', () => {
    fixture.detectChanges();
    expect(pager()).toBeNull();
  });

  it('renderiza o pager quando há linhas, mesmo sem paginação', () => {
    fixture.componentRef.setInput('hasRows', true);
    fixture.detectChanges();
    expect(pager()).not.toBeNull();
  });

  it('renderiza o pager quando há cursor, mesmo sem linhas (página preservada em erro)', () => {
    fixture.componentRef.setInput('hasRows', false);
    fixture.componentRef.setInput('hasNext', true);
    fixture.detectChanges();
    expect(pager()).not.toBeNull();
  });

  it('repassa hasPrevious/hasNext/isDisabled e o seletor de limite para o ui-pager', () => {
    fixture.componentRef.setInput('hasRows', true);
    fixture.componentRef.setInput('hasPrevious', true);
    fixture.componentRef.setInput('pageSizeOptions', [10, 25, 50]);
    fixture.componentRef.setInput('pageSize', 25);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('[data-pager="prev"]')).nativeElement.disabled).toBe(
      false,
    );
    const select = fixture.debugElement.query(By.css('[data-pager="page-size"]'))
      .nativeElement as HTMLSelectElement;
    expect(select.value).toBe('25');
  });

  it('propaga previous/next e a troca de limite', () => {
    fixture.componentRef.setInput('hasRows', true);
    fixture.componentRef.setInput('hasPrevious', true);
    fixture.componentRef.setInput('hasNext', true);
    fixture.componentRef.setInput('pageSizeOptions', [10, 25, 50]);
    fixture.componentRef.setInput('pageSize', 25);
    fixture.detectChanges();

    const previous = vi.fn();
    const next = vi.fn();
    const pageSize = vi.fn();
    fixture.componentInstance.previous.subscribe(previous);
    fixture.componentInstance.next.subscribe(next);
    fixture.componentInstance.pageSize.subscribe(pageSize);

    fixture.debugElement.query(By.css('[data-pager="prev"]')).nativeElement.click();
    fixture.debugElement.query(By.css('[data-pager="next"]')).nativeElement.click();
    const select = fixture.debugElement.query(By.css('[data-pager="page-size"]'))
      .nativeElement as HTMLSelectElement;
    select.value = '50';
    select.dispatchEvent(new Event('change'));

    expect(previous).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
    expect(pageSize).toHaveBeenCalledWith(50);
  });
});
