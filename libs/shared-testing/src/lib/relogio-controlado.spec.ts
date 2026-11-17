import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { debounceTime, timer } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { esperarUmTurno, ligarRelogioControlado, passarOTempo } from './relogio-controlado.testing';

const ESPERA_MS = 300;

@Component({
  selector: 'core-busca-com-debounce',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p>{{ termoApurado() }}</p>`,
})
class BuscaComDebounceComponent {
  readonly termo = signal('');
  protected readonly termoApurado = signal('');

  constructor() {
    toObservable(this.termo)
      .pipe(debounceTime(ESPERA_MS))
      .subscribe((termo) => this.termoApurado.set(termo));
  }
}

@Component({
  selector: 'core-aviso-com-timer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p>{{ aviso() }}</p>`,
})
class AvisoComTimerComponent {
  protected readonly aviso = signal('');

  constructor() {
    timer(ESPERA_MS).subscribe(() => this.aviso.set('Tempo esgotado'));
  }
}

function montar<T>(componente: new () => T): ComponentFixture<T> {
  const tela = TestBed.createComponent(componente);
  tela.detectChanges();
  return tela;
}

function textoDe(tela: ComponentFixture<unknown>): string {
  tela.detectChanges();
  return (tela.nativeElement as HTMLElement).textContent ?? '';
}

describe('relógio controlado', () => {
  beforeEach(() => ligarRelogioControlado());
  afterEach(() => vi.useRealTimers());

  it('não mostra o termo do debounce antes de a espera completar', async () => {
    const tela = montar(BuscaComDebounceComponent);
    tela.componentInstance.termo.set('edital');

    await passarOTempo(ESPERA_MS - 1);

    expect(textoDe(tela)).toBe('');
  });

  it('mostra o termo do debounce quando a espera completa', async () => {
    const tela = montar(BuscaComDebounceComponent);
    tela.componentInstance.termo.set('edital');

    await passarOTempo(ESPERA_MS - 1);
    await passarOTempo(1);

    expect(textoDe(tela)).toBe('edital');
  });

  it('não dispara o timer do RxJS antes de a espera completar', async () => {
    const tela = montar(AvisoComTimerComponent);

    await passarOTempo(ESPERA_MS - 1);

    expect(textoDe(tela)).toBe('');
  });

  it('dispara o timer do RxJS quando a espera completa', async () => {
    const tela = montar(AvisoComTimerComponent);

    await passarOTempo(ESPERA_MS - 1);
    await passarOTempo(1);

    expect(textoDe(tela)).toBe('Tempo esgotado');
  });

  it('avança a data junto com o tempo', async () => {
    const antes = Date.now();

    await passarOTempo(ESPERA_MS);

    expect(Date.now() - antes).toBe(ESPERA_MS);
  });
});

async function esperarDepoisDeAgendarComSetImmediate(): Promise<string[]> {
  const ordem: string[] = [];
  setImmediate(() => ordem.push('tarefa agendada antes'));
  await esperarUmTurno();
  ordem.push('espera concluída');
  return ordem;
}

describe('espera de um turno', () => {
  afterEach(() => vi.useRealTimers());

  it('termina com o relógio controlado ligado, depois da tarefa agendada antes com setImmediate', async () => {
    ligarRelogioControlado();

    expect(await esperarDepoisDeAgendarComSetImmediate()).toEqual([
      'tarefa agendada antes',
      'espera concluída',
    ]);
  });

  it('termina sem o relógio controlado, depois da tarefa agendada antes com setImmediate', async () => {
    expect(await esperarDepoisDeAgendarComSetImmediate()).toEqual([
      'tarefa agendada antes',
      'espera concluída',
    ]);
  });
});
