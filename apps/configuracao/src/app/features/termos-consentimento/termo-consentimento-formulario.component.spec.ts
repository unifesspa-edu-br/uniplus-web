import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { TermoConsentimentoFormularioComponent } from './termo-consentimento-formulario.component';
import { criarFormulario } from './termo-consentimento-form';

describe('TermoConsentimentoFormularioComponent', () => {
  function montar(criando: boolean) {
    const fixture = TestBed.createComponent(TermoConsentimentoFormularioComponent);
    fixture.componentRef.setInput('form', criarFormulario());
    fixture.componentRef.setInput('criando', criando);
    fixture.componentRef.setInput('tentouSalvar', false);
    fixture.detectChanges();
    const botao = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    if (!botao) throw new Error('botão de envio ausente');
    return botao;
  }

  function clicar(botao: HTMLButtonElement): boolean {
    const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
    botao.dispatchEvent(clique);
    return clique.defaultPrevented;
  }

  it('deixa o clique enviar o formulário quando não há criação em andamento', () => {
    expect(clicar(montar(false))).toBe(false);
  });

  it('recusa o clique enquanto a criação está em andamento', () => {
    expect(clicar(montar(true))).toBe(true);
  });
});
