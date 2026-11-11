import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { VersoesDoPerfilApi } from './versoes-do-perfil.api';
import { AUTORIZACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const RAIZ = `${BASE}/api/autorizacao`;
const PERFIL = '01960000-0000-7000-0000-0000000000d1';
const VERSAO = '01960000-0000-7000-0000-0000000000e1';
const DA_VERSAO = `${RAIZ}/perfis/${PERFIL}/versoes/${VERSAO}`;

describe('VersoesDoPerfilApi', () => {
  let api: VersoesDoPerfilApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: AUTORIZACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(VersoesDoPerfilApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('propõe a versão por POST em versoes, com chave de idempotência', () => {
    const corpo = {
      nome: 'Operador',
      descricao: 'Opera.',
      permissoes: ['a:b:c'],
      protocolo: 'P-1',
      tamanhoDoDocumento: 10,
      motivoDaRemocao: null,
      categoriaDaRemocao: null,
    };
    void firstValueFrom(api.propor(PERFIL, corpo, withIdempotencyKey('k1')));
    const req = controller.expectOne(`${RAIZ}/perfis/${PERFIL}/versoes`);

    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('k1');
    expect(req.request.body).toEqual(corpo);
  });

  it('cancela com o motivo', () => {
    void firstValueFrom(api.cancelar(PERFIL, VERSAO, 'Engano.', withIdempotencyKey('k2')));
    const req = controller.expectOne(`${DA_VERSAO}/cancelamento`);

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ motivo: 'Engano.' });
  });

  it('aprova e recusa informando a etapa, e a recusa leva o motivo', () => {
    void firstValueFrom(api.aprovar(PERFIL, VERSAO, 'gestao_de_acessos', withIdempotencyKey('k3')));
    void firstValueFrom(
      api.recusar(PERFIL, VERSAO, { etapa: 'protecao_de_dados', motivo: 'Sem base.' }, withIdempotencyKey('k4')),
    );

    expect(controller.expectOne(`${DA_VERSAO}/aprovacao`).request.body).toEqual({
      etapa: 'gestao_de_acessos',
    });
    expect(controller.expectOne(`${DA_VERSAO}/recusa`).request.body).toEqual({
      etapa: 'protecao_de_dados',
      motivo: 'Sem base.',
    });
  });

  it('lê a fila da etapa', () => {
    void firstValueFrom(api.fila('protecao_de_dados'));
    const req = controller.expectOne(
      (r) => r.url === `${RAIZ}/versoes-de-perfil` && r.params.get('fila') === 'protecao_de_dados',
    );

    expect(req.request.method).toBe('GET');
  });

  it('segue o fluxo de envio do documento: novo documento, reemissão, confirmação e leitura', () => {
    void firstValueFrom(api.novoDocumento(PERFIL, VERSAO, 2048, withIdempotencyKey('k5')));
    void firstValueFrom(api.reemitirEnvio(PERFIL, VERSAO, withIdempotencyKey('k6')));
    void firstValueFrom(api.confirmarDocumento(PERFIL, VERSAO, 'etag-1'));
    void firstValueFrom(api.lerDocumento(PERFIL, VERSAO));

    expect(controller.expectOne(`${DA_VERSAO}/documento/envio`).request.method).toBe('POST');
    const confirmacao = controller.expectOne(`${DA_VERSAO}/documento/confirmacao`);
    expect(confirmacao.request.body).toEqual({ etag: 'etag-1' });
    const requisicoes = controller.match(`${DA_VERSAO}/documento`);
    expect(requisicoes.map((r) => r.request.method).sort()).toEqual(['GET', 'POST']);
    expect(requisicoes.find((r) => r.request.method === 'POST')?.request.body).toEqual({
      tamanhoDoDocumento: 2048,
    });
  });
});
