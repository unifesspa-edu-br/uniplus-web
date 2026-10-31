import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PerfisDeAcessoService, type EstadoDosPerfis } from '@uniplus/shared-auth/bootstrap';
import { PerfisDaBarraComponent } from './perfis-da-barra.component';

describe('PerfisDaBarraComponent', () => {
  const estado = signal<EstadoDosPerfis>('carregada');
  const rotulos = signal<readonly string[]>([]);

  beforeEach(async () => {
    estado.set('carregada');
    rotulos.set([]);
    await TestBed.configureTestingModule({
      imports: [PerfisDaBarraComponent],
      providers: [{ provide: PerfisDeAcessoService, useValue: { estado, rotulos } }],
    }).compileComponents();
  });

  function texto(): HTMLElement {
    const fixture = TestBed.createComponent(PerfisDaBarraComponent);
    fixture.componentRef.setInput('username', 'leandro.viana');
    fixture.detectChanges();
    const el = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[data-testid="sidebar-user-perfil"]',
    );
    if (el === null) throw new Error('perfil da barra lateral não renderizado');
    return el;
  }

  it('mostra o primeiro perfil e +N, com os demais só para o leitor de tela', () => {
    rotulos.set([
      'Consulta institucional — Instituição',
      'Gestor de processo seletivo — CEPS',
      'Avaliador — PROEG',
    ]);
    const el = texto();

    expect(el.textContent).toContain('Consulta institucional — Instituição');
    expect(el.querySelector('[aria-hidden="true"]')?.textContent).toBe('+2');
    const oculto = el.querySelector('.sr-only')?.textContent;
    expect(oculto).toContain('Gestor de processo seletivo — CEPS');
    expect(oculto).toContain('Avaliador — PROEG');
  });

  it('mostra só o perfil, sem +N, quando é um único', () => {
    rotulos.set(['Gestor de processo seletivo — CEPS']);
    const el = texto();

    expect(el.textContent?.trim()).toBe('Gestor de processo seletivo — CEPS');
    expect(el.querySelector('.sr-only')).toBeNull();
  });

  it.each<[string, EstadoDosPerfis, readonly string[]]>([
    ['sem perfil', 'carregada', []],
    ['durante a carga', 'carregando', ['Gestor — CEPS']],
    ['em caso de falha', 'indisponivel', []],
  ])('mostra o @usuário %s', (_caso, situacao, lista) => {
    estado.set(situacao);
    rotulos.set(lista);

    expect(texto().textContent?.trim()).toBe('@leandro.viana');
  });
});
