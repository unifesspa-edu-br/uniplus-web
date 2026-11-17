import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

// O agendador do RxJS agenda por `setInterval` e mede por `Date`; microtarefa e `performance` ficam reais.
const TEMPORIZADORES_CONTROLADOS = [
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'Date',
] as const;

/**
 * Simula setTimeout, setInterval e Date: o agendador do RxJS depende dos três.
 * Liga antes de criar o componente ou o serviço cujo temporizador o teste exercita: um
 * temporizador agendado antes de ligar fica no relógio real, e o `debounceTime` o reaproveita
 * nas emissões seguintes.
 */
export function ligarRelogioControlado(): void {
  vi.useFakeTimers({ toFake: [...TEMPORIZADORES_CONTROLADOS] });
}

/** Deixa a tela assentar, avança o relógio e deixa a tela assentar de novo. O efeito de `toObservable` só emite no tick, que precisa vir antes de o relógio andar. */
export async function passarOTempo(milissegundos: number): Promise<void> {
  await Promise.resolve();
  TestBed.tick();
  await vi.advanceTimersByTimeAsync(milissegundos);
  await Promise.resolve();
  TestBed.tick();
}

/** Cede a vez a uma tarefa do laço de eventos; serve aos dois relógios porque o controlado não simula `setImmediate`. */
export function esperarUmTurno(): Promise<void> {
  return new Promise<void>((resolve) => setImmediate(resolve));
}
