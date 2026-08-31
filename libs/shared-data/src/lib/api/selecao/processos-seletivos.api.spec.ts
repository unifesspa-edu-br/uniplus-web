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
  CriarProcessoSeletivoCommand,
  EtapaProcessoInput,
  FaseCronogramaInput,
  DocumentoEditalDto,
  IniciarUploadDocumentoEditalDto,
  ProcessoSeletivoDto,
  ProcessoSeletivoResumoDto,
  ProcessosSeletivosApi,
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
        atoProduzidoCodigo: null,
        tiposBancaIds: [],
        regraRecurso: null,
      },
      {
        ordem: 2,
        faseCanonicaId: '01960000-0000-7000-0000-0000000006a2',
        inicio: '2026-03-25T08:00:00-03:00',
        fim: '2026-03-25T23:59:59-03:00',
        atoProduzidoCodigo: 'RESULTADO_HOMOLOGACAO',
        tiposBancaIds: ['01960000-0000-7000-0000-0000000006b1'],
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
   * O par de suspensividade ausente é a desativação prevista da instância, e
   * precisa chegar como `null` explícito — não como campo omitido, que o
   * servidor leria de outro modo.
   */
  it('definirCronogramaFases() preserva o par de suspensividade ausente como nulo', async () => {
    const fases: readonly FaseCronogramaInput[] = [
      {
        ordem: 1,
        faseCanonicaId: '01960000-0000-7000-0000-0000000006a3',
        inicio: null,
        fim: null,
        atoProduzidoCodigo: null,
        tiposBancaIds: [],
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
});
