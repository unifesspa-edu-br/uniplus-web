import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import axe from 'axe-core';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, TipoBancaDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EdicaoDosTiposBanca } from './edicao-dos-tipos-banca';
import { TiposBancaPage } from './tipos-banca.page';

const BASE = 'http://localhost:5000';
const PAPEIS = `${BASE}/api/configuracao/vocabularios/papeis-de-banca`;
const TIPOS = `${BASE}/api/configuracao/vocabularios/tipos-de-decisao`;
const FASES = `${BASE}/api/configuracao/fases-canonicas`;
const PUT = (id: string) => `${BASE}/api/configuracao/admin/tipos-banca/${id}`;

const banca: TipoBancaDto = {
  id: '01960000-0000-7000-0000-0000000000b2',
  codigo: {
    codigo: 'BANCA_ENTREVISTA' as TipoBancaDto['codigo']['codigo'],
    rotulo: 'BANCA_ENTREVISTA',
  },
  nome: 'Banca de Entrevista',
  faseTipica: null,
  descricao: null,
  papel: {
    codigo: 'AVALIA_O_MERITO' as TipoBancaDto['papel']['codigo'],
    rotulo: 'Avalia o mérito',
  },
  exigeDuasOuMaisBancas: false,
  encerraRecursoNaPrimeiraInstancia: false,
  tiposDeDecisaoJulgados: [
    {
      codigo: 'CLASSIFICACAO' as TipoBancaDto['tiposDeDecisaoJulgados'][number]['codigo'],
      rotulo: 'Classificação',
    },
  ],
  criadoEm: '2026-06-10T12:00:00Z',
};

const FALHA = { status: 500, statusText: 'Erro' };

describe('TiposBancaPage: vocabulários do formulário', () => {
  let fixture: ComponentFixture<TiposBancaPage>;
  let edicao: EdicaoDosTiposBanca;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;

  function abrirPagina(): void {
    fixture = TestBed.createComponent(TiposBancaPage);
    edicao = fixture.debugElement.injector.get(EdicaoDosTiposBanca);
    fixture.detectChanges();
    controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-banca`).flush([banca]);
  }

  async function abrirFormulario(): Promise<void> {
    edicao.abrirEdicao(banca);
    await propagar();
    controller.expectOne((r) => r.url === FASES).flush([]);
    await propagar();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TiposBancaPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    abrirPagina();
  });

  afterEach(() => controller.verify());

  it('não pede os vocabulários antes de o formulário abrir', () => {
    controller.expectNone(PAPEIS);
    controller.expectNone(TIPOS);
  });

  it('enquanto os tipos de decisão não chegam, não mostra caixa nem código e marca o grupo como ocupado', async () => {
    await abrirFormulario();

    const grupo = raiz().querySelector('#cfg-tipos-decisao') as HTMLElement;
    expect(grupo.getAttribute('aria-busy')).toBe('true');
    expect(grupo.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(grupo.textContent).toContain('Carregando os tipos de decisão…');
    expect(grupo.textContent).not.toContain('CLASSIFICACAO');
    controller.expectOne(PAPEIS).flush([]);
    controller.expectOne(TIPOS).flush([]);
  });

  it('depois da leitura, mostra os tipos com o rótulo da API e marca o que o tipo de banca julga', async () => {
    await abrirFormulario();
    controller.expectOne(PAPEIS).flush([banca.papel]);
    controller.expectOne(TIPOS).flush([
      { codigo: 'CLASSIFICACAO', rotulo: 'Classificação' },
      { codigo: 'GABARITO_DA_PROVA', rotulo: 'Gabarito da prova' },
    ]);
    await propagar();

    const grupo = raiz().querySelector('#cfg-tipos-decisao') as HTMLElement;
    const caixas = Array.from(grupo.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    expect(grupo.getAttribute('aria-busy')).toBeNull();
    expect(grupo.textContent).toContain('Gabarito da prova');
    expect(caixas.map((caixa) => caixa.checked)).toEqual([true, false]);
  });

  it('marcar e desmarcar um tipo de decisão muda os tipos que o PUT envia', async () => {
    await abrirFormulario();
    controller.expectOne(PAPEIS).flush([banca.papel]);
    controller.expectOne(TIPOS).flush([
      { codigo: 'CLASSIFICACAO', rotulo: 'Classificação' },
      { codigo: 'GABARITO_DA_PROVA', rotulo: 'Gabarito da prova' },
    ]);
    await propagar();
    const caixas = () =>
      Array.from(raiz().querySelectorAll<HTMLInputElement>('#cfg-tipos-decisao input'));

    caixas()[1].click();
    caixas()[0].click();
    await propagar();
    expect(caixas().map((caixa) => caixa.checked)).toEqual([false, true]);
    edicao.salvar();

    expect(controller.expectOne(PUT(banca.id)).request.body).toMatchObject({
      tiposDeDecisaoJulgados: ['GABARITO_DA_PROVA'],
    });
  });

  it('na falha dos papéis, diz o que falhou junto do campo e o papel lido segue à vista', async () => {
    await abrirFormulario();
    controller.expectOne(PAPEIS).flush(null, FALHA);
    controller.expectOne(TIPOS).flush([{ codigo: 'CLASSIFICACAO', rotulo: 'Classificação' }]);
    await propagar();

    const campo = raiz().querySelector('#cfg-papel')?.closest('label') as HTMLElement;
    expect(campo.querySelector('[role="alert"]')?.textContent).toContain(
      'Não foi possível carregar os papéis de banca.',
    );
    expect(campo.querySelector('button')?.textContent).toContain('Tentar novamente');
    expect((raiz().querySelector('#cfg-papel') as HTMLSelectElement).value).toContain(
      'AVALIA_O_MERITO',
    );
    expect(
      await axe.run(campo, { rules: { region: { enabled: false } } }).then((r) => r.violations),
    ).toEqual([]);
  });

  it('a nova tentativa dos tipos de decisão pede de novo à API', async () => {
    await abrirFormulario();
    controller.expectOne(PAPEIS).flush([banca.papel]);
    controller.expectOne(TIPOS).flush(null, FALHA);
    await propagar();

    (raiz().querySelector('#cfg-tipos-decisao button') as HTMLButtonElement).click();
    await propagar();

    controller.expectOne(TIPOS).flush([{ codigo: 'CLASSIFICACAO', rotulo: 'Classificação' }]);
  });

  it('com os dois vocabulários em falha, o PUT devolve o papel e os tipos como foram lidos', async () => {
    await abrirFormulario();
    controller.expectOne(PAPEIS).flush(null, FALHA);
    controller.expectOne(TIPOS).flush(null, FALHA);
    await propagar();

    edicao.salvar();

    const put = controller.expectOne(PUT(banca.id));
    expect(put.request.body).toMatchObject({
      papel: 'AVALIA_O_MERITO',
      tiposDeDecisaoJulgados: ['CLASSIFICACAO'],
    });
  });

  it('não guarda cópia ao sair: voltar à página e abrir o formulário pede de novo', async () => {
    await abrirFormulario();
    controller.expectOne(PAPEIS).flush([banca.papel]);
    controller.expectOne(TIPOS).flush([{ codigo: 'CLASSIFICACAO', rotulo: 'Classificação' }]);
    fixture.destroy();

    abrirPagina();
    await abrirFormulario();

    controller.expectOne(PAPEIS).flush([banca.papel]);
    controller.expectOne(TIPOS).flush([{ codigo: 'CLASSIFICACAO', rotulo: 'Classificação' }]);
  });
});
