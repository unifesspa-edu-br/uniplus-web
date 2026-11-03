import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor, isApiOk } from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { CaraterEtapa, UnidadePrazo } from './index';
import { EtapaProcessoInput, FaseCronogramaInput } from './processos-seletivos.contrato';
import { SELECAO_BASE_PATH } from './tokens';
import { CronogramaDoProcessoApi } from './cronograma-do-processo.api';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-000000000515';

describe('CronogramaDoProcessoApi', () => {
  let api: CronogramaDoProcessoApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(CronogramaDoProcessoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());
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
        produtos: [],
        emiteParecerIndividual: false,
        bancas: [],
        recursos: [],
      },
      {
        nome: 'Redação',
        carater: CaraterEtapa.ambas,
        tipoEtapaOrigemId: '01960000-0000-7000-0000-0000000005f2',
        peso: 1,
        notaMinima: 5,
        ordem: 2,
        produtos: [],
        emiteParecerIndividual: false,
        bancas: [],
        recursos: [],
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
          admiteInstanciaSuperior: true,
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
          admiteInstanciaSuperior: true,
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
});
