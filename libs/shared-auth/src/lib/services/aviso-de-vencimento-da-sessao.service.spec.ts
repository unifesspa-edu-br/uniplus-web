import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import type { LimiteDaSessao, PrazoDaCredencial } from '../models/prazo-da-credencial';
import { AuthService } from './auth.service';
import { AvisoDeVencimentoDaSessao } from './aviso-de-vencimento-da-sessao.service';

const INICIO = new Date('2026-11-27T12:00:00Z').getTime();
const SEGUNDO = 1000;

function sessaoQueVenceEm(segundos: number, limite: LimiteDaSessao = 'inatividade') {
  return {
    venceEm: INICIO + segundos * SEGUNDO,
    concedidoMs: 1800 * SEGUNDO,
    maiorConcedidoMs: 1800 * SEGUNDO,
    limite,
  } satisfies PrazoDaCredencial;
}

function preparar(segundos = 1800, limite: LimiteDaSessao = 'inatividade') {
  const prazoDaCredencial = signal<PrazoDaCredencial | null>(sessaoQueVenceEm(segundos, limite));
  const refreshToken = vi.fn(async () => true);
  const login = vi.fn(async () => undefined);
  const encerrarParaEntrarDeNovo = vi.fn(async () => undefined);
  const sessaoEncerrada = vi.fn(() => false);
  TestBed.configureTestingModule({
    providers: [
      {
        provide: AuthService,
        useValue: {
          prazoDaCredencial,
          refreshToken,
          login,
          encerrarParaEntrarDeNovo,
          sessaoEncerrada,
        },
      },
      { provide: Router, useValue: { url: '/processo-seletivo/novo' } },
    ],
  });
  const aviso = TestBed.inject(AvisoDeVencimentoDaSessao);
  TestBed.tick();
  return {
    aviso,
    prazoDaCredencial,
    refreshToken,
    login,
    encerrarParaEntrarDeNovo,
    sessaoEncerrada,
  };
}

function passar(segundos: number): void {
  vi.advanceTimersByTime(segundos * SEGUNDO);
  TestBed.tick();
}

describe('AvisoDeVencimentoDaSessao', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(INICIO);
  });
  afterEach(() => vi.useRealTimers());

  it('abre faltando dois minutos para o vencimento, e não antes', () => {
    const { aviso } = preparar(600);

    passar(600 - 121);
    expect(aviso.aberto()).toBe(false);

    passar(1);
    expect(aviso.aberto()).toBe(true);
    expect(aviso.restanteEmSegundos()).toBe(120);
  });

  it('abre aos 120 s do fim quando a credencial dura 1800 s, em passos de um minuto', () => {
    const { aviso } = preparar(1800);

    for (let minuto = 0; minuto < 27; minuto += 1) passar(60);
    expect(aviso.aberto()).toBe(false);

    passar(60);
    expect(aviso.aberto()).toBe(true);
  });

  it('atualiza o tempo que falta enquanto está aberto', () => {
    const { aviso } = preparar(100);

    passar(30);

    expect(aviso.restanteEmSegundos()).toBe(70);
  });

  it('fecha quando o prazo se vence ou a sessão acaba', () => {
    const { aviso, prazoDaCredencial } = preparar(100);
    expect(aviso.aberto()).toBe(true);

    prazoDaCredencial.set(null);
    TestBed.tick();

    expect(aviso.aberto()).toBe(false);
  });

  it('oferece continuar quando o limite é a inatividade', () => {
    const { aviso } = preparar(100, 'inatividade');

    expect(aviso.situacao()).toBe('podeContinuar');
  });

  it('só oferece entrar de novo quando o limite é o período máximo', () => {
    const { aviso } = preparar(100, 'periodoMaximo');

    expect(aviso.situacao()).toBe('soEntrandoDeNovo');
  });

  it('continuar com prazo novo fecha o aviso', async () => {
    const { aviso, prazoDaCredencial, refreshToken } = preparar(100);
    refreshToken.mockImplementationOnce(async () => {
      prazoDaCredencial.set(sessaoQueVenceEm(1900));
      return true;
    });

    await aviso.continuar();
    TestBed.tick();

    expect(refreshToken).toHaveBeenCalledWith(-1);
    expect(aviso.aberto()).toBe(false);
  });

  it('continuar sem prazo novo passa a oferecer só entrar de novo', async () => {
    const { aviso } = preparar(100);

    await aviso.continuar();

    expect(aviso.aberto()).toBe(true);
    expect(aviso.situacao()).toBe('soEntrandoDeNovo');
  });

  it('continuar que falha, sem renovar, continua oferecendo tentar de novo', async () => {
    const { aviso, refreshToken } = preparar(100);
    refreshToken.mockResolvedValueOnce(false);

    await aviso.continuar();

    expect(aviso.situacao()).toBe('podeContinuar');
  });

  it('entrar de novo, com a sessão ainda viva, a encerra para começar outra e volta à rota', async () => {
    const { aviso, login, encerrarParaEntrarDeNovo, refreshToken } = preparar(100);

    await aviso.entrarDeNovo();

    expect(refreshToken).toHaveBeenCalledWith(-1);
    expect(encerrarParaEntrarDeNovo).toHaveBeenCalledWith('/processo-seletivo/novo');
    expect(login).not.toHaveBeenCalled();
  });

  it('entrar de novo, com a sessão já encerrada por outra aba, só entra, sem encerrar a nova', async () => {
    const { aviso, login, encerrarParaEntrarDeNovo, sessaoEncerrada } = preparar(100);
    sessaoEncerrada.mockReturnValue(true);

    await aviso.entrarDeNovo();

    expect(login).toHaveBeenCalledWith('/processo-seletivo/novo');
    expect(encerrarParaEntrarDeNovo).not.toHaveBeenCalled();
  });

  it('dispensado, não reabre para o mesmo vencimento', () => {
    const { aviso } = preparar(100);

    aviso.dispensar();
    passar(60);

    expect(aviso.aberto()).toBe(false);
  });

  it('um vencimento novo depois de dispensar volta a avisar', () => {
    const { aviso, prazoDaCredencial } = preparar(100);
    aviso.dispensar();

    prazoDaCredencial.set(sessaoQueVenceEm(200));
    passar(100);

    expect(aviso.aberto()).toBe(true);
  });
});
