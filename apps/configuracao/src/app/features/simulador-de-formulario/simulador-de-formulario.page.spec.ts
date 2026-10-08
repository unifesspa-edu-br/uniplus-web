import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { VENDOR_MIME_TOKEN, apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SimuladorDeFormularioPage } from './simulador-de-formulario.page';

const BASE = 'http://localhost:5000';

const ID = '01960000-0000-7000-0000-0000000000a1';

/** O renderizável mínimo de um modelo: uma etapa com um campo. */
const RENDERIZAVEL = {
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
};

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
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  const fixture = { detectChanges: (): void => harness.detectChanges() };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'simulador', component: SimuladorDeFormularioPage }]),
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: GEO_BASE_PATH, useValue: BASE },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  const abrir = (url = '/simulador'): Promise<SimuladorDeFormularioPage> =>
    harness.navigateByUrl(url, SimuladorDeFormularioPage);

  // Nenhuma chamada além das que cada teste espera: abrir e responder não falam com a API.
  afterEach(() => http.verify());

  const tela = (): HTMLElement => harness.routeNativeElement as HTMLElement;
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
    [...tela().querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === texto,
    ) as HTMLButtonElement;

  it('abre o caso do corpus sem chamada à API, com o aviso de simulação, e esconde a aldeia do endereço urbano', async () => {
    await abrir();
    await importar(JSON.stringify(CASO));

    expect(tela().querySelector('.aviso-de-simulacao')?.textContent).toContain('nada é gravado');
    expect(tela().textContent).toContain('TIPO_ENDERECO');
    expect(tela().textContent).not.toContain('NOME_ALDEIA');
  });

  it('o arquivo fora da forma mostra o erro com o caminho do problema', async () => {
    await abrir();
    await importar('{"etapas": []}');

    expect(tela().querySelector('#simulador-arquivo-erro')?.textContent).toContain('(em regras)');
  });

  it('importar outro arquivo cancela a conferência em andamento', async () => {
    await abrir();
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
    await abrir();
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

    const linhas = [...tela().querySelectorAll('tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => td.textContent?.trim()).join(' '),
    );
    expect(linhas).toContain('Campo NOME_ALDEIA visivel "FALSO" "VERDADEIRO"');
  });

  const listaDeModelos = (ativo = true): void => {
    const req = http.expectOne(
      (r) =>
        r.url === `${BASE}/api/configuracao/admin/modelos-formulario` && !r.params.has('ativo'),
    );
    req.flush([{ id: ID, codigo: 'INSC', nome: 'Inscrição', ativo }]);
  };
  const renderizavel = (): void => {
    const req = http.expectOne(
      `${BASE}/api/configuracao/admin/modelos-formulario/${ID}/renderizavel`,
    );
    expect(req.request.context.get(VENDOR_MIME_TOKEN)).toEqual({
      resource: 'formulario',
      version: 2,
    });
    req.flush(RENDERIZAVEL);
    harness.detectChanges();
  };

  it('sem parâmetro abre na origem arquivo, sem chamada à API', async () => {
    await abrir();

    expect(tela().querySelector('input[type="file"]')).not.toBeNull();
    expect(tela().querySelector('ui-select')).toBeNull();
  });

  it('?modelo= na URL lista os modelos e carrega o renderizável do modelo', async () => {
    await abrir(`/simulador?modelo=${ID}`);
    listaDeModelos();
    renderizavel();

    expect(tela().querySelector('input[type="file"]')).toBeNull();
    expect((tela().querySelector('select') as HTMLSelectElement).value).toBe(ID);
    expect(tela().textContent).toContain('cadastro institucional');
    expect(tela().querySelector('.aviso-de-simulacao')?.textContent).toContain('nada é gravado');
    expect(tela().textContent).toContain('Nome social');
  });

  it('?modelo= de um modelo desativado o mostra escolhido, marcado como desativado', async () => {
    await abrir(`/simulador?modelo=${ID}`);
    listaDeModelos(false);
    renderizavel();

    const select = tela().querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe(ID);
    expect(select.selectedOptions[0]?.textContent).toContain('INSC — Inscrição (desativado)');
  });

  it('escolher a origem modelo e o modelo põe o modelo na URL e o carrega', async () => {
    await abrir();
    botao('Modelo de formulário').click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/simulador?origem=modelo');
    listaDeModelos();
    harness.detectChanges();

    const select = tela().querySelector('select') as HTMLSelectElement;
    select.value = ID;
    select.dispatchEvent(new Event('change'));
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(`/simulador?modelo=${ID}`);
    renderizavel();
    expect(tela().textContent).toContain('Nome social');
  });

  it('a falha ao carregar o modelo mostra o alerta com a opção de tentar de novo', async () => {
    await abrir(`/simulador?modelo=${ID}`);
    listaDeModelos();
    http.expectOne(`${BASE}/api/configuracao/admin/modelos-formulario/${ID}/renderizavel`).flush(
      { type: 'about:blank', title: 'Modelo não encontrado', status: 404 },
      {
        status: 404,
        statusText: 'Not Found',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );
    harness.detectChanges();

    expect(tela().querySelector('ui-alert')?.textContent).toContain(
      'Não foi possível carregar o modelo',
    );
    botao('Tentar novamente').click();
    renderizavel();
    expect(tela().textContent).toContain('Nome social');
  });
});
