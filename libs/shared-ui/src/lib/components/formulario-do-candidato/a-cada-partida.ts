import { linkedSignal, type WritableSignal } from '@angular/core';

export function aCadaPartida<T>(partida: () => unknown, inicio: () => T): WritableSignal<T> {
  return linkedSignal<unknown, T>({ source: partida, computation: inicio });
}
