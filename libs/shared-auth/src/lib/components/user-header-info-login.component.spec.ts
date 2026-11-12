import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { PROVEDOR_DE_LOGIN, type ProvedorDeLogin } from '../tokens/auth.tokens';
import { PerfisDeAcessoService } from '../services/perfis-de-acesso.service';
import { AuthService } from '../services/auth.service';
import { UserContextService } from '../services/user-context.service';
import { UserHeaderInfoComponent } from './user-header-info.component';

describe('UserHeaderInfoComponent — botão de login sem sessão', () => {
  function setup(provedor?: ProvedorDeLogin) {
    const login = vi.fn();
    TestBed.configureTestingModule({
      imports: [UserHeaderInfoComponent],
      providers: [
        { provide: AuthService, useValue: { login } },
        { provide: UserContextService, useValue: { user: signal(null) } },
        { provide: PerfisDeAcessoService, useValue: {} },
        ...(provedor ? [{ provide: PROVEDOR_DE_LOGIN, useValue: provedor }] : []),
      ],
    });
    const fixture = TestBed.createComponent(UserHeaderInfoComponent);
    fixture.detectChanges();
    const botao: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    return { botao, login };
  }

  it('sem provedor declarado, mostra o "Entrar" genérico', () => {
    const { botao } = setup();
    expect(botao.textContent?.trim()).toBe('Entrar');
  });

  it('com o gov.br declarado, mostra "Entrar com gov.br"', () => {
    const { botao } = setup({ id: 'govbr' });
    expect(botao.textContent?.replace(/\s+/gu, ' ').trim()).toBe('Entrar com gov.br');
  });

  it.each([
    ['sem provedor', undefined],
    ['com o gov.br', { id: 'govbr' } as const],
  ])('o clique inicia o login %s', (_caso, provedor) => {
    const { botao, login } = setup(provedor);
    botao.click();
    expect(login).toHaveBeenCalledOnce();
  });
});
