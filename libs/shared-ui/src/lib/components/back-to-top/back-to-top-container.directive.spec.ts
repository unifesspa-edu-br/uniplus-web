import { describe, expect, it } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BackToTopContainerDirective } from './back-to-top-container.directive';
import { BackToTopScrollService } from './back-to-top.service';

const microtask = (): Promise<void> => Promise.resolve();

describe('BackToTopContainerDirective', () => {
  @Component({
    standalone: true,
    imports: [BackToTopContainerDirective],
    template: `<div uiBackToTopContainer></div>`,
  })
  class DiretivaHost {}

  it('registra o elemento hospedeiro e o remove ao ser destruído', async () => {
    await TestBed.configureTestingModule({ imports: [DiretivaHost] }).compileComponents();
    const fixture = TestBed.createComponent(DiretivaHost);
    fixture.detectChanges();

    const service = TestBed.inject(BackToTopScrollService);
    const alvo = fixture.nativeElement.querySelector('div') as HTMLElement;
    await microtask();
    expect(service.containerPrincipal()).toBe(alvo);

    fixture.destroy();
    await microtask();
    expect(service.containerPrincipal()).toBeNull();
  });
});
