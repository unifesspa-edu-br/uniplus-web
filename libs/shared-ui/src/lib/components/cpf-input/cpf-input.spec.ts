import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { CpfInputComponent } from './cpf-input';

describe('CpfInputComponent (ControlValueAccessor)', () => {
  const CPF_RAW = '52998224725';
  const CPF_FORMATTED = '529.982.247-25';

  function setup() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CpfInputComponent]
    });

    const onTouchedSpy = vi.fn();
    const onChangeSpy = vi.fn();

    const fixture: ComponentFixture<CpfInputComponent> = TestBed.createComponent(CpfInputComponent);
    fixture.detectChanges();
    const getInputEl = () =>
      fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;
    const component = fixture.componentInstance;
    return { fixture, component, getInputEl, onTouchedSpy, onChangeSpy };
  }

  it('formata o CPF no input quando writeValue é chamado', () => {
    const { fixture, component, getInputEl } = setup();
    component.writeValue(CPF_RAW);
    fixture.detectChanges();
    const input = getInputEl();
    expect(input.value).toBe(CPF_FORMATTED);
  });

  it('propaga o CPF sem máscara pelo callback registrado em registerOnChange', () => {
    const { getInputEl, onChangeSpy, component } = setup();
    component.registerOnChange(onChangeSpy);

    const inputEl = getInputEl();
    inputEl.value = CPF_FORMATTED;
    inputEl.dispatchEvent(new Event('input'));

    expect(onChangeSpy).toHaveBeenCalledWith(CPF_RAW);
  });

  it('atualiza a propriedade disabled com o valor true', () => {
    const { fixture, component } = setup();
    component.setDisabledState(true);
    fixture.detectChanges();
    expect(component.disabled()).toBe(true);
  });

  it('atualiza a propriedade disabled', () => {
    const { component } = setup();
    component.setDisabledState(true);
    component.setDisabledState(false);
    expect(component.disabled()).toBe(false);
  });

  it('checa se a propriedade disable no input existe quando o signal disabled é atualizado com valor true', () => {
    const { fixture, component, getInputEl } = setup();
    const inputEl = getInputEl();
  
    component.setDisabledState(true);
    fixture.detectChanges();

    expect(inputEl.disabled).toBeTruthy();
    expect(inputEl.disabled).toBe(true);
  });

  it.each([
    ['123', '123'],
    ['1234', '123.4'],
    ['1234567', '123.456.7'],
    ['12345678901', '123.456.789-01'],
    ['1234567890199', '123.456.789-01']
  ])('formata progressivamente "%s" como "%s"', (raw, expected) => {
    const { component } = setup();
    component.writeValue(raw);
    expect(component.displayValue()).toBe(expected);
  });

  it('marca aria-invalid e vincula aria-describedby quando invalid=true', () => {
    const { fixture, getInputEl } = setup();
      fixture.componentRef.setInput('invalid', true);
      fixture.componentRef.setInput('errorMessage', 'CPF inválido');
      fixture.componentRef.setInput('inputId', 'cpf');
      fixture.detectChanges();
      const input = getInputEl();

      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.getAttribute('aria-describedby')).toBe('cpf-error');
    });

    it('dispara o callback registrado em registerOnTouched no blur do input', () => {
      const { component, onTouchedSpy, getInputEl } = setup();
    
      component.registerOnTouched(onTouchedSpy);
      const input = getInputEl();
      input.dispatchEvent(new Event('blur'));
      expect(onTouchedSpy).toHaveBeenCalledOnce();
    });

    it('trunca entrada em 11 dígitos e remove caracteres não numéricos no onInput', () => {
      const { onChangeSpy, component, getInputEl } = setup();
      component.registerOnChange(onChangeSpy);
      const input = getInputEl();
      input.value = 'abc529982247250000xyz';
      input.dispatchEvent(new Event('input'));
      expect(onChangeSpy).toHaveBeenLastCalledWith('52998224725');
    });
});
