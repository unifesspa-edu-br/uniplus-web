import { fornecerVocabulariosDaRegra } from './wizard/shared/deliberacao/vocabularios-da-regra.testing';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, of } from 'rxjs';
import { apiOk } from '@uniplus/shared-core/http';
import {
  ModalidadeDto,
  BaseLegalBonusRegionalApi,
  TiposInstrumentoNormativoApi,
  PesosEnemApi,
  CondicoesAtendimentoApi,
  CursosApi,
  ModalidadesApi,
  OfertasCursoApi,
  RecursoAcessibilidadeApi,
  ReservaDemograficaApi,
  FatosCandidatoApi,
  ModelosFormularioApi,
  TermosConsentimentoApi,
  TipoDeficienciaApi,
  TipoProcessoDto,
  TiposProcessoApi,
  FasesCanonicasApi,
  PrecedenciasFaseApi,
  TiposBancaApi,
  TiposDocumentoApi,
  TiposEtapaApi,
  CategoriasDocumentoApi,
} from '@uniplus/shared-data/configuracao';
import { UnidadeDto, UnidadesApi } from '@uniplus/shared-data/organizacao';
import { GeoApi } from '@uniplus/shared-data/geo';
import { AtosApi, TiposAtoApi } from '@uniplus/shared-data/publicacoes';
import {
  ClassificacaoDoProcessoApi,
  CronogramaDoProcessoApi,
  DocumentosEAtosDoProcessoApi,
  FormulariosDoProcessoApi,
  FundamentoIsencaoDto,
  ProcessosSeletivosApi,
  PublicacaoDoProcessoApi,
  MotivosDeDecisaoApi,
  OpcoesDoRecursoApi,
  RegrasCatalogoApi,
  VagasDoProcessoApi,
  VocabulariosDaComprovacaoApi,
  VocabulariosDoPrazoEDaValidadeApi,
} from '@uniplus/shared-data/selecao';
import { ProcessoSeletivoPage } from './processo-seletivo.page';
import { opcoesDoRecursoApiDeTeste } from './wizard/passos/cronograma/catalogos/catalogos.testing';
import type { CriterioDesempateConfigurado } from './wizard/processo-seletivo.models';
import { provideApiDosTiposDeDecisao } from './wizard/shared/decisoes-da-fase-ou-etapa/tipos-de-decisao-da-api.testing';

export const CRITERIO_POR_AREA: CriterioDesempateConfigurado = {
  regraCodigo: 'DESEMPATE-MAIOR-NOTA-AREA-ENEM',
  regraVersao: '1',
  etapaRef: '',
  idadeMinima: '',
  fato: '',
  operador: '',
  valor: '',
  areas: ['REDACAO'],
};

const tiposProcessoApiStub = {
  listar: () => of(apiOk<readonly TipoProcessoDto[]>([], 200, new HttpHeaders())),
};

const unidadesApiStub = {
  listar: () => of(apiOk<readonly UnidadeDto[]>([], 200, new HttpHeaders())),
};

/** O passo 2 injeta a Geo para o seletor de município; esta suíte não busca nada. */
const geoApiStub = {
  listarCidades: () => of(apiOk<readonly never[]>([], 200, new HttpHeaders())),
};

/** O passo de pagamento lê o catálogo de fundamentos ao montar. */
export const listarFundamentos = () =>
  of(apiOk<readonly FundamentoIsencaoDto[]>([], 200, new HttpHeaders()));

const modalidadesApiStub = {
  listar: () => of(apiOk<readonly ModalidadeDto[]>([], 200, new HttpHeaders())),
};

/** Catálogos do passo de vagas: vazios, porque esta suíte cobre a página. */
const catalogoVazioStub = {
  listar: () => of(apiOk<readonly never[]>([], 200, new HttpHeaders())),
};

const vocabulariosDoPrazoEDaValidadeStub = {
  listarEscolhasDoPrazoDeEmissao: catalogoVazioStub.listar,
  listarEscolhasDaValidade: catalogoVazioStub.listar,
  listarUnidadesDoPrazoDeEmissao: catalogoVazioStub.listar,
  listarTiposDaDataDeReferencia: catalogoVazioStub.listar,
  listarEfeitosNaAnaliseDoDocumento: catalogoVazioStub.listar,
};

const vocabulariosDaComprovacaoStub = {
  listarFormasDeComprovacao: catalogoVazioStub.listar,
  listarFormatosPermitidos: catalogoVazioStub.listar,
  listarCriteriosDeDistincaoDeApresentacoes: catalogoVazioStub.listar,
  listarConsequenciasDeIndeferimento: catalogoVazioStub.listar,
};

export const opcoesDoRecursoApiStub = {
  listarUnidadesDePrazo: catalogoVazioStub.listar,
  listarEfeitosSuspensivos: catalogoVazioStub.listar,
  listarGuardasDaVaga: catalogoVazioStub.listar,
};

/**
 * A page provê `CadastroInicial`, que injeta o client de Processo
 * Seletivo. Nenhum teste desta suíte chega a gravar — o stub existe para o
 * grafo de injeção fechar sem `HttpClient` real.
 */
const processosSeletivosApiStub = { listarFundamentosIsencao: listarFundamentos };

/** A permissão de publicar é a que o fluxo de publicação exige; as demais ficam negadas. */
export const concedeSoPublicar = (codigo: string): boolean =>
  codigo === 'selecao:processos:publicar';

export const PAGE_PROVIDERS = [
  fornecerVocabulariosDaRegra(),
  provideRouter([]),
  provideApiDosTiposDeDecisao(),
  { provide: TiposProcessoApi, useValue: tiposProcessoApiStub },
  { provide: UnidadesApi, useValue: unidadesApiStub },
  { provide: GeoApi, useValue: geoApiStub },
  { provide: ModalidadesApi, useValue: modalidadesApiStub },
  { provide: CursosApi, useValue: catalogoVazioStub },
  { provide: OfertasCursoApi, useValue: catalogoVazioStub },
  { provide: ReservaDemograficaApi, useValue: catalogoVazioStub },
  { provide: OpcoesDoRecursoApi, useValue: opcoesDoRecursoApiDeTeste() },
  { provide: RegrasCatalogoApi, useValue: catalogoVazioStub },
  // O passo de bônus carrega o catálogo de base legal e o vocabulário de tipos de norma ao montar.
  { provide: BaseLegalBonusRegionalApi, useValue: catalogoVazioStub },
  { provide: TiposInstrumentoNormativoApi, useValue: catalogoVazioStub },
  // O passo da fórmula carrega o cadastro de Peso por Área, de onde sai a resolução do ENEM.
  {
    provide: PesosEnemApi,
    useValue: { ...catalogoVazioStub, listarAreas: catalogoVazioStub.listar },
  },
  // O passo do cronograma carrega os sete catálogos ao montar; esta suíte não
  // exercita a linha do tempo, e o grafo de injeção precisa fechar sem HTTP.
  { provide: FasesCanonicasApi, useValue: catalogoVazioStub },
  { provide: PrecedenciasFaseApi, useValue: catalogoVazioStub },
  { provide: TiposBancaApi, useValue: catalogoVazioStub },
  { provide: CategoriasDocumentoApi, useValue: catalogoVazioStub },
  { provide: TiposEtapaApi, useValue: catalogoVazioStub },
  { provide: TiposDocumentoApi, useValue: catalogoVazioStub },
  { provide: VocabulariosDaComprovacaoApi, useValue: vocabulariosDaComprovacaoStub },
  { provide: VocabulariosDoPrazoEDaValidadeApi, useValue: vocabulariosDoPrazoEDaValidadeStub },
  { provide: TiposAtoApi, useValue: catalogoVazioStub },
  { provide: MotivosDeDecisaoApi, useValue: catalogoVazioStub },
  { provide: OpcoesDoRecursoApi, useValue: opcoesDoRecursoApiStub },
  { provide: AtosApi, useValue: { obter: () => NEVER } },
  // O passo de atendimento carrega os três cadastros de Configuração ao
  // montar; esta suíte não exercita as escolhas, só a estrutura da página.
  { provide: CondicoesAtendimentoApi, useValue: catalogoVazioStub },
  { provide: RecursoAcessibilidadeApi, useValue: catalogoVazioStub },
  { provide: TipoDeficienciaApi, useValue: catalogoVazioStub },
  // O passo do formulário carrega o catálogo de fatos do candidato ao montar — é dele que
  // saem os dados que o certame pode coletar.
  { provide: FatosCandidatoApi, useValue: catalogoVazioStub },
  // E os termos de consentimento que ele pode exigir.
  { provide: TermosConsentimentoApi, useValue: { listarComVersoes: () => NEVER } },
  // E os modelos de que cada formulário pode partir.
  { provide: ModelosFormularioApi, useValue: catalogoVazioStub },
  { provide: ProcessosSeletivosApi, useValue: processosSeletivosApiStub },
  { provide: DocumentosEAtosDoProcessoApi, useValue: {} },
  { provide: PublicacaoDoProcessoApi, useValue: {} },
  { provide: FormulariosDoProcessoApi, useValue: {} },
  { provide: ClassificacaoDoProcessoApi, useValue: {} },
  { provide: VagasDoProcessoApi, useValue: {} },
  { provide: CronogramaDoProcessoApi, useValue: {} },
  { provide: PermissoesService, useValue: { tem: concedeSoPublicar } },
];

/** Compila a página com os provedores que fecham o grafo de injeção sem HTTP real. */
export async function configurarPagina(): Promise<void> {
  await TestBed.configureTestingModule({
    imports: [ProcessoSeletivoPage],
    providers: PAGE_PROVIDERS,
  }).compileComponents();
}

export function montarPagina() {
  const fixture = TestBed.createComponent(ProcessoSeletivoPage);
  fixture.detectChanges();
  const page = fixture.componentInstance;
  return { fixture, page, store: page.store };
}
