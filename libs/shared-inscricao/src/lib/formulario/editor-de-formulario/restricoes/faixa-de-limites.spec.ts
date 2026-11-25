import { TestBed } from '@angular/core/testing';
import { expect, it, vi } from 'vitest';
import { FaixaDeLimitesComponent, limiteDigitado } from './faixa-de-limites';

it('converte vírgula decimal e espaços em número', () => {
  expect(limiteDigitado(' 1,5 ')).toBe(1.5);
});

it('deixa limite vazio como nulo e preserva texto inválido', () => {
  expect(limiteDigitado('  ')).toBeNull();
  expect(limiteDigitado('abc')).toBe('abc');
});

it('emite a alteração do mínimo ao sair do campo', () => {
  const fixture = TestBed.createComponent(FaixaDeLimitesComponent);
  fixture.componentRef.setInput('restricao', { tipo: 'FAIXA_NUMERICA', minimo: null, maximo: 10 });
  fixture.componentRef.setInput('idBase', 'faixa');
  fixture.componentRef.setInput('rotuloDoMinimo', 'Mínimo');
  fixture.componentRef.setInput('rotuloDoMaximo', 'Máximo');
  const receber = vi.fn();
  fixture.componentInstance.limiteChange.subscribe(receber);
  fixture.detectChanges();
  const campo = fixture.nativeElement.querySelector('#faixa-minimo') as HTMLInputElement;
  campo.value = '1,5';
  campo.dispatchEvent(new Event('change'));
  expect(receber).toHaveBeenCalledWith({ limite: 'minimo', valor: 1.5 });
});
