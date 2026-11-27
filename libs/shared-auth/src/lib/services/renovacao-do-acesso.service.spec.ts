import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { PrazoDaCredencial, PrazoDoAcesso } from '../models/prazo-da-credencial';
import { AUTH_CONFIG } from '../tokens/auth.tokens';
import { AtividadeDaPessoa } from './atividade-da-pessoa.service';
import { AuthService } from './auth.service';
import { RenovacaoDoAcesso } from './renovacao-do-acesso.service';

const INICIO = new Date('2026-11-27T12:00:00Z').getTime();
const SEGUNDO = 1000;
const ANTECEDENCIA = 60;

function acessoQueVenceEm(segundos: number): PrazoDoAcesso {
  return { emitidoEm: INICIO, venceEm: INICIO + segundos * SEGUNDO };
}

function sessaoQueVenceEm(segundos: number): PrazoDaCredencial {
  const venceEm = INICIO + segundos * SEGUNDO;
  return {
    venceEm,
    concedidoMs: 1800 * SEGUNDO,
    maiorConcedidoMs: 1800 * SEGUNDO,
    limite: 'inatividade',
  };
}

function preparar(houveAtividade = true) {
  const prazoDoAcesso = signal<PrazoDoAcesso | null>(acessoQueVenceEm(300));
  const prazoDaCredencial = signal<PrazoDaCredencial | null>(sessaoQueVenceEm(1800));
  const refreshToken = vi.fn(async (minima?: number) => minima !== undefined);
  const proxima = vi.fn(() => new Promise<void>(() => undefined));
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: { prazoDoAcesso, prazoDaCredencial, refreshToken } },
      { provide: AtividadeDaPessoa, useValue: { houveDesde: () => houveAtividade, proxima } },
      { provide: AUTH_CONFIG, useValue: { antecedenciaDaRenovacaoEmSegundos: ANTECEDENCIA } },
    ],
  });
  TestBed.inject(RenovacaoDoAcesso);
  TestBed.tick();
  return { prazoDoAcesso, prazoDaCredencial, refreshToken, proxima };
}

function passar(segundos: number): void {
  vi.advanceTimersByTime(segundos * SEGUNDO);
}

describe('RenovacaoDoAcesso', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(INICIO);
  });
  afterEach(() => vi.useRealTimers());

  it('renova o acesso na antecedência configurada, com a pessoa em uso', () => {
    const { refreshToken } = preparar();

    passar(300 - ANTECEDENCIA - 1);
    expect(refreshToken).not.toHaveBeenCalled();

    passar(1);
    expect(refreshToken).toHaveBeenCalledWith(ANTECEDENCIA);
  });

  it('sem atividade da pessoa, espera a próxima ação em vez de renovar', () => {
    const { refreshToken, proxima } = preparar(false);

    passar(300);

    expect(refreshToken).not.toHaveBeenCalled();
    expect(proxima).toHaveBeenCalledTimes(1);
  });

  it('rearma o lembrete quando o acesso renovado traz um prazo novo', () => {
    const { refreshToken, prazoDoAcesso } = preparar();
    passar(240);
    refreshToken.mockClear();

    prazoDoAcesso.set(acessoQueVenceEm(540));
    TestBed.tick();
    passar(240);

    expect(refreshToken).toHaveBeenCalledTimes(1);
  });

  it('depois do prazo da sessão, tenta renovar para o provedor recusar e encerrar', () => {
    const { refreshToken, prazoDoAcesso } = preparar();
    prazoDoAcesso.set(acessoQueVenceEm(7200));
    TestBed.tick();

    passar(1801);

    expect(refreshToken).toHaveBeenCalledWith(-1);
  });

  it('depois do prazo da sessão, tenta de novo se o provedor está fora do ar por um instante', async () => {
    const { refreshToken, prazoDoAcesso } = preparar();
    prazoDoAcesso.set(acessoQueVenceEm(7200));
    TestBed.tick();
    refreshToken.mockResolvedValueOnce(false);

    passar(1801);
    await vi.advanceTimersByTimeAsync(15 * SEGUNDO);

    expect(refreshToken).toHaveBeenCalledTimes(2);
    expect(refreshToken).toHaveBeenLastCalledWith(-1);
  });

  it('ao voltar à aba depois de suspensão, decide pela hora atual e não pelo temporizador', () => {
    const { refreshToken } = preparar();
    vi.setSystemTime(INICIO + 250 * SEGUNDO);

    document.dispatchEvent(new Event('visibilitychange'));

    expect(refreshToken).toHaveBeenCalledWith(ANTECEDENCIA);
  });

  it('tenta de novo quando a renovação não renova, no limite exato ou numa falha passageira', async () => {
    const { refreshToken } = preparar();
    refreshToken.mockResolvedValueOnce(false).mockResolvedValueOnce(false);

    passar(240);
    await vi.advanceTimersByTimeAsync(15 * SEGUNDO);
    await vi.advanceTimersByTimeAsync(15 * SEGUNDO);

    expect(refreshToken).toHaveBeenCalledTimes(3);
  });

  it('para de tentar quando a sessão termina na tentativa', async () => {
    const { refreshToken, prazoDoAcesso } = preparar();
    refreshToken.mockImplementationOnce(async () => {
      prazoDoAcesso.set(null);
      return false;
    });

    passar(240);
    await vi.advanceTimersByTimeAsync(60 * SEGUNDO);

    expect(refreshToken).toHaveBeenCalledTimes(1);
  });

  it('não agenda nada sem sessão', () => {
    const { refreshToken, prazoDoAcesso } = preparar();
    prazoDoAcesso.set(null);
    TestBed.tick();

    passar(7200);

    expect(refreshToken).not.toHaveBeenCalled();
  });

  it('limita a antecedência à metade da duração do acesso, para a renovação não repetir sem parar', () => {
    const { refreshToken, prazoDoAcesso } = preparar();
    prazoDoAcesso.set(acessoQueVenceEm(100));
    TestBed.tick();
    refreshToken.mockClear();

    passar(49);
    expect(refreshToken).not.toHaveBeenCalled();

    passar(1);
    expect(refreshToken).toHaveBeenCalledTimes(1);
  });
});
