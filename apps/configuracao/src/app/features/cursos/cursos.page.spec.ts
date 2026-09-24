import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProblemI18nService, apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CONFIGURACAO_BASE_PATH,
  CursoDto,
  type GrupoAreaEnemDto,
  OfertaCursoDto,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogoGruposAreaEnem } from '../../shared/grupos-area-enem';
import { CursosPage } from './cursos.page';

const BASE = 'http://localhost:5000';
const OFERTAS_URL = `${BASE}/api/configuracao/ofertas-curso`;
const GRUPOS_URL = `${BASE}/api/configuracao/vocabularios/grupos-area-enem`;

/** Os grupos de área do ENEM como a API os devolve: código, rótulo e ordem. */
const GRUPOS: readonly GrupoAreaEnemDto[] = [
  { codigo: 'TECNOLOGICA', rotulo: 'Tecnológica' },
  { codigo: 'HUMANISTICA_I', rotulo: 'Humanística I' },
  { codigo: 'HUMANISTICA_II', rotulo: 'Humanística II' },
  { codigo: 'SAUDE_E_BIOLOGICAS', rotulo: 'Saúde e Biológicas' },
];

const cursoSeed: CursoDto = {
  id: '01960000-0000-7000-0000-0000000000c1',
  codigo: 'ENG-CIV',
  nome: 'Engenharia Civil',
  grau: 'Bacharelado',
  nivelEnsino: 'Graduação',
  grupoAreaEnem: { codigo: 'TECNOLOGICA', rotulo: 'Tecnológica' },
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

  afterEach(() => {
    // A página pede o vocabulário de grupos ao iniciar. Quem não usa a lista deixa esse
    // pedido pendente; mais de um é pedido em excesso.
    const pendentes = controller.match(GRUPOS_URL);
    expect(pendentes.length).toBeLessThanOrEqual(1);
    pendentes.forEach((pedido) => pedido.flush([...GRUPOS]));
    controller.verify();
  });

  /** Responde o pedido do vocabulário de grupos feito ao iniciar a página. */
  const responderGrupos = (): void => controller.expectOne(GRUPOS_URL).flush([...GRUPOS]);

  const propagate = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };

  // Folga acima do debounce da busca (BUSCA_DEBOUNCE_MS = 300 na página).
  const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
  const DEBOUNCE_FOLGA_MS = 360;

  async function flushLista(itens: readonly CursoDto[]): Promise<void> {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/cursos`);
    // A primeira página envia o limite corrente do rodapé (independe do valor).
    expect(req.request.params.get('limit')).toBe(String(component['limite']()));
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
    responderGrupos();
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
    responderGrupos();
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
    responderGrupos();
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
    responderGrupos();
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
    expect(req.request.params.has('limit')).toBe(true);
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

    component['aoTrocarLimite'](50);
    await propagate();

    const p3 = controller.expectOne((r) => r.url === CURSOS_URL);
    expect(p3.request.params.get('limit')).toBe('50');
    expect(p3.request.params.has('cursor')).toBe(false);
    p3.flush([cursoSeed]);
    await propagate();
  });

  it('CA-01/CA-14a: a listagem não envia sort — consome a ordem alfabética que a API devolve por padrão', async () => {
    const CURSOS_URL = `${BASE}/api/configuracao/cursos`;
    const req = controller.expectOne((r) => r.url === CURSOS_URL);
    expect(req.request.params.has('sort')).toBe(false);
    expect(req.request.params.has('ordenarPor')).toBe(false);

    // A API devolve fora da ordem dos identificadores; a Web apresenta na
    // sequência recebida, sem reordenar a página localmente (CA-13/CA-20).
    const foraDeOrdem: readonly CursoDto[] = [
      { ...cursoSeed, id: '01960000-0000-7000-0000-0000000000c9', codigo: 'ADM', nome: 'Administração' },
      { ...cursoSeed, id: '01960000-0000-7000-0000-0000000000c1', codigo: 'ZOO', nome: 'Zootecnia' },
    ];
    req.flush(foraDeOrdem);
    await propagate();

    expect(component['cursos']().map((c) => c.nome)).toEqual(['Administração', 'Zootecnia']);
  });

  it('CA-14c: cursor recusado (400) na navegação recarrega a listagem do início, sem cursor', async () => {
    const CURSOS_URL = `${BASE}/api/configuracao/cursos`;
    const p1 = controller.expectOne((r) => r.url === CURSOS_URL);
    p1.flush([cursoSeed], {
      headers: { Link: `<${CURSOS_URL}?cursor=p2&direction=next>; rel="next"` },
    });
    await propagate();

    component['proximaPagina']();
    await propagate();
    const p2 = controller.expectOne((r) => r.url === CURSOS_URL);
    expect(p2.request.params.get('cursor')).toBe('p2');
    p2.flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.cursor.invalido',
        title: 'Cursor de paginação inválido',
        status: 400,
        code: 'uniplus.cursor.invalido',
        traceId: 'test-trace',
      }),
      { status: 400, statusText: 'Bad Request', headers: { 'content-type': 'application/problem+json' } },
    );
    await propagate();

    // Volta à primeira página automaticamente: novo GET sem cursor.
    const recarga = controller.expectOne((r) => r.url === CURSOS_URL);
    expect(recarga.request.params.has('cursor')).toBe(false);
    expect(recarga.request.params.has('limit')).toBe(true);
    recarga.flush([cursoSeed]);
    await propagate();
    expect(component['errorMessage']()).toBeNull();
  });

  it('CA-14c: cursor expirado (410) também recarrega do início', async () => {
    const CURSOS_URL = `${BASE}/api/configuracao/cursos`;
    const p1 = controller.expectOne((r) => r.url === CURSOS_URL);
    p1.flush([cursoSeed], {
      headers: { Link: `<${CURSOS_URL}?cursor=p2&direction=next>; rel="next"` },
    });
    await propagate();

    component['proximaPagina']();
    await propagate();
    controller.expectOne((r) => r.url === CURSOS_URL).flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.cursor.expirado',
        title: 'Cursor de paginação expirado',
        status: 410,
        code: 'uniplus.cursor.expirado',
        traceId: 'test-trace',
      }),
      { status: 410, statusText: 'Gone', headers: { 'content-type': 'application/problem+json' } },
    );
    await propagate();

    const recarga = controller.expectOne((r) => r.url === CURSOS_URL);
    expect(recarga.request.params.has('cursor')).toBe(false);
    recarga.flush([cursoSeed]);
    await propagate();
  });

  it('CA-14c: 400/410 na PRIMEIRA página (sem cursor) mostra a mensagem da API, não uma tela muda', async () => {
    // Contrato não prevê (a 1ª página nunca manda cursor), mas a guarda não pode
    // silenciar a mensagem sem também recuperar: o operador tem de ver algo.
    const CURSOS_URL = `${BASE}/api/configuracao/cursos`;
    const p1 = controller.expectOne((r) => r.url === CURSOS_URL);
    expect(p1.request.params.has('cursor')).toBe(false);
    p1.flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.cursor.expirado',
        title: 'Cursor de paginação expirado',
        status: 410,
        code: 'uniplus.cursor.expirado',
        traceId: 'test-trace',
      }),
      { status: 410, statusText: 'Gone', headers: { 'content-type': 'application/problem+json' } },
    );
    await propagate();

    // Sem recarga automática em loop (não havia página para recomeçar) e com
    // mensagem visível.
    controller.expectNone((r) => r.url === CURSOS_URL);
    expect(component['errorMessage']()).toBe('Cursor de paginação expirado');
  });

  it('CA-14b: 422 de busca é apresentado com a mensagem da API', async () => {
    const CURSOS_URL = `${BASE}/api/configuracao/cursos`;
    await flushLista([cursoSeed]);

    component['termoBusca'].set('x'.repeat(201));
    await sleep(DEBOUNCE_FOLGA_MS);
    await propagate();

    const req = controller.expectOne((r) => r.url === CURSOS_URL && r.params.has('q'));
    req.flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.configuracao.consulta.busca_muito_longa',
        title: 'Busca inválida',
        detail: 'O texto pesquisado excede 200 caracteres.',
        status: 422,
        code: 'uniplus.configuracao.consulta.busca_muito_longa',
        traceId: 'test-trace',
      }),
      { status: 422, statusText: 'Unprocessable Entity', headers: { 'content-type': 'application/problem+json' } },
    );
    await propagate();

    expect(component['errorMessage']()).toBe('O texto pesquisado excede 200 caracteres.');
  });

  it('busca server-side: digitação em rajada dispara um único GET com q após o debounce, na primeira página', async () => {
    const CURSOS_URL = `${BASE}/api/configuracao/cursos`;
    await flushLista([cursoSeed]);

    component['termoBusca'].set('a');
    component['termoBusca'].set('adm');
    component['termoBusca'].set('administ');
    appRef.tick();
    // Antes do debounce, nenhuma request com q (não dispara por tecla).
    controller.expectNone((r) => r.url === CURSOS_URL && r.params.has('q'));

    await sleep(DEBOUNCE_FOLGA_MS);
    await propagate();

    const req = controller.expectOne((r) => r.url === CURSOS_URL && r.params.has('q'));
    expect(req.request.params.get('q')).toBe('administ');
    expect(req.request.params.has('cursor')).toBe(false);
    expect(req.request.params.has('limit')).toBe(true);
    req.flush([{ ...cursoSeed, codigo: 'ADM', nome: 'Administração' }]);
    await propagate();
    expect(component['cursos']()).toHaveLength(1);
  });

  it('navegar com busca ativa reanexa q (o cursor não carrega o filtro)', async () => {
    const CURSOS_URL = `${BASE}/api/configuracao/cursos`;
    await flushLista([cursoSeed]);

    component['termoBusca'].set('eng');
    await sleep(DEBOUNCE_FOLGA_MS);
    await propagate();

    const p1 = controller.expectOne((r) => r.url === CURSOS_URL && r.params.get('q') === 'eng');
    p1.flush([cursoSeed], {
      headers: { Link: `<${CURSOS_URL}?cursor=p2&direction=next>; rel="next"` },
    });
    await propagate();

    component['proximaPagina']();
    await propagate();

    const p2 = controller.expectOne((r) => r.url === CURSOS_URL);
    expect(p2.request.params.get('q')).toBe('eng');
    expect(p2.request.params.get('cursor')).toBe('p2');
    p2.flush([cursoSeed]);
    await propagate();
  });

  it('expõe legenda acessível descrevendo a tabela', async () => {
    await flushLista([cursoSeed]);
    fixture.detectChanges();

    const caption = fixture.nativeElement.querySelector('table > caption');
    // Sem `sr-only` a legenda vira texto visível acima da tabela e quebra o layout.
    expect(caption).not.toBeNull();
    expect(caption?.classList.contains('sr-only')).toBe(true);
    expect(caption?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Cursos cadastrados, com código, grau, nível e grupo ENEM',
    );
  });

  it('a lista de grupos é pedida uma vez, ao abrir a página, e abrir o formulário não a pede de novo', async () => {
    await flushLista([cursoSeed]);
    responderGrupos();

    component['abrirCadastro']();
    controller.expectNone(GRUPOS_URL);
  });

  it('numa visita nova, a tabela passa ao rótulo oficial quando o vocabulário chega, sem abrir o formulário', async () => {
    await flushLista([{ ...cursoSeed, grupoAreaEnem: { codigo: 'TECNOLOGICA', rotulo: 'Rótulo do registro' } }]);
    fixture.detectChanges();
    const celula = (): string | undefined =>
      (fixture.nativeElement as HTMLElement).querySelector('td[data-label="Grupo ENEM"]')?.textContent?.trim();
    expect(celula()).toBe('Rótulo do registro');

    responderGrupos();
    fixture.detectChanges();
    expect(celula()).toBe('Tecnológica');
  });

  it('falha da carga de fundo do vocabulário não mostra alerta na listagem', async () => {
    await flushLista([cursoSeed]);
    controller
      .expectOne(GRUPOS_URL)
      .flush({ title: 'Indisponível', status: 503 }, { status: 503, statusText: 'Service Unavailable' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('#cfg-curso-grupos-tentar')).toBeNull();
  });

  describe('grupo de área do ENEM vindo da API', () => {
    const opcoesDoSelect = (): { value: string; texto: string }[] =>
      Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLOptionElement>(
          'select[formcontrolname="grupoAreaEnem"] option',
        ),
        (opcao) => ({ value: opcao.value, texto: opcao.textContent?.trim() ?? '' }),
      );

    const selectDoGrupo = (): HTMLSelectElement =>
      (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
        'select[formcontrolname="grupoAreaEnem"]',
      ) as HTMLSelectElement;

    it('CA-01: o select oferece os grupos que a API devolve, na ordem dela, com o código como valor', async () => {
      await flushLista([]);
      // Outra lista e outra ordem: o select acompanha a API, não uma lista do cliente.
      controller.expectOne(GRUPOS_URL).flush([
        { codigo: 'SAUDE_E_BIOLOGICAS', rotulo: 'Saúde e Biológicas' },
        { codigo: 'TECNOLOGICA', rotulo: 'Tecnológica' },
      ]);
      // A lista já chegou: abrir o formulário não a pede de novo.
      component['abrirCadastro']();
      fixture.detectChanges();

      expect(opcoesDoSelect()).toEqual([
        { value: '', texto: 'Não classificado' },
        { value: 'SAUDE_E_BIOLOGICAS', texto: 'Saúde e Biológicas' },
        { value: 'TECNOLOGICA', texto: 'Tecnológica' },
      ]);
    });

    it('CA-01: grupo da API sem rótulo aparece no select pelo código', async () => {
      await flushLista([]);
      controller.expectOne(GRUPOS_URL).flush([
        { codigo: 'TECNOLOGICA', rotulo: 'Tecnológica' },
        { codigo: 'OUTRO', rotulo: ' ' },
      ]);
      component['abrirCadastro']();
      fixture.detectChanges();

      expect(opcoesDoSelect()).toContainEqual({ value: 'OUTRO', texto: 'OUTRO' });
    });

    it('CA-02: com o vocabulário carregado, a tabela usa o rótulo dele, como o select', async () => {
      controller.expectOne(GRUPOS_URL).flush([...GRUPOS]);
      await flushLista([
        { ...cursoSeed, grupoAreaEnem: { codigo: 'TECNOLOGICA', rotulo: 'Rótulo antigo' } },
        // Sem rótulo, do jeito que a API pode devolver: o código, ou o traço sem código.
        {
          ...cursoSeed,
          id: '01960000-0000-7000-0000-0000000000c6',
          grupoAreaEnem: { codigo: 'Z', rotulo: null } as unknown as GrupoAreaEnemDto,
        },
        {
          ...cursoSeed,
          id: '01960000-0000-7000-0000-0000000000c7',
          grupoAreaEnem: { codigo: undefined, rotulo: undefined } as unknown as GrupoAreaEnemDto,
        },
      ]);
      fixture.detectChanges();

      const celulas = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('td[data-label="Grupo ENEM"]'),
        (td) => td.textContent?.trim(),
      );
      expect(celulas).toEqual(['Tecnológica', 'Z', '—']);
    });

    it('CA-02: com o rótulo oficial em branco, tabela e select mostram o mesmo texto', async () => {
      controller.expectOne(GRUPOS_URL).flush([
        { codigo: 'TECNOLOGICA', rotulo: ' ' },
        // Sem código não há o que gravar: o item não vira opção.
        { codigo: ' ', rotulo: 'Sem código' },
      ]);
      await flushLista([{ ...cursoSeed, grupoAreaEnem: { codigo: 'TECNOLOGICA', rotulo: 'Rótulo do registro' } }]);
      component['abrirCadastro']();
      fixture.detectChanges();

      const naTabela = (fixture.nativeElement as HTMLElement)
        .querySelector('td[data-label="Grupo ENEM"]')
        ?.textContent?.trim();
      expect(naTabela).toBe('TECNOLOGICA');
      expect(opcoesDoSelect()).toEqual([
        { value: '', texto: 'Não classificado' },
        { value: 'TECNOLOGICA', texto: 'TECNOLOGICA' },
      ]);
    });

    it('CA-02: a tabela mostra o rótulo do grupo, não o código', async () => {
      await flushLista([
        cursoSeed,
        { ...cursoSeed, id: '01960000-0000-7000-0000-0000000000c2', grupoAreaEnem: null },
        // Rótulo vazio mostra o código, como o formulário, e não o traço de "não classificado".
        { ...cursoSeed, id: '01960000-0000-7000-0000-0000000000c3', grupoAreaEnem: { codigo: 'X', rotulo: '' } },
        // Rótulo só com espaços também conta como vazio; sem rótulo nem código, fica o traço.
        { ...cursoSeed, id: '01960000-0000-7000-0000-0000000000c4', grupoAreaEnem: { codigo: 'Y', rotulo: '  ' } },
        { ...cursoSeed, id: '01960000-0000-7000-0000-0000000000c5', grupoAreaEnem: { codigo: '', rotulo: '' } },
      ]);
      fixture.detectChanges();

      const celulas = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('td[data-label="Grupo ENEM"]'),
        (td) => td.textContent?.trim(),
      );
      expect(celulas).toEqual(['Tecnológica', '—', 'X', 'Y', '—']);
    });

    it('CA-02: o grupo escolhido no select é enviado pelo código', async () => {
      await flushLista([]);
      component['abrirCadastro']();
      controller.expectOne(GRUPOS_URL).flush([...GRUPOS]);
      component['form'].patchValue({
        codigo: 'DIR',
        nome: 'Direito',
        grau: 'Bacharelado',
        nivelEnsino: 'Graduação',
      });
      fixture.detectChanges();

      const select = selectDoGrupo();
      const humanistica = Array.from(select.options).find((opcao) => opcao.textContent?.trim() === 'Humanística I');
      select.value = humanistica?.value ?? '';
      select.dispatchEvent(new Event('change'));
      component['salvar']();

      const post = controller.expectOne(`${BASE}/api/configuracao/admin/cursos`);
      expect(post.request.body.grupoAreaEnem).toBe('HUMANISTICA_I');
      post.flush('new-id', { status: 201, statusText: 'Created' });
      await propagate();
      await flushLista([]);
    });

    it('CA-02: editar um curso seleciona o grupo dele pelo código e o reenvia pelo código', async () => {
      await flushLista([cursoSeed]);
      component['abrirEdicao'](cursoSeed);
      controller.expectOne(GRUPOS_URL).flush([...GRUPOS]);
      fixture.detectChanges();

      expect(component['form'].controls.grupoAreaEnem.value).toBe('TECNOLOGICA');
      const select = selectDoGrupo();
      expect(select.options[select.selectedIndex]?.textContent?.trim()).toBe('Tecnológica');

      component['salvar']();
      const put = controller.expectOne(`${BASE}/api/configuracao/admin/cursos/${cursoSeed.id}`);
      expect(put.request.method).toBe('PUT');
      expect(put.request.body.grupoAreaEnem).toBe('TECNOLOGICA');
      put.flush(null, { status: 204, statusText: 'No Content' });
      await propagate();
      await flushLista([cursoSeed]);
    });

    it('CA-03: grupo recusado pela API aparece no campo do grupo, com a mensagem dela', async () => {
      await flushLista([]);
      component['abrirCadastro']();
      responderGrupos();
      component['form'].setValue({
        codigo: 'DIR',
        nome: 'Direito',
        grau: 'Bacharelado',
        nivelEnsino: 'Graduação',
        grupoAreaEnem: 'TECNOLOGICA',
      });
      component['salvar']();

      controller.expectOne(`${BASE}/api/configuracao/admin/cursos`).flush(
        JSON.stringify({
          type: 'https://uniplus.dev/erros/uniplus.configuracao.curso.grupo_area_enem_invalido',
          title: 'Dados inválidos',
          status: 422,
          code: 'uniplus.validacao',
          traceId: 'test-trace',
          errors: [
            {
              field: 'grupoAreaEnem',
              code: 'uniplus.configuracao.curso.grupo_area_enem_invalido',
              message: 'Grupo de área do ENEM fora dos grupos da Resolução nº 805/2024/Consepe.',
            },
          ],
        }),
        { status: 422, statusText: 'Unprocessable Entity', headers: { 'content-type': 'application/problem+json' } },
      );
      await propagate();
      fixture.detectChanges();

      const campo = selectDoGrupo().closest('label') as HTMLElement;
      expect(campo.querySelector('.field__error')?.textContent?.trim()).toBe(
        'Grupo de área do ENEM fora dos grupos da Resolução nº 805/2024/Consepe.',
      );
      expect(selectDoGrupo().getAttribute('aria-invalid')).toBe('true');
      // O erro é anunciado e descreve o select (WCAG 3.3.1).
      const erro = campo.querySelector('.field__error');
      expect(erro?.getAttribute('role')).toBe('alert');
      expect(selectDoGrupo().getAttribute('aria-describedby')?.split(' ')).toContain(erro?.id);
      expect(component['formError']()).toBeNull();
    });
  });
});

describe('CursosPage — lista de grupos de área do ENEM que não chega', () => {
  let fixture: ComponentFixture<CursosPage>;
  let component: CursosPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  const indisponivel = (): void =>
    controller
      .expectOne(GRUPOS_URL)
      .flush({ title: 'Indisponível', status: 503 }, { status: 503, statusText: 'Service Unavailable' });

  beforeEach(async () => {
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
    controller.expectOne((r) => r.url === `${BASE}/api/configuracao/cursos`).flush([cursoSeed]);
    await Promise.resolve();
    appRef.tick();
  });

  afterEach(() => controller.verify());

  it('a edição mostra o grupo do curso pelo rótulo da API, e o alerta oferece tentar de novo', () => {
    component['abrirEdicao'](cursoSeed);
    // A lista de grupos, pedida ao abrir o formulário, não chega.
    indisponivel();
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.textContent).toContain('Grupos de área do ENEM não carregados');
    // Sem a lista, o select ainda mostra o grupo do curso: salvar não reenvia um grupo
    // que o operador nunca viu selecionado.
    const select = raiz.querySelector<HTMLSelectElement>('select[formcontrolname="grupoAreaEnem"]');
    if (!select) throw new Error('select do grupo ausente');
    expect(Array.from(select.options).map((opcao) => opcao.value)).toEqual(['', 'TECNOLOGICA']);
    expect(select.options[select.selectedIndex]?.textContent?.trim()).toBe('Tecnológica');

    const tentar = Array.from(raiz.querySelectorAll('button')).find(
      (botao) => botao.textContent?.trim() === 'Tentar novamente',
    );
    tentar?.click();
    controller.expectOne(GRUPOS_URL).flush([...GRUPOS]);
    fixture.detectChanges();

    expect(raiz.textContent).not.toContain('Grupos de área do ENEM não carregados');
    // Com a lista, o grupo do curso aparece uma vez só, entre os da API.
    expect(Array.from(select.options).map((opcao) => opcao.value)).toEqual(['', ...GRUPOS.map((g) => g.codigo)]);
    expect(select.options[select.selectedIndex]?.value).toBe('TECNOLOGICA');
  });

  it('tentar de novo mantém o foco no formulário: o alerta fica até a tentativa terminar e o foco vai ao select', async () => {
    component['abrirEdicao'](cursoSeed);
    indisponivel();
    fixture.detectChanges();
    // O drawer leva o foco ao botão de fechar logo depois de abrir: deixa isso acontecer antes.
    await Promise.resolve();

    const raiz = fixture.nativeElement as HTMLElement;
    const botao = raiz.querySelector<HTMLButtonElement>('#cfg-curso-grupos-tentar');
    if (!botao) throw new Error('botão de tentar de novo ausente');
    botao.focus();
    botao.click();
    fixture.detectChanges();

    // Enquanto a nova tentativa corre, o botão continua na tela, com o foco e desabilitado.
    expect(raiz.querySelector('#cfg-curso-grupos-tentar')).toBe(botao);
    expect(document.activeElement).toBe(botao);
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    // Acionar de novo durante a tentativa não a reinicia: segue um pedido só, o primeiro.
    botao.click();
    const pedidos = controller.match(GRUPOS_URL);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]?.cancelled).toBe(false);

    pedidos[0]?.flush([...GRUPOS]);
    fixture.detectChanges();
    await Promise.resolve();
    appRef.tick();

    // A lista chegou: o alerta sai, e o foco vai ao select que ela alimenta, sem cair no body.
    expect(raiz.querySelector('#cfg-curso-grupos-tentar')).toBeNull();
    expect(document.activeElement?.id).toBe('cfg-curso-grupo-area-enem');
  });

  it('nova tentativa que falha de novo mantém o alerta e o foco no botão', async () => {
    component['abrirEdicao'](cursoSeed);
    indisponivel();
    fixture.detectChanges();
    await Promise.resolve();

    const raiz = fixture.nativeElement as HTMLElement;
    const botao = raiz.querySelector<HTMLButtonElement>('#cfg-curso-grupos-tentar');
    if (!botao) throw new Error('botão de tentar de novo ausente');
    botao.focus();
    botao.click();
    indisponivel();
    fixture.detectChanges();
    await Promise.resolve();
    appRef.tick();

    expect(raiz.querySelector('#cfg-curso-grupos-tentar')).toBe(botao);
    expect(document.activeElement).toBe(botao);
    expect(botao.getAttribute('aria-disabled')).toBeNull();
  });

  it('nova falha pedida pelo operador é anunciada de novo, com o texto pontuado que descreve o select', async () => {
    component['abrirEdicao'](cursoSeed);
    indisponivel();
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    raiz.querySelector<HTMLButtonElement>('#cfg-curso-grupos-tentar')?.click();
    indisponivel();
    fixture.detectChanges();

    const select = raiz.querySelector<HTMLSelectElement>('#cfg-curso-grupo-area-enem');
    const descricao = select?.getAttribute('aria-describedby') ?? '';
    expect(raiz.querySelector(`[id="${descricao}"]`)?.textContent?.trim()).toMatch(
      /classificar o curso\. Tentativa 2 sem sucesso\.$/u,
    );
  });

  it('recusa sem título mostra só o texto padrão, sem ponto solto no início', () => {
    component['abrirEdicao'](cursoSeed);
    controller
      .expectOne(GRUPOS_URL)
      .flush(
        { type: 'about:blank', title: '', status: 503, code: 'uniplus.teste.sem_titulo', traceId: 't' },
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('#cfg-curso-grupos-falha')?.textContent?.trim()).toBe(
      'Sem a lista de grupos não é possível classificar o curso.',
    );
  });

  it('curso cru com o grupo sem rótulo, com a lista em falha: a opção do grupo mostra o código', () => {
    component['abrirEdicao']({ ...cursoSeed, grupoAreaEnem: { codigo: 'TECNOLOGICA', rotulo: '' } });
    indisponivel();
    fixture.detectChanges();

    const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>('#cfg-curso-grupo-area-enem');
    const opcao = Array.from(select?.options ?? []).find((o) => o.value === 'TECNOLOGICA');
    expect(opcao?.textContent?.trim()).toBe('TECNOLOGICA');
  });

  it('motivo só com espaços cai no texto padrão', () => {
    component['abrirEdicao'](cursoSeed);
    controller.expectOne(GRUPOS_URL).flush(
      { type: 'about:blank', title: '   ', status: 503, code: 'uniplus.teste.sem_titulo', traceId: 't' },
      { status: 503, statusText: 'Service Unavailable', headers: { 'content-type': 'application/problem+json' } },
    );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('#cfg-curso-grupos-falha')?.textContent?.trim()).toBe(
      'Sem a lista de grupos não é possível classificar o curso.',
    );
  });

  it('lista vazia é falha de carga: alerta com tentar de novo, como na recusa', () => {
    component['abrirEdicao'](cursoSeed);
    controller.expectOne(GRUPOS_URL).flush([]);
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.textContent).toContain('Grupos de área do ENEM não carregados');
    expect(raiz.querySelector('#cfg-curso-grupos-tentar')).not.toBeNull();
  });

  it('o select do grupo é descrito pelo alerta de falha enquanto a lista não chega', () => {
    component['abrirEdicao'](cursoSeed);
    indisponivel();
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    const select = raiz.querySelector<HTMLSelectElement>('#cfg-curso-grupo-area-enem');
    const descricao = select?.getAttribute('aria-describedby') ?? '';
    expect(raiz.querySelector(`[id="${descricao}"]`)?.textContent?.trim()).toContain(
      'Sem a lista de grupos não é possível classificar o curso.',
    );

    raiz.querySelector<HTMLButtonElement>('#cfg-curso-grupos-tentar')?.click();
    controller.expectOne(GRUPOS_URL).flush([...GRUPOS]);
    fixture.detectChanges();
    expect(select?.hasAttribute('aria-describedby')).toBe(false);
  });

  it('recarga em segundo plano que dá certo não mexe no foco', async () => {
    component['abrirEdicao'](cursoSeed);
    indisponivel();
    fixture.detectChanges();
    await Promise.resolve();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('#cfg-curso-grupos-tentar')).not.toBeNull();
    // O operador não acionou nada: o foco está fora de qualquer campo.
    (document.activeElement as HTMLElement | null)?.blur();

    // Outra tela pede o vocabulário de novo, e ele chega.
    TestBed.inject(CatalogoGruposAreaEnem).garantirCarregado();
    controller.expectOne(GRUPOS_URL).flush([...GRUPOS]);
    fixture.detectChanges();
    await Promise.resolve();
    appRef.tick();

    expect(raiz.querySelector('#cfg-curso-grupos-tentar')).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it('clique que não levou o foco ao botão não move o foco quando a lista chega', async () => {
    component['abrirEdicao'](cursoSeed);
    indisponivel();
    fixture.detectChanges();
    await Promise.resolve();

    const raiz = fixture.nativeElement as HTMLElement;
    // Como no Safari: o clique aciona o botão sem focá-lo, e o foco está no body.
    (document.activeElement as HTMLElement | null)?.blur();
    raiz.querySelector<HTMLButtonElement>('#cfg-curso-grupos-tentar')?.click();
    expect(document.activeElement).toBe(document.body);

    controller.expectOne(GRUPOS_URL).flush([...GRUPOS]);
    fixture.detectChanges();
    await Promise.resolve();
    appRef.tick();

    expect(raiz.querySelector('#cfg-curso-grupos-tentar')).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it('foco levado para fora do botão durante a espera não é movido quando a lista chega', async () => {
    component['abrirEdicao'](cursoSeed);
    indisponivel();
    fixture.detectChanges();
    await Promise.resolve();

    const raiz = fixture.nativeElement as HTMLElement;
    const botao = raiz.querySelector<HTMLButtonElement>('#cfg-curso-grupos-tentar');
    botao?.focus();
    botao?.click();
    fixture.detectChanges();
    // Enquanto espera, o operador clica numa área que não recebe foco.
    botao?.blur();
    expect(document.activeElement).toBe(document.body);

    controller.expectOne(GRUPOS_URL).flush([...GRUPOS]);
    fixture.detectChanges();
    await Promise.resolve();
    appRef.tick();

    expect(document.activeElement).toBe(document.body);
  });

  it('com a lista em falha, dá para trocar para "Não classificado" e voltar ao grupo original do curso', () => {
    component['abrirEdicao'](cursoSeed);
    indisponivel();
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    const select = raiz.querySelector<HTMLSelectElement>('#cfg-curso-grupo-area-enem');
    if (!select) throw new Error('select do grupo ausente');
    const valores = (): string[] => Array.from(select.options, (opcao) => opcao.value);
    expect(valores()).toEqual(['', 'TECNOLOGICA']);

    select.value = '';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    // A opção do grupo original continua, para o operador poder voltar a ela.
    expect(valores()).toEqual(['', 'TECNOLOGICA']);

    select.value = 'TECNOLOGICA';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(component['form'].controls.grupoAreaEnem.value).toBe('TECNOLOGICA');
    expect(select.options[select.selectedIndex]?.textContent?.trim()).toBe('Tecnológica');
  });

  it('recarga que falha com a lista anterior em memória não mostra alerta, e o select segue com ela', () => {
    // A lista chegou antes (outra tela ou outra abertura do formulário).
    const catalogo = TestBed.inject(CatalogoGruposAreaEnem);
    catalogo.garantirCarregado();
    controller.expectOne(GRUPOS_URL).flush([...GRUPOS]);

    component['abrirEdicao'](cursoSeed);
    catalogo.recarregar();
    indisponivel();
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.textContent).not.toContain('Grupos de área do ENEM não carregados');
    const select = raiz.querySelector<HTMLSelectElement>('#cfg-curso-grupo-area-enem');
    expect(Array.from(select?.options ?? [], (opcao) => opcao.value)).toEqual(['', ...GRUPOS.map((g) => g.codigo)]);
  });

  it('falha de servidor dos grupos mostra o motivo no alerta e avisa com o traceId', () => {
    const erroSpy = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
    component['abrirEdicao'](cursoSeed);
    controller.expectOne(GRUPOS_URL).flush(
      JSON.stringify({ title: 'Serviço indisponível', status: 503, code: 'uniplus.indisponivel', traceId: 'trace-grupos' }),
      { status: 503, statusText: 'Service Unavailable', headers: { 'content-type': 'application/problem+json' } },
    );
    fixture.detectChanges();

    expect(erroSpy).toHaveBeenCalledTimes(1);
    expect(erroSpy.mock.calls[0]?.[0]).toMatchObject({ status: 503, traceId: 'trace-grupos' });
    const mensagem = (fixture.nativeElement as HTMLElement).querySelector('#cfg-curso-grupos-falha')?.textContent?.trim();
    expect(mensagem).toContain('Sem a lista de grupos não é possível classificar o curso.');
    expect(mensagem).not.toBe('Sem a lista de grupos não é possível classificar o curso.');
  });

  it('grupos recusados por permissão mostram o motivo sem aviso de servidor', () => {
    const erroSpy = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
    component['abrirEdicao'](cursoSeed);
    const semPermissao = { title: 'Acesso negado', status: 403, code: 'uniplus.autorizacao.acesso_negado', traceId: 't' };
    controller.expectOne(GRUPOS_URL).flush(JSON.stringify(semPermissao), {
      status: 403,
      statusText: 'Forbidden',
      headers: { 'content-type': 'application/problem+json' },
    });
    fixture.detectChanges();

    const titulo = TestBed.inject(ProblemI18nService).resolve(
      semPermissao as Parameters<ProblemI18nService['resolve']>[0],
    ).title;
    expect((fixture.nativeElement as HTMLElement).querySelector('#cfg-curso-grupos-falha')?.textContent).toContain(titulo);
    expect(erroSpy).not.toHaveBeenCalled();
  });
});
