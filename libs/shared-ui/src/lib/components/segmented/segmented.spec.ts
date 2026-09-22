import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SegmentedComponent, type UiSegmentedOption } from './segmented';

type Visao = 'lista' | 'cards';

const OPCOES: readonly UiSegmentedOption<Visao>[] = [
  { value: 'lista', label: 'Lista', icon: 'pi-list' },
  { value: 'cards', label: 'Cards' },
];

describe('SegmentedComponent', () => {
  let fixture: ComponentFixture<SegmentedComponent<Visao>>;

  function botoes(): HTMLButtonElement[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.segmented__btn'),
    );
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SegmentedComponent] });
    fixture = TestBed.createComponent<SegmentedComponent<Visao>>(SegmentedComponent);
    fixture.componentRef.setInput('choices', OPCOES);
    fixture.componentRef.setInput('accessibleName', 'Alternar entre lista e cards');
    fixture.componentRef.setInput('selectedValue', 'lista');
    fixture.detectChanges();
  });

  it('nomeia o grupo e marca a opção selecionada com aria-pressed', () => {
    const grupo = (fixture.nativeElement as HTMLElement).querySelector('.segmented');
    expect(grupo?.getAttribute('role')).toBe('group');
    expect(grupo?.getAttribute('aria-label')).toBe('Alternar entre lista e cards');

    expect(botoes().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
  });

  it('emite a opção escolhida ao clique', () => {
    botoes()[1].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedValue()).toBe('cards');
    expect(botoes().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
  });

  it('renderiza o ícone só na opção que o declara, sempre decorativo', () => {
    const [comIcone, semIcone] = botoes();

    const icone = comIcone.querySelector('i');
    expect(icone?.className).toContain('pi-list');
    expect(icone?.getAttribute('aria-hidden')).toBe('true');
    expect(semIcone.querySelector('i')).toBeNull();

    // O rótulo continua sendo o nome acessível do botão — o ícone não o substitui.
    expect(comIcone.textContent?.trim()).toBe('Lista');
  });
});
