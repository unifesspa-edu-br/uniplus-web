import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { afterEach, describe, expect, it } from 'vitest';
import { SimulacaoDoProcessoPage } from './simulacao-do-processo.page';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-000000000515';

describe('SimulacaoDoProcessoPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('carrega o formulário da finalidade, com a comprovação documental, e o simula sem gravar nada', () => {
    TestBed.configureTestingModule({
      imports: [SimulacaoDoProcessoPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: GEO_BASE_PATH, useValue: BASE },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ id: ID, finalidade: 'HABILITACAO' }) },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(SimulacaoDoProcessoPage);
    fixture.detectChanges();

    TestBed.inject(HttpTestingController)
      .expectOne(
        `${BASE}/api/selecao/admin/processos-seletivos/${ID}/formularios/HABILITACAO/renderizavel`,
      )
      .flush({
        finalidade: 'HABILITACAO',
        titulo: null,
        etapas: [
          {
            codigo: 'DOCUMENTOS',
            codigoNasRegras: null,
            ordem: 0,
            tipo: 'BLOCO',
            bloco: 'COMPROVACAO_DOCUMENTAL',
            titulo: 'Documentos',
            descricao: null,
            aviso: null,
          },
        ],
        termos: [],
        fatosColetados: [],
        grupos: [],
        regras: { etapas: [], termos: [], derivacoes: [], agregados: [] },
        pressupostos: [],
        dataReferenciaFatos: null,
        comprovacaoDocumental: [
          {
            rotulo: 'Histórico escolar',
            aplicabilidade: 'TODOS',
            obrigatorio: true,
            formatos: { extensoes: [], tamanhoMaximoMb: 5 },
            modelo: null,
          },
        ],
      });
    fixture.detectChanges();

    const tela = fixture.nativeElement as HTMLElement;
    expect(tela.querySelector('h1')?.textContent).toContain('habilitação');
    expect(tela.textContent).toContain('Histórico escolar');
  });
});
