import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SimuladorDeFormularioPage } from './simulador-de-formulario.page';

const BASE = 'http://localhost:5000';

/** Um caso do corpus: regras e respostas, sem apresentação. */
const CASO = {
  descricao: 'Endereço urbano esconde a aldeia.',
  regras: {
    etapas: [
      {
        codigo: 'DADOS',
        itens: [
          {
            fatoCodigo: 'TIPO_ENDERECO',
            obrigatoriedade: 'SEMPRE',
            restricoes: [],
            oferta: ['ALDEIA', 'URBANO'],
          },
          {
            fatoCodigo: 'NOME_ALDEIA',
            obrigatoriedade: 'SEMPRE',
            restricoes: [],
            exibicao: [[{ fato: 'TIPO_ENDERECO', operador: 'IGUAL', valor: 'ALDEIA' }]],
          },
        ],
        grupos: [],
      },
    ],
    termos: [],
    derivacoes: [],
    agregados: [],
  },
  respostas: { TIPO_ENDERECO: 'URBANO' },
  grupos: {},
  etapasConcluidas: [],
  pressupostos: {},
};

describe('SimuladorDeFormularioPage', () => {
  let fixture: ComponentFixture<SimuladorDeFormularioPage>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SimuladorDeFormularioPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: GEO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(SimuladorDeFormularioPage);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  // Nenhuma chamada além das que cada teste espera: abrir e responder não falam com a API.
  afterEach(() => http.verify());

  const tela = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const importar = async (conteudo: string): Promise<void> => {
    const input = tela().querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: [new File([conteudo], 'caso.json', { type: 'application/json' })],
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    // A leitura do arquivo termina numa tarefa seguinte do navegador: espera a tela reagir a ele.
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(
        tela().querySelector('#simulador-arquivo-erro, ui-formulario-do-candidato'),
      ).not.toBeNull();
    });
  };
  const botao = (texto: string): HTMLButtonElement =>
    Array.from(tela().querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(
      (b) => b.textContent?.trim() === texto,
    ) as HTMLButtonElement;

  it('abre o caso do corpus sem chamada à API, com o aviso de simulação, e esconde a aldeia do endereço urbano', async () => {
    await importar(JSON.stringify(CASO));

    expect(tela().querySelector('.aviso-de-simulacao')?.textContent).toContain('nada é gravado');
    expect(tela().textContent).toContain('TIPO_ENDERECO');
    expect(tela().textContent).not.toContain('NOME_ALDEIA');
  });

  it('o arquivo fora da forma mostra o erro com o caminho do problema', async () => {
    await importar('{"etapas": []}');

    expect(tela().querySelector('#simulador-arquivo-erro')?.textContent).toContain('(em regras)');
  });

  it('importar outro arquivo cancela a conferência em andamento', async () => {
    await importar(JSON.stringify(CASO));
    botao('Conferir com o servidor').click();
    const req = http.expectOne(`${BASE}/api/configuracao/admin/avaliacoes-de-formulario`);

    await importar(JSON.stringify({ ...CASO, respostas: {} }));

    // O formulário do arquivo anterior já está na tela: espera a leitura do novo chegar a ela.
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(req.cancelled).toBe(true);
    });
    expect(tela().querySelector('.simulador-formulario__conferencia')?.textContent?.trim()).toBe(
      '',
    );
  });

  it('conferir com o servidor só faz a avaliação sem cadastro e mostra a divergência', async () => {
    await importar(JSON.stringify(CASO));

    botao('Conferir com o servidor').click();
    const req = http.expectOne(`${BASE}/api/configuracao/admin/avaliacoes-de-formulario`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.respostas).toEqual({ TIPO_ENDERECO: 'URBANO' });
    req.flush({
      etapas: [{ codigo: 'DADOS', visivel: 'VERDADEIRO' }],
      campos: [
        {
          fatoCodigo: 'TIPO_ENDERECO',
          etapaCodigo: 'DADOS',
          estado: 'RESOLVIDO',
          visivel: 'VERDADEIRO',
          obrigatorio: 'VERDADEIRO',
          restricoesVioladas: [],
          impedido: 'FALSO',
          opcoes: null,
        },
        {
          fatoCodigo: 'NOME_ALDEIA',
          etapaCodigo: 'DADOS',
          estado: 'INDETERMINADO',
          visivel: 'VERDADEIRO',
          obrigatorio: 'VERDADEIRO',
          restricoesVioladas: [],
          impedido: 'FALSO',
          opcoes: null,
        },
      ],
      grupos: [],
      termos: [],
    });
    fixture.detectChanges();

    const linhas = Array.from(
      tela().querySelectorAll('tbody tr') as NodeListOf<HTMLTableRowElement>,
    ).map((tr) =>
      Array.from(tr.querySelectorAll('td') as NodeListOf<HTMLTableCellElement>)
        .map((td) => td.textContent?.trim())
        .join(' '),
    );
    expect(linhas).toContain('Campo NOME_ALDEIA visivel "FALSO" "VERDADEIRO"');
  });
});
