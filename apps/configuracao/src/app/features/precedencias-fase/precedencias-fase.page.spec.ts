import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CODIGOS_FASE_CANONICA,
  CONFIGURACAO_BASE_PATH,
  FaseCanonicaDto,
  PrecedenciaFaseDto,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PrecedenciasFasePage } from './precedencias-fase.page';

const BASE = 'http://localhost:5000';
const ARESTA_ID = '01960000-0000-7000-0000-0000000000a1';

const arestaSeed: PrecedenciaFaseDto = {
  id: ARESTA_ID,
  antecessoraCodigo: 'INSCRICAO',
  sucessoraCodigo: 'HOMOLOGACAO',
  permiteSobreposicao: false,
  criadoEm: '2026-07-15T12:00:00Z',
};

function faseCanonica(codigo: string, nome: string): FaseCanonicaDto {
  return {
    id: `fase-${codigo}`,
    codigo,
    nome,
    descricao: null,
    donoTipico: 'CEPS',
    agrupaEtapas: false,
    permiteComplementacao: false,
    baseLegal: null,
    criadoEm: '2026-06-10T12:00:00Z',
  };
}

function problem(code: string, title: string, status = 422): Record<string, unknown> {
  return { type: `https://uniplus.dev/erros/${code}`, title, status, code };
}

const PROBLEM_HEADERS = { 'Content-Type': 'application/problem+json' };

describe('PrecedenciasFasePage', () => {
  let fixture: ComponentFixture<PrecedenciasFasePage>;
  let component: PrecedenciasFasePage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PrecedenciasFasePage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(PrecedenciasFasePage);
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

  /** O GET do cadastro de fases só alimenta rótulos; roda uma vez por página. */
  async function flushFases(itens: readonly FaseCanonicaDto[]): Promise<void> {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/fases-canonicas`);
    req.flush(itens);
    await propagate();
  }

  async function falharFases(): Promise<void> {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/fases-canonicas`);
    req.flush(problem('uniplus.erro', 'Serviço indisponível', 503), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: PROBLEM_HEADERS,
    });
    await propagate();
  }

  async function flushLista(itens: readonly PrecedenciaFaseDto[]): Promise<void> {
    const req = controller.expectOne(
      (r) => r.url === `${BASE}/api/configuracao/precedencias-fase`,
    );
    expect(req.request.params.get('limit')).toBe('100');
    req.flush(itens);
    await propagate();
  }

  async function abrirCriacaoValida(): Promise<void> {
    component['abrirCadastro']();
    component['form'].setValue({
      antecessoraCodigo: 'AVALIACAO',
      sucessoraCodigo: 'CLASSIFICACAO',
      permiteSobreposicao: false,
    });
  }

  it('CA-01: lista as arestas vivas com antecessora, sucessora e sobreposição', async () => {
    await flushFases([faseCanonica('INSCRICAO', 'Inscrição')]);
    await flushLista([arestaSeed]);

    expect(component['arestas']()).toHaveLength(1);
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('INSCRICAO');
    expect(texto).toContain('HOMOLOGACAO');
    expect(texto).toContain('Não');
  });

  it('CA-01: busca filtra por código e por nome da fase', async () => {
    const outra: PrecedenciaFaseDto = {
      ...arestaSeed,
      id: 'b2',
      antecessoraCodigo: 'AVALIACAO',
      sucessoraCodigo: 'CLASSIFICACAO',
    };
    await flushFases([faseCanonica('AVALIACAO', 'Avaliação')]);
    await flushLista([arestaSeed, outra]);

    component['termoBusca'].set('CLASSIFICACAO');
    expect(component['arestasFiltradas']()).toEqual([outra]);

    // Casa pelo nome enriquecido, não só pelo código.
    component['termoBusca'].set('Avaliação');
    expect(component['arestasFiltradas']()).toEqual([outra]);

    component['termoBusca'].set('INSCRICAO');
    expect(component['arestasFiltradas']()).toEqual([arestaSeed]);
  });

  it('CA-03: self-loop é bloqueado no client e não chega a disparar POST', async () => {
    await flushFases([]);
    await flushLista([]);

    component['abrirCadastro']();
    component['form'].setValue({
      antecessoraCodigo: 'AVALIACAO',
      sucessoraCodigo: 'AVALIACAO',
      permiteSobreposicao: false,
    });

    component['salvar']();

    controller.expectNone(`${BASE}/api/configuracao/admin/precedencias-fase`);
    expect(component['form'].hasError('selfLoop')).toBe(true);
    expect(component['erroDoCampo']('sucessoraCodigo')).toBe(
      'A fase sucessora não pode ser igual à antecessora.',
    );
    expect(component['formOpen']()).toBe(true);
  });

  it('CA-03: self-loop recusado pelo backend (422) aparece no campo sucessora', async () => {
    await flushFases([]);
    await flushLista([]);
    await abrirCriacaoValida();

    component['salvar']();
    const post = controller.expectOne(`${BASE}/api/configuracao/admin/precedencias-fase`);
    post.flush(
      problem(
        'uniplus.configuracao.precedencia_fase.self_loop',
        'A fase antecessora não pode ser igual à fase sucessora',
      ),
      { status: 422, statusText: 'Unprocessable Entity', headers: PROBLEM_HEADERS },
    );
    await propagate();

    expect(component['formOpen']()).toBe(true);
    expect(component['erroDoCampo']('sucessoraCodigo')).toContain(
      'não pode ser igual à fase sucessora',
    );
  });

  it('CA-04: aresta duplicada (422) é mapeada no campo sucessora e o drawer continua aberto', async () => {
    await flushFases([]);
    await flushLista([]);
    await abrirCriacaoValida();

    component['salvar']();
    const post = controller.expectOne(`${BASE}/api/configuracao/admin/precedencias-fase`);
    post.flush(
      problem(
        'uniplus.configuracao.precedencia_fase.aresta_duplicada',
        'Já existe uma aresta de precedência viva com este par de fases',
      ),
      { status: 422, statusText: 'Unprocessable Entity', headers: PROBLEM_HEADERS },
    );
    await propagate();

    expect(component['formOpen']()).toBe(true);
    expect(component['erroDoCampo']('sucessoraCodigo')).toContain('Já existe uma aresta');
    expect(component['formError']()).toBeNull();
  });

  it('CA-05: ciclo detectado (422) vira banner geral, não erro de campo', async () => {
    await flushFases([]);
    await flushLista([]);
    await abrirCriacaoValida();

    component['salvar']();
    const post = controller.expectOne(`${BASE}/api/configuracao/admin/precedencias-fase`);
    post.flush(
      problem(
        'uniplus.configuracao.precedencia_fase.ciclo_detectado',
        'A aresta fecharia um ciclo no grafo de precedências',
      ),
      { status: 422, statusText: 'Unprocessable Entity', headers: PROBLEM_HEADERS },
    );
    await propagate();

    expect(component['formOpen']()).toBe(true);
    expect(component['formError']()).toContain('fecharia um ciclo');
    expect(component['erroDoCampo']('sucessoraCodigo')).toBeNull();
    expect(component['erroDoCampo']('antecessoraCodigo')).toBeNull();
  });

  it('renova a Idempotency-Key após 422 para que a correção seja um comando novo', async () => {
    await flushFases([]);
    await flushLista([]);
    await abrirCriacaoValida();

    component['salvar']();
    const primeiro = controller.expectOne(`${BASE}/api/configuracao/admin/precedencias-fase`);
    const chaveInicial = primeiro.request.headers.get('Idempotency-Key');
    expect(chaveInicial).toBeTruthy();
    primeiro.flush(
      problem(
        'uniplus.configuracao.precedencia_fase.aresta_duplicada',
        'Já existe uma aresta de precedência viva com este par de fases',
      ),
      { status: 422, statusText: 'Unprocessable Entity', headers: PROBLEM_HEADERS },
    );
    await propagate();

    // O filtro de idempotência do backend guarda a resposta de qualquer status
    // abaixo de 500: reenviar o corpo corrigido com a chave anterior devolveria
    // `body_mismatch` em vez de processar o comando.
    component['form'].controls.sucessoraCodigo.setValue('RESULTADO_PRELIMINAR');
    component['salvar']();

    const segundo = controller.expectOne(`${BASE}/api/configuracao/admin/precedencias-fase`);
    expect(segundo.request.headers.get('Idempotency-Key')).not.toBe(chaveInicial);
    segundo.flush('novo-id', { status: 201, statusText: 'Created' });
    await propagate();

    expect(component['formOpen']()).toBe(false);
    await flushLista([]);
  });

  it('CA-06: na edição o par é somente leitura e o PUT leva apenas id e permiteSobreposicao', async () => {
    await flushFases([]);
    await flushLista([arestaSeed]);

    component['abrirEdicao'](arestaSeed);
    fixture.detectChanges();

    const antecessora = fixture.nativeElement.querySelector(
      '#cfg-precedencia-antecessora',
    ) as HTMLInputElement;
    const sucessora = fixture.nativeElement.querySelector(
      '#cfg-precedencia-sucessora',
    ) as HTMLInputElement;
    // `readonly` não tem efeito em <select>, por isso a edição troca o controle
    // por <input readonly>.
    expect(antecessora.tagName).toBe('INPUT');
    expect(antecessora.readOnly).toBe(true);
    expect(sucessora.tagName).toBe('INPUT');
    expect(sucessora.readOnly).toBe(true);

    component['form'].controls.permiteSobreposicao.setValue(true);
    component['salvar']();

    const put = controller.expectOne(`${BASE}/api/configuracao/admin/precedencias-fase/${ARESTA_ID}`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ id: ARESTA_ID, permiteSobreposicao: true });
    expect(put.request.body).not.toHaveProperty('antecessoraCodigo');
    expect(put.request.body).not.toHaveProperty('sucessoraCodigo');
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([arestaSeed]);
  });

  it('CA-07: remove a aresta após confirmação', async () => {
    await flushFases([]);
    await flushLista([arestaSeed]);

    component['pedirRemocao'](arestaSeed);
    component['removerConfirmado']();

    const req = controller.expectOne(`${BASE}/api/configuracao/admin/precedencias-fase/${ARESTA_ID}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();

    expect(component['confirmOpen']()).toBe(false);
    await flushLista([]);
  });

  it('edição de aresta já removida por outro administrador (404) fecha o drawer e recarrega', async () => {
    await flushFases([]);
    await flushLista([arestaSeed]);

    component['abrirEdicao'](arestaSeed);
    component['form'].controls.permiteSobreposicao.setValue(true);
    component['salvar']();

    const put = controller.expectOne(`${BASE}/api/configuracao/admin/precedencias-fase/${ARESTA_ID}`);
    put.flush(
      problem(
        'uniplus.configuracao.precedencia_fase.nao_encontrada',
        'Aresta de precedência não encontrada',
        404,
      ),
      { status: 404, statusText: 'Not Found', headers: PROBLEM_HEADERS },
    );
    await propagate();

    expect(component['formOpen']()).toBe(false);
    await flushLista([]);
  });

  it('remoção de aresta já removida (404) fecha o modal e recarrega', async () => {
    await flushFases([]);
    await flushLista([arestaSeed]);

    component['pedirRemocao'](arestaSeed);
    component['removerConfirmado']();

    const req = controller.expectOne(`${BASE}/api/configuracao/admin/precedencias-fase/${ARESTA_ID}`);
    req.flush(
      problem(
        'uniplus.configuracao.precedencia_fase.nao_encontrada',
        'Aresta de precedência não encontrada',
        404,
      ),
      { status: 404, statusText: 'Not Found', headers: PROBLEM_HEADERS },
    );
    await propagate();

    expect(component['confirmOpen']()).toBe(false);
    await flushLista([]);
  });

  it('opções cobrem o roster canônico e marcam as fases ainda não cadastradas', async () => {
    await flushFases([faseCanonica('INSCRICAO', 'Inscrição')]);
    await flushLista([]);

    const opcoes = component['opcoesDeFase']();
    expect(opcoes).toHaveLength(CODIGOS_FASE_CANONICA.length);
    expect(opcoes.find((o) => o.codigo === 'INSCRICAO')?.rotulo).toBe('INSCRICAO — Inscrição');
    expect(opcoes.find((o) => o.codigo === 'MATRICULA')?.rotulo).toBe('MATRICULA — (não cadastrada)');
  });

  it('falha ao consultar o cadastro de fases degrada os rótulos sem se confundir com "não cadastrada"', async () => {
    await falharFases();
    await flushLista([arestaSeed]);

    expect(component['falhaAoCarregarFases']()).toBe(true);
    // Indisponibilidade do cadastro não pode ser apresentada como ausência dele.
    const opcoes = component['opcoesDeFase']();
    expect(opcoes.every((o) => !o.rotulo.includes('não cadastrada'))).toBe(true);
    expect(opcoes.find((o) => o.codigo === 'INSCRICAO')?.rotulo).toBe('INSCRICAO');
    // A lista principal segue utilizável.
    expect(component['arestas']()).toHaveLength(1);
    expect(component['errorMessage']()).toBeNull();
  });

  it('corrigir a antecessora limpa o erro de par vindo do backend e libera o reenvio', async () => {
    await flushFases([]);
    await flushLista([]);
    await abrirCriacaoValida();

    component['salvar']();
    const primeiro = controller.expectOne(`${BASE}/api/configuracao/admin/precedencias-fase`);
    primeiro.flush(
      problem(
        'uniplus.configuracao.precedencia_fase.aresta_duplicada',
        'Já existe uma aresta de precedência viva com este par de fases',
      ),
      { status: 422, statusText: 'Unprocessable Entity', headers: PROBLEM_HEADERS },
    );
    await propagate();
    expect(component['erroDoCampo']('sucessoraCodigo')).toContain('Já existe uma aresta');

    // A correção acontece do outro lado do par: o erro é da dupla, então
    // precisa sumir mesmo sem tocar na sucessora — senão o formulário fica
    // travado com uma combinação que já mudou.
    component['form'].controls.antecessoraCodigo.setValue('RECURSOS');
    expect(component['erroDoCampo']('sucessoraCodigo')).toBeNull();
    expect(component['form'].valid).toBe(true);

    component['salvar']();
    const segundo = controller.expectOne(`${BASE}/api/configuracao/admin/precedencias-fase`);
    expect(segundo.request.body).toEqual({
      antecessoraCodigo: 'RECURSOS',
      sucessoraCodigo: 'CLASSIFICACAO',
      permiteSobreposicao: false,
    });
    segundo.flush('novo-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([]);
  });

  it('conflito de processamento (409) preserva a chave para o retry do mesmo comando', async () => {
    await flushFases([]);
    await flushLista([]);
    await abrirCriacaoValida();

    component['salvar']();
    const primeiro = controller.expectOne(`${BASE}/api/configuracao/admin/precedencias-fase`);
    const chaveInicial = primeiro.request.headers.get('Idempotency-Key');
    primeiro.flush(
      problem(
        'uniplus.idempotency.processing_conflict',
        'Request com a mesma Idempotency-Key ainda em processamento; tentar novamente em alguns segundos',
        409,
      ),
      { status: 409, statusText: 'Conflict', headers: PROBLEM_HEADERS },
    );
    await propagate();

    // A execução anterior ainda pode concluir: reenviar com chave nova viraria
    // um segundo comando em vez de recuperar o resultado do primeiro.
    component['salvar']();
    const retry = controller.expectOne(`${BASE}/api/configuracao/admin/precedencias-fase`);
    expect(retry.request.headers.get('Idempotency-Key')).toBe(chaveInicial);
    retry.flush('novo-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([]);
  });

  it('formulário fica congelado durante a gravação e é reabilitado ao fim', async () => {
    await flushFases([]);
    await flushLista([]);
    await abrirCriacaoValida();

    component['salvar']();
    // Congelado impede que a dupla mude sob a request em voo.
    expect(component['form'].disabled).toBe(true);

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/precedencias-fase`);
    post.flush(
      problem(
        'uniplus.configuracao.precedencia_fase.aresta_duplicada',
        'Já existe uma aresta de precedência viva com este par de fases',
      ),
      { status: 422, statusText: 'Unprocessable Entity', headers: PROBLEM_HEADERS },
    );
    await propagate();

    expect(component['form'].disabled).toBe(false);
    // O erro sobrevive à reabilitação — `enable()` revalida e apagaria um erro
    // gravado antes dele.
    expect(component['erroDoCampo']('sucessoraCodigo')).toContain('Já existe uma aresta');
  });

  it('remoção não é bloqueada por uma gravação de formulário em curso', async () => {
    await flushFases([]);
    await flushLista([arestaSeed]);
    await abrirCriacaoValida();

    component['salvar']();
    const post = controller.expectOne(`${BASE}/api/configuracao/admin/precedencias-fase`);

    // Com o estado de gravação compartilhado, esta confirmação sumiria sem
    // enviar nada — o diálogo fecha ao confirmar, independentemente do guard.
    component['pedirRemocao'](arestaSeed);
    component['removerConfirmado']();
    const del = controller.expectOne(
      `${BASE}/api/configuracao/admin/precedencias-fase/${ARESTA_ID}`,
    );
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([]);

    post.flush('novo-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([]);
  });

  it('falha que chega com o drawer já fechado vira notificação em vez de sumir', async () => {
    await flushFases([]);
    await flushLista([]);
    await abrirCriacaoValida();

    component['salvar']();
    const post = controller.expectOne(`${BASE}/api/configuracao/admin/precedencias-fase`);

    // O botão Cancelar respeita `saving`, mas o X do cabeçalho e o Esc do
    // <dialog> fecham o drawer mesmo assim. Com o formulário fora da tela, o
    // erro de campo não seria visto por ninguém.
    component['formOpen'].set(false);

    post.flush(
      problem(
        'uniplus.configuracao.precedencia_fase.aresta_duplicada',
        'Já existe uma aresta de precedência viva com este par de fases',
      ),
      { status: 422, statusText: 'Unprocessable Entity', headers: PROBLEM_HEADERS },
    );
    await propagate();

    const erros = TestBed.inject(NotificationService)
      .notifications()
      .filter((n) => n.type === 'error');
    expect(erros).toHaveLength(1);
    expect(erros[0].title).toContain('Já existe uma aresta');
    await flushLista([]);
  });

  it('busca lê o valor do input sem passar por cast no template', async () => {
    await flushFases([]);
    await flushLista([arestaSeed]);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector(
      'input[type="search"]',
    ) as HTMLInputElement;
    input.value = 'HOMOLOGACAO';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component['termoBusca']()).toBe('HOMOLOGACAO');
  });

  it('sucesso de uma abertura anterior recarrega a lista sem fechar o formulário atual', async () => {
    await flushFases([]);
    await flushLista([]);
    await abrirCriacaoValida();

    component['salvar']();
    const post = controller.expectOne(`${BASE}/api/configuracao/admin/precedencias-fase`);

    component['abrirEdicao'](arestaSeed);
    post.flush('novo-id', { status: 201, statusText: 'Created' });
    await propagate();

    // O servidor mudou, então a lista precisa ser recarregada de qualquer forma;
    // o drawer aberto depois é que não pode ser fechado pela resposta antiga.
    expect(component['formOpen']()).toBe(true);
    expect(component['modo']()).toBe('editar');
    await flushLista([arestaSeed]);
  });

  it('resposta tardia de uma abertura anterior não fecha o formulário aberto depois', async () => {
    await flushFases([]);
    await flushLista([]);
    await abrirCriacaoValida();

    component['salvar']();
    const post = controller.expectOne(`${BASE}/api/configuracao/admin/precedencias-fase`);

    // Enquanto a resposta não chega, o administrador abre outro formulário.
    component['abrirEdicao'](arestaSeed);

    post.flush(
      problem(
        'uniplus.configuracao.precedencia_fase.aresta_duplicada',
        'Já existe uma aresta de precedência viva com este par de fases',
      ),
      { status: 422, statusText: 'Unprocessable Entity', headers: PROBLEM_HEADERS },
    );
    await propagate();

    // O erro pertencia à abertura anterior: não contamina o formulário atual.
    expect(component['formOpen']()).toBe(true);
    expect(component['modo']()).toBe('editar');
    expect(component['formError']()).toBeNull();
    expect(component['erroDoCampo']('sucessoraCodigo')).toBeNull();
  });
});
