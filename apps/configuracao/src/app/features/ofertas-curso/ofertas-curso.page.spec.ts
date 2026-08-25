import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  CursoDto,
  LocalOfertaDto,
  OfertaCursoDto,
  TipoLocalOferta,
} from '@uniplus/shared-data/configuracao';
import { ORGANIZACAO_BASE_PATH, UnidadeDto } from '@uniplus/shared-data/organizacao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OfertasCursoPage } from './ofertas-curso.page';

const BASE = 'http://localhost:5000';
// Teto de página aceito pela API (ADR-0026 do uniplus-api): `limit` fora da
// faixa 1..100 responde 422 `uniplus.cursor.limit_invalido`, e o lookup
// rejeitado deixa o select vazio e a listagem sem rótulo resolvido.
const LIMITE_MAXIMO_API = 100;
const CURSO_ID = '01960000-0000-7000-0000-0000000000c1';
const LOCAL_ID = '01960000-0000-7000-0000-0000000000e1';
const UNIDADE_ID = '01960000-0000-7000-0000-0000000000f1';
const OFERTA_ID = '01960000-0000-7000-0000-0000000000d1';

const cursoSeed: CursoDto = {
  id: CURSO_ID,
  codigo: 'ENG-CIV',
  nome: 'Engenharia Civil',
  grau: 'Bacharelado',
  nivelEnsino: 'Graduação',
  grupoAreaEnem: 'Tecnológica',
  criadoEm: '2026-06-10T12:00:00Z',
};

const localSeed: LocalOfertaDto = {
  id: LOCAL_ID,
  tipo: TipoLocalOferta.campusSede,
  campusResponsavelId: null,
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  codigoEmec: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

const unidadeSeed: UnidadeDto = {
  id: UNIDADE_ID,
  nome: 'Instituto de Geociências e Engenharias',
  alias: null,
  slug: 'ige',
  sigla: 'IGE',
  codigo: 'IGE',
  unidadeSuperiorId: null,
  tipo: 'Instituto',
  unidadeAcademica: true,
  vigenciaInicio: '2020-01-01',
  vigenciaFim: null,
} as UnidadeDto;

const ofertaSeed: OfertaCursoDto = {
  id: OFERTA_ID,
  cursoId: CURSO_ID,
  localOfertaId: LOCAL_ID,
  unidadeOfertante: { origemId: UNIDADE_ID, sigla: 'IGE', nome: 'Instituto de Geociências e Engenharias', tipo: 'Instituto' },
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

describe('OfertasCursoPage', () => {
  let fixture: ComponentFixture<OfertasCursoPage>;
  let component: OfertasCursoPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OfertasCursoPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(OfertasCursoPage);
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

  // Casa a requisição de lookup exigindo `limit` dentro da faixa aceita pela
  // API. Comparar só `r.url` não basta: a query string não entra nele quando os
  // parâmetros vêm de `HttpParams`, então um limite inválido passaria batido.
  const expectLookup = (url: string): TestRequest => {
    const req = controller.expectOne((r) => r.url === url);
    const limit = Number(req.request.params.get('limit'));
    expect(limit).toBeGreaterThanOrEqual(1);
    expect(limit).toBeLessThanOrEqual(LIMITE_MAXIMO_API);
    return req;
  };

  async function flushCargaInicial(ofertas: readonly OfertaCursoDto[]): Promise<void> {
    const listaReq = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/ofertas-curso`);
    listaReq.flush(ofertas);
    expectLookup(`${BASE}/api/configuracao/cursos`).flush([cursoSeed]);
    expectLookup(`${BASE}/api/configuracao/locais-oferta`).flush([localSeed]);
    await propagate();
  }

  // Pós-mutação, `recarregar()` só dá reload no resource da lista principal —
  // os lookups de Curso/Local de oferta já estão em cache e não recarregam.
  async function flushRecarregarLista(ofertas: readonly OfertaCursoDto[]): Promise<void> {
    await propagate();
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/ofertas-curso`)
      .flush(ofertas);
    await propagate();
  }

  // `abrirCadastro()` ativa o lookup lazy de Unidade (cross-módulo) — consumida
  // aqui para não deixar request pendente em `controller.verify()`.
  async function flushUnidades(itens: readonly UnidadeDto[] = [unidadeSeed]): Promise<void> {
    await propagate();
    expectLookup(`${BASE}/api/organizacao/unidades`).flush(itens);
    await propagate();
  }

  it('pede o máximo de uma página da API nos lookups de Curso, Local de oferta e Unidade', async () => {
    controller.expectOne((r) => r.url === `${BASE}/api/configuracao/ofertas-curso`).flush([]);
    const cursos = expectLookup(`${BASE}/api/configuracao/cursos`);
    const locais = expectLookup(`${BASE}/api/configuracao/locais-oferta`);
    cursos.flush([cursoSeed]);
    locais.flush([localSeed]);
    await propagate();

    component['abrirCadastro']();
    await propagate();
    const unidades = expectLookup(`${BASE}/api/organizacao/unidades`);
    unidades.flush([unidadeSeed]);
    await propagate();

    // O valor pedido é o teto da API, não um número escolhido à toa: acima
    // dele a resposta é 422 e os três campos ficam sem opção.
    for (const req of [cursos, locais, unidades]) {
      expect(req.request.params.get('limit')).toBe(String(LIMITE_MAXIMO_API));
    }
  });

  it('renderiza a lista resolvendo rótulos de Curso e Local via lookup', async () => {
    await flushCargaInicial([ofertaSeed]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('ENG-CIV — Engenharia Civil');
    expect(fixture.nativeElement.textContent).toContain('Marabá');
    expect(fixture.nativeElement.textContent).toContain('IGE — Instituto de Geociências e Engenharias');
  });

  it('CA-06: programa REGULAR não exige base legal; programa != REGULAR exige', async () => {
    await flushCargaInicial([]);
    component['abrirCadastro']();
    await flushUnidades();

    expect(component['exigeBaseLegal']()).toBe(false);

    component['form'].controls.programaDeOferta.setValue('PARFOR');
    await propagate();
    expect(component['exigeBaseLegal']()).toBe(true);
    expect(component['form'].controls.baseLegal.hasError('required')).toBe(true);

    component['form'].controls.programaDeOferta.setValue('REGULAR');
    await propagate();
    expect(component['exigeBaseLegal']()).toBe(false);
    expect(component['form'].controls.baseLegal.hasError('required')).toBe(false);
  });

  it('voltar para REGULAR limpa baseLegal (evita maxlength oculto travando o submit), mas preserva atoAutorizacaoMec', async () => {
    await flushCargaInicial([]);
    component['abrirCadastro']();
    await flushUnidades();

    component['form'].controls.programaDeOferta.setValue('PARFOR');
    await propagate();
    component['form'].controls.baseLegal.setValue('X'.repeat(600));
    component['form'].controls.atoAutorizacaoMec.setValue('Portaria SERES/MEC nº 270/2021');
    expect(component['form'].controls.baseLegal.hasError('maxlength')).toBe(true);

    component['form'].controls.programaDeOferta.setValue('REGULAR');
    await propagate();

    expect(component['form'].controls.baseLegal.value).toBe('');
    expect(component['form'].controls.baseLegal.valid).toBe(true);
    // atoAutorizacaoMec é dado factual independente do programa (a API não o
    // vincula a REGULAR) — não deve ser apagado pela troca de programa.
    expect(component['form'].controls.atoAutorizacaoMec.value).toBe(
      'Portaria SERES/MEC nº 270/2021',
    );
  });

  it('edição de oferta REGULAR com atoAutorizacaoMec preexistente preserva o valor no payload', async () => {
    const ofertaRegularComAto: OfertaCursoDto = {
      ...ofertaSeed,
      programaDeOferta: 'REGULAR',
      baseLegal: null,
      atoAutorizacaoMec: 'Portaria SERES/MEC nº 270/2021',
    };
    await flushCargaInicial([ofertaRegularComAto]);
    component['abrirEdicao'](ofertaRegularComAto);
    await propagate();

    expect(component['form'].controls.atoAutorizacaoMec.value).toBe(
      'Portaria SERES/MEC nº 270/2021',
    );

    component['form'].controls.eMecCodigo.setValue('999999');
    component['salvar']();

    const put = controller.expectOne(`${BASE}/api/configuracao/admin/ofertas-curso/${OFERTA_ID}`);
    expect(put.request.body.atoAutorizacaoMec).toBe('Portaria SERES/MEC nº 270/2021');
    put.flush(null, { status: 204, statusText: 'No Content' });
    await flushRecarregarLista([ofertaRegularComAto]);
  });

  it('CA-04: cria oferta enviando unidadeOfertanteOrigemId (não o id do DTO de leitura)', async () => {
    await flushCargaInicial([]);
    component['abrirCadastro']();
    await flushUnidades();

    component['form'].patchValue({
      cursoId: CURSO_ID,
      localOfertaId: LOCAL_ID,
      unidadeOfertanteOrigemId: UNIDADE_ID,
      programaDeOferta: 'REGULAR',
      formatoPedagogico: 'PRESENCIAL',
      regimeDeTurno: 'REGULAR',
      turnos: ['MATUTINO'],
      vagasAnuaisAutorizadas: 40,
    });

    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/ofertas-curso`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toMatchObject({
      cursoId: CURSO_ID,
      localOfertaId: LOCAL_ID,
      unidadeOfertanteOrigemId: UNIDADE_ID,
      programaDeOferta: 'REGULAR',
    });
    post.flush(OFERTA_ID, { status: 201, statusText: 'Created' });
    await flushRecarregarLista([ofertaSeed]);
    expect(component['formOpen']()).toBe(false);
  });

  it('CA-04/edição: os 3 vínculos ficam desabilitados e o payload de atualização não os inclui', async () => {
    await flushCargaInicial([ofertaSeed]);
    component['abrirEdicao'](ofertaSeed);

    expect(component['form'].controls.cursoId.disabled).toBe(true);
    expect(component['form'].controls.localOfertaId.disabled).toBe(true);
    expect(component['form'].controls.unidadeOfertanteOrigemId.disabled).toBe(true);

    component['form'].controls.eMecCodigo.setValue('999999');
    component['salvar']();

    const put = controller.expectOne(`${BASE}/api/configuracao/admin/ofertas-curso/${OFERTA_ID}`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body.cursoId).toBeUndefined();
    expect(put.request.body.localOfertaId).toBeUndefined();
    expect(put.request.body.unidadeOfertanteOrigemId).toBeUndefined();
    expect(put.request.body.eMecCodigo).toBe('999999');
    put.flush(null, { status: 204, statusText: 'No Content' });
    await flushRecarregarLista([ofertaSeed]);
  });

  it('bloqueia salvar sem os campos obrigatórios (curso/local/unidade/programa)', async () => {
    await flushCargaInicial([]);
    component['abrirCadastro']();
    await flushUnidades();
    component['salvar']();
    controller.expectNone(`${BASE}/api/configuracao/admin/ofertas-curso`);
  });

  it('CA-07: vagas anuais negativas são rejeitadas pelo form', async () => {
    await flushCargaInicial([]);
    component['abrirCadastro']();
    await flushUnidades();
    component['form'].controls.vagasAnuaisAutorizadas.setValue(-5);
    expect(component['form'].controls.vagasAnuaisAutorizadas.hasError('min')).toBe(true);
  });

  it('remove uma oferta de curso sem bloqueio (soft-delete livre)', async () => {
    await flushCargaInicial([ofertaSeed]);
    component['pedirRemocao'](ofertaSeed);
    component['removerConfirmado']();

    const req = controller.expectOne(
      `${BASE}/api/configuracao/admin/ofertas-curso/${OFERTA_ID}`,
    );
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await flushRecarregarLista([]);
    expect(component['confirmOpen']()).toBe(false);
  });

  it('CA-05: contexto de Curso e Local aparece abaixo dos selects ao selecionar', async () => {
    await flushCargaInicial([]);
    component['abrirCadastro']();
    await flushUnidades();

    component['form'].controls.cursoId.setValue(CURSO_ID);
    await propagate();
    expect(component['cursoContexto']()).toBe('Bacharelado · Graduação');

    component['form'].controls.localOfertaId.setValue(LOCAL_ID);
    await propagate();
    expect(component['localContexto']()).toContain('Marabá');
  });

  it('trocar o regime para INTEGRAL passa a exigir dois turnos, e um só não salva', async () => {
    await flushCargaInicial([]);
    component['abrirCadastro']();
    await flushUnidades();

    component['form'].patchValue({
      cursoId: CURSO_ID,
      localOfertaId: LOCAL_ID,
      unidadeOfertanteOrigemId: UNIDADE_ID,
      programaDeOferta: 'REGULAR',
      formatoPedagogico: 'PRESENCIAL',
      regimeDeTurno: 'REGULAR',
    });
    component['alternarTurno']('MATUTINO');
    await propagate();
    expect(component['form'].controls.turnos.valid).toBe(true);

    component['form'].controls.regimeDeTurno.setValue('INTEGRAL');
    await propagate();

    expect(component['turnosExigidos']()).toBe(2);
    expect(component['form'].controls.turnos.valid).toBe(false);
    expect(component['erroDoCampo']('turnos')).toContain('INTEGRAL');

    component['salvar']();
    controller.expectNone(`${BASE}/api/configuracao/admin/ofertas-curso`);
  });

  it('voltar de INTEGRAL para REGULAR mantém o turno marcado por último', async () => {
    await flushCargaInicial([]);
    component['abrirCadastro']();
    await flushUnidades();

    component['form'].controls.regimeDeTurno.setValue('INTEGRAL');
    await propagate();
    component['alternarTurno']('VESPERTINO');
    component['alternarTurno']('MATUTINO');
    await propagate();
    expect(component['form'].controls.turnos.value).toEqual(['VESPERTINO', 'MATUTINO']);

    component['form'].controls.regimeDeTurno.setValue('REGULAR');
    await propagate();

    expect(component['form'].controls.turnos.value).toEqual(['MATUTINO']);
    expect(component['form'].controls.turnos.valid).toBe(true);
  });

  it('sob INTEGRAL, um terceiro turno descarta o mais antigo em vez de zerar a seleção', async () => {
    await flushCargaInicial([]);
    component['abrirCadastro']();
    await flushUnidades();

    component['form'].controls.regimeDeTurno.setValue('INTEGRAL');
    await propagate();
    component['alternarTurno']('MATUTINO');
    component['alternarTurno']('VESPERTINO');
    component['alternarTurno']('NOTURNO');
    await propagate();

    expect(component['form'].controls.turnos.value).toEqual(['VESPERTINO', 'NOTURNO']);
    expect(component['form'].controls.turnos.valid).toBe(true);
  });

  it('sob REGULAR, marcar outro turno substitui o anterior em vez de somar', async () => {
    await flushCargaInicial([]);
    component['abrirCadastro']();
    await flushUnidades();

    component['alternarTurno']('MATUTINO');
    component['alternarTurno']('NOTURNO');
    await propagate();

    expect(component['form'].controls.turnos.value).toEqual(['NOTURNO']);
  });

  it('envia regimeDeTurno e os turnos em ordem canônica, qualquer que seja a ordem de marcação', async () => {
    await flushCargaInicial([]);
    component['abrirCadastro']();
    await flushUnidades();

    component['form'].patchValue({
      cursoId: CURSO_ID,
      localOfertaId: LOCAL_ID,
      unidadeOfertanteOrigemId: UNIDADE_ID,
      programaDeOferta: 'REGULAR',
      formatoPedagogico: 'PRESENCIAL',
      regimeDeTurno: 'INTEGRAL',
    });
    component['alternarTurno']('NOTURNO');
    component['alternarTurno']('VESPERTINO');
    await propagate();

    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/ofertas-curso`);
    expect(post.request.body).toMatchObject({
      regimeDeTurno: 'INTEGRAL',
      turnos: ['VESPERTINO', 'NOTURNO'],
    });
    post.flush(OFERTA_ID, { status: 201, statusText: 'Created' });
    await flushRecarregarLista([ofertaSeed]);
  });

  it('a recusa de cardinalidade da API aparece junto ao campo de turnos e preserva o formulário', async () => {
    await flushCargaInicial([]);
    component['abrirCadastro']();
    await flushUnidades();

    component['form'].patchValue({
      cursoId: CURSO_ID,
      localOfertaId: LOCAL_ID,
      unidadeOfertanteOrigemId: UNIDADE_ID,
      programaDeOferta: 'REGULAR',
      formatoPedagogico: 'PRESENCIAL',
      regimeDeTurno: 'REGULAR',
    });
    component['alternarTurno']('MATUTINO');
    await propagate();

    component['salvar']();

    controller.expectOne(`${BASE}/api/configuracao/admin/ofertas-curso`).flush(
      {
        type: 'https://unifesspa-edu-br.github.io/uniplus-developers/erros/uniplus.configuracao.oferta_curso.cardinalidade_turnos_incompativel_com_regime',
        title: 'Quantidade de turnos incompatível com o regime declarado',
        status: 422,
        code: 'uniplus.configuracao.oferta_curso.cardinalidade_turnos_incompativel_com_regime',
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      },
      {
        status: 422,
        statusText: 'Unprocessable Content',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );
    await propagate();

    expect(component['erroDoCampo']('turnos')).toBeTruthy();
    expect(component['formOpen']()).toBe(true);
    expect(component['form'].controls.cursoId.value).toBe(CURSO_ID);
  });

  it('regime desconhecido pelo frontend não trunca os turnos vindos da API', async () => {
    // Um regime introduzido por um backend mais novo: a UI não conhece a
    // cardinalidade e não pode reduzir a seleção — a decisão fica com a API.
    const ofertaComRegimeNovo: OfertaCursoDto = {
      ...ofertaSeed,
      regimeDeTurno: 'ROTATIVO',
      turnos: ['MATUTINO', 'VESPERTINO'],
    };
    await flushCargaInicial([ofertaComRegimeNovo]);
    component['abrirEdicao'](ofertaComRegimeNovo);
    await propagate();

    expect(component['turnosExigidos']()).toBeNull();
    expect(component['form'].controls.turnos.value).toEqual(['MATUTINO', 'VESPERTINO']);
    expect(component['form'].controls.turnos.valid).toBe(true);
  });

  it('editar uma oferta integral carrega os dois turnos marcados', async () => {
    const ofertaIntegral: OfertaCursoDto = {
      ...ofertaSeed,
      regimeDeTurno: 'INTEGRAL',
      turnos: ['VESPERTINO', 'MATUTINO'],
    };
    await flushCargaInicial([ofertaIntegral]);
    component['abrirEdicao'](ofertaIntegral);
    await propagate();

    expect(component['form'].controls.regimeDeTurno.value).toBe('INTEGRAL');
    expect(component['form'].controls.turnos.value).toEqual(['MATUTINO', 'VESPERTINO']);
    expect(component['turnoMarcado']('NOTURNO')).toBe(false);
  });
});
