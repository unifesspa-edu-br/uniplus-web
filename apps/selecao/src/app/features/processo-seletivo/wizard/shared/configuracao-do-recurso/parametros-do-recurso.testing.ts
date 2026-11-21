import { HttpHeaders } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { NEVER, of } from 'rxjs';
import { apiFailure, apiOk } from '@uniplus/shared-core/http';
import {
  EfeitoSuspensivoCodigo,
  GuardaDaVagaCodigo,
  OpcoesDoRecursoApi,
  UnidadePrazoCodigo,
} from '@uniplus/shared-data/selecao';

import { CatalogoDasOpcoesDoRecurso } from '../../passos/cronograma/catalogos/catalogo-das-opcoes-do-recurso.service';
import {
  LEITURA_EM_BRANCO,
  type AlteracaoDosParametros,
  type LeituraDoRecurso,
  type ParametrosDoRecurso,
} from './parametros-do-recurso';
import { ParametrosDoRecursoComponent } from './parametros-do-recurso.component';

/** Os parâmetros de um recurso sem instância superior, com os valores que o catálogo oferece. */
export const PARAMETROS_SEM_INSTANCIA_SUPERIOR: ParametrosDoRecurso = {
  prazoValor: '2',
  prazoUnidade: UnidadePrazoCodigo.diasUteis,
  admiteInstanciaSuperior: false,
  efeitoSuspensivo: EfeitoSuspensivoCodigo.semEfeitoSuspensivo,
  guardaDaVaga: GuardaDaVagaCodigo.ateOResultadoDefinitivo,
  prazoSegundaInstanciaValor: '',
  prazoSegundaInstanciaUnidade: '',
};

/** Os parâmetros de um recurso com instância superior e prazo próprio para ela. */
export const PARAMETROS_COM_INSTANCIA_SUPERIOR: ParametrosDoRecurso = {
  ...PARAMETROS_SEM_INSTANCIA_SUPERIOR,
  admiteInstanciaSuperior: true,
  prazoSegundaInstanciaValor: '3',
  prazoSegundaInstanciaUnidade: UnidadePrazoCodigo.diasUteis,
};

export function umaLeituraDoRecurso(parcial: Partial<LeituraDoRecurso> = {}): LeituraDoRecurso {
  return { ...LEITURA_EM_BRANCO, ...parcial };
}

/** As unidades de prazo que a API oferece ao recurso. */
export const UNIDADES_DO_PRAZO_NA_API = [
  { codigo: UnidadePrazoCodigo.diasUteis, rotulo: 'Dias úteis' },
  { codigo: UnidadePrazoCodigo.horas, rotulo: 'Horas' },
];

/** Os efeitos suspensivos que a API oferece, cada um com a explicação do que faz. */
export const EFEITOS_NA_API = [
  {
    codigo: EfeitoSuspensivoCodigo.semEfeitoSuspensivo,
    rotulo: 'Sem efeito suspensivo',
    descricao: 'O recurso não suspende o processo: as fases seguintes começam nas datas previstas.',
  },
];

/** As guardas da vaga que a API oferece, cada uma com a explicação do que faz. */
export const GUARDAS_NA_API = [
  {
    codigo: GuardaDaVagaCodigo.ateOResultadoDefinitivo,
    rotulo: 'Guarda a vaga até o resultado definitivo',
    descricao: 'A vaga fica guardada até a publicação do resultado definitivo.',
  },
  {
    codigo: GuardaDaVagaCodigo.naoGuarda,
    rotulo: 'Não guarda a vaga',
    descricao: 'A vaga segue para o próximo candidato enquanto o recurso é julgado.',
  },
];

/** A lista que a API devolve para o vocabulário que a URL pede, ou `null` se a URL não é de um deles. */
export function opcoesDoRecursoDaUrl(url: string): readonly unknown[] | null {
  if (url.endsWith('/unidades-do-prazo-de-recurso')) return UNIDADES_DO_PRAZO_NA_API;
  if (url.endsWith('/efeitos-suspensivos')) return EFEITOS_NA_API;
  return url.endsWith('/guardas-da-vaga') ? GUARDAS_NA_API : null;
}

/** A resposta de falha do servidor às listas de opções. */
function falhaDasOpcoes() {
  return of(
    apiFailure(
      { type: 'about:blank', title: 'x', status: 500, code: 'uniplus.erro', traceId: '' },
      500,
      new HttpHeaders(),
    ),
  );
}

type EntradasDosParametros = Partial<{
  [campo in keyof ParametrosDoRecursoComponent]: unknown;
}>;

/** Como a API responde às três listas de opções no cenário. */
export type SituacaoDasOpcoesNoTeste = 'prontas' | 'vazias' | 'falham' | 'pendentes';

export interface ParametrosMontados {
  readonly fixture: ComponentFixture<ParametrosDoRecursoComponent>;
  readonly raiz: HTMLElement;
  readonly catalogo: CatalogoDasOpcoesDoRecurso;
  /** O que a pessoa mudou, na ordem em que mudou. */
  readonly alteracoes: AlteracaoDosParametros[];
  readonly retiradas: { vezes: number };
}

export const PREFIXO_DOS_PARAMETROS = 'rec';

/** O que a API responde às listas de opções em cada situação do cenário. */
function respostaDasOpcoes(situacao: SituacaoDasOpcoesNoTeste, dados: readonly unknown[]) {
  const respostas = {
    prontas: () => of(apiOk(dados, 200, new HttpHeaders())),
    vazias: () => of(apiOk([], 200, new HttpHeaders())),
    falham: () => falhaDasOpcoes(),
    pendentes: () => NEVER,
  };
  return respostas[situacao];
}

function provedoresDasOpcoes(situacao: SituacaoDasOpcoesNoTeste) {
  return [
    CatalogoDasOpcoesDoRecurso,
    {
      provide: OpcoesDoRecursoApi,
      useValue: {
        listarUnidadesDePrazo: respostaDasOpcoes(situacao, UNIDADES_DO_PRAZO_NA_API),
        listarEfeitosSuspensivos: respostaDasOpcoes(situacao, EFEITOS_NA_API),
        listarGuardasDaVaga: respostaDasOpcoes(situacao, GUARDAS_NA_API),
      },
    },
  ];
}

function componenteComEntradas(entradas: EntradasDosParametros) {
  const fixture = TestBed.createComponent(ParametrosDoRecursoComponent);
  const padrao: EntradasDosParametros = {
    parametros: PARAMETROS_SEM_INSTANCIA_SUPERIOR,
    leitura: LEITURA_EM_BRANCO,
    prefixoDoId: PREFIXO_DOS_PARAMETROS,
  };
  for (const [nome, valor] of Object.entries({ ...padrao, ...entradas })) {
    fixture.componentRef.setInput(nome, valor);
  }
  return fixture;
}

/**
 * Monta os parâmetros do recurso com as opções que a API oferece (ou a falha delas) já lidas.
 * `entradas` muda o que o caso precisa; os parâmetros nascem sem instância superior.
 */
export function montarParametrosDoRecurso(
  entradas: EntradasDosParametros = {},
  opcoes: SituacaoDasOpcoesNoTeste = 'prontas',
): ParametrosMontados {
  TestBed.configureTestingModule({ providers: provedoresDasOpcoes(opcoes) });
  const catalogo = TestBed.inject(CatalogoDasOpcoesDoRecurso);
  catalogo.carregar();
  const fixture = componenteComEntradas(entradas);
  const alteracoes: AlteracaoDosParametros[] = [];
  const retiradas = { vezes: 0 };
  fixture.componentInstance.alterado.subscribe((alteracao) => alteracoes.push(alteracao));
  fixture.componentInstance.retirarPrazoDaSegundaInstancia.subscribe(() => retiradas.vezes++);
  fixture.detectChanges();
  return { fixture, raiz: fixture.nativeElement as HTMLElement, catalogo, alteracoes, retiradas };
}
