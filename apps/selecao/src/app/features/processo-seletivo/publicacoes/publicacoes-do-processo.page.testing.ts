import { EnvironmentProviders, Provider } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { PUBLICACOES_BASE_PATH, type TipoAtoPublicadoDto } from '@uniplus/shared-data/publicacoes';
import {
  SELECAO_BASE_PATH,
  SituacaoDoProdutoPrevistoCodigo,
  StatusProcessoCodigo,
  type AtoDoProcessoDto,
  type ProcessoSeletivoDto,
  type ProdutoPrevistoDto,
  type ProdutosPrevistosDoProcessoDto,
} from '@uniplus/shared-data/selecao';

import { PublicacoesDoProcessoPage } from './publicacoes-do-processo.page';

const BASE = 'http://localhost:5000';
export const PROCESSO_ID = '01960000-0000-7000-0000-0000000005aa';
const ROTA_PROCESSO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}`;
export const ROTA_ATOS = `${ROTA_PROCESSO}/atos`;
export const ROTA_TIPOS = `${BASE}/api/publicacoes/tipos-ato`;
export const ROTA_PREVISTOS = `${ROTA_PROCESSO}/produtos-previstos`;
export const ROTA_CAMPOS = `${BASE}/api/selecao/campos-divulgacao`;
export const ROTA_FASES = `${BASE}/api/configuracao/fases-canonicas`;
export const ERRO_503 = { status: 503, statusText: 'Service Unavailable' };

const TIPO_PADRAO: Omit<TipoAtoPublicadoDto, 'id' | 'codigo' | 'nome'> = {
  congelaConfiguracao: false,
  unicoPorObjeto: false,
  efeitoIrreversivel: false,
  ehResultado: false,
  publicavelComoAvulso: true,
  exigeAtoCorrigido: false,
  vigenciaInicio: '2026-01-01',
  vigenciaFim: null,
  baseLegal: null,
  criadoEm: '2026-01-01T00:00:00Z',
};

function tipo(
  codigo: string,
  sobrescritas: Partial<TipoAtoPublicadoDto> = {},
): TipoAtoPublicadoDto {
  return { id: `id-${codigo}`, codigo, nome: codigo, ...TIPO_PADRAO, ...sobrescritas };
}

const ATO_PADRAO: Omit<AtoDoProcessoDto, 'id' | 'documentoPrincipal' | 'anexos'> = {
  tipoCodigo: 'AVISO',
  tipoNome: 'Aviso',
  numero: null,
  dataDoAto: '2026-10-10',
  publicadoEm: '2026-10-10T15:00:00Z',
  assinante: 'Pró-reitoria de Ensino',
  atoCorrigidoId: null,
  motivoDaCorrecao: null,
  politicaDeDivulgacaoConfirmada: false,
};

function documentoPrincipalDe(id: string): AtoDoProcessoDto['documentoPrincipal'] {
  return {
    documentoAPublicarId: `doc-${id}`,
    nomeArquivo: `${id}.pdf`,
    nomeDeExibicao: null,
    tipoDeMidia: 'application/pdf',
    hashSha256: 'a'.repeat(64),
  };
}

export function ato(id: string, sobrescritas: Partial<AtoDoProcessoDto> = {}): AtoDoProcessoDto {
  return {
    id,
    ...ATO_PADRAO,
    documentoPrincipal: documentoPrincipalDe(id),
    anexos: [],
    ...sobrescritas,
  };
}

const ITEM_PADRAO: Omit<ProdutoPrevistoDto, 'id' | 'correcoes'> = {
  tipoCodigo: 'RESULTADO_HOMOLOGACAO',
  tipoNome: 'Resultado da homologação',
  papel: {
    codigo: 'PRELIMINAR' as NonNullable<ProdutoPrevistoDto['papel']>['codigo'],
    rotulo: 'Preliminar',
  },
  situacao: { codigo: SituacaoDoProdutoPrevistoCodigo.aberto, rotulo: 'Aberto' },
  ato: null,
  podePublicar: true,
  impedimento: null,
};

export function item(
  id: string,
  sobrescritas: Partial<ProdutoPrevistoDto> = {},
): ProdutoPrevistoDto {
  return { id, ...ITEM_PADRAO, correcoes: [], ...sobrescritas };
}

export function previstos(...itens: readonly ProdutoPrevistoDto[]): ProdutosPrevistosDoProcessoDto {
  return {
    numeroDaVersao: 1,
    politicaDeDivulgacao: { camposPublicos: ['numero_inscricao'], justificativa: null },
    fases: [{ id: 'f1', codigo: 'INSCRICAO', ordem: 1, produtos: itens, etapas: [] }],
    etapasSemFase: [],
  };
}

export const CAMPOS = [
  {
    codigo: 'numero_inscricao',
    nome: 'Número de inscrição',
    obrigatorio: true,
    exigeJustificativa: false,
  },
];
export const FASES = [{ id: 'fase-1', codigo: 'INSCRICAO', nome: 'Inscrição' }];

const TIPOS = [
  tipo('EDITAL_ABERTURA', { congelaConfiguracao: true, publicavelComoAvulso: false }),
  tipo('AVISO'),
  tipo('ERRATA', { exigeAtoCorrigido: true }),
];

/** Cede o event loop para a cadeia de `await` da página avançar até a próxima requisição. */
export function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function botao(linha: HTMLTableRowElement, texto: string): HTMLButtonElement | undefined {
  return Array.from(linha.querySelectorAll('button')).find((b) => b.textContent?.trim() === texto);
}

export function temCorrigir(linha: HTMLTableRowElement): boolean {
  return botao(linha, 'Corrigir') !== undefined;
}

function provedoresDaPagina(
  permissoes: () => readonly string[],
): (Provider | EnvironmentProviders)[] {
  return [
    { provide: PermissoesService, useValue: { tem: (c: string) => permissoes().includes(c) } },
    provideHttpClient(withInterceptors([apiResultInterceptor])),
    provideHttpClientTesting(),
    provideRouter([]),
    { provide: SELECAO_BASE_PATH, useValue: BASE },
    { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
    { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
    { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: PROCESSO_ID })) } },
  ];
}

/** A página aberta contra o servidor simulado, com as respostas de cada leitura que ela faz. */
export class PaginaDePublicacoes {
  permissoesConcedidas: readonly string[] = ['selecao:processos:publicar'];
  readonly controller: HttpTestingController;
  fixture!: ComponentFixture<PublicacoesDoProcessoPage>;
  host!: HTMLElement;

  constructor() {
    TestBed.configureTestingModule({
      imports: [PublicacoesDoProcessoPage],
      providers: provedoresDaPagina(() => this.permissoesConcedidas),
    });
    this.controller = TestBed.inject(HttpTestingController);
  }

  iniciar(): void {
    this.fixture = TestBed.createComponent(PublicacoesDoProcessoPage);
    this.host = this.fixture.nativeElement as HTMLElement;
    this.fixture.detectChanges();
  }

  async estabilizar(): Promise<void> {
    await this.fixture.whenStable();
    this.fixture.detectChanges();
  }

  responderProcesso(status: StatusProcessoCodigo): void {
    this.controller.expectOne(ROTA_PROCESSO).flush({
      id: PROCESSO_ID,
      nome: 'Medicina 2027',
      status: { codigo: status, rotulo: status },
    } as ProcessoSeletivoDto);
  }

  falharProcesso(): void {
    this.controller.expectOne(ROTA_PROCESSO).flush(null, ERRO_503);
  }

  responderPrevistos(itens: ProdutosPrevistosDoProcessoDto, camposFalham = false): void {
    this.controller.expectOne(ROTA_PREVISTOS).flush(itens);
    if (camposFalham) this.controller.expectOne(ROTA_CAMPOS).flush(null, ERRO_503);
    else this.controller.expectOne(ROTA_CAMPOS).flush(CAMPOS);
    this.controller.expectOne((r) => r.url === ROTA_FASES).flush(FASES);
  }

  falharPrevistos(): void {
    this.controller.expectOne(ROTA_PREVISTOS).flush(null, ERRO_503);
    this.controller.expectOne(ROTA_CAMPOS).flush(CAMPOS);
    this.controller.expectOne((r) => r.url === ROTA_FASES).flush(FASES);
  }

  responderTipos(): void {
    this.controller.expectOne((r) => r.url === ROTA_TIPOS).flush(TIPOS);
  }

  falharTipos(): void {
    this.controller.expectOne((r) => r.url === ROTA_TIPOS).flush(null, ERRO_503);
  }

  private responderLeituraInicial(
    status: StatusProcessoCodigo,
    atos: readonly AtoDoProcessoDto[],
  ): void {
    this.responderProcesso(status);
    this.controller.expectOne(ROTA_ATOS).flush(atos);
    this.responderTipos();
  }

  async abrir(
    status: StatusProcessoCodigo,
    atos: readonly AtoDoProcessoDto[],
    itensPrevistos: ProdutosPrevistosDoProcessoDto = previstos(),
    camposFalham = false,
  ): Promise<void> {
    this.iniciar();
    this.responderLeituraInicial(status, atos);
    if (status !== StatusProcessoCodigo.rascunho) {
      // Os itens do edital só são pedidos depois de o processo dizer que já não é rascunho.
      await tick();
      this.responderPrevistos(itensPrevistos, camposFalham);
    }
    await this.estabilizar();
  }

  async abrirPublicadoComFalhaEm(onde: 'tipos' | 'previstos'): Promise<void> {
    this.iniciar();
    this.responderProcesso(StatusProcessoCodigo.publicado);
    this.controller.expectOne(ROTA_ATOS).flush([]);
    if (onde === 'tipos') this.falharTipos();
    else this.responderTipos();
    await tick();
    if (onde === 'previstos') this.falharPrevistos();
    else this.responderPrevistos(previstos());
    await this.estabilizar();
  }

  linhas(): HTMLTableRowElement[] {
    return Array.from(this.host.querySelectorAll('sel-atos-do-processo tbody tr'));
  }

  linhasDosPrevistos(): HTMLTableRowElement[] {
    return Array.from(this.host.querySelectorAll('sel-previstos-no-edital tbody tr'));
  }

  botaoDe(texto: string): HTMLButtonElement | undefined {
    return Array.from(this.host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(texto),
    );
  }
}
