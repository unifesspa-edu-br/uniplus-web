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
      imports: [CpfInputComponent],
    });

    const onTouchedSpy = vi.fn();
    const onChangeSpy = vi.fn();

    const fixture: ComponentFixture<CpfInputComponent> =
      TestBed.createComponent(CpfInputComponent);
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
    expect(getInputEl().value).toBe(CPF_FORMATTED);
  });

  it('limpa o input quando writeValue recebe null (form.reset)', () => {
    const { fixture, component, getInputEl } = setup();
    component.writeValue(CPF_RAW);
    fixture.detectChanges();
    component.writeValue(null as unknown as string);
    fixture.detectChanges();
    expect(getInputEl().value).toBe('');
  });

  it('remove caracteres não numéricos do valor recebido em writeValue', () => {
    const { fixture, component, getInputEl } = setup();
    component.writeValue('abc529.982.247-25xyz');
    fixture.detectChanges();
    expect(getInputEl().value).toBe(CPF_FORMATTED);
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

  it('restaura disabled para false após setDisabledState(false)', () => {
    const { component } = setup();
    component.setDisabledState(true);
    component.setDisabledState(false);
    expect(component.disabled()).toBe(false);
  });

  it('checa se a propriedade disabled no input existe quando o signal disabled é atualizado com valor true', () => {
    const { fixture, component, getInputEl } = setup();
    const inputEl = getInputEl();

    component.setDisabledState(true);
    fixture.detectChanges();

    expect(inputEl.disabled).toBe(true);
  });

  it.each([
    ['123', '123'],
    ['1234', '123.4'],
    ['123456', '123.456'],
    ['1234567', '123.456.7'],
    ['123456789', '123.456.789'],
    ['12345678901', '123.456.789-01'],
    ['1234567890199', '123.456.789-01'],
  ])('formata progressivamente "%s" como "%s"', (raw, expected) => {
    const { fixture, component, getInputEl } = setup();
    component.writeValue(raw);
    fixture.detectChanges();
    expect(getInputEl().value).toBe(expected);
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
    getInputEl().dispatchEvent(new Event('blur'));

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
