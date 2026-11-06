import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { TermoConsentimentoFormularioComponent } from './termo-consentimento-formulario.component';
import { criarFormulario } from './termo-consentimento-form';

describe('TermoConsentimentoFormularioComponent', () => {
  function montar(criando: boolean): ComponentFixture<TermoConsentimentoFormularioComponent> {
    const fixture = TestBed.createComponent(TermoConsentimentoFormularioComponent);
    fixture.componentRef.setInput('form', criarFormulario());
    fixture.componentRef.setInput('criando', criando);
    fixture.detectChanges();
    return fixture;
  }
  const raiz = (fixture: ComponentFixture<unknown>): HTMLElement => fixture.nativeElement;
  const enviar = (fixture: ComponentFixture<unknown>): HTMLButtonElement =>
    raiz(fixture).querySelector('button[type="submit"]') as HTMLButtonElement;

  function clicar(botao: HTMLButtonElement): boolean {
    const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
    botao.dispatchEvent(clique);
    return clique.defaultPrevented;
  }

  it('deixa o clique enviar o formulário quando não há criação em andamento', () => {
    const botao = enviar(montar(false));
    expect(clicar(botao)).toBe(false);
    expect(botao.getAttribute('aria-disabled')).toBeNull();
  });

  it('recusa o clique e deixa os campos indisponíveis enquanto a criação está em andamento', () => {
    const fixture = montar(true);
    expect(clicar(enviar(fixture))).toBe(true);
    expect(enviar(fixture).getAttribute('aria-disabled')).toBe('true');
    expect(raiz(fixture).querySelector('fieldset')?.matches(':disabled')).toBe(true);
    expect(raiz(fixture).querySelector('input')?.matches(':disabled')).toBe(true);
  });

  it('identifica o nome como obrigatório', () => {
    const nome = raiz(montar(false)).querySelector('input[formcontrolname="nome"]');
    expect(nome?.getAttribute('aria-required')).toBe('true');
  });

  it('emite o envio uma vez e não emite durante a criação', () => {
    const livre = montar(false);
    const emitidos: string[] = [];
    livre.componentInstance.salvar.subscribe(() => emitidos.push('envio'));
    livre.componentInstance.form().controls.nome.setValue('Termo');
    raiz(livre).querySelector('form')?.dispatchEvent(new Event('submit'));
    expect(emitidos).toEqual(['envio']);

    const ocupado = montar(true);
    ocupado.componentInstance.salvar.subscribe(() => emitidos.push('indevido'));
    raiz(ocupado).querySelector('form')?.dispatchEvent(new Event('submit'));
    expect(emitidos).toEqual(['envio']);
  });

  it('mostra a recusa do servidor com a mensagem do servidor e a de tamanho', () => {
    const fixture = montar(false);
    const { nome, texto } = fixture.componentInstance.form().controls;
    nome.setErrors({ backend: { code: 'c', message: 'Nome recusado.' } });
    nome.markAsTouched();
    texto.setValue('x'.repeat(20001));
    texto.markAsTouched();
    fixture.detectChanges();
    const mensagens = [...raiz(fixture).querySelectorAll('.field__error')].map(
      (item) => item.textContent,
    );
    expect(mensagens).toEqual(['Nome recusado.', 'Informe no máximo 20000 caracteres.']);
  });
});
