import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CronogramaDoProcessoApi,
  DocumentosEAtosDoProcessoApi,
  FormulariosDoProcessoApi,
  OrigemCandidatos,
  ProcessosSeletivosApi,
  SELECAO_BASE_PATH,
} from '@uniplus/shared-data/selecao';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GravacaoDoProcesso, type RecursoDoProcesso } from './gravacao-do-processo';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000005aa';
const DOCUMENTO_ID = '01960000-0000-7000-0000-0000000005dd';
const ROTA = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}`;

const erroDeRede = (requisicao: { error: (e: ProgressEvent, o: object) => void }) =>
  requisicao.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

describe('GravacaoDoProcesso', () => {
  let gravacao: GravacaoDoProcesso;
  let api: ProcessosSeletivosApi;
  let cronogramaApi: CronogramaDoProcessoApi;
  let documentosApi: DocumentosEAtosDoProcessoApi;
  let formulariosApi: FormulariosDoProcessoApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        GravacaoDoProcesso,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });
    gravacao = TestBed.inject(GravacaoDoProcesso);
    api = TestBed.inject(ProcessosSeletivosApi);
    cronogramaApi = TestBed.inject(CronogramaDoProcessoApi);
    documentosApi = TestBed.inject(DocumentosEAtosDoProcessoApi);
    formulariosApi = TestBed.inject(FormulariosDoProcessoApi);
    http = TestBed.inject(HttpTestingController);
  });

  /** Duas gravações de recursos diferentes com o mesmo corpo vazio. */
  const gravarEtapas = () =>
    gravacao.gravar('etapas', [], (contexto) =>
      cronogramaApi.definirEtapas(PROCESSO_ID, [], contexto),
    );
  const gravarCronograma = () =>
    gravacao.gravar('cronograma', [], (contexto) =>
      cronogramaApi.definirCronogramaFases(PROCESSO_ID, [], contexto),
    );
  const confirmarEdital = () =>
    gravacao.gravarRetida('confirmacaoDoEdital', (contexto) =>
      documentosApi.confirmarEnvioDocumentoAPublicar(PROCESSO_ID, DOCUMENTO_ID, contexto),
    );

  function chaveDe(rota: string): string {
    const requisicao = http.expectOne(`${ROTA}/${rota}`);
    const chave = requisicao.request.headers.get('Idempotency-Key') ?? '';
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    return chave;
  }

  async function chaveDaGravacao(recurso: () => Promise<unknown>, rota: string): Promise<string> {
    const pendente = recurso();
    const chave = chaveDe(rota);
    await pendente;
    return chave;
  }

  it('mantém uma chave por recurso', async () => {
    const etapas = await chaveDaGravacao(gravarEtapas, 'etapas');
    const cronograma = await chaveDaGravacao(gravarCronograma, 'cronograma-fases');

    expect(cronograma).not.toBe(etapas);
  });

  it('renova a chave depois do aceite', async () => {
    const primeira = await chaveDaGravacao(gravarEtapas, 'etapas');
    const segunda = await chaveDaGravacao(gravarEtapas, 'etapas');

    expect(segunda).not.toBe(primeira);
  });

  it('preserva a chave numa resposta inconclusiva', async () => {
    const primeira = gravarEtapas();
    const requisicao = http.expectOne(`${ROTA}/etapas`);
    const chave = requisicao.request.headers.get('Idempotency-Key');
    erroDeRede(requisicao);
    const resultado = await primeira;

    expect(resultado).toMatchObject({ ok: false, inconclusiva: true });

    const repeticao = gravarEtapas();
    const repetida = http.expectOne(`${ROTA}/etapas`);
    expect(repetida.request.headers.get('Idempotency-Key')).toBe(chave);
    repetida.flush(null, { status: 204, statusText: 'No Content' });
    await repeticao;
  });

  it('descarta a resposta de um processo que saiu de tela', async () => {
    const pendente = gravarEtapas();
    const requisicao = http.expectOne(`${ROTA}/etapas`);

    gravacao.descartar();
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    const resultado = await pendente;

    expect(resultado).toMatchObject({
      ok: false,
      problem: { code: 'uniplus.client.operacao_superada' },
    });
  });

  it('renova toda chave de substituição ao descartar, sem depender de lista nominal', async () => {
    // O último é um recurso que nenhuma lista do código conhece: o descarte tem de alcançá-lo.
    const recursos = [
      'taxa',
      'distribuicao',
      'etapas',
      'cronograma',
      'bonus',
      'atendimento',
      'recurso-criado-no-teste',
    ] as unknown as readonly RecursoDoProcesso[];
    const gravarEmAberto = async (recurso: RecursoDoProcesso): Promise<string> => {
      // A falha de rede deixa a chave em uso, que é a que o descarte tem de trocar.
      const pendente = gravacao.gravar(recurso, 'mesmo corpo', (contexto) =>
        cronogramaApi.definirEtapas(PROCESSO_ID, [], contexto),
      );
      const requisicao = http.expectOne(`${ROTA}/etapas`);
      const chave = requisicao.request.headers.get('Idempotency-Key') ?? '';
      erroDeRede(requisicao);
      await pendente;
      return chave;
    };
    const antes = new Map<string, string>();
    for (const recurso of recursos) antes.set(recurso, await gravarEmAberto(recurso));
    expect(new Set(antes.values()).size, 'cada recurso tem a sua chave').toBe(recursos.length);

    gravacao.descartar();

    for (const recurso of recursos) {
      expect(
        await gravarEmAberto(recurso),
        `chave de ${recurso} que atravessou o descarte`,
      ).not.toBe(antes.get(recurso));
    }
  });

  describe('contexto do pedido', () => {
    it('monta o contexto de gravação, de remoção e de operação retida pelo mesmo ponto', async () => {
      const contextoDa = vi.spyOn(
        gravacao as unknown as { contextoDa: () => unknown },
        'contextoDa',
      );

      const gravada = gravarEtapas();
      http.expectOne(`${ROTA}/etapas`).flush(null, { status: 204, statusText: 'No Content' });
      await gravada;
      const removida = gravacao.remover(() =>
        formulariosApi.removerFormulario(PROCESSO_ID, 'INSCRICAO'),
      );
      http
        .expectOne(`${ROTA.replace('/api/selecao/', '/api/selecao/admin/')}/formularios/INSCRICAO`)
        .flush(null, {
          status: 204,
          statusText: 'No Content',
        });
      await removida;
      const retida = confirmarEdital();
      http
        .expectOne(`${ROTA}/documentos-a-publicar/${DOCUMENTO_ID}/confirmacao`)
        .flush(null, { status: 204, statusText: 'No Content' });
      await retida;

      expect(contextoDa).toHaveBeenCalledTimes(3);
    });
  });

  describe('chave retida', () => {
    it('renova a chave da confirmação do edital e mantém a pendência no descarte', async () => {
      const primeira = confirmarEdital();
      const requisicao = http.expectOne(
        `${ROTA}/documentos-a-publicar/${DOCUMENTO_ID}/confirmacao`,
      );
      const chave = requisicao.request.headers.get('Idempotency-Key');
      erroDeRede(requisicao);
      await primeira;
      expect(gravacao.retidaPendente('confirmacaoDoEdital')).toBe(true);

      gravacao.descartar();

      expect(gravacao.retidaPendente('confirmacaoDoEdital')).toBe(true);
      const segunda = confirmarEdital();
      const nova = http.expectOne(`${ROTA}/documentos-a-publicar/${DOCUMENTO_ID}/confirmacao`);
      expect(nova.request.headers.get('Idempotency-Key')).not.toBe(chave);
      nova.flush(null, { status: 204, statusText: 'No Content' });
      await segunda;
    });

    it('esquece a criação retida no descarte', async () => {
      const comando = {
        nome: 'Processo Seletivo A',
        tipoProcessoOrigemId: '01960000-0000-7000-0000-000000000001',
        origemCandidatos: OrigemCandidatos.inscricaoPropria,
        unidadeAdministradoraOrigemId: '01960000-0000-7000-0000-000000000002',
        localidadeCodigoIbge: null,
        localidadeNome: null,
        localidadeUf: null,
        identificadorLegivel: null,
      } as const;
      const criar = () =>
        gravacao.gravarRetida('criacao', (contexto) => api.criar(comando, contexto));

      const primeira = criar();
      erroDeRede(http.expectOne(`${BASE}/api/selecao/processos-seletivos`));
      await primeira;
      expect(gravacao.retidaPendente('criacao')).toBe(true);

      gravacao.descartar();

      expect(gravacao.retidaPendente('criacao')).toBe(false);
    });
  });
});
