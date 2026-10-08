import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it } from 'vitest';
import { MODELOS_FORMULARIO_ROUTES } from './modelos-formulario.routes';

@Component({ template: '' })
class SimuladorFalso {}

describe('MODELOS_FORMULARIO_ROUTES', () => {
  it('o endereço antigo da simulação do modelo leva ao simulador com o modelo', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'modelos-formulario', children: MODELOS_FORMULARIO_ROUTES },
          { path: 'simulador-de-formulario', component: SimuladorFalso },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/modelos-formulario/abc/simulacao', SimuladorFalso);

    expect(TestBed.inject(Router).url).toBe('/simulador-de-formulario?modelo=abc');
  });
});
