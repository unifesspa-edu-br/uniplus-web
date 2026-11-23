import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmacaoDaRemocaoDoDocumentoComponent } from './confirmacao-da-remocao-do-documento.component';

function montar() {
  const fixture = TestBed.createComponent(ConfirmacaoDaRemocaoDoDocumentoComponent);
  fixture.componentRef.setInput('descricaoId', 'efeito-da-remocao');
  fixture.componentRef.setInput('texto', 'O documento RG será removido.');
  fixture.componentInstance.visivel.set(true);
  fixture.detectChanges();
  return fixture;
}

describe('confirmação da remoção do documento', () => {
  it('associa a descrição ao diálogo', () => {
    const fixture = montar();
    const dialogo = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    const texto = fixture.nativeElement.querySelector('#efeito-da-remocao') as HTMLElement;
    expect(dialogo.getAttribute('aria-describedby')).toBe(texto.id);
    expect(texto.textContent).toContain('RG');
  });

  it('cancelar fecha sem confirmar', () => {
    const fixture = montar();
    const confirmada = vi.fn();
    fixture.componentInstance.confirmada.subscribe(confirmada);
    const botoes = fixture.nativeElement.querySelectorAll(
      'button',
    ) as NodeListOf<HTMLButtonElement>;
    Array.from(botoes)
      .find((botao) => botao.textContent?.includes('Cancelar'))
      ?.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.visivel()).toBe(false);
    expect(confirmada).not.toHaveBeenCalled();
  });

  it('Esc fecha sem confirmar', () => {
    const fixture = montar();
    const confirmada = vi.fn();
    fixture.componentInstance.confirmada.subscribe(confirmada);
    const dialogo = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialogo.dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.visivel()).toBe(false);
    expect(confirmada).not.toHaveBeenCalled();
  });

  it('confirma após fechar o diálogo', () => {
    const fixture = montar();
    const confirmada = vi.fn();
    fixture.componentInstance.confirmada.subscribe(confirmada);
    const botoes = fixture.nativeElement.querySelectorAll(
      'button',
    ) as NodeListOf<HTMLButtonElement>;
    Array.from(botoes)
      .find((botao) => botao.textContent?.includes('Remover'))
      ?.click();
    fixture.detectChanges();
    expect(confirmada).toHaveBeenCalledOnce();
  });
});
