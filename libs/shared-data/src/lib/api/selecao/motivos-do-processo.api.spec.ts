import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor, buildVendorMimeAccept, isApiOk } from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { MotivosDoProcessoApi, type MotivoDeDecisaoDoProcessoDto } from './motivos-do-processo.api';
import { SELECAO_BASE_PATH } from './tokens';
import { SentidoDoMotivoCodigo, TipoMotivoDeDecisaoCodigo } from './schema';

const BASE = 'http://localhost:5000';
const PROCESSO = '01960000-0000-7000-0000-000000000515';
const FASE = '01960000-0000-7000-0000-0000000000c3';
const MOTIVO = '01960000-0000-7000-0000-0000000000a1';
const ROTA_DA_ESCOLHA = `${BASE}/api/selecao/processos-seletivos/${PROCESSO}/fases/${FASE}/motivos-de-decisao/${MOTIVO}`;
const ROTA_DA_LISTA = `${BASE}/api/selecao/processos-seletivos/${PROCESSO}/motivos-de-decisao`;
const PROBLEMA = { 'content-type': 'application/problem+json' };

const escolhido: MotivoDeDecisaoDoProcessoDto = {
  motivoDeDecisaoId: MOTIVO,
  lugar: { faseCanonicaOrigemId: FASE, etapaId: null },
  tipo: {
    codigo: TipoMotivoDeDecisaoCodigo.HOMOLOGACAO_DAS_INSCRICOES,
    rotulo: 'Homologação das inscrições',
  },
  codigo: 'SEM_RESULTADO_NO_ENEM',
  descricao: 'Sem resultado no ENEM informado.',
  subclassificacao: null,
  sentido: { codigo: SentidoDoMotivoCodigo.DESFAVORAVEL, rotulo: 'Desfavorável' },
  vigencia: { versaoDoEditalDeEntrada: 1, versaoDoEditalDeSaida: null },
  justificativaDaInclusao: null,
};

function problema(status: number, code: string) {
  return {
    type: `https://erros.example/${code}`,
    title: 'Recusa',
    status,
    code,
    traceId: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
  };
}

describe('MotivosDoProcessoApi', () => {
  let api: MotivosDoProcessoApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(MotivosDoProcessoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('listar() lê a escolha do processo com o Accept versionado', async () => {
    const promise = firstValueFrom(api.listar(PROCESSO));
    const req = controller.expectOne(ROTA_DA_LISTA);

    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('motivo-do-processo', 1));
    req.flush([escolhido]);

    const resultado = await promise;
    expect(isApiOk(resultado) && resultado.data).toEqual([escolhido]);
  });

  it('incluirNaFase() faz PUT sem corpo, com Idempotency-Key', async () => {
    const promise = firstValueFrom(
      api.incluirNaFase(PROCESSO, FASE, MOTIVO, withIdempotencyKey('chave-da-inclusao')),
    );
    const req = controller.expectOne(ROTA_DA_ESCOLHA);

    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('Idempotency-Key')).toBe('chave-da-inclusao');
    expect(req.request.body).toBeNull();
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(isApiOk(await promise)).toBe(true);
  });

  it('retirarDaFase() faz DELETE, com Idempotency-Key', async () => {
    const promise = firstValueFrom(
      api.retirarDaFase(PROCESSO, FASE, MOTIVO, withIdempotencyKey('chave-da-retirada')),
    );
    const req = controller.expectOne(ROTA_DA_ESCOLHA);

    expect(req.request.method).toBe('DELETE');
    expect(req.request.headers.get('Idempotency-Key')).toBe('chave-da-retirada');
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(isApiOk(await promise)).toBe(true);
  });

  it('incluirNaFase() devolve o 409 de motivo já escolhido sem lançar', async () => {
    const codigo = 'uniplus.selecao.motivo_de_decisao.ja_escolhido';
    const promise = firstValueFrom(
      api.incluirNaFase(PROCESSO, FASE, MOTIVO, withIdempotencyKey('k')),
    );

    controller
      .expectOne(ROTA_DA_ESCOLHA)
      .flush(problema(409, codigo), { status: 409, statusText: 'Conflict', headers: PROBLEMA });

    const resultado = await promise;
    expect(isApiOk(resultado)).toBe(false);
    if (!resultado.ok) expect(resultado.problem.code).toBe(codigo);
  });

  it('incluirNaFase() devolve o 422 de motivo desativado sem lançar', async () => {
    const codigo = 'uniplus.selecao.motivo_de_decisao.motivo_inativo';
    const promise = firstValueFrom(
      api.incluirNaFase(PROCESSO, FASE, MOTIVO, withIdempotencyKey('k')),
    );

    controller.expectOne(ROTA_DA_ESCOLHA).flush(problema(422, codigo), {
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: PROBLEMA,
    });

    const resultado = await promise;
    expect(isApiOk(resultado)).toBe(false);
    if (!resultado.ok) expect(resultado.problem.status).toBe(422);
  });

  it('retirarDaFase() devolve o 409 sem lançar', async () => {
    const promise = firstValueFrom(
      api.retirarDaFase(PROCESSO, FASE, MOTIVO, withIdempotencyKey('k')),
    );

    controller.expectOne(ROTA_DA_ESCOLHA).flush(problema(409, 'uniplus.selecao.x'), {
      status: 409,
      statusText: 'Conflict',
      headers: PROBLEMA,
    });

    expect(isApiOk(await promise)).toBe(false);
  });

  it('codifica os identificadores no endereço', async () => {
    const promise = firstValueFrom(
      api.incluirNaFase(PROCESSO, 'fase/estranha', MOTIVO, withIdempotencyKey('k')),
    );

    const req = controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${PROCESSO}/fases/fase%2Festranha/motivos-de-decisao/${MOTIVO}`,
    );
    req.flush(null, { status: 204, statusText: 'No Content' });
    await promise;
  });
});
