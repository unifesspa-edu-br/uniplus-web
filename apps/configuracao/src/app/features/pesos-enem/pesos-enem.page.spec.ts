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

  it('PesosEnemPage_CorteRedacaoVazioNaEdicao_InvalidaFormEBloqueiaSubmit', async () => {
    // Regressão: `AtualizarPesoAreaEnemCommand.corteRedacao`
    // não é opcional no schema — limpar o input não pode resultar em `null`
    // enviado ao backend silenciosamente (min/max ignoram valor vazio).
    await carregarUmaPagina([...linhas805]);
    component.clicarEditarParametros(RES_805);
    await propagate();

    const grupo = component.editForm()?.controls[0];
    expect(grupo).toBeDefined();
    if (!grupo) throw new Error('form de edição não inicializado');
    grupo.controls.corteRedacao.setValue(null as unknown as number);
    grupo.controls.corteRedacao.markAsTouched();

    expect(grupo.controls.corteRedacao.valid).toBe(false);
    expect(component.erroDoCampo(grupo, 'corteRedacao')).toBe('Campo obrigatório.');

    component.salvarEdicao();
    await propagate();
    controller.expectNone((r) => r.url.includes('/admin/pesos-area-enem/'));
  });

  it('PesosEnemPage_IdempotencyKey_PreservadaEmRetryComMesmoCorpo', async () => {
    // Um retry idêntico (corpo inalterado) reusa a mesma key — cobre o
    // caso de falha transitória (rede/5xx) e de retry sem correção alguma.
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

    // Usuário corrige o valor apontado pelo erro antes de reenviar.
    component.editForm()?.controls[0]?.controls.pesoLinguagens.setValue(2.0);
    component.salvarEdicao();
    await propagate();
    const retry = controller.expectOne(`${BASE}/api/configuracao/admin/pesos-area-enem/${linhas805[0]?.id}`);
    expect(retry.request.headers.get('Idempotency-Key')).not.toBe(chaveOriginal);
    retry.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();

    expect(component.editandoResolucao()).toBeNull();
  });

  it('PesosEnemPage_FalhaTransitoria_NaoTravaFormNemImpedeRetryImediato', async () => {
    // Regressão: status 0/5xx é transitório — não pode
    // pinar um erro sintético em pesoLinguagens que invalida o form e
    // bloqueia o retry até o usuário editar algum campo só para limpá-lo.
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
    expect(grupoFalho?.controls.pesoLinguagens.errors).toBeNull();
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
    // gravada em `registros` como se estivesse persistida (ver revisão do PR).
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

    component.editForm()?.controls[0]?.controls.pesoMatematica.setValue(3.0);
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
    expect(component.registros().find((l) => l.id === linhas805[0]?.id)?.pesoMatematica).toBe(3.0);
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

    component.editForm()?.controls[0]?.controls.pesoMatematica.setValue(3.0);
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
    expect(component.registros().find((l) => l.id === linhas805[0]?.id)?.pesoMatematica).toBe(3.0);
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

    expect(component.pesoLoteForm.controls.grupos.controls[0]?.controls.pesoLinguagens.errors).toBeNull();

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
    component.pesoLoteForm.controls.grupos.controls[0]?.controls.pesoLinguagens.setValue(3.5);
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

    // Corrige o grupo que falhou e reenvia (retry só do pendente).
    component.pesoLoteForm.controls.grupos.controls[1]?.controls.pesoLinguagens.setValue(2.0);
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
