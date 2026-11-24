import {
  DADO_NUMERICO,
  DADO_OPCAO,
  ORIGEM_CALCULADA,
  ORIGEM_DECLARADA,
  VALOR_UNICO,
} from '../../shared/valores-do-catalogo.testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  OperadorCodigo as OperadorDoCatalogo,
  type FatoDoCatalogoDto,
} from '@uniplus/shared-data/configuracao';
import { CaraterEtapaCodigo, SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';

import { CriterioDesempateConfigurado, EtapaPontuada } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';
import { ReleituraDoSnapshot } from '../../shared/releitura-do-snapshot.service';
import { LeituraDoCadastroDePesos } from '../classificacao/leitura-do-cadastro-de-pesos.service';
import { CatalogosDeClassificacao } from '../classificacao/catalogos-de-classificacao.service';
import { DesempatePassoComponent } from './desempate.component';

export const BASE = 'http://localhost:5000';
export const PROCESSO_ID = '01960000-0000-7000-0000-0000000007aa';
export const ROTA_DESEMPATE = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/criterios-desempate`;

export const ETAPA_PERSISTIDA: EtapaPontuada = {
  id: 'etapa-1',
  nome: 'Prova objetiva',
  carater: CaraterEtapaCodigo.CLASSIFICATORIA,
  tipoEtapaOrigemId: 'tipo-1',
  peso: '1',
  notaMinima: '',
  ordem: 1,
  faseCodigo: '',
  produtos: [],
  inicio: '',
  fim: '',
  emiteParecerIndividual: false,
  bancas: [],
  recursos: [],
};

/** O catálogo institucional, como a API o publica — só o que o predicado pode citar. */
export const FATOS: readonly FatoDoCatalogoDto[] = [
  {
    fato: {
      id: 'f1',
      codigo: 'RENDA_PER_CAPITA',
      nome: 'Renda familiar per capita',
      descricao: 'Renda familiar dividida pelos membros.',
      dominio: DADO_NUMERICO,
      origem: ORIGEM_CALCULADA,
      cardinalidade: VALOR_UNICO,
      valoresDominio: null,
      pontoResolucao: 'INSCRICAO',
      binding: 'ATRIBUTO_CANDIDATO:RENDA_PER_CAPITA',
      valoresDominioDeclarados: null,
      fonteValores: null,
      ativo: true,
      escopo: 'CANDIDATO',
      classificacaoProtecao: 'PESSOAL',
      hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
      finalidadeTratamento: 'Desempatar pela renda.',
      protecaoAprovada: true,
    },
    operadoresAdmitidos: [
      { codigo: OperadorDoCatalogo.IGUAL, rotulo: 'é igual a' },
      { codigo: OperadorDoCatalogo.DIFERENTE, rotulo: 'é diferente de' },
      { codigo: OperadorDoCatalogo.MAIOR_IGUAL, rotulo: 'é maior ou igual a' },
      { codigo: OperadorDoCatalogo.MENOR_IGUAL, rotulo: 'é menor ou igual a' },
    ],
  },
  {
    fato: {
      id: 'f2',
      codigo: 'COR_RACA',
      nome: 'Cor ou raça',
      descricao: 'Cor ou raça autodeclarada.',
      dominio: DADO_OPCAO,
      origem: ORIGEM_DECLARADA,
      cardinalidade: VALOR_UNICO,
      valoresDominio: ['BRANCA', 'PRETA', 'PARDA', 'INDIGENA', 'AMARELA'],
      pontoResolucao: 'INSCRICAO',
      binding: 'CAMPO_INSCRICAO:COR_RACA',
      valoresDominioDeclarados: null,
      fonteValores: null,
      ativo: true,
      escopo: 'CANDIDATO',
      classificacaoProtecao: 'SENSIVEL',
      hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
      finalidadeTratamento: 'Desempatar pela reserva.',
      protecaoAprovada: true,
    },
    operadoresAdmitidos: [
      { codigo: OperadorDoCatalogo.IGUAL, rotulo: 'é' },
      { codigo: OperadorDoCatalogo.DIFERENTE, rotulo: 'não é' },
      { codigo: OperadorDoCatalogo.ALGUM_DE, rotulo: 'é um de' },
      { codigo: OperadorDoCatalogo.NENHUM_DE, rotulo: 'não é nenhum de' },
    ],
  },
];

export function criterio(
  patch: Partial<CriterioDesempateConfigurado>,
): CriterioDesempateConfigurado {
  return {
    regraCodigo: '',
    regraVersao: '',
    etapaRef: '',
    idadeMinima: '',
    fato: '',
    operador: '',
    valor: '',
    areas: [],
    ...patch,
  };
}

export interface PassoDeDesempate {
  readonly fixture: ComponentFixture<DesempatePassoComponent>;
  readonly store: ProcessoSeletivoStore;
  readonly controller: HttpTestingController;
}

const PROVEDORES = [
  ProcessoSeletivoStore,
  CadastroInicial,
  GravacaoDoProcesso,
  CatalogosDeClassificacao,
  LeituraDoCadastroDePesos,
  ReleituraDoSnapshot,
  provideHttpClient(withInterceptors([apiResultInterceptor])),
  provideHttpClientTesting(),
  { provide: SELECAO_BASE_PATH, useValue: BASE },
  // O passo lê o catálogo de fatos do candidato, que é do módulo Configuração.
  { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
];

async function configurarModulo(): Promise<void> {
  await TestBed.configureTestingModule({
    imports: [DesempatePassoComponent],
    providers: PROVEDORES,
  }).compileComponents();
}

/**
 * O catálogo de fatos do candidato governa o que o predicado pode citar; respondê-lo vazio faria
 * todo critério por predicado ser recusado por "fato fora do catálogo".
 */
function responderCatalogos(controller: HttpTestingController): void {
  for (const requisicao of controller.match(() => true)) {
    requisicao.flush(requisicao.request.url.includes('fatos-candidato') ? FATOS : []);
  }
}

/** Monta o passo com o catálogo de fatos já respondido e a etapa pontuada gravada. */
export async function montarPassoDeDesempate(): Promise<PassoDeDesempate> {
  await configurarModulo();
  const fixture = TestBed.createComponent(DesempatePassoComponent);
  const store = TestBed.inject(ProcessoSeletivoStore);
  const controller = TestBed.inject(HttpTestingController);

  fixture.detectChanges();
  responderCatalogos(controller);
  fixture.detectChanges();

  store.processoSeletivoId.set(PROCESSO_ID);
  store.patchObjectSection('cronograma', { etapas: [ETAPA_PERSISTIDA] });
  return { fixture, store, controller };
}
