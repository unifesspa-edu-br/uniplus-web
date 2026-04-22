import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CpfInputComponent } from './cpf-input';

describe('CpfInputComponent (ControlValueAccessor)', () => {
  let component: CpfInputComponent;
  let fixture: ComponentFixture<CpfInputComponent>;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CpfInputComponent]
    });

    fixture = TestBed.createComponent(CpfInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should update `displayValue` signal when method `writeValue` is called', () => {
    component.writeValue('52998224725');

    expect(component.displayValue()).toBe('529.982.247-25');
  });

  it('should call `registeredOnChange` method with argument', () => {
    const onChangeSpy = vi.fn();
    onChangeSpy('52998224725');

    component.registerOnChange(onChangeSpy);
    expect(onChangeSpy).toHaveBeenCalledWith('52998224725');
  });

  it('should update `disabled` signal when method `setDisabled` is called with `true` argument', () => {
    component.setDisabledState(true);

    expect(component.disabled()).toBe(true);
  });

  it('should update `disabled` signal when method `setDisabled` is called with `false` argument', () => {
    component.setDisabledState(false);

    expect(component.disabled()).toBe(false);
  });

  it('should call `setDisabledState` with `true` argument and check if `disabled` property input is enabled', () => {
    const debugElement = fixture.debugElement.query(By.css('input'));
    const inputElement = debugElement.nativeElement;

    component.setDisabledState(true);
    fixture.detectChanges();

    expect(inputElement.disabled).toBe(true);
  });
});