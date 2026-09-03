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
  unidadeOfertante: {
    origemId: UNIDADE_ID,
    sigla: 'IGE',
    nome: 'Instituto de Geociências e Engenharias',
    tipo: 'Instituto',
  },
  programaDeOferta: 'REGULAR',
  formatoPedagogico: 'PRESENCIAL',
  regimeDeTurno: 'REGULAR',
  regimeDeFuncionamento: 'EXTENSIVO',
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
    const listaReq = controller.expectOne(
      (r) => r.url === `${BASE}/api/configuracao/ofertas-curso`,
    );
    listaReq.flush(ofertas);
    expectLookup(`${BASE}/api/configuracao/cursos`).flush([cursoSeed]);
    expectLookup(`${BASE}/api/configuracao/locais-oferta`).flush([localSeed]);
    await propagate();
  }

  // Pós-mutação, `recarregar()` só dá reload no resource da lista principal —
  // os lookups de Curso/Local de oferta já estão em cache e não recarregam.
  async function flushRecarregarLista(ofertas: readonly OfertaCursoDto[]): Promise<void> {
    await propagate();
    controller.expectOne((r) => r.url === `${BASE}/api/configuracao/ofertas-curso`).flush(ofertas);
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

  it('cancela o lookup de cursos anterior ao clicar "Tentar novamente" antes da resposta chegar', async () => {
    controller.expectOne((r) => r.url === `${BASE}/api/configuracao/ofertas-curso`).flush([]);
    const primeira = expectLookup(`${BASE}/api/configuracao/cursos`);
    expectLookup(`${BASE}/api/configuracao/locais-oferta`).flush([localSeed]);

    component['cursos'].recarregar();
    await propagate();

    // A primeira travessia precisa ter sido cancelada de verdade (não só
    // ignorada) — senão ela ainda pode ganhar a corrida se responder por
    // último, sobrescrevendo o resultado da segunda com dado obsoleto.
    expect(primeira.cancelled).toBe(true);

    const segunda = expectLookup(`${BASE}/api/configuracao/cursos`);
    segunda.flush([cursoSeed]);
    await propagate();

    expect(component['cursos'].opcoes()).toHaveLength(1);
    expect(component['cursos'].opcoes()[0].id).toBe(CURSO_ID);
  });

  it('percorre todas as páginas dos lookups de Curso e Local de oferta sem truncar (issue #580)', async () => {
    controller.expectOne((r) => r.url === `${BASE}/api/configuracao/ofertas-curso`).flush([]);

    const cursosPagina1 = expectLookup(`${BASE}/api/configuracao/cursos`);
    cursosPagina1.flush([cursoSeed], {
      headers: {
        Link: `<${BASE}/api/configuracao/cursos?cursor=pagina-2&direction=next>; rel="next"`,
      },
    });
    const locaisPagina1 = expectLookup(`${BASE}/api/configuracao/locais-oferta`);
    locaisPagina1.flush([localSeed], {
      headers: {
        Link: `<${BASE}/api/configuracao/locais-oferta?cursor=pagina-2&direction=next>; rel="next"`,
      },
    });
    await propagate();

    const outroCurso: CursoDto = {
      ...cursoSeed,
      id: '01960000-0000-7000-0000-0000000000c2',
      codigo: 'DIR',
      nome: 'Direito',
    };
    const cursosPagina2 = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/cursos`);
    expect(cursosPagina2.request.params.get('cursor')).toBe('pagina-2');
    cursosPagina2.flush([outroCurso]);

    const outroLocal: LocalOfertaDto = {
      ...localSeed,
      id: '01960000-0000-7000-0000-0000000000e2',
      cidade: { codigoIbge: '1508084', nome: 'Xinguara', uf: 'PA' },
    };
    const locaisPagina2 = controller.expectOne(
      (r) => r.url === `${BASE}/api/configuracao/locais-oferta`,
    );
    expect(locaisPagina2.request.params.get('cursor')).toBe('pagina-2');
    locaisPagina2.flush([outroLocal]);
    await propagate();

    expect(component['cursos'].opcoes()).toHaveLength(2);
    expect(component['cursos'].opcoes().map((c) => c.codigo)).toEqual(['ENG-CIV', 'DIR']);
    expect(component['locaisOferta'].opcoes()).toHaveLength(2);
    expect(component['locaisOferta'].opcoes().map((l) => l.cidade?.nome)).toEqual([
      'Marabá',
      'Xinguara',
    ]);
  });

  // Unidade é o único lookup cross-módulo (Organização, ADR-0056) e o que mais
  // cresce: o truncamento aqui esconderia unidades ofertantes inteiras do
  // select de criação.
  it('percorre todas as páginas do lookup de Unidade sem truncar (issue #580)', async () => {
    await flushCargaInicial([]);
    component['abrirCadastro']();
    await propagate();

    const unidadesPagina1 = expectLookup(`${BASE}/api/organizacao/unidades`);
    unidadesPagina1.flush([unidadeSeed], {
      headers: {
        Link: `<${BASE}/api/organizacao/unidades?cursor=pagina-2&direction=next>; rel="next"`,
      },
    });
    await propagate();

    const outraUnidade: UnidadeDto = {
      ...unidadeSeed,
      id: '01960000-0000-7000-0000-0000000000f2',
      sigla: 'ICH',
      nome: 'Instituto de Ciências Humanas',
      slug: 'ich',
      codigo: 'ICH',
    };
    const unidadesPagina2 = controller.expectOne(
      (r) => r.url === `${BASE}/api/organizacao/unidades`,
    );
    expect(unidadesPagina2.request.params.get('cursor')).toBe('pagina-2');
    unidadesPagina2.flush([outraUnidade]);
    await propagate();

    expect(component['unidades'].opcoes()).toHaveLength(2);
    expect(component['unidades'].opcoes().map((u) => u.sigla)).toEqual(['IGE', 'ICH']);
  });

  it('renderiza a lista resolvendo rótulos de Curso e Local via lookup', async () => {
    await flushCargaInicial([ofertaSeed]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Engenharia Civil');
    expect(fixture.nativeElement.textContent).toContain('Marabá');
    expect(fixture.nativeElement.textContent).toContain('IGE');
  });

  // Asserção por igualdade, não por continência: `toContain('Engenharia Civil')`
  // também passaria com o rótulo `ENG-CIV — Engenharia Civil`, e o que estas
  // colunas precisam provar é justamente o que deixou de ser exibido.
  it('CA-01/CA-02 (#696): a coluna Curso exibe o nome do curso sem o código', async () => {
    await flushCargaInicial([ofertaSeed]);
    fixture.detectChanges();

    const celulaCurso: HTMLElement = fixture.nativeElement.querySelector('td[data-label="Curso"]');
    expect(celulaCurso.textContent?.trim()).toBe('Engenharia Civil');
    expect(celulaCurso.textContent).not.toContain('ENG-CIV');
  });

  it('CA-01/CA-02 (#697): a coluna Unidade ofertante exibe a sigla sem o nome', async () => {
    await flushCargaInicial([ofertaSeed]);
    fixture.detectChanges();

    const celulaUnidade: HTMLElement = fixture.nativeElement.querySelector(
      'td[data-label="Unidade ofertante"]',
    );
    expect(celulaUnidade.textContent?.trim()).toBe('IGE');
    expect(celulaUnidade.textContent).not.toContain('Instituto de Geociências e Engenharias');
  });

  // CA-11 da #696: enxugar a coluna não pode enxugar as mensagens. Aqui o curso
  // aparece sozinho, sem as demais colunas da linha, e o código é o que
  // distingue cursos de nome semelhante numa remoção.
  it('CA-11 (#696): a confirmação de remoção identifica o curso pelo código e nome', async () => {
    await flushCargaInicial([ofertaSeed]);
    component['pedirRemocao'](ofertaSeed);

    expect(component['confirmMessage']()).toContain('ENG-CIV — Engenharia Civil');
  });

  it('a listagem mostra os regimes por rótulo, não pelo token do contrato', async () => {
    await flushCargaInicial([ofertaSeed]);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Extensivo');
    expect(texto).toContain('Regular');
    expect(texto).not.toContain('EXTENSIVO');
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
      regimeDeFuncionamento: 'EXTENSIVO',
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
      regimeDeFuncionamento: 'EXTENSIVO',
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
      regimeDeFuncionamento: 'EXTENSIVO',
      formatoPedagogico: 'PRESENCIAL',
      regimeDeTurno: 'REGULAR',
      turnos: ['MATUTINO'],
      vagasAnuaisAutorizadas: 40,
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

    const req = controller.expectOne(`${BASE}/api/configuracao/admin/ofertas-curso/${OFERTA_ID}`);
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
      regimeDeFuncionamento: 'EXTENSIVO',
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
      regimeDeFuncionamento: 'EXTENSIVO',
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

  it('a recusa de regime de funcionamento sobrevive à edição de outro campo', async () => {
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
      regimeDeFuncionamento: 'EXTENSIVO',
    });
    component['alternarTurno']('MATUTINO');
    await propagate();

    component['salvar']();

    controller.expectOne(`${BASE}/api/configuracao/admin/ofertas-curso`).flush(
      {
        type: 'https://unifesspa-edu-br.github.io/uniplus-developers/erros/uniplus.configuracao.oferta_curso.regime_de_funcionamento_invalido',
        title: 'Regime de funcionamento inválido',
        status: 422,
        code: 'uniplus.configuracao.oferta_curso.regime_de_funcionamento_invalido',
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      },
      {
        status: 422,
        statusText: 'Unprocessable Content',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );
    await propagate();

    expect(component['erroDoCampo']('regimeDeFuncionamento')).toBeTruthy();

    // Editar um campo sem relação nenhuma não pode varrer a recusa da tela.
    component['form'].controls.eMecCodigo.setValue('999999');
    await propagate();

    expect(component['erroDoCampo']('regimeDeFuncionamento')).toBeTruthy();
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

    // O seletor precisa mostrar o token: sem opção correspondente ele
    // renderizaria em branco enquanto o modelo guarda o valor.
    expect(component['regimeNaoReconhecido']()).toBe('ROTATIVO');
    const opcoes = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLOptionElement>(
      'select[formControlName="regimeDeTurno"] option',
    );
    expect([...opcoes].map((o) => o.value)).toContain('ROTATIVO');
  });

  it('turno desconhecido pela versão aparece no grupo, marcado', async () => {
    const ofertaComTurnoNovo: OfertaCursoDto = {
      ...ofertaSeed,
      regimeDeTurno: 'INTEGRAL',
      turnos: ['MATUTINO', 'MADRUGADA'],
    };
    await flushCargaInicial([ofertaComTurnoNovo]);
    component['abrirEdicao'](ofertaComTurnoNovo);
    await propagate();

    expect(component['opcoesDeTurno']().map((o) => o.value)).toEqual([
      'MATUTINO',
      'VESPERTINO',
      'NOTURNO',
      'MADRUGADA',
    ]);
    expect(component['turnoMarcado']('MADRUGADA')).toBe(true);
    expect(component['form'].controls.turnos.value).toContain('MADRUGADA');
  });

  it('oferta sem turno desconhecido não ganha opção extra no grupo', async () => {
    await flushCargaInicial([ofertaSeed]);
    component['abrirEdicao'](ofertaSeed);
    await propagate();

    expect(component['opcoesDeTurno']()).toHaveLength(3);
  });

  it('regime conhecido não ganha opção de fallback no seletor', async () => {
    await flushCargaInicial([ofertaSeed]);
    component['abrirEdicao'](ofertaSeed);
    await propagate();

    expect(component['regimeNaoReconhecido']()).toBeNull();
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

  // O rótulo resolvido e o fallback de lookup falho são indistinguíveis quando
  // a falha só troca o texto da célula (#579): o teste cobra a diferença.
  it('lookup de Curso recusado sinaliza a coluna e oferece recarregar só esse catálogo', async () => {
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/ofertas-curso`)
      .flush([ofertaSeed]);
    expectLookup(`${BASE}/api/configuracao/cursos`).flush(
      {},
      { status: 500, statusText: 'Server Error' },
    );
    expectLookup(`${BASE}/api/configuracao/locais-oferta`).flush([localSeed]);
    await propagate();
    fixture.detectChanges();

    const celulaCurso: HTMLElement = fixture.nativeElement.querySelector('td[data-label="Curso"]');
    expect(celulaCurso.querySelector('.lookup-label--failed')?.textContent?.trim()).toBe(
      'Não carregado',
    );

    // A coluna cujo lookup respondeu segue exibindo o rótulo real: a falha de
    // um catálogo não pode contaminar o outro.
    expect(
      fixture.nativeElement.querySelector('td[data-label="Local de oferta"]').textContent,
    ).toContain('Marabá');

    const alerta: HTMLElement = fixture.nativeElement.querySelector('.alert--warning');
    expect(alerta.textContent).toContain('Recarregar cursos');
    expect(alerta.textContent).not.toContain('Recarregar locais de oferta');

    const botaoRecarregar: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.alert--warning button',
    );
    botaoRecarregar.click();
    await propagate();
    expectLookup(`${BASE}/api/configuracao/cursos`).flush([cursoSeed]);
    await propagate();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.alert--warning')).toBeNull();
    expect(fixture.nativeElement.querySelector('td[data-label="Curso"]').textContent).toContain(
      'Engenharia Civil',
    );
  });

  it('lookup de Local de oferta recusado sinaliza a própria coluna', async () => {
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/ofertas-curso`)
      .flush([ofertaSeed]);
    expectLookup(`${BASE}/api/configuracao/cursos`).flush([cursoSeed]);
    expectLookup(`${BASE}/api/configuracao/locais-oferta`).flush(
      {},
      { status: 500, statusText: 'Server Error' },
    );
    await propagate();
    fixture.detectChanges();

    const celulaLocal: HTMLElement = fixture.nativeElement.querySelector(
      'td[data-label="Local de oferta"]',
    );
    expect(celulaLocal.querySelector('.lookup-label--failed')?.textContent?.trim()).toBe(
      'Não carregado',
    );
    expect(fixture.nativeElement.querySelector('td[data-label="Curso"]').textContent).toContain(
      'Engenharia Civil',
    );

    const alerta: HTMLElement = fixture.nativeElement.querySelector('.alert--warning');
    expect(alerta.textContent).toContain('Recarregar locais de oferta');
    expect(alerta.textContent).not.toContain('Recarregar cursos');
  });

  it('evita submissão de formulário quando regime de funcionamento INTENSIVO e regime de turno REGULAR', async () => {
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
      regimeDeFuncionamento: 'INTENSIVO',
    });
    component['alternarTurno']('NOTURNO');
    await propagate();
    component['salvar']();

    controller.expectNone(`${BASE}/api/configuracao/admin/ofertas-curso`);
    expect(component['erroDoCampo']('regimeDeFuncionamento')).toContain('INTENSIVO');
  });

  it('CA-01, CA-02, CA-03 e CA-07: apresenta a coluna Grau logo após Curso com valor resolvido e data-label', async () => {
    await flushCargaInicial([ofertaSeed]);
    fixture.detectChanges();

    const headers = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLTableCellElement>('th'),
    ).map((th) => th.textContent?.trim());

    expect(headers[0]).toBe('Curso');
    expect(headers[1]).toBe('Grau');

    const celulaGrau: HTMLElement | null = fixture.nativeElement.querySelector(
      'td[data-label="Grau"]',
    );
    expect(celulaGrau).toBeTruthy();
    expect(celulaGrau?.textContent?.trim()).toBe('Bacharelado');
  });

  it('Cenário BDD: exibe graus diferentes para cada curso relacionado na tabela', async () => {
    const cursoLicenciatura: CursoDto = {
      ...cursoSeed,
      id: '01960000-0000-7000-0000-0000000000c2',
      codigo: 'LET-POR',
      nome: 'Letras - Língua Portuguesa',
      grau: 'Licenciatura',
    };

    const oferta2: OfertaCursoDto = {
      ...ofertaSeed,
      id: '01960000-0000-7000-0000-0000000000d2',
      cursoId: cursoLicenciatura.id,
    };

    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/ofertas-curso`)
      .flush([ofertaSeed, oferta2]);
    expectLookup(`${BASE}/api/configuracao/cursos`).flush([cursoSeed, cursoLicenciatura]);
    expectLookup(`${BASE}/api/configuracao/locais-oferta`).flush([localSeed]);
    await propagate();
    fixture.detectChanges();

    const celulasGrau = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLTableCellElement>('td[data-label="Grau"]'),
    ).map((td) => td.textContent?.trim());

    expect(celulasGrau).toEqual(['Bacharelado', 'Licenciatura']);
  });

  it('CA-06: apresenta "—" na coluna Grau quando o cursoId não puder ser resolvido no lookup', async () => {
    const ofertaComCursoInexistente: OfertaCursoDto = {
      ...ofertaSeed,
      cursoId: '01960000-0000-7000-0000-0000000000c9',
    };

    await flushCargaInicial([ofertaComCursoInexistente]);
    fixture.detectChanges();

    const celulaGrau: HTMLElement | null = fixture.nativeElement.querySelector(
      'td[data-label="Grau"]',
    );
    expect(celulaGrau?.textContent?.trim()).toBe('—');
  });

  it('CA-06: apresenta "—" na coluna Grau quando a requisição do lookup de Cursos falhar', async () => {
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/ofertas-curso`)
      .flush([ofertaSeed]);
    expectLookup(`${BASE}/api/configuracao/cursos`).flush(
      {},
      { status: 500, statusText: 'Server Error' },
    );
    expectLookup(`${BASE}/api/configuracao/locais-oferta`).flush([localSeed]);
    await propagate();
    fixture.detectChanges();

    const celulaGrau: HTMLElement | null = fixture.nativeElement.querySelector(
      'td[data-label="Grau"]',
    );
    expect(celulaGrau?.textContent?.trim()).toBe('—');
  });
});
