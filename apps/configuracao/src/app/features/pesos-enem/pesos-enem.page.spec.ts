import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { ProblemI18nService, apiResultInterceptor, buildVendorMimeAccept } from '@uniplus/shared-core/http';
import { AreaPesoAreaEnemDto, CONFIGURACAO_BASE_PATH, PesoAreaEnemDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PesosEnemPage } from './pesos-enem.page';

const BASE = 'http://localhost:5000';
const LIST_URL = `${BASE}/api/configuracao/pesos-area-enem`;
const AREAS_URL = `${BASE}/api/configuracao/pesos-area-enem/areas`;

/** As cinco áreas como a API as devolve: código, rótulo oficial e ordem canônica. */
const AREAS: readonly AreaPesoAreaEnemDto[] = [
  { codigo: 'REDACAO', rotulo: 'Redação' },
  { codigo: 'CIENCIAS_DA_NATUREZA', rotulo: 'Ciências da Natureza e suas Tecnologias' },
  { codigo: 'CIENCIAS_HUMANAS', rotulo: 'Ciências Humanas e suas Tecnologias' },
  { codigo: 'LINGUAGENS', rotulo: 'Linguagens e suas Tecnologias' },
  { codigo: 'MATEMATICA', rotulo: 'Matemática e suas Tecnologias' },
];

/** Pesos padrão por código; a Redação tem corte 400, as demais não têm corte. */
const PESOS_PADRAO: Readonly<Record<string, number>> = {
  REDACAO: 1,
  CIENCIAS_DA_NATUREZA: 1.5,
  CIENCIAS_HUMANAS: 1,
  LINGUAGENS: 1,
  MATEMATICA: 2.5,
};

function linha(overrides: Partial<PesoAreaEnemDto> & Pick<PesoAreaEnemDto, 'id' | 'resolucao' | 'grupoCurso'>): PesoAreaEnemDto {
  return {
    areas: AREAS.map((area) => ({
      codigo: area.codigo,
      rotulo: area.rotulo,
      peso: PESOS_PADRAO[area.codigo] ?? 1,
      corte: area.codigo === 'REDACAO' ? 400 : null,
    })),
    baseLegal: 'Res. 805/2024 Anexo I',
    criadoEm: '2026-06-24T12:00:00Z',
    ...overrides,
  };
}

/** Peso de uma área numa linha de `registros`. */
function pesoDe(dto: PesoAreaEnemDto | undefined, codigo: string): number | string | undefined {
  return dto?.areas.find((area) => area.codigo === codigo)?.peso;
}

const RES_805 = 'Res. 805/2024';
const RES_750 = 'Res. 750/2022';

const linhas805: readonly PesoAreaEnemDto[] = [
  linha({ id: '01960000-0000-7000-0000-0000000000a1', resolucao: RES_805, grupoCurso: 'Tecnológica' }),
  linha({ id: '01960000-0000-7000-0000-0000000000a2', resolucao: RES_805, grupoCurso: 'Humanística I' }),
  linha({ id: '01960000-0000-7000-0000-0000000000a3', resolucao: RES_805, grupoCurso: 'Humanística II' }),
  linha({ id: '01960000-0000-7000-0000-0000000000a4', resolucao: RES_805, grupoCurso: 'Saúde e Biológicas' }),
];

const linhas750: readonly PesoAreaEnemDto[] = [
  linha({
    id: '01960000-0000-7000-0000-0000000000b1',
    resolucao: RES_750,
    grupoCurso: 'Tecnológica',
    criadoEm: '2025-01-10T12:00:00Z',
  }),
  linha({
    id: '01960000-0000-7000-0000-0000000000b2',
    resolucao: RES_750,
    grupoCurso: 'Humanística I',
    criadoEm: '2025-01-10T12:00:00Z',
  }),
  linha({
    id: '01960000-0000-7000-0000-0000000000b3',
    resolucao: RES_750,
    grupoCurso: 'Humanística II',
    criadoEm: '2025-01-10T12:00:00Z',
  }),
  linha({
    id: '01960000-0000-7000-0000-0000000000b4',
    resolucao: RES_750,
    grupoCurso: 'Saúde e Biológicas',
    criadoEm: '2025-01-10T12:00:00Z',
  }),
];

function problem(status: number, code: string, title: string, errors?: readonly { field: string; code: string; message: string }[]): string {
  return JSON.stringify({
    type: `https://unifesspa-edu-br.github.io/uniplus-developers/erros/${code}`,
    title,
    status,
    code,
    traceId: 'test-trace',
    errors,
  });
}

describe('PesosEnemPage', () => {
  let fixture: ComponentFixture<PesosEnemPage>;
  let component: PesosEnemPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PesosEnemPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(PesosEnemPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
  });

  afterEach(() => controller.verify());

  const propagate = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };

  function expectAreas(): TestRequest {
    const req = controller.expectOne((r) => r.url === AREAS_URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('area-peso-area-enem', 1));
    return req;
  }

  /** Controles de uma área (peso, corte) dentro de um grupo do formulário. */
  function areaDo(
    grupo: { controls: { areas: { controls: readonly { controls: { codigo: { value: string } } }[] } } } | undefined,
    codigo: string,
  ) {
    const area = grupo?.controls.areas.controls.find((a) => a.controls.codigo.value === codigo);
    if (!area) throw new Error(`área ${codigo} ausente do formulário`);
    return area as unknown as FormGroup<{
      codigo: FormControl<string>;
      peso: FormControl<number>;
      corte: FormControl<number | null>;
    }>;
  }

  function expectListagem(): TestRequest {
    const req = controller.expectOne((r) => r.url === LIST_URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('peso-area-enem', 1));
    return req;
  }

  /** Carrega a página com a lista de áreas e uma única página de resultados (sem Link de próxima página). */
  async function carregarUmaPagina(
    dados: readonly PesoAreaEnemDto[],
    areas: readonly AreaPesoAreaEnemDto[] = AREAS,
  ): Promise<void> {
    fixture.detectChanges();
    expectAreas().flush([...areas]);
    expectListagem().flush([...dados]);
    await propagate();
    fixture.detectChanges();
  }

  it('PesosEnemPage_TextoDeApoio_DescreveOCadastroSemRotuloInterno', async () => {
    await carregarUmaPagina([...linhas805]);
    fixture.detectChanges();

    const texto = (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');

    // São cinco áreas com peso — Linguagens, Matemática, Ciências da Natureza,
    // Ciências Humanas e Redação —, e o conjunto não decorre da LDB. Cada área tem
    // também um corte opcional, que é nota mínima e não peso: não entra nesta contagem.
    expect(texto).toContain('Pesos das cinco áreas do ENEM por grupo de curso');
    expect(texto).not.toContain('LDB');

    // Identificador de requisito e rótulo de regra são rastreabilidade interna:
    // não dizem nada a quem opera a tela e envelhecem sem ninguém perceber.
    expect(texto).not.toMatch(/UNI-REQ-\d{4}/);
    expect(texto).not.toMatch(/\bRN\s?\d{2}\b/);

    // O congelamento é do processo seletivo, que é a entidade; "edital" é o
    // documento que o publica, e trocar um pelo outro confunde o operador.
    expect(texto).toContain('congelados por processo seletivo');
    expect(texto).not.toContain('edital');
  });

  it('PesosEnemPage_CarregamentoInicial_EsgotaCursorEAgrupaPorResolucao', async () => {
    fixture.detectChanges();
    expectAreas().flush([...AREAS]);
    const pagina1 = expectListagem();
    pagina1.flush([...linhas805], { headers: { Link: `<${LIST_URL}?cursor=abc&direction=next>; rel="next"` } });
    await propagate();

    const pagina2 = expectListagem();
    pagina2.flush([...linhas750]);
    await propagate();

    expect(component.resolucoes()).toEqual([RES_805, RES_750]);
    expect(component.porResolucao().get(RES_805)).toHaveLength(4);
    expect(component.porResolucao().get(RES_750)).toHaveLength(4);
  });

  it('PesosEnemPage_ResolucoesOrdenadasPorDataDesc_MaisRecentePrimeiro', async () => {
    await carregarUmaPagina([...linhas750, ...linhas805]);
    expect(component.resolucoes()).toEqual([RES_805, RES_750]);
  });

  it('PesosEnemPage_ModoLeitura_ExibeTagsVigenteEAnterior', async () => {
    await carregarUmaPagina([...linhas805, ...linhas750]);
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Vigente');
    expect(texto).toContain('Anterior');
    expect(texto).toContain(RES_805);
    expect(texto).toContain(RES_750);
  });

  it('PesosEnemPage_ErroCarga_ExibeAlertComRetry', async () => {
    fixture.detectChanges();
    expectAreas().flush([...AREAS]);
    expectListagem().flush(
      problem(500, 'uniplus.erro_interno', 'Erro interno'),
      { status: 500, statusText: 'Internal Server Error', headers: { 'content-type': 'application/problem+json' } },
    );
    await propagate();

    expect(component.errorMessage()).toBeTruthy();
    const botaoRetry = fixture.nativeElement.querySelector('.cfg-pesos-enem__retry button') as HTMLButtonElement;
    expect(botaoRetry).not.toBeNull();

    botaoRetry.click();
    await propagate();
    expectListagem().flush([...linhas805]);
    await propagate();

    expect(component.errorMessage()).toBeNull();
    expect(component.resolucoes()).toEqual([RES_805]);
  });

  it('PesosEnemPage_SemResolucoes_ExibeEmptyState', async () => {
    await carregarUmaPagina([]);
    expect(fixture.nativeElement.querySelector('ui-empty-state')).not.toBeNull();
  });

  // --- Edição in-line -----------------------------------------------------

  it('PesosEnemPage_EnterEdit_HabilitaInputsERevelaBarra', async () => {
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();

    expect(component.editandoResolucao()).toBe(RES_805);
    const form = component.editForm();
    expect(form).not.toBeNull();
    expect(form?.controls).toHaveLength(4);
    expect(form?.controls[0]?.controls.grupoCurso.value).toBe('Tecnológica');

    const barra = fixture.nativeElement.querySelector('#grid-pe-bar');
    expect(barra).not.toBeNull();
  });

  it('PesosEnemPage_EnterEdit_OrdenaPeloRosterMesmoComApiForaDeOrdem', async () => {
    // Regressão: a API pode devolver as 4 linhas em qualquer ordem (ex.: id de
    // inserção); o modo edição deve seguir a MESMA ordem do modo leitura
    // (roster canônico), não a ordem crua da resposta.
    const foraDeOrdem = [linhas805[3], linhas805[1], linhas805[0], linhas805[2]].filter(
      (l): l is PesoAreaEnemDto => l !== undefined,
    );
    await carregarUmaPagina(foraDeOrdem);
    component.clicarEditarParametros(RES_805);
    await propagate();

    const ordemObtida = component.editForm()?.controls.map((g) => g.controls.grupoCurso.value);
    expect(ordemObtida).toEqual(['Tecnológica', 'Humanística I', 'Humanística II', 'Saúde e Biológicas']);
  });

  it('PesosEnemPage_Cancelar_ReverteSemChamarApiEDevolveFoco', async () => {
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();

    areaDo(component.editForm()?.controls[0], 'LINGUAGENS').controls.peso.setValue(3);
    component.cancelarEdicao();
    await propagate();

    expect(component.editandoResolucao()).toBeNull();
    expect(component.editForm()).toBeNull();
    // Nenhuma chamada de API disparada pelo cancelamento (o afterEach->verify()
    // garante isso: qualquer request não esperada falharia o teste).
    expect(pesoDe(component.registros().find((l) => l.id === linhas805[0]?.id), 'LINGUAGENS')).toBe(1);
  });

  it('PesosEnemPage_Esc_FechaModoEdicaoERestauraValores', async () => {
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();

    const grid = fixture.nativeElement.querySelector('.pe-grid') as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(component.editandoResolucao()).toBeNull();
  });

  it('PesosEnemPage_EscDuranteEnvio_NaoLimpaSessaoAntesDoForkJoinResolver', async () => {
    // Regressão: o botão Cancelar já fica [disabled]
    // durante o envio, mas o atalho Esc não tinha essa trava — pressionar
    // Esc enquanto o PUT estava em voo limpava editForm()/
    // estadoLinhasEdicao() antes da resposta chegar, e o sucesso posterior
    // não tinha mais onde aplicar os valores salvos.
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();

    component.salvarEdicao();
    await propagate();

    const grid = fixture.nativeElement.querySelector('.pe-grid') as HTMLElement;
    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    // Esc não teve efeito: a sessão continua aberta.
    expect(component.editandoResolucao()).toBe(RES_805);
    expect(component.editForm()).not.toBeNull();

    const requests = [0, 1, 2, 3].map((i) =>
      controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    for (const req of requests) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await propagate();

    // Só depois do envio resolver a sessão fecha de fato.
    expect(component.editandoResolucao()).toBeNull();
  });

  it('PesosEnemPage_Salvar_CoordenaQuatroChamadasComIdempotencyKeyDistintas', async () => {
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();

    const form = component.editForm();
    areaDo(form?.controls[0], 'MATEMATICA').controls.peso.setValue(3.0);
    component.salvarEdicao();
    await propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    const chaves = new Set<string | null>();
    for (const req of requests) {
      expect(req.request.method).toBe('PUT');
      chaves.add(req.request.headers.get('Idempotency-Key'));
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    expect(chaves.size).toBe(4);
    await propagate();

    expect(component.editandoResolucao()).toBeNull();
    expect(pesoDe(component.registros().find((l) => l.id === linhas805[0]?.id), 'MATEMATICA')).toBe(3.0);
  });

  it('PesosEnemPage_PesoZero_Valido_PesoNegativo_InvalidaForm', async () => {
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();

    const grupo = component.editForm()?.controls[0];
    expect(grupo).toBeDefined();
    if (!grupo) throw new Error('form de edição não inicializado');
    areaDo(grupo, 'CIENCIAS_HUMANAS').controls.peso.setValue(0);
    expect(areaDo(grupo, 'CIENCIAS_HUMANAS').controls.peso.valid).toBe(true);

    const linguagens = areaDo(grupo, 'LINGUAGENS');
    linguagens.controls.peso.setValue(-1);
    linguagens.controls.peso.markAsTouched();
    expect(component.erroDaArea(linguagens, 'peso')).toBe('O peso não pode ser negativo.');

    component.salvarEdicao();
    await propagate();
    controller.expectNone((r) => r.url.includes('/admin/pesos-area-enem/'));
  });

  it('PesosEnemPage_CorteNegativo_InvalidaForm', async () => {
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();

    const redacao = areaDo(component.editForm()?.controls[3], 'REDACAO');
    redacao.controls.corte.setValue(-10);
    redacao.controls.corte.markAsTouched();
    expect(component.erroDaArea(redacao, 'corte')).toBe('O corte não pode ser negativo.');
  });

  it('PesosEnemPage_CorteVazioNaEdicao_ViajaComoSemCorte', async () => {
    // O corte é opcional: limpar o campo é "sem corte", não erro de campo
    // obrigatório — o PUT leva corte null para a área.
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();

    const redacao = areaDo(component.editForm()?.controls[0], 'REDACAO');
    redacao.controls.corte.setValue(null);
    redacao.controls.corte.markAsTouched();
    expect(redacao.controls.corte.valid).toBe(true);
    expect(component.erroDaArea(redacao, 'corte')).toBeNull();

    component.salvarEdicao();
    await propagate();
    const requests = [0, 1, 2, 3].map((i) =>
      controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    const corpo = requests[0]?.request.body as { areas: { codigo: string; corte: number | null }[] };
    expect(corpo.areas.find((a) => a.codigo === 'REDACAO')?.corte).toBeNull();
    for (const req of requests) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await propagate();
  });

  it('PesosEnemPage_IdempotencyKey_PreservadaEmRetryComMesmoCorpo', async () => {
    // Um retry idêntico (corpo inalterado) reusa a mesma key — cobre o
    // caso de falha transitória (rede/5xx) e de retry sem correção alguma.
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();

    areaDo(component.editForm()?.controls[0], 'MATEMATICA').controls.peso.setValue(3.0);
    component.salvarEdicao();
    await propagate();

    const requests1 = [0, 1, 2, 3].map((i) =>
      controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    const chaveOriginal = requests1[0]?.request.headers.get('Idempotency-Key');
    requests1[0]?.flush(
      problem(500, 'uniplus.erro_interno', 'Erro interno'),
      { status: 500, statusText: 'Internal Server Error', headers: { 'content-type': 'application/problem+json' } },
    );
    for (const req of requests1.slice(1)) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await propagate();

    expect(component.editErro()).toContain('1 de 4');

    // Retry sem alterar nada — mesmo corpo, mesma key.
    component.salvarEdicao();
    await propagate();
    const retry = controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[0]?.id}`);
    expect(retry.request.headers.get('Idempotency-Key')).toBe(chaveOriginal);
    retry.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();

    expect(component.editandoResolucao()).toBeNull();
  });

  it('PesosEnemPage_IdempotencyKey_RenovadaQuandoCorpoMudaApos422', async () => {
    // Regressão: a maioria dos 422 de peso/corte é rejeitada por exceção do
    // FluentValidation, que descarta a reserva de idempotência — reenviar
    // com a mesma key funciona. Mas há um caminho de erro de domínio
    // (retornado como Result, não lançado) que é cacheado pelo idempotency
    // store; reenviar corpo diferente sob a mesma key nesse caso
    // conflitaria como corpo divergente. Comparar o payload evita depender
    // de saber qual caminho ocorreu: corrigir o valor renova a key.
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();

    component.salvarEdicao();
    await propagate();

    const requests1 = [0, 1, 2, 3].map((i) =>
      controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    const chaveOriginal = requests1[0]?.request.headers.get('Idempotency-Key');
    requests1[0]?.flush(
      problem(422, 'PesoAreaEnem.PesoExcedeMaximo', 'Peso excede o máximo'),
      { status: 422, statusText: 'Unprocessable Entity', headers: { 'content-type': 'application/problem+json' } },
    );
    for (const req of requests1.slice(1)) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await propagate();

    // Usuário muda um valor antes de reenviar (a recusa sem `errors[]` vai ao banner,
    // sem apontar campo).
    areaDo(component.editForm()?.controls[0], 'REDACAO').controls.peso.setValue(2.0);
    component.salvarEdicao();
    await propagate();
    const retry = controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[0]?.id}`);
    expect(retry.request.headers.get('Idempotency-Key')).not.toBe(chaveOriginal);
    retry.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();

    expect(component.editandoResolucao()).toBeNull();
  });

  it('PesosEnemPage_FalhaTransitoria_NaoTravaFormNemImpedeRetryImediato', async () => {
    // Regressão: status 0/5xx é transitório — não pode pinar um erro sintético em
    // campo nenhum, que invalidaria o form e bloquearia o retry até o usuário editar
    // algum campo só para limpá-lo.
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();
    component.salvarEdicao();
    await propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    requests[0]?.flush(
      problem(500, 'uniplus.erro_interno', 'Erro interno'),
      { status: 500, statusText: 'Internal Server Error', headers: { 'content-type': 'application/problem+json' } },
    );
    requests[1]?.flush(null, { status: 204, statusText: 'No Content' });
    requests[2]?.flush(null, { status: 204, statusText: 'No Content' });
    requests[3]?.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();

    const grupoFalho = component.editForm()?.controls[0];
    expect(areaDo(grupoFalho, 'REDACAO').controls.peso.errors).toBeNull();
    expect(component.editForm()?.invalid).toBe(false);

    // Retry imediato, sem editar nada — deve disparar o PUT de novo.
    component.salvarEdicao();
    await propagate();
    const retry = controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[0]?.id}`);
    retry.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    expect(component.editandoResolucao()).toBeNull();
  });

  it('PesosEnemPage_LinhaSalvaEmRodadaParcial_FicaTravadaENaoSofreDriftLocal', async () => {
    // Regressão: numa falha parcial, a linha que já teve sucesso não pode
    // continuar editável — senão uma edição local não reenviada seria
    // gravada em `registros` como se estivesse persistida.
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();
    component.salvarEdicao();
    await propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    requests[0]?.flush(null, { status: 204, statusText: 'No Content' });
    requests[1]?.flush(
      problem(422, 'PesoAreaEnem.PesoExcedeMaximo', 'Peso excede o máximo'),
      { status: 422, statusText: 'Unprocessable Entity', headers: { 'content-type': 'application/problem+json' } },
    );
    requests[2]?.flush(null, { status: 204, statusText: 'No Content' });
    requests[3]?.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();

    const grupoSalvo = component.editForm()?.controls[0];
    expect(grupoSalvo?.disabled).toBe(true);
    expect(component.estadoLinhasEdicao().get(linhas805[0]?.id ?? '')).toBe('ok');
  });

  it('PesosEnemPage_Salvar_TravaInputsDuranteEnvioEReabilitaSoALinhaComFalha', async () => {
    // Regressão: sem travar os inputs durante o envio, o
    // usuário podia editar um valor depois do snapshot já ter sido enviado
    // ao backend (mas antes do PUT resolver) — aplicarLinhasAtualizadas()
    // gravaria em registros() esse valor nunca persistido.
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();

    component.salvarEdicao();
    await propagate();

    const formEmVoo = component.editForm();
    for (const grupo of formEmVoo?.controls ?? []) {
      expect(grupo.disabled).toBe(true);
    }

    const requests = [0, 1, 2, 3].map((i) =>
      controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    requests[0]?.flush(
      problem(422, 'PesoAreaEnem.PesoExcedeMaximo', 'Peso excede o máximo'),
      { status: 422, statusText: 'Unprocessable Entity', headers: { 'content-type': 'application/problem+json' } },
    );
    requests[1]?.flush(null, { status: 204, statusText: 'No Content' });
    requests[2]?.flush(null, { status: 204, statusText: 'No Content' });
    requests[3]?.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();

    const form = component.editForm();
    expect(form?.controls[0]?.disabled).toBe(false);
    expect(form?.controls[1]?.disabled).toBe(true);
  });

  it('PesosEnemPage_TrocarSessaoDuranteSalvar_NaoTrocaAteEnvioTerminar', async () => {
    // Regressão: trocar de sessão de edição enquanto o
    // forkJoin da sessão atual ainda está em voo permitiria que a resposta
    // tardia (que reaplica editForm()/estadoLinhasEdicao() e pode chamar
    // cancelarEdicao()) fechasse ou corrompesse a sessão nova que o usuário
    // já tinha aberto.
    await carregarUmaPagina([...linhas805, ...linhas750]);
    component.clicarEditarParametros(RES_805);
    await propagate();

    component.salvarEdicao();
    await propagate();

    // Tenta trocar para outra resolução enquanto o envio está em voo.
    component.clicarEditarParametros(RES_750);
    await propagate();
    expect(component.editandoResolucao()).toBe(RES_805);

    const requests = [0, 1, 2, 3].map((i) =>
      controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    for (const req of requests) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await propagate();

    // Só agora, com o envio concluído, a troca de sessão é permitida.
    component.clicarEditarParametros(RES_750);
    await propagate();
    expect(component.editandoResolucao()).toBe(RES_750);
  });

  it('PesosEnemPage_CancelarAposSucessoParcial_AplicaLinhasJaPersistidas', async () => {
    // Regressão: se 1 de 4 PUTs falha e o
    // usuário cancela em vez de reenviar o pendente, o modo leitura não pode
    // voltar a mostrar o valor pré-edição das 3 linhas que JÁ foram salvas —
    // isso ficaria desatualizado até um reload manual da página.
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();

    areaDo(component.editForm()?.controls[0], 'MATEMATICA').controls.peso.setValue(3.0);
    component.salvarEdicao();
    await propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    requests[0]?.flush(null, { status: 204, statusText: 'No Content' });
    requests[1]?.flush(
      problem(422, 'PesoAreaEnem.PesoExcedeMaximo', 'Peso excede o máximo'),
      { status: 422, statusText: 'Unprocessable Entity', headers: { 'content-type': 'application/problem+json' } },
    );
    requests[2]?.flush(null, { status: 204, statusText: 'No Content' });
    requests[3]?.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();

    component.cancelarEdicao();
    await propagate();

    expect(component.editandoResolucao()).toBeNull();
    expect(pesoDe(component.registros().find((l) => l.id === linhas805[0]?.id), 'MATEMATICA')).toBe(3.0);
  });

  it('PesosEnemPage_TrocarResolucaoAposSucessoParcial_AplicaLinhasJaPersistidas', async () => {
    // Regressão: trocar diretamente para outra resolução (via confirmação
    // de descarte) sem passar por cancelarEdicao() deixaria as linhas já
    // persistidas na sessão anterior desatualizadas em registros() até um
    // reload manual — mesmo bug do Cancelar, mas pelo caminho de troca de
    // sessão.
    await carregarUmaPagina([...linhas805, ...linhas750]);
    component.clicarEditarParametros(RES_805);
    await propagate();

    areaDo(component.editForm()?.controls[0], 'MATEMATICA').controls.peso.setValue(3.0);
    component.salvarEdicao();
    await propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    requests[0]?.flush(null, { status: 204, statusText: 'No Content' });
    requests[1]?.flush(
      problem(422, 'PesoAreaEnem.PesoExcedeMaximo', 'Peso excede o máximo'),
      { status: 422, statusText: 'Unprocessable Entity', headers: { 'content-type': 'application/problem+json' } },
    );
    requests[2]?.flush(null, { status: 204, statusText: 'No Content' });
    requests[3]?.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();

    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    component.clicarEditarParametros(RES_750);
    await propagate();
    confirmSpy.mockRestore();

    expect(component.editandoResolucao()).toBe(RES_750);
    expect(pesoDe(component.registros().find((l) => l.id === linhas805[0]?.id), 'MATEMATICA')).toBe(3.0);
  });

  // --- Drawer de criação ----------------------------------------------

  it('PesosEnemPage_Drawer_Cria4GruposFixosComGrupoCursoReadonly', async () => {
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    await propagate();

    const grupos = component.pesoLoteForm.controls.grupos.controls;
    expect(grupos).toHaveLength(4);
    expect(grupos.map((g) => g.controls.grupoCurso.value)).toEqual([
      'Tecnológica',
      'Humanística I',
      'Humanística II',
      'Saúde e Biológicas',
    ]);

    const legendas = fixture.nativeElement.querySelectorAll('.pe-drawer-grupo legend');
    expect(legendas).toHaveLength(4);

    // As áreas de cada grupo são as da API, na ordem dela, e funcionam com o cadastro vazio.
    for (const grupo of grupos) {
      expect(grupo.controls.areas.controls.map((a) => a.controls.codigo.value)).toEqual(
        AREAS.map((a) => a.codigo),
      );
    }
  });

  it('PesosEnemPage_ResolucaoVazia_InvalidaFormDeCriacao', async () => {
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    component.criarResolucao();
    await propagate();

    controller.expectNone((r) => r.url.includes('/admin/pesos-area-enem'));
    expect(component.erroDoCampoLote('resolucao')).toBe('Campo obrigatório.');
  });

  it('PesosEnemPage_Criar_CoordenaQuatroChamadasComIdempotencyKeyPropria', async () => {
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    component.pesoLoteForm.patchValue({ resolucao: 'Res. 900/2026', baseLegalGlobal: 'Res. 900/2026 Anexo I' });
    component.criarResolucao();
    await propagate();

    const requests = controller.match((r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`);
    expect(requests).toHaveLength(4);
    const chaves = new Set<string | null>();
    requests.forEach((req, i) => {
      expect(req.request.method).toBe('POST');
      chaves.add(req.request.headers.get('Idempotency-Key'));
      req.flush(`novo-id-${i}`, { status: 201, statusText: 'Created' });
    });
    expect(chaves.size).toBe(4);
    await propagate();

    expect(component.drawerAberto()).toBe(false);
    expectListagem().flush(
      linhas805.map((l) => ({ ...l, resolucao: 'Res. 900/2026' })),
    );
    await propagate();
  });

  it('PesosEnemPage_Criar_CamposDeTextoEmBrancoViajamComoNull', async () => {
    // `Validators.required` aceita espaços em branco: sem normalizar, o payload
    // levaria '' e o backend responderia sobre formato, não sobre ausência.
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    component.pesoLoteForm.patchValue({ resolucao: '   ', baseLegalGlobal: '  ' });
    component.criarResolucao();
    await propagate();

    const requests = controller.match(
      (r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`,
    );
    expect(requests).toHaveLength(4);
    requests.forEach((req, i) => {
      expect(req.request.body).toMatchObject({ resolucao: null, baseLegal: null });
      req.flush(`novo-id-${i}`, { status: 201, statusText: 'Created' });
    });
    await propagate();
    expectListagem().flush([]);
    await propagate();
  });

  it('PesosEnemPage_FalhaTransitoriaNaCriacao_PreservaIdempotencyKey', async () => {
    // Regressão: renovar a key numa falha transitória
    // (rede/5xx) trocaria um retry idempotente seguro por uma criação
    // duplicada — o POST original pode ter sido processado no servidor
    // mesmo com a resposta perdida.
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    component.pesoLoteForm.patchValue({ resolucao: 'Res. 900/2026', baseLegalGlobal: 'Res. 900/2026 Anexo I' });
    component.criarResolucao();
    await propagate();

    const requests1 = controller.match((r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`);
    expect(requests1).toHaveLength(4);
    const chaveOriginal = requests1[0]?.request.headers.get('Idempotency-Key');
    requests1[0]?.flush(
      problem(500, 'uniplus.erro_interno', 'Erro interno'),
      { status: 500, statusText: 'Internal Server Error', headers: { 'content-type': 'application/problem+json' } },
    );
    requests1.slice(1).forEach((req, i) => req.flush(`novo-id-${i}`, { status: 201, statusText: 'Created' }));
    await propagate();

    expect(areaDo(component.pesoLoteForm.controls.grupos.controls[0], 'REDACAO').controls.peso.errors).toBeNull();

    component.criarResolucao();
    await propagate();
    const retry = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`);
    expect(retry.request.headers.get('Idempotency-Key')).toBe(chaveOriginal);
    retry.flush('novo-id-3', { status: 201, statusText: 'Created' });
    await propagate();
    expect(component.drawerAberto()).toBe(false);
    expectListagem().flush([]);
    await propagate();
  });

  it('PesosEnemPage_Criar_TravaGruposPendentesDuranteEnvio', async () => {
    // Regressão: sem travar os grupos pendentes durante o envio, o usuário
    // podia editar um valor depois do snapshot já ter sido enviado ao POST,
    // mas antes da resposta chegar — o sucesso posterior desabilitaria o
    // MESMO FormGroup marcando "Criado" com um valor diferente do que o
    // backend recebeu.
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    component.pesoLoteForm.patchValue({ resolucao: 'Res. 900/2026', baseLegalGlobal: 'Res. 900/2026 Anexo I' });
    component.criarResolucao();
    await propagate();

    for (const grupo of component.pesoLoteForm.controls.grupos.controls) {
      expect(grupo.disabled).toBe(true);
    }

    const requests = controller.match((r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`);
    expect(requests).toHaveLength(4);
    requests[0]?.flush(
      problem(422, 'PesoAreaEnem.PesoExcedeMaximo', 'Peso excede o máximo'),
      { status: 422, statusText: 'Unprocessable Entity', headers: { 'content-type': 'application/problem+json' } },
    );
    requests[1]?.flush('novo-id-1', { status: 201, statusText: 'Created' });
    requests[2]?.flush('novo-id-2', { status: 201, statusText: 'Created' });
    requests[3]?.flush('novo-id-3', { status: 201, statusText: 'Created' });
    await propagate();

    expect(component.pesoLoteForm.controls.grupos.controls[0]?.disabled).toBe(false);
    expect(component.pesoLoteForm.controls.grupos.controls[1]?.disabled).toBe(true);
  });

  it('PesosEnemPage_RetryComCorpoAlterado_RenovaIdempotencyKey', async () => {
    // Regressão: preservar a key de uma falha transitória só é seguro
    // enquanto o corpo reenviado for idêntico ao original. Se o usuário
    // altera o grupo que falhou antes de reenviar, o corpo muda — reusar a
    // mesma key arriscaria um conflito de idempotência (corpo divergente)
    // no backend.
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    component.pesoLoteForm.patchValue({ resolucao: 'Res. 900/2026', baseLegalGlobal: 'Res. 900/2026 Anexo I' });
    component.criarResolucao();
    await propagate();

    const requests1 = controller.match((r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`);
    expect(requests1).toHaveLength(4);
    const chaveOriginal = requests1[0]?.request.headers.get('Idempotency-Key');
    requests1[0]?.flush(
      problem(500, 'uniplus.erro_interno', 'Erro interno'),
      { status: 500, statusText: 'Internal Server Error', headers: { 'content-type': 'application/problem+json' } },
    );
    requests1.slice(1).forEach((req, i) => req.flush(`novo-id-${i}`, { status: 201, statusText: 'Created' }));
    await propagate();

    // Usuário altera o grupo que falhou antes de reenviar.
    areaDo(component.pesoLoteForm.controls.grupos.controls[0], 'LINGUAGENS').controls.peso.setValue(3.5);
    component.criarResolucao();
    await propagate();
    const retry = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`);
    expect(retry.request.headers.get('Idempotency-Key')).not.toBe(chaveOriginal);
    retry.flush('novo-id-3', { status: 201, statusText: 'Created' });
    await propagate();
    expect(component.drawerAberto()).toBe(false);
    expectListagem().flush([]);
    await propagate();
  });

  it('PesosEnemPage_CancelarDrawerAposSucessoParcial_RecarregaLista', async () => {
    // Regressão: se 1+ grupos já foram criados antes de o
    // usuário desistir do restante, cancelar sem recarregar deixaria esses
    // grupos invisíveis em registros() até um reload manual.
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    component.pesoLoteForm.patchValue({ resolucao: 'Res. 900/2026', baseLegalGlobal: 'Res. 900/2026 Anexo I' });
    component.criarResolucao();
    await propagate();

    const requests = controller.match((r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`);
    expect(requests).toHaveLength(4);
    requests[0]?.flush('novo-id-0', { status: 201, statusText: 'Created' });
    requests[1]?.flush(
      problem(422, 'PesoAreaEnem.PesoExcedeMaximo', 'Peso excede o máximo'),
      { status: 422, statusText: 'Unprocessable Entity', headers: { 'content-type': 'application/problem+json' } },
    );
    requests[2]?.flush('novo-id-2', { status: 201, statusText: 'Created' });
    requests[3]?.flush('novo-id-3', { status: 201, statusText: 'Created' });
    await propagate();

    // Simula o fechamento real: o botão Cancelar (ou X/Esc do próprio
    // ui-drawer) muda `drawerAberto`, e o drawer emite `(closed)` ao
    // terminar de fechar — aoFecharDrawerCriacao() é o handler desse evento.
    component.drawerAberto.set(false);
    component.aoFecharDrawerCriacao();
    await propagate();

    expect(component.drawerAberto()).toBe(false);
    // A recarga da lista é disparada — sem ela, este GET não seria esperado.
    expectListagem().flush([]);
    await propagate();
  });

  it('PesosEnemPage_CancelarDrawerSemSucessoParcial_NaoRecarrega', async () => {
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    component.drawerAberto.set(false);
    component.aoFecharDrawerCriacao();
    await propagate();

    expect(component.drawerAberto()).toBe(false);
    controller.expectNone((r) => r.url === LIST_URL);
  });

  it('PesosEnemPage_DrawerFechadoComPostsEmVoo_RecarregaAoChegarSucessoParcial', async () => {
    // Regressão: se o drawer fecha (X/Esc) ENQUANTO os 4
    // POSTs ainda estão em voo, aoFecharDrawerCriacao() roda antes de
    // qualquer resultado chegar e não vê sucesso para recarregar. Quando o
    // forkJoin resolve depois (parcial), o branch de falha precisa detectar
    // que o drawer já está fechado e recarregar ali mesmo.
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    component.pesoLoteForm.patchValue({ resolucao: 'Res. 900/2026', baseLegalGlobal: 'Res. 900/2026 Anexo I' });
    component.criarResolucao();
    await propagate();

    const requests = controller.match((r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`);
    expect(requests).toHaveLength(4);

    // Usuário fecha o drawer (X/Esc) antes de qualquer POST responder.
    component.drawerAberto.set(false);
    component.aoFecharDrawerCriacao();
    await propagate();
    controller.expectNone((r) => r.url === LIST_URL);

    // Só agora as respostas chegam — 1 falha, 3 sucesso.
    requests[0]?.flush('novo-id-0', { status: 201, statusText: 'Created' });
    requests[1]?.flush(
      problem(422, 'PesoAreaEnem.PesoExcedeMaximo', 'Peso excede o máximo'),
      { status: 422, statusText: 'Unprocessable Entity', headers: { 'content-type': 'application/problem+json' } },
    );
    requests[2]?.flush('novo-id-2', { status: 201, statusText: 'Created' });
    requests[3]?.flush('novo-id-3', { status: 201, statusText: 'Created' });
    await propagate();

    expectListagem().flush([]);
    await propagate();
  });

  it('PesosEnemPage_ReabrirDrawerDuranteSubmit_NaoResetaSessaoEmVoo', async () => {
    // Regressão: pesoLoteForm é uma única instância
    // reaproveitada entre sessões — reabrir enquanto submitting() é true
    // resetaria/reabilitaria os MESMOS FormGroups que o forkJoin da sessão
    // anterior ainda referencia, deixando a resposta tardia mexer nos
    // campos da sessão nova que o usuário já está preenchendo.
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    component.pesoLoteForm.patchValue({ resolucao: 'Res. 900/2026', baseLegalGlobal: 'Res. 900/2026 Anexo I' });
    component.criarResolucao();
    await propagate();

    const requests = controller.match((r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`);
    expect(requests).toHaveLength(4);

    // Tenta reabrir/reset enquanto o envio está em voo — deve ser no-op.
    component.abrirDrawerCriacao();
    expect(component.pesoLoteForm.controls.resolucao.value).toBe('Res. 900/2026');

    for (const req of requests) {
      req.flush(`novo-id`, { status: 201, statusText: 'Created' });
    }
    await propagate();
    expectListagem().flush([]);
    await propagate();

    // Só agora, com o envio concluído, abrir reseta normalmente.
    component.abrirDrawerCriacao();
    expect(component.pesoLoteForm.controls.resolucao.value).toBe('');
  });

  it('PesosEnemPage_FecharDrawerDuranteRetrySubmitting_NaoRecarregaPrematuramente', async () => {
    // Regressão: fechar o drawer ENQUANTO um retry de
    // grupo pendente está em voo não pode disparar um carregar() prematuro
    // — isso "venceria" a corrida contra o reload legítimo que
    // criarResolucao() dispara ao concluir, e esse seria descartado pelo
    // guard de isLoading() em carregar(), publicando a lista sem o grupo
    // recém-criado no retry.
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    component.pesoLoteForm.patchValue({ resolucao: 'Res. 900/2026', baseLegalGlobal: 'Res. 900/2026 Anexo I' });
    component.criarResolucao();
    await propagate();

    const primeiraRodada = controller.match((r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`);
    expect(primeiraRodada).toHaveLength(4);
    primeiraRodada[0]?.flush('novo-id-0', { status: 201, statusText: 'Created' });
    primeiraRodada[1]?.flush(
      problem(422, 'PesoAreaEnem.PesoExcedeMaximo', 'Peso excede o máximo'),
      { status: 422, statusText: 'Unprocessable Entity', headers: { 'content-type': 'application/problem+json' } },
    );
    primeiraRodada[2]?.flush('novo-id-2', { status: 201, statusText: 'Created' });
    primeiraRodada[3]?.flush('novo-id-3', { status: 201, statusText: 'Created' });
    await propagate();

    // Muda um valor do grupo que falhou (a recusa sem `errors[]` vai ao banner) e
    // reenvia (retry só do pendente).
    areaDo(component.pesoLoteForm.controls.grupos.controls[1], 'REDACAO').controls.peso.setValue(2.0);
    component.criarResolucao();
    await propagate();
    const retry = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`);

    // Fecha o drawer ENQUANTO o retry ainda está em voo — não deve disparar GET.
    component.drawerAberto.set(false);
    component.aoFecharDrawerCriacao();
    await propagate();
    controller.expectNone((r) => r.url === LIST_URL);

    // Só quando o retry resolve com sucesso o reload de fato acontece.
    retry.flush('novo-id-1', { status: 201, statusText: 'Created' });
    await propagate();
    expectListagem().flush([]);
    await propagate();
  });

  it('PesosEnemPage_ResolucaoDuplicada_MapeiaErroNoCampo', async () => {
    await carregarUmaPagina([...linhas805]);
    component.abrirDrawerCriacao();
    component.pesoLoteForm.patchValue({ resolucao: RES_805, baseLegalGlobal: 'Res. 805/2024 Anexo I' });
    component.criarResolucao();
    await propagate();

    const requests = controller.match((r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`);
    expect(requests).toHaveLength(4);
    for (const req of requests) {
      req.flush(
        problem(409, 'uniplus.configuracao.peso_area_enem.par_ja_existe', 'Já existe'),
        { status: 409, statusText: 'Conflict', headers: { 'content-type': 'application/problem+json' } },
      );
    }
    await propagate();

    expect(component.erroDoCampoLote('resolucao')).toBe(
      'Resolução já cadastrada. Informe um identificador diferente.',
    );
    expect(component.drawerAberto()).toBe(true);
  });

  it('PesosEnemPage_DuplicidadeComSucessoParcial_NaoInstruiTrocarCampoTravado', async () => {
    // Regressão: quando 3 de 4 grupos são criados e o 4º retorna
    // par_ja_existe (ex.: uma tentativa anterior criou aquele grupo
    // silenciosamente e a resposta se perdeu), resolucao já está travada
    // pelo sucesso dos outros — pedir "informe um identificador diferente"
    // num campo desabilitado é uma instrução impossível de seguir. Nesse
    // caso o aviso vai só para o banner geral, sem pinar erro no campo.
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    component.pesoLoteForm.patchValue({ resolucao: 'Res. 900/2026', baseLegalGlobal: 'Res. 900/2026 Anexo I' });
    component.criarResolucao();
    await propagate();

    const requests = controller.match((r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`);
    expect(requests).toHaveLength(4);
    requests[0]?.flush('novo-id-0', { status: 201, statusText: 'Created' });
    requests[1]?.flush(
      problem(409, 'uniplus.configuracao.peso_area_enem.par_ja_existe', 'Já existe'),
      { status: 409, statusText: 'Conflict', headers: { 'content-type': 'application/problem+json' } },
    );
    requests[2]?.flush('novo-id-2', { status: 201, statusText: 'Created' });
    requests[3]?.flush('novo-id-3', { status: 201, statusText: 'Created' });
    await propagate();

    expect(component.pesoLoteForm.controls.resolucao.disabled).toBe(true);
    expect(component.erroDoCampoLote('resolucao')).toBeNull();
    expect(component.submitError()).toContain('já criados foram salvos');
    expect(component.drawerAberto()).toBe(true);
  });

  it('PesosEnemPage_SucessoParcialNaCriacao_TravaResolucaoContraMistura', async () => {
    // Regressão: se o usuário mudasse `resolucao` após um sucesso parcial, o
    // reenvio dos grupos pendentes criaria uma resolução distinta da dos
    // grupos já persistidos — misturando duas resoluções na mesma sessão.
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    component.pesoLoteForm.patchValue({ resolucao: 'Res. 900/2026', baseLegalGlobal: 'Res. 900/2026 Anexo I' });
    component.criarResolucao();
    await propagate();

    const requests = controller.match((r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`);
    expect(requests).toHaveLength(4);
    requests[0]?.flush('novo-id-0', { status: 201, statusText: 'Created' });
    requests[1]?.flush(
      problem(500, 'uniplus.erro_interno', 'Erro interno'),
      { status: 500, statusText: 'Internal Server Error', headers: { 'content-type': 'application/problem+json' } },
    );
    requests[2]?.flush('novo-id-2', { status: 201, statusText: 'Created' });
    requests[3]?.flush('novo-id-3', { status: 201, statusText: 'Created' });
    await propagate();

    expect(component.pesoLoteForm.controls.resolucao.disabled).toBe(true);

    component.abrirDrawerCriacao();
    expect(component.pesoLoteForm.controls.resolucao.disabled).toBe(false);
  });

  it('PesosEnemPage_BaseLegalGlobal_PrePreencheGruposPristine', async () => {
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    component.pesoLoteForm.controls.baseLegalGlobal.setValue('Res. 900/2026 Anexo I');
    await propagate();

    for (const grupo of component.pesoLoteForm.controls.grupos.controls) {
      expect(grupo.controls.baseLegal.value).toBe('Res. 900/2026 Anexo I');
    }
  });

  it('PesosEnemPage_BaseLegalGlobal_NaoPropagaParaGrupoJaCriado', async () => {
    // Regressão: grupo 'ok'/desabilitado não entra mais no
    // próximo POST — propagar o valor global faria o card "Criado" mostrar
    // uma base legal nunca enviada ao backend (a linha real fica com a
    // antiga).
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    component.pesoLoteForm.patchValue({ resolucao: 'Res. 900/2026', baseLegalGlobal: 'Base original' });
    component.criarResolucao();
    await propagate();

    const requests = controller.match((r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`);
    expect(requests).toHaveLength(4);
    requests[0]?.flush('novo-id-0', { status: 201, statusText: 'Created' });
    requests[1]?.flush(
      problem(422, 'PesoAreaEnem.PesoExcedeMaximo', 'Peso excede o máximo'),
      { status: 422, statusText: 'Unprocessable Entity', headers: { 'content-type': 'application/problem+json' } },
    );
    requests[2]?.flush('novo-id-2', { status: 201, statusText: 'Created' });
    requests[3]?.flush('novo-id-3', { status: 201, statusText: 'Created' });
    await propagate();

    component.pesoLoteForm.controls.baseLegalGlobal.setValue('Base corrigida');
    await propagate();

    expect(component.pesoLoteForm.controls.grupos.controls[0]?.controls.baseLegal.value).toBe('Base original');
    expect(component.pesoLoteForm.controls.grupos.controls[1]?.controls.baseLegal.value).toBe('Base corrigida');
  });

  // --- Inativação -------------------------------------------------------

  it('PesosEnemPage_ConfirmarInativacao_Remove4LinhasERecarrega', async () => {
    await carregarUmaPagina([...linhas805, ...linhas750]);
    component.pedirInativacao(RES_805);
    component.confirmarInativacao();
    await propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    for (const req of requests) {
      expect(req.request.method).toBe('DELETE');
      expect(req.request.headers.has('Idempotency-Key')).toBe(false);
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await propagate();

    expectListagem().flush([...linhas750]);
    await propagate();

    expect(component.resolucoes()).toEqual([RES_750]);
  });

  it('PesosEnemPage_InativarResolucaoEmEdicao_LimpaSessaoAntesDoReload', async () => {
    // Regressão: inativar a MESMA resolução que está em
    // edição deixa editandoResolucao()/editForm() presos aos ids antigos.
    // Como o identificador pode ser reaproveitado (§5.3), um novo cadastro
    // com o mesmo texto de resolução faria o panel novo renderizar "já em
    // edição" com o form antigo — e Salvar tentaria PUT em linhas que não
    // existem mais.
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();
    expect(component.editandoResolucao()).toBe(RES_805);

    component.pedirInativacao(RES_805);
    component.confirmarInativacao();
    await propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    for (const req of requests) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await propagate();

    expect(component.editandoResolucao()).toBeNull();
    expect(component.editForm()).toBeNull();

    expectListagem().flush([]);
    await propagate();
  });

  it('PesosEnemPage_InativacaoParcial_ExibeAvisoERecarrega', async () => {
    await carregarUmaPagina([...linhas805]);
    component.pedirInativacao(RES_805);
    component.confirmarInativacao();
    await propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    requests[0]?.flush(null, { status: 204, statusText: 'No Content' });
    requests[1]?.flush(null, { status: 204, statusText: 'No Content' });
    requests[2]?.flush(
      problem(404, 'PesoAreaEnem.NaoEncontrado', 'Não encontrado'),
      { status: 404, statusText: 'Not Found', headers: { 'content-type': 'application/problem+json' } },
    );
    requests[3]?.flush(
      problem(404, 'PesoAreaEnem.NaoEncontrado', 'Não encontrado'),
      { status: 404, statusText: 'Not Found', headers: { 'content-type': 'application/problem+json' } },
    );
    await propagate();

    expectListagem().flush([]);
    await propagate();
  });

  it('PesosEnemPage_ReuseAposInativacao_NaoBloqueiaNovaResolucao', async () => {
    // Simula que, após a resolução ter sido inativada (não está mais entre os
    // vivos retornados pela listagem), o mesmo identificador pode ser
    // reutilizado sem 409 — a página não faz checagem client-side de
    // duplicidade, apenas reflete o que o backend aceitar.
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    component.pesoLoteForm.patchValue({ resolucao: RES_805, baseLegalGlobal: 'Res. 805/2024 Anexo I' });
    component.criarResolucao();
    await propagate();

    const requests = controller.match((r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`);
    expect(requests).toHaveLength(4);
    requests.forEach((req, i) => req.flush(`novo-id-${i}`, { status: 201, statusText: 'Created' }));
    await propagate();

    expect(component.drawerAberto()).toBe(false);
    expectListagem().flush([...linhas805]);
    await propagate();
    expect(component.resolucoes()).toEqual([RES_805]);
  });

  it('PesosEnemPage_TrocarResolucaoEmEdicaoSuja_PedeConfirmacao', async () => {
    await carregarUmaPagina([...linhas805, ...linhas750]);
    component.clicarEditarParametros(RES_805);
    await propagate();
    areaDo(component.editForm()?.controls[0], 'LINGUAGENS').controls.peso.setValue(9);
    areaDo(component.editForm()?.controls[0], 'LINGUAGENS').controls.peso.markAsDirty();

    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    component.clicarEditarParametros(RES_750);
    await propagate();

    expect(confirmSpy).toHaveBeenCalled();
    expect(component.editandoResolucao()).toBe(RES_805);

    confirmSpy.mockReturnValue(true);
    component.clicarEditarParametros(RES_750);
    await propagate();
    expect(component.editandoResolucao()).toBe(RES_750);

    confirmSpy.mockRestore();
  });

  // --- Áreas vindas da API ------------------------------------------------

  it('PesosEnemPage_Colunas_VemDasAreasDaApiNaOrdemDela', async () => {
    await carregarUmaPagina([...linhas805]);

    const cabecalho = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.num-grid__header .num-cell--head'),
    ].map((celula) => celula.textContent?.trim());
    expect(cabecalho).toEqual(AREAS.map((area) => area.rotulo));
    expect((fixture.nativeElement.textContent as string)).not.toContain('Corte de redação');
  });

  it('PesosEnemPage_Colunas_NaoTemListaDeAreasNoCliente', async () => {
    // Com outra lista vinda da API, a tabela mostra exatamente essa lista:
    // nenhuma área é escrita no cliente.
    const duas: readonly AreaPesoAreaEnemDto[] = [
      { codigo: 'MATEMATICA', rotulo: 'Matemática e suas Tecnologias' },
      { codigo: 'REDACAO', rotulo: 'Redação' },
    ];
    await carregarUmaPagina([...linhas805], duas);

    const cabecalho = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.num-grid__header .num-cell--head'),
    ].map((celula) => celula.textContent?.trim());
    expect(cabecalho).toEqual(['Matemática e suas Tecnologias', 'Redação']);
  });

  it('PesosEnemPage_ModoLeitura_MostraCorteAbaixoDoPesoSoQuandoExiste', async () => {
    await carregarUmaPagina([...linhas805]);

    const cortes = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.pe-corte')].map(
      (el) => el.textContent?.trim(),
    );
    // Uma por grupo: só a Redação tem corte nas linhas de exemplo.
    expect(cortes).toEqual(['Corte: 400', 'Corte: 400', 'Corte: 400', 'Corte: 400']);
  });

  it('PesosEnemPage_Criar_EnviaAreasComCodigoPesoECorteSemRotulo', async () => {
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    component.pesoLoteForm.patchValue({ resolucao: 'Res. 900/2026', baseLegalGlobal: 'Res. 900/2026 Anexo I' });
    const grupo0 = component.pesoLoteForm.controls.grupos.controls[0];
    areaDo(grupo0, 'REDACAO').controls.corte.setValue(450);
    areaDo(grupo0, 'MATEMATICA').controls.peso.setValue(2.5);
    component.criarResolucao();
    await propagate();

    const requests = controller.match((r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`);
    expect(requests).toHaveLength(4);
    expect(requests[0]?.request.body).toEqual({
      resolucao: 'Res. 900/2026',
      grupoCurso: 'Tecnológica',
      areas: [
        { codigo: 'REDACAO', peso: 0, corte: 450 },
        { codigo: 'CIENCIAS_DA_NATUREZA', peso: 0, corte: null },
        { codigo: 'CIENCIAS_HUMANAS', peso: 0, corte: null },
        { codigo: 'LINGUAGENS', peso: 0, corte: null },
        { codigo: 'MATEMATICA', peso: 2.5, corte: null },
      ],
      baseLegal: 'Res. 900/2026 Anexo I',
    });
    requests.forEach((req, i) => req.flush(`novo-id-${i}`, { status: 201, statusText: 'Created' }));
    await propagate();
    expectListagem().flush([]);
    await propagate();
  });

  it('PesosEnemPage_CodigoERotulo_NaoSaoEditaveis', async () => {
    await carregarUmaPagina([...linhas805]);
    component.abrirDrawerCriacao();
    component.clicarEditarParametros(RES_805);
    await propagate();
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelectorAll('input[formcontrolname="codigo"]')).toHaveLength(0);
    expect(raiz.querySelectorAll('input[formcontrolname="peso"]').length).toBeGreaterThan(0);
    expect(raiz.querySelectorAll('input[formcontrolname="corte"]').length).toBeGreaterThan(0);
  });

  it('PesosEnemPage_ErroDoBackendPorArea_VaiAoCampoDaArea', async () => {
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();
    component.salvarEdicao();
    await propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    requests[0]?.flush(
      problem(422, 'uniplus.configuracao.peso_area_enem.corte_fora_da_redacao', 'Corte fora da Redação', [
        {
          field: 'areas[3].corte',
          code: 'uniplus.configuracao.peso_area_enem.corte_fora_da_redacao',
          message: 'Por enquanto só a Redação aceita corte; Linguagens e suas Tecnologias deve ficar sem corte.',
        },
        {
          field: 'areas[4].peso',
          code: 'uniplus.configuracao.peso_area_enem.peso_excede_maximo',
          message: 'O peso de Matemática e suas Tecnologias não pode exceder 99.99.',
        },
      ]),
      { status: 422, statusText: 'Unprocessable Entity', headers: { 'content-type': 'application/problem+json' } },
    );
    for (const req of requests.slice(1)) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await propagate();

    const grupo = component.editForm()?.controls[0];
    expect(component.erroDaArea(areaDo(grupo, 'LINGUAGENS'), 'corte')).toBe(
      'Por enquanto só a Redação aceita corte; Linguagens e suas Tecnologias deve ficar sem corte.',
    );
    expect(component.erroDaArea(areaDo(grupo, 'MATEMATICA'), 'peso')).toBe(
      'O peso de Matemática e suas Tecnologias não pode exceder 99.99.',
    );
    expect(component.erroDaArea(areaDo(grupo, 'REDACAO'), 'peso')).toBeNull();
  });

  it('PesosEnemPage_AreaFaltandoNoBackend_VaiAoPrimeiroPeso', async () => {
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    component.pesoLoteForm.patchValue({ resolucao: 'Res. 900/2026', baseLegalGlobal: 'Res. 900/2026 Anexo I' });
    component.criarResolucao();
    await propagate();

    const requests = controller.match((r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`);
    requests[0]?.flush(
      problem(422, 'uniplus.configuracao.peso_area_enem.area_faltando', 'Área faltando', [
        {
          field: 'areas',
          code: 'uniplus.configuracao.peso_area_enem.area_faltando',
          message: 'Informe o peso das cinco áreas; faltam: MATEMATICA.',
        },
      ]),
      { status: 422, statusText: 'Unprocessable Entity', headers: { 'content-type': 'application/problem+json' } },
    );
    requests.slice(1).forEach((req, i) => req.flush(`novo-id-${i}`, { status: 201, statusText: 'Created' }));
    await propagate();

    const grupo0 = component.pesoLoteForm.controls.grupos.controls[0];
    expect(component.erroDaArea(areaDo(grupo0, 'REDACAO'), 'peso')).toBe(
      'Informe o peso das cinco áreas; faltam: MATEMATICA.',
    );
  });

  it('PesosEnemPage_CamposTemRotuloAcessivelCompleto', async () => {
    await carregarUmaPagina([...linhas805]);
    const raiz = fixture.nativeElement as HTMLElement;

    // Modo leitura: label associado ao input nomeia área e grupo.
    const rotulos = [...raiz.querySelectorAll('label.sr-only')].map((l) => l.textContent?.trim());
    expect(rotulos).toContain('Peso de Matemática e suas Tecnologias — Tecnológica');

    // Drawer: o nome acessível começa pelo texto visível e acrescenta o grupo.
    component.abrirDrawerCriacao();
    await propagate();
    fixture.detectChanges();
    expect(
      raiz.querySelector('input[aria-label="Peso de Matemática e suas Tecnologias — Tecnológica"]'),
    ).not.toBeNull();
    const corteRedacao = raiz.querySelector<HTMLInputElement>(
      'input[aria-label="Corte de Redação — Saúde e Biológicas"]',
    );
    expect(corteRedacao).not.toBeNull();
    // A dica "Opcional" fica fora do nome acessível (o aria-label o substitui), então
    // é ligada ao campo como descrição.
    const dica = raiz.querySelector(`[id="${corteRedacao?.getAttribute('aria-describedby') ?? ''}"]`);
    expect(dica?.textContent?.trim()).toBe('Opcional — em branco, a área fica sem corte.');
  });

  it('PesosEnemPage_AreasPendentesComRegistrosCarregados_ExibeSkeleton', async () => {
    // Sem as áreas a tabela não é montada: enquanto elas não chegam, a tela
    // mostra o skeleton em vez de ficar em branco, mesmo com os registros já carregados.
    fixture.detectChanges();
    const areas = expectAreas();
    expectListagem().flush([...linhas805]);
    await propagate();
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelectorAll('ui-skeleton').length).toBeGreaterThan(0);

    areas.flush([...AREAS]);
    await propagate();
    fixture.detectChanges();
    expect(raiz.querySelectorAll('ui-skeleton')).toHaveLength(0);
  });

  it('PesosEnemPage_ModoLeitura_FormataCorteEmPtBr', async () => {
    const comCorteFracionado = linhas805.map((l) => ({
      ...l,
      areas: l.areas.map((area) => (area.codigo === 'REDACAO' ? { ...area, corte: 450.5 } : area)),
    }));
    await carregarUmaPagina(comCorteFracionado);

    const cortes = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.pe-corte')].map(
      (el) => el.textContent?.trim(),
    );
    expect(cortes).toEqual(['Corte: 450,5', 'Corte: 450,5', 'Corte: 450,5', 'Corte: 450,5']);
  });

  it('PesosEnemPage_ErroAoCarregarAreas_ExibeAlertaEBloqueiaCadastro', async () => {
    fixture.detectChanges();
    expectAreas().flush(
      problem(500, 'uniplus.erro_interno', 'Erro interno'),
      { status: 500, statusText: 'Internal Server Error', headers: { 'content-type': 'application/problem+json' } },
    );
    expectListagem().flush([]);
    await propagate();
    fixture.detectChanges();

    expect(component.erroAreas()).toBeTruthy();
    component.abrirDrawerCriacao();
    expect(component.drawerAberto()).toBe(false);

    const retry = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.cfg-pesos-enem__retry button')][0] as
      | HTMLButtonElement
      | undefined;
    expect(retry).toBeDefined();
    retry?.click();
    await propagate();
    expectAreas().flush([...AREAS]);
    await propagate();

    expect(component.erroAreas()).toBeNull();
    component.abrirDrawerCriacao();
    expect(component.drawerAberto()).toBe(true);
  });

  // --- Acessibilidade e validação dos campos numéricos --------------------

  /** Simula o navegador marcando o texto digitado como não numérico (`badInput`):
   *  o `value` fica vazio e o evento `input` dispara, como no navegador real. */
  function digitarNumeroInvalido(input: HTMLInputElement): void {
    Object.defineProperty(input, 'validity', {
      configurable: true,
      value: { ...input.validity, badInput: true, valid: false },
    });
    input.value = '';
    input.dispatchEvent(new Event('input'));
  }

  /** Texto inválido digitado e o operador sai do campo — quando o erro é acusado. */
  function digitarNumeroInvalidoESair(input: HTMLInputElement): void {
    digitarNumeroInvalido(input);
    input.dispatchEvent(new FocusEvent('blur'));
  }

  function inputDaEdicao(campo: 'peso' | 'corte', grupo: number, area: number): HTMLInputElement {
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      `#pe-res-805-2024-g${grupo}-a${area}-${campo}`,
    );
    if (!input) throw new Error(`input de ${campo} (g${grupo}, a${area}) ausente`);
    return input;
  }

  it('PesosEnemPage_EdicaoEmLinha_PesoECorteTemRotuloVisivel', async () => {
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    for (const campo of ['peso', 'corte'] as const) {
      const input = inputDaEdicao(campo, 0, 0);
      const rotulo = raiz.querySelector<HTMLLabelElement>(`label[for="${input.id}"]`);
      expect(rotulo).not.toBeNull();
      // Visível: o rótulo não é sr-only, e o texto fora do trecho sr-only é curto.
      expect(rotulo?.classList.contains('sr-only')).toBe(false);
      const visivel = [...(rotulo?.childNodes ?? [])]
        .filter((no) => no.nodeType === Node.TEXT_NODE)
        .map((no) => no.textContent?.trim())
        .join('');
      expect(visivel).toBe(campo === 'peso' ? 'Peso' : 'Corte');
      // O nome acessível completo continua o texto visível.
      expect(rotulo?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        `${campo === 'peso' ? 'Peso' : 'Corte'} de Redação — Tecnológica`,
      );
    }
  });

  it('PesosEnemPage_ModoLeitura_CorteDescreveOPeso', async () => {
    await carregarUmaPagina([...linhas805]);
    const raiz = fixture.nativeElement as HTMLElement;

    const pesoRedacao = raiz.querySelector<HTMLInputElement>('#pe-res-805-2024-g0-a0-leitura');
    const idDescricao = pesoRedacao?.getAttribute('aria-describedby') ?? '';
    expect(idDescricao).not.toBe('');
    expect(raiz.querySelector(`[id="${idDescricao}"]`)?.textContent?.trim()).toBe('Corte: 400');

    // Área sem corte não aponta descrição inexistente.
    const pesoMatematica = raiz.querySelector<HTMLInputElement>('#pe-res-805-2024-g0-a4-leitura');
    expect(pesoMatematica?.hasAttribute('aria-describedby')).toBe(false);
  });

  it('PesosEnemPage_EdicaoEmLinha_NumeroInvalidoNoCorteBloqueiaEnvio', async () => {
    // Sem a recusa, o texto não numérico virava null e o PUT apagava o corte sem aviso.
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();
    fixture.detectChanges();

    digitarNumeroInvalidoESair(inputDaEdicao('corte', 0, 0));
    fixture.detectChanges();

    const redacao = areaDo(component.editForm()?.controls[0], 'REDACAO');
    expect(component.erroDaArea(redacao, 'corte')).toBe('Número inválido.');

    component.salvarEdicao();
    await propagate();
    controller.expectNone((r) => r.url.includes('/admin/pesos-area-enem/'));
  });

  it('PesosEnemPage_Drawer_NumeroInvalidoNoPesoMostraErroProprio', async () => {
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    await propagate();
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    const input = raiz.querySelector<HTMLInputElement>(
      'input[aria-label="Peso de Matemática e suas Tecnologias — Tecnológica"]',
    );
    if (!input) throw new Error('campo de peso ausente');
    digitarNumeroInvalidoESair(input);
    fixture.detectChanges();

    const matematica = areaDo(component.pesoLoteForm.controls.grupos.controls[0], 'MATEMATICA');
    expect(component.erroDaArea(matematica, 'peso')).toBe('Número inválido.');
  });

  it('PesosEnemPage_CasasDecimaisAlemDoGravado_SaoRecusadas', async () => {
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();

    const grupo = component.editForm()?.controls[0];
    const matematica = areaDo(grupo, 'MATEMATICA');
    matematica.controls.peso.setValue(1.125);
    matematica.controls.peso.markAsTouched();
    expect(component.erroDaArea(matematica, 'peso')).toBe('O peso aceita no máximo 2 casas decimais.');

    const redacao = areaDo(grupo, 'REDACAO');
    redacao.controls.corte.setValue(400.1234);
    redacao.controls.corte.markAsTouched();
    expect(component.erroDaArea(redacao, 'corte')).toBe('O corte aceita no máximo 3 casas decimais.');

    component.salvarEdicao();
    await propagate();
    controller.expectNone((r) => r.url.includes('/admin/pesos-area-enem/'));

    // No limite do que a coluna guarda, o valor é aceito.
    matematica.controls.peso.setValue(1.25);
    redacao.controls.corte.setValue(400.125);
    expect(matematica.controls.peso.valid).toBe(true);
    expect(redacao.controls.corte.valid).toBe(true);
  });

  it('PesosEnemPage_ListaDeAreasVazia_TrataComoFalhaDeCarregamento', async () => {
    await carregarUmaPagina([], []);

    expect(component.erroAreas()).toBeTruthy();
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('ui-empty-state')).toBeNull();
    expect(raiz.querySelector('.cfg-pesos-enem__retry button')).not.toBeNull();
  });

  it('PesosEnemPage_AbrirEdicao_FocaOPrimeiroCampoEditavel', async () => {
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();
    fixture.detectChanges();
    await propagate();

    const focado = document.activeElement as HTMLInputElement | null;
    expect(focado?.id).toBe('pe-res-805-2024-g0-a0-peso');
    expect(focado?.readOnly).toBe(false);
  });

  it('PesosEnemPage_ErroDoBackendComPrefixoOuMaiuscula_VaiAoCampoCerto', async () => {
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();
    component.salvarEdicao();
    await propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    requests[0]?.flush(
      problem(422, 'uniplus.configuracao.peso_area_enem.corte_fora_da_redacao', 'Recusa', [
        { field: 'request.Areas[3].corte', code: 'c1', message: 'Erro no corte de Linguagens.' },
        { field: '$.areas[2]', code: 'c2', message: 'Erro no item de Ciências Humanas.' },
        { field: 'Areas[4].Peso', code: 'c3', message: 'Erro no peso de Matemática.' },
      ]),
      { status: 422, statusText: 'Unprocessable Entity', headers: { 'content-type': 'application/problem+json' } },
    );
    for (const req of requests.slice(1)) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await propagate();

    const grupo = component.editForm()?.controls[0];
    expect(component.erroDaArea(areaDo(grupo, 'LINGUAGENS'), 'corte')).toBe('Erro no corte de Linguagens.');
    expect(component.erroDaArea(areaDo(grupo, 'CIENCIAS_HUMANAS'), 'peso')).toBe(
      'Erro no item de Ciências Humanas.',
    );
    expect(component.erroDaArea(areaDo(grupo, 'MATEMATICA'), 'peso')).toBe('Erro no peso de Matemática.');
  });

  it('PesosEnemPage_VariosErrosNoMesmoCampo_MostraTodos', async () => {
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();
    component.salvarEdicao();
    await propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    requests[0]?.flush(
      problem(422, 'uniplus.configuracao.peso_area_enem.area_fora_do_dominio', 'Recusa', [
        { field: 'areas[0].codigo', code: 'c1', message: 'Área fora do Peso por Área.' },
        { field: 'areas[0].peso', code: 'c2', message: 'O peso não pode ser negativo.' },
        { field: 'areas', code: 'c3', message: 'Faltam áreas: MATEMATICA.' },
      ]),
      { status: 422, statusText: 'Unprocessable Entity', headers: { 'content-type': 'application/problem+json' } },
    );
    for (const req of requests.slice(1)) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await propagate();

    const erro = component.erroDaArea(areaDo(component.editForm()?.controls[0], 'REDACAO'), 'peso');
    expect(erro).toContain('Área fora do Peso por Área.');
    expect(erro).toContain('O peso não pode ser negativo.');
    expect(erro).toContain('Faltam áreas: MATEMATICA.');
  });

  // --- Erro do backend preservado, destino corrigível e descrição acessível ---

  function recusa422(req: TestRequest | undefined, errors: readonly { field: string; code: string; message: string }[]): void {
    req?.flush(
      problem(422, errors[0]?.code ?? 'uniplus.recusa', 'Recusa', errors),
      { status: 422, statusText: 'Unprocessable Entity', headers: { 'content-type': 'application/problem+json' } },
    );
  }

  it('PesosEnemPage_SairDoCampoComTab_NaoApagaOErroDoBackend', async () => {
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();
    component.salvarEdicao();
    await propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    recusa422(requests[0], [
      {
        field: 'areas[3].corte',
        code: 'uniplus.configuracao.peso_area_enem.corte_fora_da_redacao',
        message: 'Por enquanto só a Redação aceita corte.',
      },
    ]);
    for (const req of requests.slice(1)) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await propagate();
    fixture.detectChanges();

    inputDaEdicao('corte', 0, 3).dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();

    const linguagens = areaDo(component.editForm()?.controls[0], 'LINGUAGENS');
    expect(component.erroDaArea(linguagens, 'corte')).toBe('Por enquanto só a Redação aceita corte.');
    expect(component.editForm()?.invalid).toBe(true);
  });

  it('PesosEnemPage_ErroDeBaseLegalNaEdicaoEmLinha_VaiAoBannerSemTravarCampo', async () => {
    // A edição em linha não mostra nem edita a base legal: o erro dela não pode ficar
    // num controle escondido (trava o formulário sem mensagem) nem num campo que não é
    // o dele (o operador mexeria no lugar errado e reenviaria o mesmo pedido).
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();
    component.salvarEdicao();
    await propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    recusa422(requests[0], [
      {
        field: 'baseLegal',
        code: 'uniplus.configuracao.peso_area_enem.base_legal_tamanho',
        message: 'Base legal deve ter no máximo 500 caracteres.',
      },
    ]);
    for (const req of requests.slice(1)) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await propagate();

    const grupo = component.editForm()?.controls[0];
    if (!grupo) throw new Error('form de edição não inicializado');
    expect(component.editErro()).toContain('Tecnológica: Base legal deve ter no máximo 500 caracteres.');
    expect(grupo.controls.baseLegal.errors).toBeNull();
    expect(component.erroDaArea(areaDo(grupo, 'REDACAO'), 'peso')).toBeNull();
    expect(component.editForm()?.invalid).toBe(false);

    // O operador pode desistir da edição.
    component.cancelarEdicao();
    expect(component.editandoResolucao()).toBeNull();
  });

  it('PesosEnemPage_Drawer_ErroDoCampoEntraNaDescricaoDoInput', async () => {
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    component.pesoLoteForm.patchValue({ resolucao: 'Res. 900/2026', baseLegalGlobal: 'Res. 900/2026 Anexo I' });
    component.criarResolucao();
    await propagate();

    const requests = controller.match((r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`);
    recusa422(requests[0], [
      { field: 'areas[4].peso', code: 'c1', message: 'O peso de Matemática excede o máximo.' },
      { field: 'areas[0].corte', code: 'c2', message: 'O corte de Redação excede o máximo.' },
    ]);
    requests.slice(1).forEach((req, i) => req.flush(`novo-id-${i}`, { status: 201, statusText: 'Created' }));
    await propagate();
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    const descricao = (input: HTMLInputElement | null): string =>
      (input?.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => raiz.querySelector(`[id="${id}"]`)?.textContent?.trim() ?? '')
        .join(' | ');

    const peso = raiz.querySelector<HTMLInputElement>(
      'input[aria-label="Peso de Matemática e suas Tecnologias — Tecnológica"]',
    );
    expect(descricao(peso)).toBe('O peso de Matemática excede o máximo.');

    const corte = raiz.querySelector<HTMLInputElement>('input[aria-label="Corte de Redação — Tecnológica"]');
    expect(descricao(corte)).toBe(
      'Opcional — em branco, a área fica sem corte. | O corte de Redação excede o máximo.',
    );

    // Sem erro, só a dica descreve o corte, e o peso não tem descrição.
    const pesoSemErro = raiz.querySelector<HTMLInputElement>(
      'input[aria-label="Peso de Redação — Tecnológica"]',
    );
    expect(pesoSemErro?.hasAttribute('aria-describedby')).toBe(false);
  });

  it('PesosEnemPage_FormatacaoDoCorte_NaoCriaFormatadorPorCelula', async () => {
    // O formatador é criado uma vez, no módulo: montar as células não constrói outro
    // Intl.NumberFormat nem usa o toLocaleString, que cria um a cada chamada.
    const construtor = vi.spyOn(Intl, 'NumberFormat');
    const toLocaleString = vi.spyOn(Number.prototype, 'toLocaleString');
    try {
      const comCorteFracionado = linhas805.map((l) => ({
        ...l,
        areas: l.areas.map((area) => (area.codigo === 'REDACAO' ? { ...area, corte: 450.5 } : area)),
      }));
      await carregarUmaPagina(comCorteFracionado);

      expect(construtor).not.toHaveBeenCalled();
      expect(toLocaleString).not.toHaveBeenCalled();
      const cortes = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.pe-corte')].map(
        (el) => el.textContent?.trim(),
      );
      expect(cortes).toEqual(['Corte: 450,5', 'Corte: 450,5', 'Corte: 450,5', 'Corte: 450,5']);
    } finally {
      construtor.mockRestore();
      toLocaleString.mockRestore();
    }
  });

  // --- Destino dos erros no drawer, foco estável e custo por célula --------

  it('PesosEnemPage_Drawer_ErroDeResolucaoVaiAoCampoDaResolucaoEDestravaReenvio', async () => {
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    component.pesoLoteForm.patchValue({ resolucao: 'Res', baseLegalGlobal: 'Res. 900/2026 Anexo I' });
    component.criarResolucao();
    await propagate();

    const requests = controller.match((r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`);
    expect(requests).toHaveLength(4);
    for (const req of requests) {
      recusa422(req, [
        {
          field: 'resolucao',
          code: 'uniplus.configuracao.peso_area_enem.resolucao_tamanho',
          message: 'Resolução deve ter entre 5 e 40 caracteres.',
        },
      ]);
    }
    await propagate();

    expect(component.erroDoCampoLote('resolucao')).toBe('Resolução deve ter entre 5 e 40 caracteres.');
    const redacao = areaDo(component.pesoLoteForm.controls.grupos.controls[0], 'REDACAO');
    expect(component.erroDaArea(redacao, 'peso')).toBeNull();

    // Corrigir a resolução limpa o erro, e o reenvio volta a sair.
    component.pesoLoteForm.controls.resolucao.setValue('Res. 900/2026');
    component.criarResolucao();
    await propagate();
    const reenvio = controller.match((r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`);
    expect(reenvio).toHaveLength(4);
    reenvio.forEach((req, i) => req.flush(`novo-id-${i}`, { status: 201, statusText: 'Created' }));
    await propagate();
    expectListagem().flush([]);
    await propagate();
  });

  it('PesosEnemPage_Drawer_ErroDeGrupoQueNaoSeEditaVaiAoBanner', async () => {
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    component.pesoLoteForm.patchValue({ resolucao: 'Res. 900/2026', baseLegalGlobal: 'Res. 900/2026 Anexo I' });
    component.criarResolucao();
    await propagate();

    const requests = controller.match((r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`);
    for (const req of requests) {
      recusa422(req, [{ field: 'grupoCurso', code: 'c1', message: 'Grupo fora do domínio.' }]);
    }
    await propagate();

    expect(component.submitError()).toContain('Tecnológica: Grupo fora do domínio.');
    const redacao = areaDo(component.pesoLoteForm.controls.grupos.controls[0], 'REDACAO');
    expect(component.erroDaArea(redacao, 'peso')).toBeNull();
  });

  it('PesosEnemPage_TentarDeNovoAsAreas_MantemOFocoEmPontoEstavel', async () => {
    fixture.detectChanges();
    expectAreas().flush(
      problem(500, 'uniplus.erro_interno', 'Erro interno'),
      { status: 500, statusText: 'Internal Server Error', headers: { 'content-type': 'application/problem+json' } },
    );
    expectListagem().flush([]);
    await propagate();
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    const botao = raiz.querySelector<HTMLButtonElement>('#cfg-pesos-enem-areas-tentar');
    if (!botao) throw new Error('botão de tentar de novo ausente');
    botao.focus();
    botao.click();
    await propagate();
    fixture.detectChanges();

    // Enquanto recarrega, o botão continua na tela e com o foco.
    expect(document.activeElement?.id).toBe('cfg-pesos-enem-areas-tentar');
    expect(raiz.querySelector('#cfg-pesos-enem-areas-tentar')?.getAttribute('aria-disabled')).toBe('true');

    // Carregou: o alerta sai, e o foco vai ao título da página, não ao body.
    expectAreas().flush([...AREAS]);
    await propagate();
    fixture.detectChanges();
    await propagate();
    expect(raiz.querySelector('#cfg-pesos-enem-areas-tentar')).toBeNull();
    expect(document.activeElement?.id).toBe('cfg-pesos-enem-titulo');
  });

  it('PesosEnemPage_EdicaoEmLinha_CalculaErroDeCadaCampoUmaVezPorPassada', async () => {
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();
    fixture.detectChanges();

    const alvo = component as unknown as {
      erroDaArea: (...args: unknown[]) => unknown;
      idCampo: (...args: unknown[]) => unknown;
    };
    const erroDaArea = vi.spyOn(alvo, 'erroDaArea');
    const idCampo = vi.spyOn(alvo, 'idCampo');
    try {
      const campos = (fixture.nativeElement as HTMLElement).querySelectorAll(
        'input[formcontrolname="peso"], input[formcontrolname="corte"]',
      ).length;
      expect(campos).toBe(40);

      // Marca a view do próprio componente (OnPush) e roda uma passada, sem a
      // conferência extra de modo de desenvolvimento.
      fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck();
      fixture.detectChanges(false);

      // Uma avaliação por campo (peso e corte de cada área, em cada grupo) por passada.
      expect(erroDaArea).toHaveBeenCalledTimes(campos);
      expect(idCampo).toHaveBeenCalledTimes(campos);
    } finally {
      erroDaArea.mockRestore();
      idCampo.mockRestore();
    }
  });

  // --- Banner das recusas sem campo, foco depois de salvar e digitação -----

  it('PesosEnemPage_DigitandoSeparadorDecimal_NaoAcusaAteSairDoCampo', async () => {
    // "2," e "2." são estados intermediários com badInput no navegador: acusá-los
    // durante a digitação dispararia o alerta a cada separador digitado.
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();
    fixture.detectChanges();

    const input = inputDaEdicao('corte', 0, 0);
    const redacao = areaDo(component.editForm()?.controls[0], 'REDACAO');
    digitarNumeroInvalido(input);
    fixture.detectChanges();
    expect(component.erroDaArea(redacao, 'corte')).toBeNull();
    expect(input.parentElement?.querySelector('.field__error')).toBeNull();

    // Ao sair do campo com o texto ainda inválido, o erro aparece.
    input.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
    expect(component.erroDaArea(redacao, 'corte')).toBe('Número inválido.');

    // Voltar a digitar tira o alerta até o operador terminar de novo.
    digitarNumeroInvalido(input);
    fixture.detectChanges();
    expect(component.erroDaArea(redacao, 'corte')).toBeNull();
  });

  it('PesosEnemPage_Drawer_EnterComTextoInvalido_AcusaAntesDeEnviar', async () => {
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    await propagate();
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    const input = raiz.querySelector<HTMLInputElement>('input[aria-label="Corte de Redação — Tecnológica"]');
    if (!input) throw new Error('campo de corte ausente');
    digitarNumeroInvalido(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    const redacao = areaDo(component.pesoLoteForm.controls.grupos.controls[0], 'REDACAO');
    expect(component.erroDaArea(redacao, 'corte')).toBe('Número inválido.');
  });

  it('PesosEnemPage_Drawer_DuplicidadeSemGrupoCriado_MostraMensagensSemCampoDosOutros', async () => {
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    component.pesoLoteForm.patchValue({ resolucao: 'Res. 900/2026', baseLegalGlobal: 'Res. 900/2026 Anexo I' });
    component.criarResolucao();
    await propagate();

    const requests = controller.match((r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`);
    expect(requests).toHaveLength(4);
    requests[0]?.flush(
      problem(409, 'uniplus.configuracao.peso_area_enem.par_ja_existe', 'Já existe'),
      { status: 409, statusText: 'Conflict', headers: { 'content-type': 'application/problem+json' } },
    );
    for (const req of requests.slice(1)) {
      recusa422(req, [{ field: 'grupoCurso', code: 'c1', message: 'Grupo fora do domínio.' }]);
    }
    await propagate();

    expect(component.erroDoCampoLote('resolucao')).toBe(
      'Resolução já cadastrada. Informe um identificador diferente.',
    );
    expect(component.submitError()).toContain('Humanística I: Grupo fora do domínio.');
    expect(component.submitError()).toContain('Saúde e Biológicas: Grupo fora do domínio.');
  });

  it('PesosEnemPage_SalvarComSucesso_DevolveOFocoAoBotaoDeEditar', async () => {
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();
    fixture.detectChanges();
    component.salvarEdicao();
    await propagate();
    fixture.detectChanges();

    const requests = [0, 1, 2, 3].map((i) =>
      controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    for (const req of requests) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await propagate();
    fixture.detectChanges();
    await propagate();

    expect(component.editandoResolucao()).toBeNull();
    expect(document.activeElement?.id).toBe('pe-editar-res-805-2024');
  });

  it('PesosEnemPage_RecusaSemErrorsNaEdicao_VaiAoBannerSemMarcarCampo', async () => {
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();
    component.salvarEdicao();
    await propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    const naoEncontrado = JSON.parse(
      problem(404, 'uniplus.configuracao.peso_area_enem.nao_encontrado', 'Linha de pesos não encontrada'),
    ) as Parameters<ProblemI18nService['resolve']>[0];
    requests[0]?.flush(JSON.stringify(naoEncontrado), {
      status: 404,
      statusText: 'Not Found',
      headers: { 'content-type': 'application/problem+json' },
    });
    for (const req of requests.slice(1)) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await propagate();

    const titulo = TestBed.inject(ProblemI18nService).resolve(naoEncontrado).title;
    expect(component.editErro()).toContain(titulo);
    const grupo = component.editForm()?.controls[0];
    expect(component.erroDaArea(areaDo(grupo, 'REDACAO'), 'peso')).toBeNull();
    expect(component.editForm()?.invalid).toBe(false);
  });

  it('PesosEnemPage_RecusaSemErrorsNaCriacao_VaiAoBannerSemMarcarCampo', async () => {
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    component.pesoLoteForm.patchValue({ resolucao: 'Res. 900/2026', baseLegalGlobal: 'Res. 900/2026 Anexo I' });
    component.criarResolucao();
    await propagate();

    const requests = controller.match((r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`);
    const conflito = JSON.parse(
      problem(409, 'uniplus.concorrencia.conflito', 'Conflito de concorrência'),
    ) as Parameters<ProblemI18nService['resolve']>[0];
    requests[0]?.flush(JSON.stringify(conflito), {
      status: 409,
      statusText: 'Conflict',
      headers: { 'content-type': 'application/problem+json' },
    });
    requests.slice(1).forEach((req, i) => req.flush(`novo-id-${i}`, { status: 201, statusText: 'Created' }));
    await propagate();

    const titulo = TestBed.inject(ProblemI18nService).resolve(conflito).title;
    expect(component.submitError()).toContain(titulo);
    const redacao = areaDo(component.pesoLoteForm.controls.grupos.controls[0], 'REDACAO');
    expect(component.erroDaArea(redacao, 'peso')).toBeNull();
  });

  // --- Anúncio das recusas, digitação no peso e chave depois de recusa -----

  it('PesosEnemPage_RecusaSemCampoNaEdicao_BannerEhRegiaoViva', async () => {
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();
    component.salvarEdicao();
    await propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    requests[0]?.flush(
      problem(404, 'uniplus.configuracao.peso_area_enem.nao_encontrado', 'Linha de pesos não encontrada'),
      { status: 404, statusText: 'Not Found', headers: { 'content-type': 'application/problem+json' } },
    );
    for (const req of requests.slice(1)) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await propagate();
    fixture.detectChanges();

    const banner = (fixture.nativeElement as HTMLElement).querySelector('#grid-pe-bar .alert');
    expect(banner?.getAttribute('role')).toBe('alert');
    expect(banner?.textContent).toContain(component.editErro() ?? '<sem mensagem>');
  });

  it('PesosEnemPage_EdicaoEmLinha_DigitandoSeparadorNoPeso_NaoAcusaNada', async () => {
    // No peso (obrigatório), o texto incompleto vira valor vazio: sem a chave
    // silenciosa, "Campo obrigatório." apareceria a cada separador digitado.
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();
    fixture.detectChanges();

    const input = inputDaEdicao('peso', 0, 4);
    const matematica = areaDo(component.editForm()?.controls[0], 'MATEMATICA');
    digitarNumeroInvalido(input);
    fixture.detectChanges();
    expect(component.erroDaArea(matematica, 'peso')).toBeNull();
    expect(input.parentElement?.querySelector('.field__error')).toBeNull();
    expect(matematica.controls.peso.invalid).toBe(true);

    input.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
    expect(component.erroDaArea(matematica, 'peso')).toBe('Número inválido.');
  });

  it('PesosEnemPage_Drawer_DigitandoSeparadorNoPeso_NaoAcusaNada', async () => {
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    await propagate();
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    const input = raiz.querySelector<HTMLInputElement>(
      'input[aria-label="Peso de Matemática e suas Tecnologias — Tecnológica"]',
    );
    if (!input) throw new Error('campo de peso ausente');
    const matematica = areaDo(component.pesoLoteForm.controls.grupos.controls[0], 'MATEMATICA');
    digitarNumeroInvalido(input);
    fixture.detectChanges();
    expect(component.erroDaArea(matematica, 'peso')).toBeNull();

    input.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
    expect(component.erroDaArea(matematica, 'peso')).toBe('Número inválido.');
  });

  it('PesosEnemPage_EdicaoEmLinha_RecusaDefinitivaSemErrors_ReenvioIgualSaiComChaveNova', async () => {
    // A API guarda a recusa 4xx: reenviar o mesmo corpo com a mesma chave devolveria
    // a mesma recusa, mesmo depois de a causa externa ter sido resolvida.
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();
    component.salvarEdicao();
    await propagate();

    const requests = [0, 1, 2, 3].map((i) =>
      controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[i]?.id}`),
    );
    const chaveOriginal = requests[0]?.request.headers.get('Idempotency-Key');
    requests[0]?.flush(
      problem(403, 'uniplus.autorizacao.sem_permissao', 'Sem permissão'),
      { status: 403, statusText: 'Forbidden', headers: { 'content-type': 'application/problem+json' } },
    );
    for (const req of requests.slice(1)) {
      req.flush(null, { status: 204, statusText: 'No Content' });
    }
    await propagate();

    component.salvarEdicao();
    await propagate();
    const retry = controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[0]?.id}`);
    expect(retry.request.headers.get('Idempotency-Key')).not.toBe(chaveOriginal);
    retry.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
  });

  it('PesosEnemPage_Criacao_RecusaDefinitivaSemErrors_ReenvioIgualSaiComChaveNova', async () => {
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    component.pesoLoteForm.patchValue({ resolucao: 'Res. 900/2026', baseLegalGlobal: 'Res. 900/2026 Anexo I' });
    component.criarResolucao();
    await propagate();

    const requests = controller.match((r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`);
    const chaveOriginal = requests[0]?.request.headers.get('Idempotency-Key');
    requests[0]?.flush(
      problem(422, 'uniplus.configuracao.peso_area_enem.regra_qualquer', 'Recusa'),
      { status: 422, statusText: 'Unprocessable Entity', headers: { 'content-type': 'application/problem+json' } },
    );
    requests.slice(1).forEach((req, i) => req.flush(`novo-id-${i}`, { status: 201, statusText: 'Created' }));
    await propagate();

    component.criarResolucao();
    await propagate();
    const retry = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`);
    expect(retry.request.headers.get('Idempotency-Key')).not.toBe(chaveOriginal);
    retry.flush('novo-id-0', { status: 201, statusText: 'Created' });
    await propagate();
    expectListagem().flush([]);
    await propagate();
  });

  it('PesosEnemPage_Drawer_CampoDePrimeiroNivelComPrefixoEMaiuscula_VaiAoCampoCerto', async () => {
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    component.pesoLoteForm.patchValue({ resolucao: 'Res', baseLegalGlobal: 'Base' });
    component.criarResolucao();
    await propagate();

    const requests = controller.match((r) => r.url === `${BASE}/api/configuracao/admin/pesos-area-enem`);
    recusa422(requests[0], [
      { field: 'Request.Resolucao', code: 'c1', message: 'Resolução curta demais.' },
      { field: '$.BaseLegal', code: 'c2', message: 'Base legal curta demais.' },
    ]);
    for (const req of requests.slice(1)) {
      recusa422(req, [{ field: 'Request.Resolucao', code: 'c1', message: 'Resolução curta demais.' }]);
    }
    await propagate();

    expect(component.erroDoCampoLote('resolucao')).toBe('Resolução curta demais.');
    expect(component.erroDoCampoGrupo(0, 'baseLegal')).toBe('Base legal curta demais.');
    expect(component.submitError()).not.toContain('curta demais');
  });
});
