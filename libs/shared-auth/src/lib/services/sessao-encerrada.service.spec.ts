import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { SessaoEncerrada } from './sessao-encerrada.service';

function preparar() {
  const encerrada = signal(false);
  const login = vi.fn(async () => undefined);
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: { sessaoEncerrada: encerrada, login } },
      { provide: Router, useValue: { url: '/processo-seletivo/abc?passo=4' } },
    ],
  });
  const sessao = TestBed.inject(SessaoEncerrada);
  return { sessao, login, encerrada };
}

describe('SessaoEncerrada', () => {
  it('não abre o aviso enquanto a sessão está ativa', () => {
    const { sessao } = preparar();
    TestBed.tick();
    expect(sessao.aberto()).toBe(false);
  });

  it('abre o aviso quando a sessão termina', () => {
    const { sessao, encerrada } = preparar();

    encerrada.set(true);
    TestBed.tick();

    expect(sessao.aberto()).toBe(true);
  });

  it('abre o login voltando à mesma rota ao entrar novamente', () => {
    const { sessao, login, encerrada } = preparar();
    encerrada.set(true);
    TestBed.tick();

    sessao.entrarNovamente();

    expect(login).toHaveBeenCalledWith('/processo-seletivo/abc?passo=4');
  });

  it('fecha o aviso ao dispensar, sem abrir o login', () => {
    const { sessao, login, encerrada } = preparar();
    encerrada.set(true);
    TestBed.tick();

    sessao.dispensar();

    expect(sessao.aberto()).toBe(false);
    expect(login).not.toHaveBeenCalled();
  });
});
