import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CampusDto } from '@uniplus/shared-data/configuracao';
import { beforeEach, describe, expect, it } from 'vitest';
import { CampiListaComponent } from './campi-lista.component';

const campus: CampusDto = {
  id: '01960000-0000-7000-0000-0000000000b1',
  sigla: 'MARABA',
  nome: 'Campus de Marabá',
  codigoEmec: '12345',
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

describe('CampiListaComponent — remoção em curso', () => {
  let fixture: ComponentFixture<CampiListaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CampiListaComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(CampiListaComponent);
  });

  function montar(campi: readonly CampusDto[], removendo: boolean, paginas = false): void {
    const entradas: Record<string, unknown> = {
      campi,
      carregando: false,
      removendo,
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
    montar([campus], true, true);

    expect(botoes().length).toBeGreaterThan(3);
    expect(botoes().filter((b) => !b.disabled)).toEqual([]);
  });

  it('no estado vazio, o acionador de cadastro também fica indisponível', () => {
    montar([], true);

    const cadastros = botoes().filter((b) => b.textContent?.includes('Novo campus'));
    expect(cadastros).toHaveLength(2);
    expect(cadastros.every((b) => b.disabled)).toBe(true);
  });

  it('sem remoção em curso os acionadores seguem disponíveis', () => {
    montar([], false);

    expect(botoes().every((b) => !b.disabled)).toBe(true);
  });

  it('anuncia a remoção numa região de status e esconde o texto visual duplicado', () => {
    montar([campus], true);
    fixture.componentRef.setInput('anuncioDaRemocao', 'Removendo o campus MARABA.');
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('.sr-only[role="status"]')?.textContent?.trim()).toBe(
      'Removendo o campus MARABA.',
    );
    expect(raiz.querySelector('.cfg-campi__loading')?.getAttribute('aria-hidden')).toBe('true');
  });
});
