import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  CursoDto,
  OfertaCursoDto,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CursosPage } from './cursos.page';

const BASE = 'http://localhost:5000';
const OFERTAS_URL = `${BASE}/api/configuracao/ofertas-curso`;

const cursoSeed: CursoDto = {
  id: '01960000-0000-7000-0000-0000000000c1',
  codigo: 'ENG-CIV',
  nome: 'Engenharia Civil',
  grau: 'Bacharelado',
  nivelEnsino: 'Graduação',
  grupoAreaEnem: 'Tecnológica',
  criadoEm: '2026-06-10T12:00:00Z',
};

const ofertaSeed: OfertaCursoDto = {
  id: '01960000-0000-7000-0000-0000000000f1',
  cursoId: cursoSeed.id,
  localOfertaId: '01960000-0000-7000-0000-0000000000d1',
  unidadeOfertante: {
    origemId: '01960000-0000-7000-0000-0000000000e1',
    sigla: 'IGE',
    nome: 'Instituto de Geociências e Engenharias',
    tipo: 'Instituto',
  },
  programaDeOferta: 'REGULAR',
  formatoPedagogico: 'PRESENCIAL',
  regimeDeTurno: 'REGULAR',
  turnos: ['MATUTINO'],
  eMecCodigo: '123456',
  codigoSga: null,
  vagasAnuaisAutorizadas: 40,
  baseLegal: null,
  atoAutorizacaoMec: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

describe('CursosPage', () => {
  let fixture: ComponentFixture<CursosPage>;
  let component: CursosPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CursosPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(CursosPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const propagate = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };

  async function flushLista(itens: readonly CursoDto[]): Promise<void> {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/cursos`);
    expect(req.request.params.get('limit')).toBe('25');
    req.flush(itens);
    await propagate();
  }

  it('renderiza a lista de cursos', async () => {
    await flushLista([cursoSeed]);
    expect(component['cursos']()).toHaveLength(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Engenharia Civil');
    expect(fixture.nativeElement.textContent).toContain('ENG-CIV');
  });

  it('CA-02: cria curso com código único, nome, grau e nível válidos', async () => {
    await flushLista([]);

    component['abrirCadastro']();
    component['form'].setValue({
      codigo: 'ADM',
      nome: 'Administração',
      grau: 'Bacharelado',
      nivelEnsino: 'Graduação',
      grupoAreaEnem: '',
    });
    const key = component['idempotencyKeyAtual']();

    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/cursos`);
    expect(post.request.method).toBe('POST');
    expect(post.request.headers.get('Idempotency-Key')).toBe(key);
    expect(post.request.body).toMatchObject({
      codigo: 'ADM',
      nome: 'Administração',
      grau: 'Bacharelado',
      nivelEnsino: 'Graduação',
      grupoAreaEnem: null,
    });
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();

    await flushLista([cursoSeed]);
    expect(component['formOpen']()).toBe(false);
  });

  it('CA-02: cria curso sem grupo de área do ENEM (campo opcional)', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].setValue({
      codigo: 'HIST',
      nome: 'História',
      grau: 'Licenciatura',
      nivelEnsino: 'Graduação',
      grupoAreaEnem: '',
    });
    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/cursos`);
    expect(post.request.body.grupoAreaEnem).toBeNull();
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([]);
  });

  it('bloqueia salvar com campos obrigatórios vazios', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    fixture.detectChanges();

    const submit = fixture.nativeElement.querySelector(
      'button[form="cfg-curso-form"]',
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);

    component['salvar']();

    controller.expectNone(`${BASE}/api/configuracao/admin/cursos`);
  });

  it('CA-03: código duplicado (409) é mapeado ao campo Código sem fechar o drawer', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].setValue({
      codigo: 'ENG-CIV',
      nome: 'Engenharia Civil (duplicado)',
      grau: 'Bacharelado',
      nivelEnsino: 'Graduação',
      grupoAreaEnem: '',
    });
    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/cursos`);
    post.flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.configuracao.curso.codigo_ja_existe',
        title: 'Já existe um curso ativo com este código',
        status: 409,
        code: 'uniplus.configuracao.curso.codigo_ja_existe',
        traceId: 'test-trace',
      }),
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();

    expect(component['formOpen']()).toBe(true);
    expect(component['form'].controls.codigo.errors?.['backend']).toBeTruthy();
  });

  it('CA-08/CA2: remoção bloqueada (409) fecha o confirm e abre o drawer de Ofertas com o preview do bloqueio', async () => {
    await flushLista([cursoSeed]);
    component['pedirRemocao'](cursoSeed);
    component['removerConfirmado']();
    // Reproduz o fechamento síncrono que o `ui-confirm-dialog` real faz ao
    // emitir `confirmed` — antes desta resposta HTTP assíncrona chegar.
    component['confirmOpen'].set(false);

    const req = controller.expectOne(`${BASE}/api/configuracao/admin/cursos/${cursoSeed.id}`);
    req.flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.configuracao.curso.remocao_bloqueada_por_oferta_curso',
        title: 'Não é possível remover um curso referenciado por uma oferta de curso ativa',
        status: 409,
        code: 'uniplus.configuracao.curso.remocao_bloqueada_por_oferta_curso',
        traceId: 'test-trace',
      }),
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();

    // O confirm não reabre; abre o drawer de Ofertas com a mensagem que a API
    // devolveu (sem acoplar a UI ao vendor code — ramifica por status 409).
    expect(component['confirmOpen']()).toBe(false);
    expect(component['ofertasOpen']()).toBe(true);
    expect(component['ofertasBloqueio']()).toBe(
      'Não é possível remover um curso referenciado por uma oferta de curso ativa',
    );

    // E consulta as ofertas do curso via ?cursoId para o preview do bloqueio.
    const ofertas = controller.expectOne((r) => r.url === OFERTAS_URL);
    expect(ofertas.request.params.get('cursoId')).toBe(cursoSeed.id);
    ofertas.flush([ofertaSeed]);
    await propagate();
    expect(component['ofertas']()).toHaveLength(1);
  });

  it('CA1: abrir "Ofertas" lista as ofertas do curso filtrando por cursoId', async () => {
    await flushLista([cursoSeed]);

    component['abrirOfertas'](cursoSeed);
    await propagate();

    const req = controller.expectOne((r) => r.url === OFERTAS_URL);
    expect(req.request.params.get('cursoId')).toBe(cursoSeed.id);
    expect(req.request.params.get('limit')).toBe('50');
    req.flush([ofertaSeed]);
    await propagate();

    expect(component['ofertasOpen']()).toBe(true);
    expect(component['ofertas']()).toHaveLength(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('IGE');
    expect(fixture.nativeElement.textContent).toContain('Regular');
  });

  it('CA1: drawer mostra empty-state quando o curso não tem ofertas vivas', async () => {
    await flushLista([cursoSeed]);

    component['abrirOfertas'](cursoSeed);
    await propagate();
    controller.expectOne((r) => r.url === OFERTAS_URL).flush([]);
    await propagate();

    expect(component['ofertas']()).toHaveLength(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nenhuma oferta ativa');
  });

  it('CA1: trocar de curso não vaza as ofertas do curso anterior enquanto o novo GET não resolve', async () => {
    const cursoB: CursoDto = {
      ...cursoSeed,
      id: '01960000-0000-7000-0000-0000000000c2',
      codigo: 'ADM',
      nome: 'Administração',
    };
    await flushLista([cursoSeed, cursoB]);

    component['abrirOfertas'](cursoSeed);
    await propagate();
    controller.expectOne((r) => r.url === OFERTAS_URL).flush([ofertaSeed]);
    await propagate();
    expect(component['ofertas']()).toHaveLength(1);

    // Fecha A e abre B: a lista precisa zerar de imediato (antes do GET de B),
    // senão o drawer mostraria a oferta de A sob o cabeçalho de B.
    component['aoFecharOfertas']();
    component['abrirOfertas'](cursoB);
    expect(component['ofertas']()).toHaveLength(0);
    expect(component['ofertasNextCursor']()).toBeNull();

    await propagate();
    const reqB = controller.expectOne((r) => r.url === OFERTAS_URL);
    expect(reqB.request.params.get('cursoId')).toBe(cursoB.id);
    reqB.flush([]);
    await propagate();
    expect(component['ofertas']()).toHaveLength(0);
  });

  it('CA3: navegar para a próxima página reanexa cursoId e envia cursor/direction sem limit', async () => {
    await flushLista([cursoSeed]);

    component['abrirOfertas'](cursoSeed);
    await propagate();

    const p1 = controller.expectOne((r) => r.url === OFERTAS_URL);
    p1.flush([ofertaSeed], {
      headers: { Link: `<${OFERTAS_URL}?cursor=pagina-2&direction=next>; rel="next"` },
    });
    await propagate();
    expect(component['ofertasNextCursor']()).not.toBeNull();

    component['proximaPaginaOfertas']();
    await propagate();

    const p2 = controller.expectOne((r) => r.url === OFERTAS_URL);
    expect(p2.request.params.get('cursoId')).toBe(cursoSeed.id);
    expect(p2.request.params.get('cursor')).toBe('pagina-2');
    expect(p2.request.params.get('direction')).toBe('next');
    expect(p2.request.params.has('limit')).toBe(false);
    p2.flush([{ ...ofertaSeed, id: '01960000-0000-7000-0000-0000000000f2' }]);
    await propagate();
  });

  it('remove um curso sem oferta viva após confirmação', async () => {
    await flushLista([cursoSeed]);
    component['pedirRemocao'](cursoSeed);
    component['removerConfirmado']();

    const req = controller.expectOne(`${BASE}/api/configuracao/admin/cursos/${cursoSeed.id}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([]);
    expect(component['confirmOpen']()).toBe(false);
  });

  it('trocar itens por página recarrega a primeira página com o novo limit', async () => {
    await flushLista([cursoSeed]);

    component['aoTrocarLimite'](100);
    await propagate();

    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/cursos`);
    expect(req.request.params.get('limit')).toBe('100');
    expect(req.request.params.has('cursor')).toBe(false);
    req.flush([cursoSeed]);
    await propagate();
    expect(component['limite']()).toBe(100);
  });

  it('trocar itens por página a partir de uma página navegada volta ao início sem cursor', async () => {
    const CURSOS_URL = `${BASE}/api/configuracao/cursos`;
    const p1 = controller.expectOne((r) => r.url === CURSOS_URL);
    p1.flush([cursoSeed], {
      headers: { Link: `<${CURSOS_URL}?cursor=pagina-2&direction=next>; rel="next"` },
    });
    await propagate();

    component['proximaPagina']();
    await propagate();
    const p2 = controller.expectOne((r) => r.url === CURSOS_URL);
    expect(p2.request.params.get('cursor')).toBe('pagina-2');
    p2.flush([cursoSeed]);
    await propagate();

    component['aoTrocarLimite'](10);
    await propagate();

    const p3 = controller.expectOne((r) => r.url === CURSOS_URL);
    expect(p3.request.params.get('limit')).toBe('10');
    expect(p3.request.params.has('cursor')).toBe(false);
    p3.flush([cursoSeed]);
    await propagate();
  });

  it('filtra a lista client-side por código ou nome', async () => {
    const outroCurso: CursoDto = { ...cursoSeed, id: 'outro-id', codigo: 'ADM', nome: 'Administração' };
    await flushLista([cursoSeed, outroCurso]);

    component['termoBusca'].set('ADM');
    fixture.detectChanges();

    expect(component['cursosFiltrados']()).toHaveLength(1);
    expect(component['cursosFiltrados']()[0].codigo).toBe('ADM');
  });
});
