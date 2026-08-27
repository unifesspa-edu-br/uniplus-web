import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '@uniplus/shared-auth/bootstrap';
import { beforeEach, describe, expect, it } from 'vitest';

import { DashboardPage } from './dashboard.page';

/** Papéis de quem está autenticado — o atalho da listagem depende deles. */
const papeis = signal<readonly string[]>(['plataforma-admin']);
const authServiceStub = { roles: papeis };

describe('DashboardPage', () => {
  beforeEach(async () => {
    papeis.set(['plataforma-admin']);

    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [provideRouter([]), { provide: AuthService, useValue: authServiceStub }],
    }).compileComponents();
  });

  function montar(): HTMLElement {
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  /**
   * Os processos, KPIs, prazos e atividades desta tela eram valores escritos no
   * template — inclusive nomes de pessoas. Nenhum tinha endpoint por trás
   * (Story #478, CA-02).
   */
  it('não apresenta processo, número ou atividade sem origem de dados', () => {
    const host = montar();

    expect(host.querySelector('table')).toBeNull();
    expect(host.querySelector('.kpi')).toBeNull();
    expect(host.querySelector('.timeline')).toBeNull();
    expect(host.textContent).not.toContain('SISU 2026.1');
    expect(host.textContent).not.toContain('23.481');
  });

  it('declara que os indicadores ainda não existem', () => {
    expect(montar().querySelector('.empty-state__title')?.textContent).toContain(
      'Indicadores ainda indisponíveis',
    );
  });

  /**
   * O painel é acessível a todo o backoffice; a listagem exige
   * `plataforma-admin` na rota e na API. Oferecer o atalho a quem não tem o
   * papel levaria direto ao acesso negado.
   */
  it('leva à listagem quem administra a plataforma', () => {
    const atalho = [...montar().querySelectorAll('a')].find((a) =>
      a.textContent?.includes('Ver processos seletivos'),
    );

    expect(atalho?.getAttribute('href')).toBe('/processo-seletivo');
  });

  it('esconde o atalho da listagem de quem não administra a plataforma', () => {
    papeis.set(['avaliador']);

    const atalho = [...montar().querySelectorAll('a')].find((a) =>
      a.textContent?.includes('Ver processos seletivos'),
    );

    expect(atalho).toBeUndefined();
  });

  it('não expõe âncoras sem destino', () => {
    const vazias = [...montar().querySelectorAll('a')].filter(
      (a) => a.getAttribute('href') === '#',
    );

    expect(vazias).toHaveLength(0);
  });
});
