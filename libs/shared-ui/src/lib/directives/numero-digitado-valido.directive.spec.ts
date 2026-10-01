import { describe } from 'vitest';
import { ApplicationRef, Component } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NumeroDigitadoValidoDirective } from './numero-digitado-valido.directive';
import { By } from '@angular/platform-browser';

interface Form {
  numeroOpcional: FormControl<number | null>
  numeroObrigatorio: FormControl<number>;
}

const NUMERO_INVALIDO_VALIDATION_ERRO: ValidationErrors = { required: true, };

@Component({
  standalone: true,
  imports: [NumeroDigitadoValidoDirective, ReactiveFormsModule],
  template: `
    <form [formGroup]="form">
      <input
        id="numero-obrigatorio"
        type="number"
        min="0"
        formControlName="numeroObrigatorio"
        uiNumeroDigitadoValido
      />
      <input
        id="numero-opcional"
        type="number"
        min="0"
        formControlName="numeroOpcional"
        uiNumeroDigitadoValido
      />
    </form>
  `,
})
class HospedeiroComponent {
  protected readonly form = new FormGroup<Form>({
    numeroOpcional: new FormControl<number | null>(null, { validators: [Validators.min(0),] }),
    numeroObrigatorio: new FormControl<number>(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0),],
    }),
  });
}

describe('NumeroDigitadoValidoDirective', async () => {
  let fixture: ComponentFixture<HospedeiroComponent>;
  let component: HospedeiroComponent;
  let appRef: ApplicationRef;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HospedeiroComponent,],
    }).compileComponents();

    fixture = TestBed.createComponent(HospedeiroComponent);
    component = fixture.componentInstance;
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  const getInputOpcional = () => fixture.debugElement.query(By.css('input[id="numero-opcional"]')).nativeElement as HTMLInputElement;
  const getInputObrigatorio = () => fixture.debugElement.query(By.css('input[id="numero-obrigatorio"]')).nativeElement as HTMLInputElement;

  it('campo numérico opcional permanece válido quando digita número com separador com ponto', async () => {
    const input = getInputOpcional();
    input.value = '123.45';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
      }),
    );
    appRef.tick();
    component['form'].updateValueAndValidity({ emitEvent: true });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component['form'].controls.numeroOpcional.valid).toBe(true);
    expect(component['form'].controls.numeroOpcional.errors).toBe(null);
  });

  it('campo numérico opcional se torna inválido quando a entrada possui separador em vírgula', async () => {
    const input = getInputOpcional();
    input.value = '123,45';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
      }),
    );
    appRef.tick();
    component['form'].updateValueAndValidity({ emitEvent: true });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component['form'].controls.numeroOpcional.valid).toBe(false);
    expect(component['form'].controls.numeroOpcional.errors).toStrictEqual(
      NUMERO_INVALIDO_VALIDATION_ERRO,
    );
  });

  it('campo numérico opcional se torna inválido quando a entrada é um número euleriano', async () => {
    const input = getInputOpcional();
    input.value = '4e';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
      }),
    );
    appRef.tick();
    component['form'].updateValueAndValidity({ emitEvent: true });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component['form'].controls.numeroOpcional.valid).toBe(false);
    expect(component['form'].controls.numeroOpcional.errors).toStrictEqual(
      NUMERO_INVALIDO_VALIDATION_ERRO,
    );
  });

  it('campo numérico opcional se torna inválido quando a entrada é inválida', async () => {
    const input = getInputOpcional();
    input.value = '--4';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
      }),
    );
    appRef.tick();
    component['form'].updateValueAndValidity({ emitEvent: true });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component['form'].controls.numeroOpcional.valid).toBe(false);
    expect(component['form'].controls.numeroOpcional.errors).toStrictEqual(
      NUMERO_INVALIDO_VALIDATION_ERRO,
    );
  });

  it('campo numérico obrigatório permanece válido quando digita número com separador com ponto', async () => {
    const input = getInputObrigatorio();
    input.value = '123.45';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
      }),
    );
    appRef.tick();
    component['form'].updateValueAndValidity({ emitEvent: true });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component['form'].controls.numeroObrigatorio.valid).toBe(true);
    expect(component['form'].controls.numeroObrigatorio.errors).toBe(null);
  });

  it('campo numérico obrigatório permanece inválido quando a entrada possui separador em vírgula', async () => {
    const input = getInputObrigatorio();
    input.value = '123,45';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
      }),
    );
    appRef.tick();
    component['form'].updateValueAndValidity({ emitEvent: true });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component['form'].controls.numeroObrigatorio.valid).toBe(false);
    expect(component['form'].controls.numeroObrigatorio.errors).toStrictEqual(
      NUMERO_INVALIDO_VALIDATION_ERRO,
    );
  });

  it('campo numérico obrigatório permanece inválido quando a entrada é um número euleriano', async () => {
    const input = getInputObrigatorio();
    input.value = '4e';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
      }),
    );
    appRef.tick();
    component['form'].updateValueAndValidity({ emitEvent: true });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component['form'].controls.numeroObrigatorio.valid).toBe(false);
    expect(component['form'].controls.numeroObrigatorio.errors).toStrictEqual(
      NUMERO_INVALIDO_VALIDATION_ERRO,
    );
  });

  it('campo numérico obrigatório permanece inválido quando a entrada é inválida', async () => {
    const input = getInputObrigatorio();
    input.value = '--4';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
      }),
    );
    appRef.tick();
    component['form'].updateValueAndValidity({ emitEvent: true });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component['form'].controls.numeroObrigatorio.valid).toBe(false);
    expect(component['form'].controls.numeroObrigatorio.errors).toStrictEqual(
      NUMERO_INVALIDO_VALIDATION_ERRO,
    );
  });
});
