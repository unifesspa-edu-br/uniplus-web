import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalOfertaRemocaoComponent } from './local-oferta-remocao.component';

describe('LocalOfertaRemocaoComponent', () => {
  let fixture: ComponentFixture<LocalOfertaRemocaoComponent>;
  let confirmacoes: number;

  beforeEach(() => {
    confirmacoes = 0;
    TestBed.configureTestingModule({ imports: [LocalOfertaRemocaoComponent] });
    fixture = TestBed.createComponent(LocalOfertaRemocaoComponent);
    fixture.componentRef.setInput('aberto', true);
    fixture.componentRef.setInput('mensagem', 'Deseja remover este local?');
    fixture.componentRef.setInput('erro', null);
    fixture.componentRef.setInput('anuncio', '');
    fixture.componentInstance.confirmar.subscribe(() => (confirmacoes += 1));
  });

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const confirmar = (): HTMLButtonElement =>
    raiz().querySelector('[data-testid="confirm-dialog-confirm"]') as HTMLButtonElement;

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

  it('durante a remoção, o botão fica ocupado e o diálogo não pode ser fechado', () => {
    fixture.componentRef.setInput('removendo', true);
    fixture.detectChanges();

    expect(confirmar().getAttribute('aria-disabled')).toBe('true');
    expect(confirmar().getAttribute('aria-busy')).toBe('true');
    expect(
      raiz().querySelector<HTMLButtonElement>('[data-testid="confirm-dialog-cancel"]')?.disabled,
    ).toBe(true);
    expect(raiz().querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled).toBe(
      true,
    );
  });

  it('mostra a recusa e o botão volta a aceitar a confirmação', () => {
    fixture.componentRef.setInput('removendo', false);
    fixture.componentRef.setInput('erro', 'Local em uso');
    fixture.detectChanges();

    expect(raiz().querySelector('.field__error')?.textContent).toBe('Local em uso');
    expect(confirmar().getAttribute('aria-disabled')).toBeNull();
    expect(
      raiz().querySelector<HTMLButtonElement>('[data-testid="confirm-dialog-cancel"]')?.disabled,
    ).toBe(false);
  });
});
