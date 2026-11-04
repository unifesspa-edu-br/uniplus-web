import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CursoDto } from '@uniplus/shared-data/configuracao';
import { beforeEach, describe, expect, it } from 'vitest';
import { CursosListaComponent } from './cursos-lista.component';

const curso: CursoDto = {
  id: '01960000-0000-7000-0000-0000000000c1',
  codigo: 'ENG-CIV',
  nome: 'Engenharia Civil',
  grau: 'Bacharelado',
  nivelEnsino: 'Graduação',
  grupoAreaEnem: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

describe('CursosListaComponent — remoção em curso', () => {
  let fixture: ComponentFixture<CursosListaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CursosListaComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(CursosListaComponent);
  });

  function montar(cursos: readonly CursoDto[], removendo: boolean, paginas = false): void {
    const entradas: Record<string, unknown> = {
      cursos,
      carregando: false,
      removendo,
      temBusca: false,
      limite: 20,
      termoBusca: '',
      anuncioDaRemocao: '',
      mensagemDeErro: null,
      temAnterior: paginas,
      temProximo: paginas,
    };
    for (const [nome, valor] of Object.entries(entradas)) {
      fixture.componentRef.setInput(nome, valor);
    }
    fixture.detectChanges();
  }

  const botoes = (): HTMLButtonElement[] => [
    ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
  ];

  it('com itens e paginação, todo acionador fica indisponível', () => {
    montar([curso], true, true);

    expect(botoes().length).toBeGreaterThan(3);
    expect(botoes().filter((b) => !b.disabled)).toEqual([]);
  });

  it('no estado vazio e na busca sem resultado, os acionadores ficam indisponíveis', () => {
    montar([], true);
    fixture.componentRef.setInput('temBusca', true);
    fixture.detectChanges();

    expect(botoes().filter((b) => !b.disabled)).toEqual([]);
  });

  it('no estado vazio, o acionador de cadastro também fica indisponível', () => {
    montar([], true);

    const cadastros = botoes().filter((b) => b.textContent?.includes('Novo curso'));
    expect(cadastros).toHaveLength(2);
    expect(cadastros.every((b) => b.disabled)).toBe(true);
  });

  it('sem remoção em curso os acionadores seguem disponíveis', () => {
    montar([], false);

    expect(botoes().every((b) => !b.disabled)).toBe(true);
  });

  it('anuncia a remoção numa região de status e esconde o texto visual duplicado', () => {
    montar([curso], true);
    fixture.componentRef.setInput('anuncioDaRemocao', 'Removendo o curso ENG-CIV.');
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('.sr-only[role="status"]')?.textContent?.trim()).toBe(
      'Removendo o curso ENG-CIV.',
    );
    expect(raiz.querySelector('.cfg-cursos__loading')?.getAttribute('aria-hidden')).toBe('true');
  });
});
