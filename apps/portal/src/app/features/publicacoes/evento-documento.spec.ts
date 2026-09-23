import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { beforeEach, describe, expect, it } from 'vitest';

import { EventoDocumentoComponent } from './evento-documento';
import type { Publicacao } from './publicacoes.model';
import { PublicacoesRepository } from './publicacoes.repository';

const medicina: Publicacao = {
  id: 'medicina-2027',
  numeroEdital: '012/2026',
  titulo: 'Medicina 2027',
  descricao: 'Lista de classificação final por curso, campus e modalidade de concorrência.',
  situacao: 'resultadoDivulgado',
  dataPublicacao: '2026-04-16',
  historico: [
    {
      id: 'evt-5',
      categoria: 'resultado',
      data: '2026-04-16',
      titulo: 'Resultado final divulgado',
      documentoArquivo: 'documento.pdf',
    },
  ],
};

describe('EventoDocumentoComponent', () => {
  let fixture: ComponentFixture<EventoDocumentoComponent>;

  function criarComponente(
    buscarPorId: (id: string) => Observable<Publicacao | undefined>,
    id = 'medicina-2027',
    eventoId = 'evt-5',
  ): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [EventoDocumentoComponent],
      providers: [{ provide: PublicacoesRepository, useValue: { buscarPorId } }],
    });

    fixture = TestBed.createComponent(EventoDocumentoComponent);
    fixture.componentRef.setInput('id', id);
    fixture.componentRef.setInput('eventoId', eventoId);
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    criarComponente(() => of(medicina));
  });

  it('mostra o título do evento e o texto padrão do documento', () => {
    expect(host().querySelector('h1')?.textContent?.trim()).toBe('Resultado final divulgado');
    expect(host().textContent).toContain('Medicina 2027');
    expect(host().textContent).toContain('Este documento ainda não está disponível');
  });

  it('mostra um estado de carregando antes da publicação chegar', () => {
    criarComponente(() => of(medicina).pipe(delay(30)));

    expect(host().querySelector('[role="status"]')?.textContent).toContain('Carregando documento');
    expect(host().querySelector('h1')).toBeNull();
  });

  it('publicação desconhecida mostra estado de "não encontrado"', () => {
    criarComponente(() => of(undefined), 'edital-que-nao-existe');

    expect(host().querySelector('h1')).toBeNull();
    expect(host().querySelector('.empty-state')?.textContent).toContain('Documento não encontrado');
  });

  it('evento desconhecido dentro de uma publicação existente também mostra "não encontrado"', () => {
    criarComponente(() => of(medicina), 'medicina-2027', 'evento-que-nao-existe');

    expect(host().querySelector('h1')).toBeNull();
    expect(host().querySelector('.empty-state')?.textContent).toContain('Documento não encontrado');
  });

  it('o carregando fica dentro do landmark main, sem substituir o papel dele', () => {
    criarComponente(() => of(medicina).pipe(delay(30)));

    const main = host().querySelector('main');
    expect(main?.getAttribute('role')).toBeNull();
    expect(main?.querySelector('[role="status"]')?.textContent).toContain('Carregando documento');
  });

  it('falha na carga mostra erro em vez de ficar carregando para sempre', () => {
    criarComponente(() => throwError(() => new Error('falha de rede')));

    expect(host().textContent).not.toContain('Carregando documento');
    expect(host().querySelector('.empty-state')?.textContent).toContain(
      'Não foi possível carregar o documento',
    );
  });
});
