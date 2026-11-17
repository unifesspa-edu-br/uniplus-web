import { HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type EnvironmentProviders, type Provider, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, type Observable } from 'rxjs';
import { vi } from 'vitest';
import { ligarRelogioControlado, passarOTempo } from '@uniplus/shared-testing';
import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import { RELOGIO } from '@uniplus/shared-core/relogio';
import { type ApiResult, apiFailure, apiOk, apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  type AvaliacaoDaInscricaoDto,
  type AvaliacaoDaInscricaoRequest,
  type ReciboDaInscricaoDto,
  type FormularioRenderizavelDto,
  type InscricaoDto,
  type InscricaoRequest,
  SELECAO_BASE_PATH,
  SituacaoInscricao,
} from '@uniplus/shared-data/selecao';
import {
  type ArquivoEnviado,
  BUSCA_DE_CEP,
  BUSCA_DE_MUNICIPIOS,
  LEITURA_DE_MUNICIPIO_POR_CODIGO,
} from '@uniplus/shared-ui/components';

import type { OfertaDaInscricao } from '../oferta-da-inscricao';
import { EnvioDeDocumentosDaInscricao } from './envio-de-documentos-da-inscricao';
import { FORMULARIO_DE_INSCRICAO_MOCK } from './inscricao-do-candidato.mock';
import { InscricaoDoCandidatoPage } from './inscricao-do-candidato.page';
import { LeituraDaInscricao } from './leitura-da-inscricao';
import { InscricaoDoCandidatoService } from './inscricao-do-candidato.service';

/** Fernanda Drumond, persona fictícia do portal de documentação. */
export const CPF_DA_CONTA = '69959836371';
export const NOME_DA_CONTA = 'Fernanda Laura Nicole Drumond';
export const PROCESSO = '0199e000-0000-7000-8000-0000000000d1';

export const MEDICINA: OfertaDaInscricao = { id: 'oferta-1', nome: 'Medicina — Marabá' };
export const DIREITO: OfertaDaInscricao = { id: 'oferta-2', nome: 'Direito — Marabá' };
export const ENGENHARIA: OfertaDaInscricao = {
  id: 'oferta-3',
  nome: 'Engenharia da Computação — Marabá',
};

export const ok = <T>(data: T): Observable<ApiResult<T>> => of(apiOk(data, 200, new HttpHeaders()));

export const problema = (status: number, code: string) =>
  apiFailure(
    { type: 'about:blank', title: 'Recusa', status, code, traceId: '' },
    status,
    new HttpHeaders(),
  );

export const RECIBO: ReciboDaInscricaoDto = {
  inscricaoId: '0199e000-0000-7000-8000-0000000000e1',
  numeroInscricao: '2027-000001',
  numeroDoComprovante: 2,
  instante: '2026-11-07T15:00:00Z',
};

export const SEM_DOCUMENTOS: AvaliacaoDaInscricaoDto['documentos'] = { fases: [] };

/** A avaliação em que o candidato concorre nas modalidades de nome dado. */
export const concorrendoEm = (...nomes: string[]): AvaliacaoDaInscricaoDto => ({
  modalidades: {
    derivada: true,
    situacao: 'CONCORRE',
    itens: nomes.map((nome, ordem) => ({ codigo: `M${ordem}`, nome, ordem })),
    pendencias: [],
  },
  documentos: SEM_DOCUMENTOS,
});
export const SEM_DERIVACAO: AvaliacaoDaInscricaoDto = {
  modalidades: { derivada: false, situacao: null, itens: [], pendencias: [] },
  documentos: SEM_DOCUMENTOS,
};

/** O formulário de teste com o bloco das modalidades, que dependem do nome. */
export const COM_MODALIDADES: FormularioRenderizavelDto = {
  ...FORMULARIO_DE_INSCRICAO_MOCK,
  dependenciasDaAvaliacao: { fatos: ['NOME'], grupos: [] },
  dependenciasDoFator: null,
  etapas: [
    ...FORMULARIO_DE_INSCRICAO_MOCK.etapas,
    {
      codigo: 'MODALIDADES',
      codigoNasRegras: null,
      ordem: 3,
      tipo: 'BLOCO',
      bloco: 'MODALIDADES_CALCULADAS',
      titulo: 'Modalidades de concorrência',
      descricao: null,
      aviso: null,
    },
  ],
};

/** O formulário de teste que também coleta o nome social. */
export const COM_NOME_SOCIAL: FormularioRenderizavelDto = {
  ...FORMULARIO_DE_INSCRICAO_MOCK,
  fatosColetados: [
    ...FORMULARIO_DE_INSCRICAO_MOCK.fatosColetados,
    {
      ...FORMULARIO_DE_INSCRICAO_MOCK.fatosColetados[0],
      fatoCodigo: 'DESEJA_NOME_SOCIAL',
      ordem: 8,
      rotulo: 'Deseja usar nome social',
      tipoRenderizacao: 'BOOLEANO',
      formato: null,
    },
    {
      ...FORMULARIO_DE_INSCRICAO_MOCK.fatosColetados[0],
      fatoCodigo: 'NOME_SOCIAL',
      ordem: 9,
      rotulo: 'Nome social',
      formato: null,
    },
  ],
  regras: {
    ...FORMULARIO_DE_INSCRICAO_MOCK.regras,
    etapas: FORMULARIO_DE_INSCRICAO_MOCK.regras.etapas.map((e, i) =>
      i === 0
        ? {
            ...e,
            itens: [
              ...e.itens,
              { ...e.itens[0], fatoCodigo: 'DESEJA_NOME_SOCIAL', formato: null },
              { ...e.itens[0], fatoCodigo: 'NOME_SOCIAL', formato: null },
            ],
          }
        : e,
    ),
  },
};

const INSCRICAO_EM_RASCUNHO: InscricaoDto = {
  id: 'inscricao-1',
  processoSeletivoId: PROCESSO,
  situacao: SituacaoInscricao.rascunho,
  numeroInscricao: null,
  versaoFormularioId: 'versao-1',
  ofertaCursoId: null,
  ofertaCursoSegundaOpcaoId: null,
  numeroDeOpcoesDeCurso: 1,
  ofertas: [],
  respostas: {},
  derivados: {},
  grupos: {},
  aceites: [],
  eTag: '"inscricao-1:1"',
  avaliacao: SEM_DERIVACAO,
};

export const inscricao = (outros: Partial<InscricaoDto> = {}): InscricaoDto => ({
  ...INSCRICAO_EM_RASCUNHO,
  ...outros,
});

/** Tudo o que o formulário de teste pede, com os dados da persona: o envio sai sem pendência. */
export const RESPONDIDA: Partial<InscricaoDto> = {
  respostas: {
    NOME: 'Fernanda Laura Nicole Drumond',
    DATA_NASCIMENTO: '1970-02-02',
    ENDERECO_RESIDENCIAL: {
      cep: '79096730',
      logradouro: 'Rua Dario Tomazelli Júnior',
      numero: '743',
      bairro: 'Caiobá',
      cidade: { codigoIbge: '5002704', nome: 'Campo Grande', uf: 'MS' },
      nivelResolucao: 'logradouro',
      origem: 'logradouro',
    },
  },
  aceites: [{ codigo: 'VERACIDADE', versaoId: 'v1', hashVersao: 'h1' }],
};

export class ServicoDublê extends InscricaoDoCandidatoService {
  inscricao = inscricao();
  formulario: FormularioRenderizavelDto = FORMULARIO_DE_INSCRICAO_MOCK;
  ofertas: readonly OfertaDaInscricao[] = [MEDICINA];
  /** Quantas opções de curso a versão fixada admite. */
  opcoes = 1;
  readonly salvos: InscricaoRequest[] = [];
  readonly enviados: InscricaoRequest[] = [];
  readonly avaliacoes: AvaliacaoDaInscricaoRequest[] = [];
  recusaDoEnvio: ApiResult<ReciboDaInscricaoDto> | null = null;

  /** A inscrição como a API a devolve: com as ofertas e o número de opções da versão fixada. */
  private lida(): InscricaoDto {
    return {
      ...this.inscricao,
      numeroDeOpcoesDeCurso: this.opcoes,
      ofertas: this.ofertas.map((o) => ({
        ofertaCursoOrigemId: o.id,
        cursoNome: o.nome,
        cursoGrau: 'Bacharelado',
        unidadeOfertanteNome: 'Campus Marabá',
        turnos: [],
      })),
    };
  }
  iniciar = () => ok(this.lida());
  obter = () => ok(this.lida());
  salvar = (_: string, request: InscricaoRequest) => {
    this.salvos.push(request);
    return ok(this.inscricao);
  };
  avaliar = (_: string, request: AvaliacaoDaInscricaoRequest) => {
    this.avaliacoes.push(request);
    return ok(concorrendoEm('Ampla concorrência'));
  };
  submeter = (_: string, request: InscricaoRequest) => {
    this.enviados.push(request);
    return this.recusaDoEnvio ? of(this.recusaDoEnvio) : ok(RECIBO);
  };
}

export const botao = (tela: HTMLElement, texto: string): HTMLButtonElement =>
  [...tela.querySelectorAll('button')].find((b) =>
    b.textContent?.trim().startsWith(texto),
  ) as HTMLButtonElement;

export const indisponivel = (botao: HTMLElement | undefined): boolean =>
  botao?.getAttribute('aria-disabled') === 'true';

export const passos = (tela: HTMLElement): HTMLButtonElement[] => [
  ...tela.querySelectorAll<HTMLButtonElement>('ui-formulario-do-candidato nav button'),
];

export const campoDe = (tela: HTMLElement, fato: string): HTMLInputElement =>
  tela.querySelector(`[data-campo="${fato}"] input`) as HTMLInputElement;

/** A página aberta com o serviço, a conta, o envio de documentos e o relógio de teste. */
export class CenarioDaInscricao {
  readonly servico = new ServicoDublê();
  readonly arquivosDoEnvio = signal<readonly ArquivoEnviado[]>([]);
  readonly mudancasDoEnvio = signal(0);
  readonly ocupadoDoEnvio = signal(false);
  readonly conta = signal<Record<string, string | undefined>>({ cpf: CPF_DA_CONTA });
  readonly leituraDeMunicipio = vi.fn();
  /** O instante que o relógio da página devolve. */
  agora = new Date('2026-12-11T13:30:00Z');
  fixture!: ComponentFixture<InscricaoDoCandidatoPage>;

  static preparar(): CenarioDaInscricao {
    ligarRelogioControlado();
    const cenario = new CenarioDaInscricao();
    TestBed.configureTestingModule({
      imports: [InscricaoDoCandidatoPage],
      providers: cenario.provedores(),
    });
    return cenario;
  }

  encerrar(): void {
    vi.useRealTimers();
    vi.restoreAllMocks();
    TestBed.inject(HttpTestingController).verify();
  }

  async abrir(): Promise<HTMLElement> {
    this.criarPagina();
    await this.atenderOFormulario();
    return this.fixture.nativeElement as HTMLElement;
  }

  abrirSemAtender(): LeituraDaInscricao {
    this.criarPagina();
    this.fixture.detectChanges();
    return this.fixture.debugElement.injector.get(LeituraDaInscricao);
  }

  /** Responde ao GET do formulário que a leitura pede depois de iniciar a inscrição. */
  async atenderOFormulario(): Promise<void> {
    const http = TestBed.inject(HttpTestingController);
    this.fixture.detectChanges();
    await Promise.resolve();
    this.fixture.detectChanges();
    for (const pedido of http.match((r) => r.url.endsWith('/inscricao/formulario'))) {
      pedido.flush(this.servico.formulario);
    }
    await passarOTempo(0);
    this.fixture.detectChanges();
  }

  async clicar(elemento: HTMLElement): Promise<void> {
    elemento.click();
    await this.atenderOFormulario();
  }

  async irAoPasso(tela: HTMLElement, nome: string): Promise<void> {
    await this.clicar(passos(tela).find((b) => b.textContent?.includes(nome)) as HTMLElement);
  }

  async escolherCurso(tela: HTMLElement, id: string): Promise<void> {
    const select = tela.querySelector('#inscricao-oferta') as HTMLSelectElement;
    select.value = id;
    select.dispatchEvent(new Event('change'));
    this.fixture.detectChanges();
    await passarOTempo(0);
  }

  private criarPagina(): void {
    this.fixture = TestBed.createComponent(InscricaoDoCandidatoPage);
    this.fixture.componentRef.setInput('processoId', PROCESSO);
  }

  private provedores(): (Provider | EnvironmentProviders)[] {
    return [
      ...this.provedoresDaApi(),
      this.provedorDoEnvioDeDocumentos(),
      this.provedorDaConta(),
      ...this.provedoresDoEndereco(),
      this.provedorDoRelogio(),
    ];
  }

  private provedoresDaApi(): (Provider | EnvironmentProviders)[] {
    return [
      provideRouter([]),
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      { provide: SELECAO_BASE_PATH, useValue: 'http://api.teste' },
      { provide: InscricaoDoCandidatoService, useValue: this.servico },
    ];
  }

  private provedorDoEnvioDeDocumentos(): Provider {
    const paraOProcesso = () => ({
      arquivos: this.arquivosDoEnvio,
      mudancas: this.mudancasDoEnvio,
      ocupado: this.ocupadoDoEnvio,
      enviar: vi.fn(),
      remover: vi.fn(),
    });
    return { provide: EnvioDeDocumentosDaInscricao, useValue: { paraOProcesso } };
  }

  private provedorDaConta(): Provider {
    return { provide: UserContextService, useValue: { user: this.conta } };
  }

  private provedoresDoEndereco(): Provider[] {
    return [
      { provide: BUSCA_DE_CEP, useValue: () => of({ ok: false }) },
      { provide: BUSCA_DE_MUNICIPIOS, useValue: () => of({ ok: true, data: [] }) },
      { provide: LEITURA_DE_MUNICIPIO_POR_CODIGO, useValue: this.leituraDeMunicipio },
    ];
  }

  private provedorDoRelogio(): Provider {
    return { provide: RELOGIO, useValue: () => this.agora };
  }
}
