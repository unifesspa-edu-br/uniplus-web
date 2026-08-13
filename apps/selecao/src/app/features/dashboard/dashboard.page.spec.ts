import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '@uniplus/shared-auth/bootstrap';
import { DashboardPage } from './dashboard.page';

/** Papéis de quem está autenticado — o atalho de cadastro depende deles. */
const papeis = signal<readonly string[]>(['plataforma-admin']);
const authServiceStub = { roles: papeis };

describe('DashboardPage — acessibilidade', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [provideRouter([]), { provide: AuthService, useValue: authServiceStub }],
    }).compileComponents();
  });

  function montar() {
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  /**
   * O `aria-labelledby` apontava para um id do módulo Configuração, que não
   * existe aqui — a seção ficava sem nome acessível.
   */
  it('nomeia a seção de processos por um id existente', () => {
    const host = montar();
    const secao = host.querySelector('section.panel[aria-labelledby]');
    const id = secao?.getAttribute('aria-labelledby');

    expect(id).toBeTruthy();
    expect(host.querySelector(`#${id}`)).not.toBeNull();
  });

  /** No modo responsivo, `data-label` é o cabeçalho lido para cada célula. */
  it('rotula todas as células com o cabeçalho correspondente', () => {
    const host = montar();
    const cabecalhos = [...host.querySelectorAll('thead th')].map((th) => th.textContent?.trim());
    const primeiraLinha = host.querySelector('tbody tr');
    const rotulos = [...(primeiraLinha?.querySelectorAll('td') ?? [])].map((td) =>
      td.getAttribute('data-label'),
    );

    expect(rotulos.length).toBe(cabecalhos.length);
    expect(rotulos).toEqual(cabecalhos);
  });

  it('exibe o prazo na coluna de prazo', () => {
    const host = montar();
    const celula = host.querySelector('tbody tr td[data-label="Prazo"]');

    expect(celula?.textContent?.trim()).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  /** Controle que não executa a ação anunciada é pior que ausência dele. */
  it('não expõe âncoras sem destino', () => {
    const host = montar();
    const ancorasVazias = [...host.querySelectorAll('a')].filter(
      (a) => a.getAttribute('href') === '#',
    );

    expect(ancorasVazias.length).toBe(0);
  });

  it('leva ao cadastro pelo atalho de novo processo', () => {
    papeis.set(['plataforma-admin']);
    const host = montar();
    const atalho = [...host.querySelectorAll('a')].find((a) =>
      a.textContent?.includes('Novo Processo'),
    );

    expect(atalho?.getAttribute('href')).toBe('/processo-seletivo');
  });

  /**
   * O cadastro do certame é restrito a `plataforma-admin` na rota e na API.
   * Oferecer o atalho a quem não tem o papel levaria direto ao acesso negado.
   */
  it('esconde o atalho de novo processo de quem não administra a plataforma', () => {
    papeis.set(['gestor']);
    const host = montar();
    const atalho = [...host.querySelectorAll('a')].find((a) =>
      a.textContent?.includes('Novo Processo'),
    );

    expect(atalho).toBeUndefined();
    papeis.set(['plataforma-admin']);
  });
});
