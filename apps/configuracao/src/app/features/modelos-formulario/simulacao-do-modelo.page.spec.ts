import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { VENDOR_MIME_TOKEN, apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { afterEach, describe, expect, it } from 'vitest';
import { SimulacaoDoModeloPage } from './simulacao-do-modelo.page';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-0000000000a1';

describe('SimulacaoDoModeloPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('carrega o modelo renderizável e o simula sem nenhuma outra chamada à API', () => {
    TestBed.configureTestingModule({
      imports: [SimulacaoDoModeloPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: GEO_BASE_PATH, useValue: BASE },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: ID }) } },
        },
      ],
    });
    const fixture = TestBed.createComponent(SimulacaoDoModeloPage);
    fixture.detectChanges();

    const req = TestBed.inject(HttpTestingController).expectOne(
      `${BASE}/api/configuracao/admin/modelos-formulario/${ID}/renderizavel`,
    );
    expect(req.request.context.get(VENDOR_MIME_TOKEN)).toEqual({
      resource: 'formulario',
      version: 2,
    });
    req.flush({
      finalidade: 'INSCRICAO',
      titulo: null,
      etapas: [
        {
          codigo: 'DADOS',
          codigoNasRegras: 'DADOS',
          ordem: 0,
          tipo: 'SECAO',
          bloco: null,
          titulo: 'Dados',
          descricao: null,
          aviso: null,
        },
      ],
      termos: [],
      fatosColetados: [
        { fatoCodigo: 'NOME_SOCIAL', ordem: 0, rotulo: 'Nome social', tipoRenderizacao: 'TEXTO' },
      ],
      grupos: [],
      regras: {
        etapas: [
          {
            codigo: 'DADOS',
            itens: [{ fatoCodigo: 'NOME_SOCIAL', obrigatoriedade: 'NUNCA', restricoes: [] }],
            grupos: [],
          },
        ],
        termos: [],
        derivacoes: [],
        agregados: [],
      },
      pressupostos: [],
      dataReferenciaFatos: null,
    });
    fixture.detectChanges();

    const tela = fixture.nativeElement as HTMLElement;
    expect(tela.querySelector('.aviso-de-simulacao')?.textContent).toContain('nada é gravado');
    expect(tela.textContent).toContain('Nome social');
  });
});
