import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FasesCanonicasPage } from './fases-canonicas.page';

const BASE = 'http://localhost:5000';
const CRIAR_URL = `${BASE}/api/configuracao/admin/fases-canonicas`;

const faseAvaliacaoSeed: FaseCanonicaDto = {
  id: '01960000-0000-7000-0000-0000000000f1',
  codigo: 'AVALIACAO',
  nome: 'Avaliação',
  descricao: null,
  donoTipico: 'CEPS',
  agrupaEtapas: true,
  permiteComplementacao: false,
  baseLegal: null,
  coletaInscricao: false,
  coletaSolicitacaoIsencao: false,
  origemData: 'PROPRIA',
  criadoEm: '2026-06-10T12:00:00Z',
};

describe('FasesCanonicasPage', () => {
  let fixture: ComponentFixture<FasesCanonicasPage>;
  let component: FasesCanonicasPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FasesCanonicasPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(FasesCanonicasPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => {
    // Issue #698: a tela nunca deve emitir a criação de fase canônica.
    controller.expectNone((r) => r.method === 'POST' && r.url === CRIAR_URL);
    controller.verify();
  });

  const propagate = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };

  async function flushLista(itens: readonly FaseCanonicaDto[]): Promise<void> {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/fases-canonicas`);
    expect(req.request.params.get('limit')).toBe('50');
    req.flush(itens);
    await propagate();
  }

  function nomesDeBotoes(): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('button')).map((b) =>
      ((b as HTMLButtonElement).textContent ?? '').trim().replace(/\s+/gu, ' '),
    );
  }

  it('CA-12: renderiza a lista de fases canônicas', async () => {
    await flushLista([faseAvaliacaoSeed]);
    expect(component['fases']()).toHaveLength(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Avaliação');
    expect(fixture.nativeElement.textContent).toContain('AVALIACAO');
  });

  it('CA-01/CA-03: o cabeçalho não oferece a ação "Nova fase canônica"', async () => {
    await flushLista([faseAvaliacaoSeed]);
    fixture.detectChanges();
    const nomes = nomesDeBotoes();
    expect(nomes).not.toContain('Nova fase canônica');
    expect(nomes).not.toContain('Criar fase canônica');
  });

  it('CA-02/CA-16: o estado vazio informa sem sugerir cadastro da primeira fase', async () => {
    await flushLista([]);
    fixture.detectChanges();
    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('catálogo de fases é definido institucionalmente');
    expect(texto).not.toMatch(/cadastr\w+ a primeira/iu);
    expect(nomesDeBotoes()).not.toContain('Nova fase canônica');
  });

  it('CA-10/CA-11: o aviso remete ao catálogo institucional e não orienta a criar uma nova entrada', async () => {
    await flushLista([]);
    fixture.detectChanges();
    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Códigos definidos pelo catálogo institucional');
    expect(texto).not.toContain('crie uma nova entrada');
  });

  it('CA-13: filtro de dono típico filtra registros carregados', async () => {
    const faseCrca: FaseCanonicaDto = {
      ...faseAvaliacaoSeed,
      id: 'f2',
      codigo: 'MATRICULA',
      donoTipico: 'CRCA',
    };
    await flushLista([faseAvaliacaoSeed, faseCrca]);

    component['donoTipicoFiltro'].set('CRCA');
    expect(component['fasesFiltradas']()).toEqual([faseCrca]);
  });

  it('CA-05: o drawer só abre a partir da edição de uma fase existente', async () => {
    await flushLista([faseAvaliacaoSeed]);
    expect(component['formOpen']()).toBe(false);

    component['abrirEdicao'](faseAvaliacaoSeed);
    expect(component['formOpen']()).toBe(true);
    expect(component['faseEmEdicaoId']()).toBe(faseAvaliacaoSeed.id);
  });

  it('CA-06: o drawer de edição usa título e ação compatíveis com a edição', async () => {
    await flushLista([faseAvaliacaoSeed]);
    component['abrirEdicao'](faseAvaliacaoSeed);
    fixture.detectChanges();

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Editar fase canônica');
    expect(texto).not.toContain('Nova fase canônica');

    const submit = fixture.nativeElement.querySelector(
      'button[form="cfg-fase-canonica-form"]',
    ) as HTMLButtonElement;
    expect(submit.textContent?.trim()).toBe('Salvar fase canônica');
  });

  it('CA-07: código é readonly na edição e o payload de atualização não inclui o campo codigo', async () => {
    await flushLista([faseAvaliacaoSeed]);
    component['abrirEdicao'](faseAvaliacaoSeed);
    expect(component['form'].controls.codigo.value).toBe('AVALIACAO');
    fixture.detectChanges();
    const codigoInput = fixture.nativeElement.querySelector(
      '[formcontrolname="codigo"]',
    ) as HTMLInputElement;
    expect(codigoInput.readOnly).toBe(true);

    component['form'].controls.nome.setValue('Avaliação (revisada)');
    component['salvar']();

    const put = controller.expectOne(
      `${BASE}/api/configuracao/admin/fases-canonicas/${faseAvaliacaoSeed.id}`,
    );
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).not.toHaveProperty('codigo');
    expect(put.request.body).toMatchObject({
      id: faseAvaliacaoSeed.id,
      nome: 'Avaliação (revisada)',
    });
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([faseAvaliacaoSeed]);
  });

  it('CA-08/CA-14: salvar a edição emite PUT e nunca POST', async () => {
    await flushLista([faseAvaliacaoSeed]);
    component['abrirEdicao'](faseAvaliacaoSeed);
    component['form'].controls.nome.setValue('Avaliação (2)');
    component['salvar']();

    controller.expectNone(CRIAR_URL);
    const put = controller.expectOne(
      `${BASE}/api/configuracao/admin/fases-canonicas/${faseAvaliacaoSeed.id}`,
    );
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([faseAvaliacaoSeed]);
  });

  it('CA-05: grupos condicionais seguem o código da fase em edição', async () => {
    const faseHomologacao: FaseCanonicaDto = {
      ...faseAvaliacaoSeed,
      id: 'f-homolog',
      codigo: 'HOMOLOGACAO',
      agrupaEtapas: false,
    };
    await flushLista([faseAvaliacaoSeed, faseHomologacao]);

    component['abrirEdicao'](faseAvaliacaoSeed);
    expect(component['showGrupoAgrupa']()).toBe(true);
    expect(component['showGrupoCompl']()).toBe(false);

    component['abrirEdicao'](faseHomologacao);
    expect(component['showGrupoAgrupa']()).toBe(false);
    expect(component['showGrupoCompl']()).toBe(true);
  });

  it('editar a fase de isenção deriva a marca de isenção e esconde a coleta de inscrição', async () => {
    const faseIsencao: FaseCanonicaDto = {
      ...faseAvaliacaoSeed,
      id: 'f-isencao',
      codigo: 'SOLICITACAO_ISENCAO',
      agrupaEtapas: false,
      coletaInscricao: false,
      coletaSolicitacaoIsencao: true,
    };
    await flushLista([faseIsencao]);

    component['abrirEdicao'](faseIsencao);
    fixture.detectChanges();
    // O agregado exige a marca verdadeira nessa fase e recusa a coleta de
    // inscrição na mesma fase — as duas janelas são exclusivas.
    expect(component['ehFaseDeIsencao']()).toBe(true);
    expect(component['form'].controls.coletaSolicitacaoIsencao.value).toBe(true);
    expect(
      fixture.nativeElement.querySelector('[formControlName="coletaInscricao"]'),
    ).toBeNull();

    component['salvar']();
    const put = controller.expectOne(
      `${BASE}/api/configuracao/admin/fases-canonicas/${faseIsencao.id}`,
    );
    expect(put.request.body).toMatchObject({
      coletaSolicitacaoIsencao: true,
      coletaInscricao: false,
    });
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([faseIsencao]);
  });

  it('CA-14: edição carrega os sinalizadores do DTO e os devolve na atualização', async () => {
    const faseComColeta: FaseCanonicaDto = {
      ...faseAvaliacaoSeed,
      coletaInscricao: true,
      origemData: 'DELEGADA',
    };
    await flushLista([faseComColeta]);

    component['abrirEdicao'](faseComColeta);
    expect(component['form'].controls.origemData.value).toBe('DELEGADA');
    expect(component['form'].controls.coletaInscricao.value).toBe(true);

    component['salvar']();
    const put = controller.expectOne(
      `${BASE}/api/configuracao/admin/fases-canonicas/${faseComColeta.id}`,
    );
    expect(put.request.body).toMatchObject({
      origemData: 'DELEGADA',
      coletaInscricao: true,
    });
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([faseComColeta]);
  });

  it('CA-10: aviso de código do catálogo é visível mesmo com lista vazia', async () => {
    await flushLista([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Códigos definidos pelo catálogo institucional',
    );
  });

  it('CA-15: inativa uma fase canônica após confirmação', async () => {
    await flushLista([faseAvaliacaoSeed]);
    component['pedirRemocao'](faseAvaliacaoSeed);
    component['removerConfirmado']();

    const req = controller.expectOne(
      `${BASE}/api/configuracao/admin/fases-canonicas/${faseAvaliacaoSeed.id}`,
    );
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([]);
  });
});
