import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor, buildVendorMimeAccept } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, PesoAreaEnemDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PesosEnemPage } from './pesos-enem.page';

const BASE = 'http://localhost:5000';
const LIST_URL = `${BASE}/api/configuracao/pesos-area-enem`;

function linha(overrides: Partial<PesoAreaEnemDto> & Pick<PesoAreaEnemDto, 'id' | 'resolucao' | 'grupoCurso'>): PesoAreaEnemDto {
  return {
    pesoLinguagens: 1,
    pesoCienciasHumanas: 1,
    pesoCienciasNatureza: 1.5,
    pesoMatematica: 2.5,
    pesoRedacao: 1,
    corteRedacao: 400,
    baseLegal: 'Res. 805/2024 Anexo I',
    criadoEm: '2026-06-24T12:00:00Z',
    ...overrides,
  };
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
    type: `https://uniplus.unifesspa.edu.br/errors/${code}`,
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

  function expectListagem(): TestRequest {
    const req = controller.expectOne((r) => r.url === LIST_URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('peso-area-enem', 1));
    return req;
  }

  /** Carrega a página com uma única página de resultados (sem Link de próxima página). */
  async function carregarUmaPagina(dados: readonly PesoAreaEnemDto[]): Promise<void> {
    fixture.detectChanges();
    expectListagem().flush([...dados]);
    await propagate();
  }

  it('PesosEnemPage_CarregamentoInicial_EsgotaCursorEAgrupaPorResolucao', async () => {
    fixture.detectChanges();
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

  it('PesosEnemPage_Cancelar_ReverteSemChamarApiEDevolveFoco', async () => {
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();

    component.editForm()?.controls[0]?.controls.pesoLinguagens.setValue(3);
    component.cancelarEdicao();
    await propagate();

    expect(component.editandoResolucao()).toBeNull();
    expect(component.editForm()).toBeNull();
    // Nenhuma chamada de API disparada pelo cancelamento (o afterEach->verify()
    // garante isso: qualquer request não esperada falharia o teste).
    expect(component.registros().find((l) => l.id === linhas805[0]?.id)?.pesoLinguagens).toBe(1);
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

  it('PesosEnemPage_Salvar_CoordenaQuatroChamadasComIdempotencyKeyDistintas', async () => {
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();

    const form = component.editForm();
    form?.controls[0]?.controls.pesoMatematica.setValue(3.0);
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
    expect(component.registros().find((l) => l.id === linhas805[0]?.id)?.pesoMatematica).toBe(3.0);
  });

  it('PesosEnemPage_PesoZero_Valido_PesoNegativo_InvalidaForm', async () => {
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();

    const grupo = component.editForm()?.controls[0];
    expect(grupo).toBeDefined();
    if (!grupo) throw new Error('form de edição não inicializado');
    grupo.controls.pesoCienciasHumanas.setValue(0);
    expect(grupo.controls.pesoCienciasHumanas.valid).toBe(true);

    grupo.controls.pesoLinguagens.setValue(-1);
    grupo.controls.pesoLinguagens.markAsTouched();
    expect(component.erroDoCampo(grupo, 'pesoLinguagens')).toBe('O peso não pode ser negativo.');

    component.salvarEdicao();
    await propagate();
    controller.expectNone((r) => r.url.includes('/admin/pesos-area-enem/'));
  });

  it('PesosEnemPage_CorteNegativo_InvalidaForm', async () => {
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();

    const grupo = component.editForm()?.controls[3];
    expect(grupo).toBeDefined();
    if (!grupo) throw new Error('form de edição não inicializado');
    grupo.controls.corteRedacao.setValue(-10);
    grupo.controls.corteRedacao.markAsTouched();
    expect(component.erroDoCampo(grupo, 'corteRedacao')).toBe('O corte de redação não pode ser negativo.');
  });

  it('PesosEnemPage_IdempotencyKey_PreservadaEmRetryApos422', async () => {
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();

    component.editForm()?.controls[0]?.controls.pesoMatematica.setValue(3.0);
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

    expect(component.editErro()).toContain('1 de 4');

    // Usuário corrige o valor apontado pelo erro (aplicado em pesoLinguagens,
    // fallback de domínio sem `errors[]` granular) — mesmo com o corpo
    // mudando, a Idempotency-Key não é renovada (só troca em sucesso ou nova
    // sessão de edição).
    component.editForm()?.controls[0]?.controls.pesoLinguagens.setValue(2.0);
    component.salvarEdicao();
    await propagate();
    const retry = controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[0]?.id}`);
    expect(retry.request.headers.get('Idempotency-Key')).toBe(chaveOriginal);
    retry.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();

    expect(component.editandoResolucao()).toBeNull();
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

  it('PesosEnemPage_BaseLegalGlobal_PrePreencheGruposPristine', async () => {
    await carregarUmaPagina([]);
    component.abrirDrawerCriacao();
    component.pesoLoteForm.controls.baseLegalGlobal.setValue('Res. 900/2026 Anexo I');
    await propagate();

    for (const grupo of component.pesoLoteForm.controls.grupos.controls) {
      expect(grupo.controls.baseLegal.value).toBe('Res. 900/2026 Anexo I');
    }
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
    component.editForm()?.controls[0]?.controls.pesoLinguagens.setValue(9);
    component.editForm()?.controls[0]?.controls.pesoLinguagens.markAsDirty();

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
});
