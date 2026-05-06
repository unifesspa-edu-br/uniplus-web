import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormControl, Validators } from '@angular/forms';
import { describe, it, expect, beforeEach } from 'vitest';
import { FormFieldComponent } from './form-field';

describe('FormFieldComponent', () => {
  let fixture: ComponentFixture<FormFieldComponent>;
  let component: FormFieldComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [FormFieldComponent] });

    fixture = TestBed.createComponent(FormFieldComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('label', 'Título');
    fixture.componentRef.setInput('control', new FormControl<string>(''));
  });

  it('inicializa com label e input ligados via id único', () => {
    fixture.detectChanges();

    const label = fixture.debugElement.query(By.css('label')).nativeElement as HTMLLabelElement;
    const input = fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;

    expect(label.textContent?.trim()).toBe('Título');
    expect(input.id).toMatch(/^ui-form-field-input-\d+$/);
    expect(label.htmlFor).toBe(input.id);
  });

  it('binda valor do FormControl via [formControl]', () => {
    const control = new FormControl<string>('PSE 2026');
    fixture.componentRef.setInput('control', control);
    fixture.detectChanges();

    const input = fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;
    expect(input.value).toBe('PSE 2026');

    // Mutação no controle reflete no input.
    control.setValue('PSE 2027');
    fixture.detectChanges();
    expect(input.value).toBe('PSE 2027');
  });

  it('default type é text; aceita override via input type', () => {
    fixture.detectChanges();
    let input = fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;
    expect(input.type).toBe('text');

    fixture.componentRef.setInput('type', 'number');
    fixture.detectChanges();
    input = fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;
    expect(input.type).toBe('number');
  });

  it('errorMessage popula <p id> visível + aria-invalid + aria-describedby + aria-live=polite', () => {
    fixture.componentRef.setInput('errorMessage', 'Campo obrigatório.');
    fixture.detectChanges();

    const input = fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;
    const erro = fixture.debugElement.query(By.css('p[aria-live="polite"]')).nativeElement as HTMLParagraphElement;

    expect(erro.textContent?.trim()).toBe('Campo obrigatório.');
    expect(erro.hasAttribute('hidden')).toBe(false);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(erro.id);
    expect(erro.id).toMatch(/^ui-form-field-error-\d+$/);
  });

  it('sem errorMessage e sem hint, aria-invalid e aria-describedby ausentes; <p>s ocultos', () => {
    fixture.detectChanges();

    const input = fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBeNull();

    // <p>s permanecem no DOM (com [hidden]) para garantir que IDs sempre existam.
    const ps = fixture.debugElement.queryAll(By.css('p'));
    expect(ps.length).toBe(2);
    expect((ps[0].nativeElement as HTMLElement).hasAttribute('hidden')).toBe(true);
    expect((ps[1].nativeElement as HTMLElement).hasAttribute('hidden')).toBe(true);
  });

  it('hint sem errorMessage exibe <p hint> + aria-describedby aponta para hint', () => {
    fixture.componentRef.setInput('hint', 'Use somente dígitos.');
    fixture.detectChanges();

    const input = fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;
    const ps = fixture.debugElement.queryAll(By.css('p'));
    const hintEl = ps.find((p) => (p.nativeElement as HTMLElement).id.startsWith('ui-form-field-hint-'))!.nativeElement as HTMLParagraphElement;
    const erroEl = ps.find((p) => (p.nativeElement as HTMLElement).id.startsWith('ui-form-field-error-'))!.nativeElement as HTMLParagraphElement;

    expect(hintEl.textContent?.trim()).toBe('Use somente dígitos.');
    expect(hintEl.hasAttribute('hidden')).toBe(false);
    expect(erroEl.hasAttribute('hidden')).toBe(true);
    expect(input.getAttribute('aria-describedby')).toBe(hintEl.id);
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(hintEl.id).toMatch(/^ui-form-field-hint-\d+$/);
  });

  it('errorMessage tem precedência sobre hint quando ambos presentes (hint oculto)', () => {
    fixture.componentRef.setInput('hint', 'Hint que deveria ser ignorado.');
    fixture.componentRef.setInput('errorMessage', 'Erro vence.');
    fixture.detectChanges();

    const ps = fixture.debugElement.queryAll(By.css('p'));
    const hintEl = ps.find((p) => (p.nativeElement as HTMLElement).id.startsWith('ui-form-field-hint-'))!.nativeElement as HTMLParagraphElement;
    const erroEl = ps.find((p) => (p.nativeElement as HTMLElement).id.startsWith('ui-form-field-error-'))!.nativeElement as HTMLParagraphElement;

    expect(erroEl.textContent?.trim()).toBe('Erro vence.');
    expect(erroEl.hasAttribute('hidden')).toBe(false);
    expect(hintEl.hasAttribute('hidden')).toBe(true);

    const input = fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;
    expect(input.getAttribute('aria-describedby')).toBe(erroEl.id);
  });

  it('atributos opcionais min/max/placeholder são propagados quando setados', () => {
    fixture.componentRef.setInput('min', 1);
    fixture.componentRef.setInput('max', 99);
    fixture.componentRef.setInput('placeholder', 'Ex.: 042');
    fixture.detectChanges();

    const input = fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;
    expect(input.getAttribute('min')).toBe('1');
    expect(input.getAttribute('max')).toBe('99');
    expect(input.getAttribute('placeholder')).toBe('Ex.: 042');
  });

  it('IDs distintos entre instâncias do mesmo componente (evita colisão DOM)', () => {
    fixture.detectChanges();
    const id1 = (fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement).id;

    const fixture2 = TestBed.createComponent(FormFieldComponent);
    fixture2.componentRef.setInput('label', 'Outro');
    fixture2.componentRef.setInput('control', new FormControl<string>(''));
    fixture2.detectChanges();
    const id2 = (fixture2.debugElement.query(By.css('input')).nativeElement as HTMLInputElement).id;

    expect(id1).not.toBe(id2);
  });

  it('FormControl com Validators.required emite evento de mudança ao usuário digitar', () => {
    const control = new FormControl<string>('', { nonNullable: true, validators: [Validators.required] });
    fixture.componentRef.setInput('control', control);
    fixture.detectChanges();

    const input = fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;
    input.value = 'Novo valor';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(control.value).toBe('Novo valor');
    expect(control.dirty).toBe(true);
  });

  // Documenta a API: defaults dos inputs opcionais. Como signals nunca
  // são nulos (sempre objetos), checar `.toBeTruthy()` direto seria trivial;
  // chamar como função (`input()`) verifica o valor default real.
  it('expõe inputs canônicos com defaults coerentes', () => {
    expect(component.type()).toBe('text');
    expect(component.placeholder()).toBe('');
    expect(component.errorMessage()).toBeNull();
    expect(component.hint()).toBeNull();
    expect(component.min()).toBeNull();
    expect(component.max()).toBeNull();
  });
});
