import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { CampusRemocaoComponent } from './campus-remocao.component';

describe('CampusRemocaoComponent', () => {
  let fixture: ComponentFixture<CampusRemocaoComponent>;
  let confirmacoes: number;

  beforeEach(() => {
    confirmacoes = 0;
    TestBed.configureTestingModule({ imports: [CampusRemocaoComponent] });
    fixture = TestBed.createComponent(CampusRemocaoComponent);
    fixture.componentRef.setInput('aberto', true);
    fixture.componentRef.setInput('mensagem', 'Deseja remover MARABA?');
    fixture.componentRef.setInput('erro', null);
    fixture.componentRef.setInput('anuncio', '');
    fixture.componentInstance.confirmar.subscribe(() => (confirmacoes += 1));
  });

  const confirmar = (): HTMLButtonElement =>
    (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="confirm-dialog-confirm"]',
    ) as HTMLButtonElement;

  it('confirma uma vez e, com a remoção em curso, o clique é cancelado e não confirma de novo', () => {
    fixture.componentRef.setInput('removendo', false);
    fixture.detectChanges();
    confirmar().click();
    expect(confirmacoes).toBe(1);

    fixture.componentRef.setInput('removendo', true);
    fixture.detectChanges();
    const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
    confirmar().dispatchEvent(clique);

    expect(clique.defaultPrevented).toBe(true);
    expect(confirmacoes).toBe(1);
  });

  it('mostra a recusa e o botão volta a aceitar a confirmação', () => {
    fixture.componentRef.setInput('removendo', false);
    fixture.componentRef.setInput('erro', 'Campus em uso');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.field__error')?.textContent).toBe(
      'Campus em uso',
    );
    expect(confirmar().getAttribute('aria-disabled')).toBeNull();
  });
});
