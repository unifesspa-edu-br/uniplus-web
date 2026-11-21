import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import axe from 'axe-core';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MotivosDeDecisaoPage } from './motivos-de-decisao.page';

const BASE = 'http://localhost:5000';
const TIPOS = `${BASE}/api/configuracao/vocabularios/tipos-de-decisao`;
const LISTA = `${BASE}/api/selecao/motivos-de-decisao`;
const VOCABULARIO = [
  { codigo: 'ISENCAO_DA_TAXA', rotulo: 'Isenção da taxa' },
  { codigo: 'GABARITO_DA_PROVA', rotulo: 'Gabarito da prova' },
];

describe('MotivosDeDecisaoPage: vocabulário de tipos de decisão', () => {
  let fixture: ComponentFixture<MotivosDeDecisaoPage>;
  let http: HttpTestingController;

  const tela = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const seletor = (): HTMLSelectElement =>
    tela().querySelector('[data-testid="motivos-tipo"]') as HTMLSelectElement;
  const novoMotivo = (): HTMLButtonElement =>
    tela().querySelector('#cfg-motivos-de-decisao-novo') as HTMLButtonElement;
  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();
    fixture.detectChanges();
  };
  const abrir = (): void => {
    fixture = TestBed.createComponent(MotivosDeDecisaoPage);
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MotivosDeDecisaoPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: PermissoesService, useValue: { tem: () => true } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    abrir();
  });

  afterEach(() => http.verify());

  it('enquanto o vocabulário não chega, o seletor fica ocupado, sem opção e sem pedir a lista', () => {
    expect(seletor().getAttribute('aria-busy')).toBe('true');
    expect(seletor().disabled).toBe(true);
    expect(novoMotivo().disabled).toBe(true);
    expect(seletor().options).toHaveLength(0);
    expect(tela().textContent).toContain('Carregando os tipos de decisão…');
    http.expectNone(LISTA);
    http.expectOne(TIPOS).flush(VOCABULARIO);
  });

  it('depois da leitura, oferece os tipos com o rótulo da API e lê a lista do primeiro', async () => {
    http.expectOne(TIPOS).flush(VOCABULARIO);
    await propagar();

    expect(seletor().getAttribute('aria-busy')).toBeNull();
    expect(Array.from(seletor().options).map((opcao) => opcao.textContent?.trim())).toEqual([
      'Isenção da taxa',
      'Gabarito da prova',
    ]);
    http.expectOne((r) => r.url === LISTA).flush([]);
    await propagar();
    expect(novoMotivo().disabled).toBe(false);
  });

  it('na falha, diz o que falhou junto do seletor e a nova tentativa pede de novo', async () => {
    http.expectOne(TIPOS).flush(null, { status: 500, statusText: 'Erro' });
    await propagar();

    expect(novoMotivo().disabled).toBe(true);
    const campo = seletor().closest('label') as HTMLElement;
    expect(campo.querySelector('[role="alert"]')?.textContent).toContain(
      'Não foi possível carregar os tipos de decisão.',
    );
    expect(
      await axe.run(campo, { rules: { region: { enabled: false } } }).then((r) => r.violations),
    ).toEqual([]);

    (campo.querySelector('button') as HTMLButtonElement).click();
    await propagar();

    http.expectOne(TIPOS).flush(VOCABULARIO);
    await propagar();
    http.expectOne((r) => r.url === LISTA).flush([]);
  });

  it('sem tipos disponíveis, impede o cadastro', async () => {
    http.expectOne(TIPOS).flush([]);
    await propagar();
    expect(novoMotivo().disabled).toBe(true);
    expect(tela().textContent).toContain('Não foi possível carregar os tipos de decisão.');
  });

  it('não guarda cópia ao sair: voltar à página pede o vocabulário de novo', async () => {
    http.expectOne(TIPOS).flush(VOCABULARIO);
    await propagar();
    http.expectOne((r) => r.url === LISTA).flush([]);
    fixture.destroy();

    abrir();

    http.expectOne(TIPOS).flush(VOCABULARIO);
  });
});
