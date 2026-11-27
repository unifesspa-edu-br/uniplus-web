import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RELOGIO } from '@uniplus/shared-core/relogio';
import { AtividadeDaPessoa } from './atividade-da-pessoa.service';
import { AuthService } from './auth.service';
import { SessaoEncerrada } from './sessao-encerrada.service';

function preparar(agora = { valor: 1_000 }) {
  const ultimaAtividade = { valor: 0 };
  const encerrada = signal(false);
  const login = vi.fn(async () => undefined);
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: { sessaoEncerrada: encerrada, login } },
      { provide: Router, useValue: { url: '/processo-seletivo/abc?passo=4' } },
      { provide: RELOGIO, useValue: () => new Date(agora.valor) },
      {
        provide: AtividadeDaPessoa,
        useValue: { houveDesde: (i: number) => ultimaAtividade.valor >= i },
      },
    ],
  });
  const sessao = TestBed.inject(SessaoEncerrada);
  return { sessao, login, encerrada, agora, ultimaAtividade };
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

  describe('reabrir', () => {
    function dispensada() {
      const contexto = preparar();
      contexto.encerrada.set(true);
      TestBed.tick();
      contexto.ultimaAtividade.valor = 1_000;
      contexto.sessao.dispensar();
      return contexto;
    }

    it('não reabre o aviso dispensado sem ação da pessoa, como no pedido automático', () => {
      const { sessao } = dispensada();

      sessao.reabrir();

      expect(sessao.aberto()).toBe(false);
    });

    it('reabre o aviso dispensado quando a pessoa age de novo', () => {
      const { sessao, ultimaAtividade } = dispensada();
      ultimaAtividade.valor = 5_000;

      sessao.reabrir();

      expect(sessao.aberto()).toBe(true);
    });
  });
});
