import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';

import { UserProfile } from '../models/user.model';
import { AuthService } from '../services/auth.service';
import { UserContextService } from '../services/user-context.service';
import { AccessDeniedComponent } from './access-denied.component';

describe('AccessDeniedComponent', () => {
  const perfil: UserProfile = {
    id: 'abc-123',
    username: 'servidor.sem.papel',
    email: 'servidor@teste.unifesspa.edu.br',
    nomeCivil: 'Servidor Sem Papel',
    cpf: '33257350376',
  };

  function montar(
    logout = vi.fn().mockResolvedValue(undefined),
    profile: UserProfile | null = perfil,
    rotaDeVolta: string | null = null,
    rotulo: string | null = null,
  ) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AccessDeniedComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { logout } as unknown as AuthService },
        {
          provide: UserContextService,
          useValue: { user: signal(profile).asReadonly() } as unknown as UserContextService,
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: {
                ...(rotaDeVolta === null ? {} : { rotaDeVolta }),
                ...(rotulo === null ? {} : { rotuloDaRotaDeVolta: rotulo }),
              },
            },
          } as unknown as ActivatedRoute,
        },
      ],
    });

    const fixture: ComponentFixture<AccessDeniedComponent> =
      TestBed.createComponent(AccessDeniedComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      host,
      logout,
      botao: () => host.querySelector('button'),
      volta: () => host.querySelector('a'),
    };
  }

  it('oferece a saída pelo encerramento da sessão', () => {
    const { botao } = montar();

    expect(botao()?.textContent?.trim()).toBe('Sair');
  });

  /**
   * Nos apps administrativos a raiz é protegida pelo mesmo guard que trouxe o
   * usuário até aqui: oferecer volta o devolveria a esta tela, sem saída.
   */
  it('não oferece volta quando a rota não declara destino', () => {
    const { host, volta } = montar();

    expect(volta()).toBeNull();
    expect(host.textContent).not.toContain('Voltar ao início');
  });

  /**
   * O portal tem consulta pública alcançável sem a role que faltou. Forçar
   * logout ali encerraria a sessão de quem só topou com uma operação vedada.
   */
  it('oferece volta ao destino que a rota declara', () => {
    const { volta } = montar(vi.fn().mockResolvedValue(undefined), perfil, '/processos');

    expect(volta()?.getAttribute('href')).toBe('/processos');
  });

  it('usa o rótulo que a rota declara para o link de volta', () => {
    const { volta } = montar(vi.fn(), perfil, '/acessos/pedidos', 'Pedir acesso');

    expect(volta()?.textContent?.trim()).toBe('Pedir acesso');
  });

  it('mantém a saída disponível junto da volta', () => {
    const { botao } = montar(vi.fn().mockResolvedValue(undefined), perfil, '/processos');

    expect(botao()?.textContent?.trim()).toBe('Sair');
  });

  it('encerra a sessão no provedor ao acionar', async () => {
    const { botao, logout, fixture } = montar();

    botao()?.click();
    await fixture.whenStable();

    expect(logout).toHaveBeenCalledTimes(1);
  });

  /** Um clique duplo não pode disparar duas saídas concorrentes. */
  it('ignora acionamento repetido enquanto a saída corre', async () => {
    let concluir: () => void = () => {
      throw new Error('logout não foi chamado');
    };
    const logout = vi.fn(() => new Promise<void>((resolve) => (concluir = resolve)));
    const { botao, fixture } = montar(logout);

    botao()?.click();
    fixture.detectChanges();
    botao()?.click();
    fixture.detectChanges();

    expect(logout).toHaveBeenCalledTimes(1);
    expect(botao()?.disabled).toBe(true);
    expect(botao()?.getAttribute('aria-busy')).toBe('true');

    concluir();
    await fixture.whenStable();
  });

  it('identifica a conta autenticada', () => {
    const { host } = montar();

    expect(host.textContent).toContain('servidor.sem.papel');
  });

  /** Sem perfil carregado a tela continua utilizável — a saída é o que importa. */
  it('oferece a saída mesmo sem perfil disponível', () => {
    const { botao, host } = montar(vi.fn().mockResolvedValue(undefined), null);

    expect(botao()?.textContent?.trim()).toBe('Sair');
    expect(host.textContent).not.toContain('Conectado como');
  });

  it('suprime o link de volta quando quem monta a rota pede', () => {
    const { fixture, volta } = montar(undefined, perfil, '/acessos/pedidos/novo', 'Pedir acesso');
    expect(volta()?.textContent?.trim()).toBe('Pedir acesso');

    fixture.componentRef.setInput('ocultarRotaDeVolta', true);
    fixture.detectChanges();

    expect(volta()).toBeNull();
  });
});
