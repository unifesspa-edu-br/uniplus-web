import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { EdicoesDoEnemComponent } from './edicoes-do-enem.component';

describe('EdicoesDoEnemComponent', () => {
  let fixture: ComponentFixture<EdicoesDoEnemComponent>;
  let store: ProcessoSeletivoStore;

  const elemento = (seletor: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(seletor);
  const campoDoAno = (): HTMLInputElement => elemento('#f-edicao-enem') as HTMLInputElement;

  function iniciar(edicoesEnem: readonly string[]): void {
    store.patchObjectSection('classificacao', { baseadoEmEnem: true, edicoesEnem });
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ProcessoSeletivoStore] });
    store = TestBed.inject(ProcessoSeletivoStore);
    fixture = TestBed.createComponent(EdicoesDoEnemComponent);
  });

  it('acrescenta a edição digitada ao rascunho da classificação', () => {
    iniciar(['2024']);

    campoDoAno().value = '2025';
    campoDoAno().dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (elemento('button.btn--secondary') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(store.draft().classificacao.edicoesEnem).toEqual(['2024', '2025']);
    expect(campoDoAno().value).toBe('');
  });

  it('a recusa do servidor às edições aparece junto da lista e descreve o campo do ano', () => {
    iniciar(['2026']);

    store.classificacao.recusaDasEdicoesDoEnem.set('A edição informada não é aceita.');
    fixture.detectChanges();

    expect(elemento('#edicoes-enem-servidor')?.textContent?.trim()).toBe(
      'A edição informada não é aceita.',
    );
    expect(campoDoAno().getAttribute('aria-describedby')).toContain('edicoes-enem-servidor');
  });
});
