import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RELOGIO } from '@uniplus/shared-core/relogio';
import type { FormularioRenderizavelDto } from '@uniplus/shared-data/selecao';
import { ligarRelogioControlado, passarOTempo } from '@uniplus/shared-testing';

import { DiaDoEnvio } from './dia-do-envio';
import { FORMULARIO_DE_INSCRICAO_MOCK } from './inscricao-do-candidato.testing';
import { LeituraDaInscricao } from './leitura-da-inscricao';

/** De 23h50 à meia-noite no fuso do envio. */
const ATE_A_MEIA_NOITE_MS = 10 * 60 * 1_000;
const ANTES_DA_MEIA_NOITE = new Date('2026-12-12T02:50:00Z'); // 23h50 de 11/12 em Belém
const DEPOIS_DA_MEIA_NOITE = new Date('2026-12-12T03:00:01Z'); // 00h00 de 12/12 em Belém

describe('DiaDoEnvio: o dia contra o qual a tela confere os limites de data', () => {
  const formulario = signal<FormularioRenderizavelDto | null>(FORMULARIO_DE_INSCRICAO_MOCK);
  const carregada = signal<object | null>(null);
  let agora: Date;
  let dia: DiaDoEnvio;

  const criar = (): DiaDoEnvio => {
    TestBed.configureTestingModule({
      providers: [
        DiaDoEnvio,
        { provide: RELOGIO, useValue: () => agora },
        { provide: LeituraDaInscricao, useValue: { formulario, carregada } },
      ],
    });
    const criado = TestBed.inject(DiaDoEnvio);
    TestBed.tick();
    return criado;
  };

  beforeEach(() => {
    ligarRelogioControlado();
    agora = ANTES_DA_MEIA_NOITE;
    formulario.set(FORMULARIO_DE_INSCRICAO_MOCK);
    carregada.set(null);
    dia = criar();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('é o instante de agora no fuso que o formulário publica', () => {
    expect(dia.envio()).toEqual({
      instante: ANTES_DA_MEIA_NOITE.toISOString(),
      fuso: 'America/Belem',
    });
  });

  it('sem formulário carregado, não há envio', () => {
    formulario.set(null);

    expect(dia.envio()).toBeNull();
  });

  it('a cada carga recomeça do instante de agora, ainda que o dia seja o mesmo', () => {
    agora = new Date('2026-12-12T02:55:00Z');

    carregada.set({});
    TestBed.tick();

    expect(dia.envio()?.instante).toBe('2026-12-12T02:55:00.000Z');
  });

  it('o instante não anda com o tique do relógio dentro do mesmo dia', async () => {
    agora = new Date('2026-12-12T02:55:00Z');
    await passarOTempo(60_000);

    expect(dia.envio()?.instante).toBe(ANTES_DA_MEIA_NOITE.toISOString());
  });

  it('anda um dia quando a meia-noite do fuso do envio passa', async () => {
    agora = DEPOIS_DA_MEIA_NOITE;

    await passarOTempo(ATE_A_MEIA_NOITE_MS);

    expect(dia.envio()?.instante).toBe(DEPOIS_DA_MEIA_NOITE.toISOString());
  });

  it('a aba que volta ao primeiro plano confere o dia, mesmo com o timer atrasado', () => {
    agora = new Date('2026-12-12T09:00:00Z');

    document.dispatchEvent(new Event('visibilitychange'));

    expect(dia.envio()?.instante).toBe('2026-12-12T09:00:00.000Z');
  });

  it('a janela que ganha o foco confere o dia', () => {
    agora = new Date('2026-12-12T09:00:00Z');

    window.dispatchEvent(new Event('focus'));

    expect(dia.envio()?.instante).toBe('2026-12-12T09:00:00.000Z');
  });

  it('a volta à aba no mesmo dia não troca o instante', () => {
    agora = new Date('2026-12-12T02:59:00Z');

    document.dispatchEvent(new Event('visibilitychange'));

    expect(dia.envio()?.instante).toBe(ANTES_DA_MEIA_NOITE.toISOString());
  });

  it('sem fuso publicado, a volta à aba não agenda outra virada do dia', () => {
    formulario.set(null);
    const agendadas = vi.getTimerCount();

    document.dispatchEvent(new Event('visibilitychange'));

    expect(dia.envio()).toBeNull();
    expect(vi.getTimerCount()).toBe(agendadas);
  });

  it('agenda uma só virada do dia, mesmo depois de várias conferências', () => {
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));

    expect(vi.getTimerCount()).toBe(1);
  });

  it('ao encerrar, cancela a virada do dia e para de ouvir a aba', async () => {
    TestBed.resetTestingModule();
    agora = new Date('2026-12-12T09:00:00Z');

    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    await passarOTempo(ATE_A_MEIA_NOITE_MS);

    expect(vi.getTimerCount()).toBe(0);
    expect(dia.envio()?.instante).toBe(ANTES_DA_MEIA_NOITE.toISOString());
  });
});
