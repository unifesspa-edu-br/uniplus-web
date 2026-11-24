import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { apiResultInterceptor, buildVendorMimeAccept } from '@uniplus/shared-core/http';
import {
  VocabulariosDeConfiguracaoApi,
  type VocabulariosDeConfiguracao,
} from './vocabularios-de-configuracao.api';
import { CONFIGURACAO_BASE_PATH } from './tokens';
import { ITENS_DE_VOCABULARIO } from './vocabularios-de-configuracao.testing';

const vocabularios: ReadonlyArray<readonly [keyof VocabulariosDeConfiguracao, string]> = [
  ['abrangencias-dia-nao-util', 'codigo-abrangencia-dia-nao-util'],
  ['acoes-quando-indeferido', 'codigo-acao-quando-indeferido'],
  ['composicoes-vagas', 'codigo-composicao-vagas'],
  ['formas-aceite', 'codigo-forma-aceite'],
  ['formatos-pedagogicos', 'codigo-formato-pedagogico'],
  ['naturezas-legais', 'codigo-natureza-legal'],
  ['origens-data-fase', 'codigo-origem-data-fase'],
  ['regras-remanejamento', 'codigo-regra-remanejamento'],
  ['tipos-local-oferta', 'codigo-tipo-local-oferta'],
  ['programas-oferta', 'codigo-programa-de-oferta'],
  ['regimes-funcionamento', 'codigo-regime-de-funcionamento'],
  ['regimes-turno', 'codigo-regime-de-turno'],
  ['turnos-oferta', 'codigo-turno-oferta'],
];

describe('VocabulariosDeConfiguracaoApi', () => {
  it.each(vocabularios)('consulta %s com a mídia do contrato', async (caminho, mime) => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: 'http://localhost:5000' },
      ],
    });
    const resposta = firstValueFrom(TestBed.inject(VocabulariosDeConfiguracaoApi).listar(caminho));
    const http = TestBed.inject(HttpTestingController);
    const req = http.expectOne(`http://localhost:5000/api/configuracao/vocabularios/${caminho}`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept(mime, 1));
    req.flush(ITENS_DE_VOCABULARIO);
    const resultado = await resposta;
    expect(resultado.ok && resultado.data).toEqual(ITENS_DE_VOCABULARIO);
    http.verify();
  });
});
