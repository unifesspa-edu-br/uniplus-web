import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import type { PrazoDaCredencial, PrazoDoAcesso } from '../models/prazo-da-credencial';
import { AUTH_CONFIG } from '../tokens/auth.tokens';
import { AuthService } from './auth.service';
import { AvisoDeVencimentoDaSessao } from './aviso-de-vencimento-da-sessao.service';
import { RenovacaoDoAcesso } from './renovacao-do-acesso.service';

const INICIO = new Date('2026-11-27T12:00:00Z').getTime();
const SEGUNDO = 1000;
const MINUTO = 60 * SEGUNDO;

/** A pessoa carregou a página e não fez mais nada: nada renova e, aos 28 minutos, o aviso abre. */
describe('Sessão de uma aba parada', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(INICIO);
  });
  afterEach(() => vi.useRealTimers());

  function carregarAPaginaSemAgir() {
    const emitidoEm = INICIO - 2 * SEGUNDO;
    const prazoDoAcesso = signal<PrazoDoAcesso | null>({
      emitidoEm,
      venceEm: emitidoEm + 300 * SEGUNDO,
    });
    const prazoDaCredencial = signal<PrazoDaCredencial | null>({
      venceEm: emitidoEm + 1800 * SEGUNDO,
      concedidoMs: 1800 * SEGUNDO,
      maiorConcedidoMs: 1800 * SEGUNDO,
      limite: 'inatividade',
    });
    const refreshToken = vi.fn(async () => true);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { prazoDoAcesso, prazoDaCredencial, refreshToken } },
        { provide: Router, useValue: { url: '/' } },
        { provide: AUTH_CONFIG, useValue: { antecedenciaDaRenovacaoEmSegundos: 60 } },
      ],
    });
    TestBed.inject(RenovacaoDoAcesso);
    const aviso = TestBed.inject(AvisoDeVencimentoDaSessao);
    TestBed.tick();
    return { refreshToken, aviso };
  }

  function passarMinutos(minutos: number): void {
    for (let minuto = 0; minuto < minutos; minuto += 1) {
      vi.advanceTimersByTime(MINUTO);
      TestBed.tick();
    }
  }

  it('não renova sem ação da pessoa', () => {
    const { refreshToken } = carregarAPaginaSemAgir();

    passarMinutos(28);

    expect(refreshToken).not.toHaveBeenCalled();
  });

  it('abre o aviso aos 28 minutos', () => {
    const { aviso } = carregarAPaginaSemAgir();

    passarMinutos(27);
    expect(aviso.aberto()).toBe(false);

    passarMinutos(1);
    expect(aviso.aberto()).toBe(true);
  });
});

/** Uma tela que consulta a API sozinha, sem ninguém na frente, não adia o fim da sessão. */
describe('Sessão de uma aba parada com consulta automática', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(INICIO);
  });
  afterEach(() => vi.useRealTimers());

  function abrirComConsultaAutomatica() {
    const emitidoEm = INICIO - 2 * SEGUNDO;
    const prazoDoAcesso = signal<PrazoDoAcesso | null>({
      emitidoEm,
      venceEm: emitidoEm + 300 * SEGUNDO,
    });
    const prazoDaCredencial = signal<PrazoDaCredencial | null>({
      venceEm: emitidoEm + 1800 * SEGUNDO,
      concedidoMs: 1800 * SEGUNDO,
      maiorConcedidoMs: 1800 * SEGUNDO,
      limite: 'inatividade',
    });
    const refreshToken = vi.fn(async (minima: number) => {
      const vencida = Date.now() >= (prazoDaCredencial()?.venceEm ?? 0);
      if (minima === -1 && vencida) {
        prazoDoAcesso.set(null);
        prazoDaCredencial.set(null);
      }
      return !vencida;
    });
    const isTokenExpired = (minima: number) =>
      Date.now() >= (prazoDoAcesso()?.venceEm ?? 0) - minima * SEGUNDO;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            prazoDoAcesso,
            prazoDaCredencial,
            refreshToken,
            isTokenExpired,
            getToken: () => 'acesso',
          },
        },
        { provide: Router, useValue: { url: '/' } },
        { provide: AUTH_CONFIG, useValue: { antecedenciaDaRenovacaoEmSegundos: 60 } },
      ],
    });
    const renovacao = TestBed.inject(RenovacaoDoAcesso);
    const aviso = TestBed.inject(AvisoDeVencimentoDaSessao);
    TestBed.tick();
    return { refreshToken, aviso, renovacao, prazoDaCredencial };
  }

  async function consultarAteOMinuto(minutos: number, renovacao: RenovacaoDoAcesso) {
    for (let meio = 0; meio < minutos * 2; meio += 1) {
      await renovacao.acessoParaOPedido();
      await vi.advanceTimersByTimeAsync(30 * SEGUNDO);
      TestBed.tick();
    }
  }

  it('não renova, abre o aviso aos 28 minutos e não encerra antes dos 30', async () => {
    const { refreshToken, aviso, renovacao, prazoDaCredencial } = abrirComConsultaAutomatica();

    await consultarAteOMinuto(27, renovacao);
    expect(aviso.aberto()).toBe(false);

    await consultarAteOMinuto(1, renovacao);
    expect(aviso.aberto()).toBe(true);
    expect(refreshToken).not.toHaveBeenCalled();
    expect(prazoDaCredencial()).not.toBeNull();
  });

  it('aos 30 minutos tenta renovar uma vez, o provedor recusa e a sessão acaba', async () => {
    const { refreshToken, renovacao, prazoDaCredencial } = abrirComConsultaAutomatica();

    await consultarAteOMinuto(30, renovacao);
    await vi.advanceTimersByTimeAsync(2 * SEGUNDO);

    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(refreshToken).toHaveBeenCalledWith(-1);
    expect(prazoDaCredencial()).toBeNull();
  });
});
