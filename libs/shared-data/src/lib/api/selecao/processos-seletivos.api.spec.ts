import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ApiResult,
  apiResultInterceptor,
  buildVendorMimeAccept,
  isApiOk,
  withIdempotencyKey,
} from '@uniplus/shared-core/http';
import { CaraterEtapa, UnidadePrazo } from './index';
import {
  ConformidadeLegalProcessoSeletivoDto,
  ConformidadeProcessoSeletivoDto,
  CriarProcessoSeletivoCommand,
  DadosDoAtoRequest,
  DefinirCascataRemanejamentoRequest,
  DefinirOfertaAtendimentoRequest,
  EtapaProcessoInput,
  FaseCronogramaInput,
  DocumentoEditalDto,
  IniciarUploadDocumentoEditalDto,
  ProcessoSeletivoDto,
  ProcessoSeletivoResumoDto,
  ProcessosSeletivosApi,
  PublicarProcessoSeletivoRequest,
  TipoProcessoSnapshotDto,
} from './processos-seletivos.api';
import { OrigemCandidatos } from './schema';
import { SELECAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-000000000515';
const TIPO_ID = '01960000-0000-7000-0000-000000000516';
const DOCUMENTO_ID = '01960000-0000-7000-0000-000000000518';
const URL_ASSINADA =
  'http://localhost:9000/uniplus-selecao/editais/documento.pdf?X-Amz-Signature=abc';

const tipoProcesso: TipoProcessoSnapshotDto = {
  origemId: TIPO_ID,
  codigo: 'SISU',
  nome: 'SiSU',
};

const resumoSeed: ProcessoSeletivoResumoDto = {
  id: ID,
  nome: 'Processo Seletivo 2027',
  tipoProcesso,
  status: 'rascunho',
  criadoEm: '2026-08-11T12:00:00Z',
};

const iniciacaoSeed: IniciarUploadDocumentoEditalDto = {
  documentoEditalId: DOCUMENTO_ID,
  urlUpload: URL_ASSINADA,
  contentTypeExigido: 'application/pdf',
  expiraEm: '2026-08-13T12:15:00Z',
};

const documentoSeed: DocumentoEditalDto = {
  id: DOCUMENTO_ID,
  processoSeletivoId: ID,
  status: 'Confirmado',
  criadoEm: '2026-08-13T12:00:00Z',
  expiraEm: '2026-08-13T12:15:00Z',
  tamanhoBytes: 2048,
  hashSha256: 'a'.repeat(64),
  confirmadoEm: '2026-08-13T12:05:00Z',
};

const documentoPendenteSeed: DocumentoEditalDto = {
  id: '01960000-0000-7000-0000-000000000519',
  processoSeletivoId: ID,
  status: 'Pendente',
  criadoEm: '2026-08-13T12:10:00Z',
  expiraEm: '2026-08-13T12:25:00Z',
  tamanhoBytes: null,
  hashSha256: null,
  confirmadoEm: null,
};

const criarCommand: CriarProcessoSeletivoCommand = {
  nome: 'Processo Seletivo 2027',
  tipoProcessoOrigemId: TIPO_ID,
  origemCandidatos: OrigemCandidatos.inscricaoPropria,
  unidadeAdministradoraOrigemId: '01960000-0000-7000-000000000517',
};

describe('ProcessosSeletivosApi', () => {
  let api: ProcessosSeletivosApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(ProcessosSeletivosApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('listar() lê o snapshot de tipo retornado por Seleção', async () => {
    const promise = firstValueFrom(api.listar());
    const req = controller.expectOne(`${BASE}/api/selecao/processos-seletivos?limit=100`);

    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('processo-seletivo', 1));
    req.flush([resumoSeed]);

    const result = (await promise) as ApiResult<readonly ProcessoSeletivoResumoDto[]>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) expect(result.data[0].tipoProcesso).toEqual(tipoProcesso);
  });

  it('obter() preserva o snapshot no detalhe sem consultar Configuração', async () => {
    const promise = firstValueFrom(api.obter(ID));
    const req = controller.expectOne(`${BASE}/api/selecao/processos-seletivos/${ID}`);

    expect(req.request.method).toBe('GET');
    req.flush({ ...resumoSeed } as ProcessoSeletivoDto);

    const result = (await promise) as ApiResult<ProcessoSeletivoDto>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) expect(result.data.tipoProcesso.nome).toBe('SiSU');
  });

  it('criar() envia somente tipoProcessoOrigemId e preserva a Idempotency-Key', async () => {
    const promise = firstValueFrom(
      api.criar(criarCommand, withIdempotencyKey('processo-create-key')),
    );
    const req = controller.expectOne(`${BASE}/api/selecao/processos-seletivos`);

    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('processo-create-key');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    expect(req.request.body).toEqual(criarCommand);
    expect(req.request.body).toHaveProperty('tipoProcessoOrigemId', TIPO_ID);
    expect(req.request.body).not.toHaveProperty('tipo');
    req.flush(ID, { status: 201, statusText: 'Created' });

    const result = (await promise) as ApiResult<string>;
    expect(isApiOk(result)).toBe(true);
  });

  it('listarDocumentosEdital() lê a coleção do processo pelo vendor MIME do documento', async () => {
    const promise = firstValueFrom(api.listarDocumentosEdital(ID));
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/documentos-edital`,
    );

    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('documento-edital', 1));
    req.flush([documentoSeed, documentoPendenteSeed]);

    const result = (await promise) as ApiResult<readonly DocumentoEditalDto[]>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      expect(result.data.map((documento) => documento.status)).toEqual(['Confirmado', 'Pendente']);
    }
  });

  /**
   * O id vai na rota; um valor com caractere reservado não pode escapar para o
   * path sem codificação.
   */
  it('listarDocumentosEdital() codifica o id na rota', async () => {
    const promise = firstValueFrom(api.listarDocumentosEdital('a/b'));
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/a%2Fb/documentos-edital`,
    );

    req.flush([]);
    await promise;
  });

  it('listarDocumentosEdital() devolve a coleção vazia de um processo sem anexo', async () => {
    const promise = firstValueFrom(api.listarDocumentosEdital(ID));
    controller
      .expectOne(`${BASE}/api/selecao/processos-seletivos/${ID}/documentos-edital`)
      .flush([]);

    const result = (await promise) as ApiResult<readonly DocumentoEditalDto[]>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) expect(result.data).toEqual([]);
  });

  it('iniciarUploadDocumentoEdital() posta sem corpo e devolve a URL assinada', async () => {
    const promise = firstValueFrom(
      api.iniciarUploadDocumentoEdital(ID, withIdempotencyKey('documento-init-key')),
    );
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/documentos-edital`,
    );

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    expect(req.request.headers.get('Idempotency-Key')).toBe('documento-init-key');
    req.flush(iniciacaoSeed, { status: 201, statusText: 'Created' });

    const result = (await promise) as ApiResult<IniciarUploadDocumentoEditalDto>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) expect(result.data.contentTypeExigido).toBe('application/pdf');
  });

  it('confirmarUploadDocumentoEdital() usa os dois ids na rota de confirmação', async () => {
    const promise = firstValueFrom(
      api.confirmarUploadDocumentoEdital(ID, DOCUMENTO_ID, withIdempotencyKey('documento-conf-key')),
    );
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/documentos-edital/${DOCUMENTO_ID}/confirmacao`,
    );

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    expect(req.request.headers.get('Idempotency-Key')).toBe('documento-conf-key');
    req.flush(documentoSeed);

    const result = (await promise) as ApiResult<DocumentoEditalDto>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) expect(result.data.status).toBe('Confirmado');
  });

  /**
   * A coleção é substituída por inteiro, e o `id` de cada item é o que critério
   * de desempate e regra de eliminação referenciam. Omiti-lo faria o servidor
   * criar outra etapa, deixando essas referências apontando para uma que deixou
   * de existir — daí o teste afirmar o corpo item a item, e não só a rota.
   */
  it('definirEtapas() envia a coleção inteira preservando o id das existentes', async () => {
    const etapas: readonly EtapaProcessoInput[] = [
      {
        id: '01960000-0000-7000-0000-0000000005e1',
        nome: 'Prova Objetiva',
        carater: CaraterEtapa.classificatoria,
        tipoEtapaOrigemId: '01960000-0000-7000-0000-0000000005f1',
        peso: 2,
        notaMinima: null,
        ordem: 1,
      },
      {
        nome: 'Redação',
        carater: CaraterEtapa.ambas,
        tipoEtapaOrigemId: '01960000-0000-7000-0000-0000000005f2',
        peso: 1,
        notaMinima: 5,
        ordem: 2,
      },
    ];

    const promise = firstValueFrom(
      api.definirEtapas(ID, etapas, withIdempotencyKey('chave-etapas')),
    );
    const req = controller.expectOne(`${BASE}/api/selecao/processos-seletivos/${ID}/etapas`);

    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('Idempotency-Key')).toBe('chave-etapas');
    expect(req.request.body).toEqual(etapas);
    expect(req.request.body[0].id).toBe('01960000-0000-7000-0000-0000000005e1');
    expect(req.request.body[1].id).toBeUndefined();
    req.flush(null, { status: 204, statusText: 'No Content' });

    const result = await promise;
    expect(isApiOk(result)).toBe(true);
  });

  /**
   * Processo cuja classificação é importada não tem etapa pontuada, e a coleção
   * vazia é como isso se declara. O cliente não pode transformá-la em ausência
   * de requisição nem inventar um item.
   */
  it('definirEtapas() envia a coleção vazia como corpo válido', async () => {
    const promise = firstValueFrom(api.definirEtapas(ID, [], withIdempotencyKey('chave-vazia')));
    const req = controller.expectOne(`${BASE}/api/selecao/processos-seletivos/${ID}/etapas`);

    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual([]);
    req.flush(null, { status: 204, statusText: 'No Content' });

    const result = await promise;
    expect(isApiOk(result)).toBe(true);
  });

  it('definirEtapas() propaga a recusa do domínio sem lançar', async () => {
    const promise = firstValueFrom(api.definirEtapas(ID, [], withIdempotencyKey('chave-recusa')));
    const req = controller.expectOne(`${BASE}/api/selecao/processos-seletivos/${ID}/etapas`);

    req.flush(
      {
        type: 'https://unifesspa-edu-br.github.io/uniplus-developers/erros/uniplus.selecao.processo_seletivo.nenhuma_etapa_compoe_nota',
        title: 'Ao menos uma etapa deve compor a nota final',
        status: 422,
        code: 'uniplus.selecao.processo_seletivo.nenhuma_etapa_compoe_nota',
        traceId: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    const result = await promise;
    expect(isApiOk(result)).toBe(false);
    if (!result.ok) expect(result.problem.status).toBe(422);
  });

  /**
   * A janela é instante, não data — o contrato declara `date-time`, e o servidor
   * normaliza para UTC preservando o momento. O teste envia deslocamento de
   * Belém de propósito: um cliente que truncasse para data perderia a hora que
   * separa o fim do dia do começo dele.
   */
  it('definirCronogramaFases() envia a coleção com a janela em instante', async () => {
    const fases: readonly FaseCronogramaInput[] = [
      {
        ordem: 1,
        faseCanonicaId: '01960000-0000-7000-0000-0000000006a1',
        inicio: '2026-03-01T08:00:00-03:00',
        fim: '2026-03-20T23:59:59-03:00',
        produtos: [],
        faseConcluinteCodigo: null,
        emiteParecerIndividual: false,
        bancasRequeridas: [],
        regraRecurso: null,
      },
      {
        ordem: 2,
        faseCanonicaId: '01960000-0000-7000-0000-0000000006a2',
        inicio: '2026-03-25T08:00:00-03:00',
        fim: '2026-03-25T23:59:59-03:00',
        produtos: [{ atoCodigo: 'RESULTADO_HOMOLOGACAO', papel: 'PRELIMINAR' }],
        faseConcluinteCodigo: null,
        emiteParecerIndividual: false,
        bancasRequeridas: [
          {
            tipoBancaId: '01960000-0000-7000-0000-0000000006b1',
            categoriasDocumentoIds: ['01960000-0000-7000-0000-0000000006c1'],
          },
        ],
        regraRecurso: {
          regraCodigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
          regraVersao: 'v1',
          prazoValor: 2,
          prazoUnidade: UnidadePrazo.diasUteis,
          atoAncoraCodigo: 'RESULTADO_HOMOLOGACAO',
          suspensividadePrimeiraInstanciaValor: null,
          suspensividadePrimeiraInstanciaUnidade: null,
          suspensividadeSegundaInstanciaValor: null,
          suspensividadeSegundaInstanciaUnidade: null,
        },
      },
    ];

    const promise = firstValueFrom(
      api.definirCronogramaFases(ID, fases, withIdempotencyKey('chave-cronograma')),
    );
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/cronograma-fases`,
    );

    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('Idempotency-Key')).toBe('chave-cronograma');
    expect(req.request.body).toEqual(fases);
    expect(req.request.body[0].inicio).toBe('2026-03-01T08:00:00-03:00');
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(isApiOk(await promise)).toBe(true);
  });

  /**
   * Fase de data delegada grava sem janela, e a ausência de recurso é `null`
   * explícito — não campo omitido, que o servidor leria de outro modo.
   */
  it('definirCronogramaFases() preserva janela e recurso ausentes como nulos', async () => {
    const fases: readonly FaseCronogramaInput[] = [
      {
        ordem: 1,
        faseCanonicaId: '01960000-0000-7000-0000-0000000006a3',
        inicio: null,
        fim: null,
        produtos: [],
        faseConcluinteCodigo: null,
        emiteParecerIndividual: false,
        bancasRequeridas: [],
        regraRecurso: null,
      },
    ];

    const promise = firstValueFrom(
      api.definirCronogramaFases(ID, fases, withIdempotencyKey('chave-sem-janela')),
    );
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/cronograma-fases`,
    );

    expect(req.request.body[0].inicio).toBeNull();
    expect(req.request.body[0].fim).toBeNull();
    expect(req.request.body[0].regraRecurso).toBeNull();
    req.flush(null, { status: 204, statusText: 'No Content' });
    await promise;
  });

  /**
   * A ausência dos dois campos de uma instância é a desativação prevista dela —
   * o domínio a distingue de par incompleto, que recusa. Os quatro campos
   * chegam como `null` explícito dentro da regra de recurso, e não omitidos.
   */
  it('definirCronogramaFases() envia a suspensividade desativada como par nulo', async () => {
    const fases: readonly FaseCronogramaInput[] = [
      {
        ordem: 1,
        faseCanonicaId: '01960000-0000-7000-0000-0000000006a4',
        inicio: '2026-03-25T08:00:00-03:00',
        fim: '2026-03-25T23:59:59-03:00',
        produtos: [{ atoCodigo: 'RESULTADO_HOMOLOGACAO', papel: 'PRELIMINAR' }],
        faseConcluinteCodigo: null,
        emiteParecerIndividual: false,
        bancasRequeridas: [],
        regraRecurso: {
          regraCodigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
          regraVersao: 'v1',
          prazoValor: 2,
          prazoUnidade: UnidadePrazo.diasUteis,
          atoAncoraCodigo: 'RESULTADO_HOMOLOGACAO',
          suspensividadePrimeiraInstanciaValor: null,
          suspensividadePrimeiraInstanciaUnidade: null,
          suspensividadeSegundaInstanciaValor: null,
          suspensividadeSegundaInstanciaUnidade: null,
        },
      },
    ];

    const promise = firstValueFrom(
      api.definirCronogramaFases(ID, fases, withIdempotencyKey('chave-suspensividade')),
    );
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/cronograma-fases`,
    );

    const recurso = req.request.body[0].regraRecurso;
    for (const campo of [
      'suspensividadePrimeiraInstanciaValor',
      'suspensividadePrimeiraInstanciaUnidade',
      'suspensividadeSegundaInstanciaValor',
      'suspensividadeSegundaInstanciaUnidade',
    ]) {
      expect(campo in recurso, `${campo} sumiu do corpo`).toBe(true);
      expect(recurso[campo]).toBeNull();
    }
    req.flush(null, { status: 204, statusText: 'No Content' });
    await promise;
  });

  it('definirAlgoritmoContagemPrazo() envia código e versão da regra', async () => {
    const promise = firstValueFrom(
      api.definirAlgoritmoContagemPrazo(
        ID,
        { codigo: 'CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL', versao: 'v1' },
        withIdempotencyKey('chave-algoritmo'),
      ),
    );
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/algoritmo-contagem-prazo`,
    );

    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      codigo: 'CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL',
      versao: 'v1',
    });
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(isApiOk(await promise)).toBe(true);
  });

  it('definirCronogramaFases() propaga a recusa do domínio sem lançar', async () => {
    const promise = firstValueFrom(
      api.definirCronogramaFases(ID, [], withIdempotencyKey('chave-vazio')),
    );
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/cronograma-fases`,
    );

    req.flush(
      {
        type: 'https://unifesspa-edu-br.github.io/uniplus-developers/erros/uniplus.selecao.processo_seletivo.cronograma_fases_vazio',
        title: 'O processo deve ter ao menos uma fase no cronograma',
        status: 422,
        code: 'uniplus.selecao.processo_seletivo.cronograma_fases_vazio',
        traceId: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    const result = await promise;
    expect(isApiOk(result)).toBe(false);
    if (!result.ok) expect(result.problem.status).toBe(422);
  });

  it('definirOfertaAtendimento() envia os ids dos cadastros de Configuração', async () => {
    const request: DefinirOfertaAtendimentoRequest = {
      condicaoIds: ['01960000-0000-7000-0000-000000000601'],
      recursoIds: ['01960000-0000-7000-0000-000000000602'],
      tipoDeficienciaIds: ['01960000-0000-7000-0000-000000000603'],
    };

    const promise = firstValueFrom(
      api.definirOfertaAtendimento(ID, request, withIdempotencyKey('chave-atendimento')),
    );
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/oferta-atendimento`,
    );

    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('Idempotency-Key')).toBe('chave-atendimento');
    expect(req.request.body).toEqual(request);
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(isApiOk(await promise)).toBe(true);
  });

  it('definirOfertaAtendimento() propaga a recusa por tipo de deficiência sem condição PcD', async () => {
    const request: DefinirOfertaAtendimentoRequest = {
      condicaoIds: [],
      recursoIds: [],
      tipoDeficienciaIds: ['01960000-0000-7000-0000-000000000603'],
    };

    const promise = firstValueFrom(
      api.definirOfertaAtendimento(ID, request, withIdempotencyKey('chave-sem-pcd')),
    );
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/oferta-atendimento`,
    );

    req.flush(
      {
        type: 'https://unifesspa-edu-br.github.io/uniplus-developers/erros/uniplus.selecao.oferta_atendimento.tipo_deficiencia_sem_condicao_pcd',
        title: 'Tipo de deficiência exige a condição PcD marcada',
        status: 422,
        code: 'uniplus.selecao.oferta_atendimento.tipo_deficiencia_sem_condicao_pcd',
        traceId: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    const result = await promise;
    expect(isApiOk(result)).toBe(false);
    if (!result.ok) expect(result.problem.status).toBe(422);
  });

  /**
   * A tela não compõe a matriz: envia o que a regra do catálogo já congelou.
   * O teste afirma o corpo exato — fallback e destinos — para provar que o
   * cliente não reordena nem reformata o que o chamador montou.
   */
  it('definirCascataRemanejamento() envia a matriz congelada pela regra', async () => {
    const request: DefinirCascataRemanejamentoRequest = {
      regraCodigo: 'REMANEJ-CASCATA-LEI-12711',
      regraVersao: 'v1',
      fallbackCodigo: 'AC_ESCOLA_PUBLICA_RENDA_ATE_1_5',
      destinos: [
        {
          modalidadeOrigemCodigo: 'AC_ESCOLA_PUBLICA_PPI_RENDA_ATE_1_5',
          ordem: 1,
          modalidadeDestinoCodigo: 'AC_ESCOLA_PUBLICA_RENDA_ATE_1_5',
        },
      ],
    };

    const promise = firstValueFrom(
      api.definirCascataRemanejamento(ID, request, withIdempotencyKey('chave-cascata')),
    );
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/cascata-remanejamento`,
    );

    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('Idempotency-Key')).toBe('chave-cascata');
    expect(req.request.body).toEqual(request);
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(isApiOk(await promise)).toBe(true);
  });

  it('definirCascataRemanejamento() propaga a matriz divergente da regra sem lançar', async () => {
    const request: DefinirCascataRemanejamentoRequest = {
      regraCodigo: 'REMANEJ-CASCATA-LEI-12711',
      regraVersao: 'v1',
      fallbackCodigo: 'CODIGO_INVENTADO',
      destinos: [],
    };

    const promise = firstValueFrom(
      api.definirCascataRemanejamento(ID, request, withIdempotencyKey('chave-cascata-invalida')),
    );
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/cascata-remanejamento`,
    );

    req.flush(
      {
        type: 'https://unifesspa-edu-br.github.io/uniplus-developers/erros/uniplus.selecao.configuracao_cascata_remanejamento.matriz_divergente_da_regra',
        title: 'A matriz enviada diverge do esquema congelado pela regra',
        status: 422,
        code: 'uniplus.selecao.configuracao_cascata_remanejamento.matriz_divergente_da_regra',
        traceId: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    const result = await promise;
    expect(isApiOk(result)).toBe(false);
    if (!result.ok) expect(result.problem.status).toBe(422);
  });

  it('obterConformidade() lê o preflight estrutural com o vendor MIME do recurso', async () => {
    const conformidade: ConformidadeProcessoSeletivoDto = {
      processoSeletivoId: ID,
      itens: [
        { codigo: 'classificacao_ausente', dimensao: 'classificacao', mensagem: 'x', ok: false },
      ],
    };

    const promise = firstValueFrom(api.obterConformidade(ID));
    const req = controller.expectOne(`${BASE}/api/selecao/processos-seletivos/${ID}/conformidade`);

    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('conformidade-processo-seletivo', 1),
    );
    req.flush(conformidade);

    const result = (await promise) as ApiResult<ConformidadeProcessoSeletivoDto>;
    expect(isApiOk(result)).toBe(true);
    if (result.ok) expect(result.data.itens[0].ok).toBe(false);
  });

  it('obterConformidadeLegal() sem dataReferencia deixa o servidor decidir a referência', async () => {
    const conformidadeLegal: ConformidadeLegalProcessoSeletivoDto = {
      processoSeletivoId: ID,
      dataReferencia: '2027-03-01',
      regras: [],
      avisos: [],
    };

    const promise = firstValueFrom(api.obterConformidadeLegal(ID));
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/conformidade-legal`,
    );

    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('dataReferencia')).toBe(false);
    expect(req.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('conformidade-legal-processo-seletivo', 1),
    );
    req.flush(conformidadeLegal);

    expect(isApiOk(await promise)).toBe(true);
  });

  it('obterConformidadeLegal() com dataReferencia envia a data de início da inscrição', async () => {
    const promise = firstValueFrom(api.obterConformidadeLegal(ID, '2027-03-01'));
    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${ID}/conformidade-legal?dataReferencia=2027-03-01`,
    );

    expect(req.request.params.get('dataReferencia')).toBe('2027-03-01');
    req.flush({
      processoSeletivoId: ID,
      dataReferencia: '2027-03-01',
      regras: [],
      avisos: [],
    } satisfies ConformidadeLegalProcessoSeletivoDto);

    expect(isApiOk(await promise)).toBe(true);
  });

  /**
   * O período de inscrição não é derivado aqui: quem chama decide `null` ou os
   * dois campos preenchidos antes de montar o corpo. O teste só afirma que o
   * cliente transporta o que recebeu, sem reescrever nenhum dos dois ramos.
   */
  it('publicar() transporta null nos dois campos de período quando o cronograma tem fase de coleta', async () => {
    const ato: DadosDoAtoRequest = {
      orgao: 'Reitoria',
      serie: '1',
      ano: 2027,
      dataPublicacao: '2027-01-15',
      assinante: 'Reitor',
      tipoAtoCodigo: 'PORTARIA',
    };
    const request: PublicarProcessoSeletivoRequest = {
      numero: '001/2027',
      periodoInscricaoInicio: null,
      periodoInscricaoFim: null,
      documentoEditalId: '01960000-0000-7000-0000-000000000518',
      ato,
    };

    const promise = firstValueFrom(
      api.publicar(ID, request, withIdempotencyKey('chave-publicacao')),
    );
    const req = controller.expectOne(`${BASE}/api/selecao/processos-seletivos/${ID}/publicacao`);

    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('chave-publicacao');
    expect(req.request.body).toEqual(request);
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(isApiOk(await promise)).toBe(true);
  });

  /**
   * A recusa por pendência chega tipada a quem chamou — `ApiResult.fail` com o
   * `ProblemDetails` do 422 — sem catch genérico que a esconda do chamador.
   */
  it('publicar() propaga o 422 de pendência como ApiResult.fail tipado', async () => {
    const ato: DadosDoAtoRequest = {
      orgao: 'Reitoria',
      serie: '1',
      ano: 2027,
      dataPublicacao: '2027-01-15',
      assinante: 'Reitor',
      tipoAtoCodigo: 'PORTARIA',
    };
    const request: PublicarProcessoSeletivoRequest = {
      numero: '001/2027',
      periodoInscricaoInicio: null,
      periodoInscricaoFim: null,
      documentoEditalId: '01960000-0000-7000-0000-000000000518',
      ato,
    };

    const promise = firstValueFrom(
      api.publicar(ID, request, withIdempotencyKey('chave-publicacao-pendente')),
    );
    const req = controller.expectOne(`${BASE}/api/selecao/processos-seletivos/${ID}/publicacao`);

    req.flush(
      {
        type: 'https://unifesspa-edu-br.github.io/uniplus-developers/erros/uniplus.selecao.processo_seletivo.conformidade_estrutural_insuficiente',
        title: 'O processo tem pendências estruturais',
        status: 422,
        code: 'uniplus.selecao.processo_seletivo.conformidade_estrutural_insuficiente',
        traceId: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
        pendencias: ['classificacao_ausente'],
      },
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );

    const result = await promise;
    expect(isApiOk(result)).toBe(false);
    if (!result.ok) {
      expect(result.problem.status).toBe(422);
      expect(result.problem.code).toBe(
        'uniplus.selecao.processo_seletivo.conformidade_estrutural_insuficiente',
      );
    }
  });
});
