import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';

import { DistribuicaoDeVagas, ModalidadeGravada } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CatalogosDeDistribuicao } from './catalogos-de-distribuicao.service';
import {
  distribuicao as distribuicaoInstitucional,
  federal as distribuicaoFederal,
} from './distribuicao-de-vagas.testing';
import { ConferenciaDoQuadro } from './servicos/conferencia-do-quadro.service';
import { EstadoDoPassoDeVagas } from './servicos/estado-do-passo-de-vagas';
import { SimulacaoDoQuadro } from './servicos/simulacao-do-quadro.service';
import { VagasPassoComponent } from './vagas.component';

export const BASE = 'http://localhost:5000';
export const PROCESSO_ID = '01960000-0000-7000-0000-0000000007aa';
export const ROTA_DISTRIBUICAO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/distribuicao-vagas`;
export const ROTA_SIMULACAO = `${ROTA_DISTRIBUICAO}/simulacao`;
export const OFERTA = '01960000-0000-7000-0000-0000000000f1';
export const OUTRA_OFERTA = '01960000-0000-7000-0000-0000000000f2';
export const MODALIDADE = '01960000-0000-7000-0000-0000000000a1';

export const SEGUNDA_MODALIDADE = '01960000-0000-7000-0000-0000000000a2';

/** Suplementares: não dependem de origem nem de remanejamento para valer. */
export const MODALIDADES = [
  {
    id: MODALIDADE,
    codigo: 'AC_I',
    descricao: 'Indígena',
    naturezaLegal: 'ACAO_AFIRMATIVA',
    composicaoVagas: 'SUPLEMENTAR_AO_TOTAL',
    composicaoOrigemCodigo: null,
    regraRemanejamento: null,
    remanejamentoDestino: null,
    remanejamentoPar: null,
    remanejamentoFallback: null,
  },
  {
    id: SEGUNDA_MODALIDADE,
    codigo: 'AC_Q',
    descricao: 'Quilombola',
    naturezaLegal: 'ACAO_AFIRMATIVA',
    composicaoVagas: 'SUPLEMENTAR_AO_TOTAL',
    composicaoOrigemCodigo: null,
    regraRemanejamento: null,
    remanejamentoDestino: null,
    remanejamentoPar: null,
    remanejamentoFallback: null,
  },
];

export const LISTA_DE_CURSOS = [
  { id: 'curso-1', nome: 'Medicina', grau: 'Bacharelado' },
  { id: 'curso-2', nome: 'Letras', grau: 'Licenciatura' },
];

export const OFERTAS = [
  {
    id: OFERTA,
    cursoId: 'curso-1',
    unidadeOfertante: { sigla: 'IGE' },
    programaDeOferta: 'REGULAR',
    formatoPedagogico: 'PRESENCIAL',
    regimeDeTurno: 'INTEGRAL',
    turnos: ['MATUTINO', 'VESPERTINO'],
    vagasAnuaisAutorizadas: 40,
  },
  {
    id: OUTRA_OFERTA,
    cursoId: 'curso-2',
    unidadeOfertante: { sigla: 'IGE' },
    programaDeOferta: 'REGULAR',
    formatoPedagogico: 'PRESENCIAL',
    turnos: ['NOTURNO'],
    vagasAnuaisAutorizadas: 40,
  },
];

export function distribuicao(ofertaCursoId: string): DistribuicaoDeVagas {
  return distribuicaoInstitucional({
    ofertaCursoId,
    regraDistribuicaoVersao: 'v1',
    modalidades: [{ id: MODALIDADE, codigo: 'AC_I' }],
    quadro: [{ modalidadeId: MODALIDADE, quantidade: '2' }],
  });
}

export const ROTA_PROCESSO_LIDO = new RegExp(`^${BASE}/api/selecao/processos-seletivos/[^/]+$`);

/**
 * Espera a gravação do passo respondendo a releitura do processo que segue a gravação do quadro:
 * é dela que saem as regras congeladas das modalidades.
 */
export async function comReleitura<T>(
  controller: HttpTestingController,
  gravacao: Promise<T>,
): Promise<T> {
  let terminou = false;
  void gravacao.finally(() => (terminou = true)).catch(() => undefined);
  for (let volta = 0; !terminou && volta < 20; volta++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (const releitura of controller.match(
      (r) => r.method === 'GET' && ROTA_PROCESSO_LIDO.test(r.url),
    )) {
      releitura.flush({ distribuicaoVagas: [], regrasDerivacao: [] });
    }
  }
  return gravacao;
}

/**
 * O passo exige o número de opções e o grava junto da distribuição: estes grupos testam a distribuição,
 * então partem do número declarado e o PUT de opções é aceito sem alarde (`ACEITA_AS_OPCOES`).
 */
export const ACEITA_AS_OPCOES: HttpInterceptorFn = (req, next) =>
  req.method === 'PUT' && req.url.endsWith('/opcoes-de-curso')
    ? of(new HttpResponse({ status: 204 }))
    : next(req);

export function declararUmaOpcaoJaGravada(store: ProcessoSeletivoStore): void {
  store.patchObjectSection('opcoesDeCurso', { numero: '1' });
  store.opcoesDeCursoGravadas.set(1);
}

/**
 * Cede o event loop para que a cadeia de `await` do `persistir()` avance até a
 * segunda requisição (cascata). `Promise.resolve()` sozinho não basta: a
 * cadeia passa por `firstValueFrom` e por mais de um microtask entre o flush
 * da distribuição e o disparo do PUT da cascata.
 */
export function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export const LB_PPI = '01960000-0000-7000-0000-0000000000c1';
export const LB_Q = '01960000-0000-7000-0000-0000000000c2';
export const AC_CASCATA = '01960000-0000-7000-0000-0000000000c3';

export const MODALIDADES_CASCATA = [
  {
    id: LB_PPI,
    codigo: 'LB_PPI',
    descricao: null,
    naturezaLegal: 'COTA_RESERVADA',
    composicaoVagas: 'RETIRADA_DE_OUTRA_MODALIDADE',
    composicaoOrigem: 'AC',
    regraRemanejamento: 'SEGUE_CASCATA',
    remanejamentoDestino: null,
    remanejamentoPar: null,
    remanejamentoFallback: null,
  },
  {
    id: LB_Q,
    codigo: 'LB_Q',
    descricao: null,
    naturezaLegal: 'COTA_RESERVADA',
    composicaoVagas: 'RETIRADA_DE_OUTRA_MODALIDADE',
    composicaoOrigem: 'AC',
    regraRemanejamento: null,
    remanejamentoDestino: null,
    remanejamentoPar: null,
    remanejamentoFallback: null,
  },
  {
    id: AC_CASCATA,
    codigo: 'AC',
    descricao: null,
    naturezaLegal: 'GERAL',
    composicaoVagas: 'RETIRADA_DE_OUTRA_MODALIDADE',
    composicaoOrigem: null,
    regraRemanejamento: null,
    remanejamentoDestino: null,
    remanejamentoPar: null,
    remanejamentoFallback: null,
  },
];

export const OFERTA_CASCATA = '01960000-0000-7000-0000-0000000000f9';
export const OFERTAS_CASCATA = [
  {
    id: OFERTA_CASCATA,
    cursoId: 'curso-1',
    unidadeOfertante: { sigla: 'IGE' },
    programaDeOferta: 'REGULAR',
    formatoPedagogico: 'PRESENCIAL',
    turnos: ['MATUTINO'],
    vagasAnuaisAutorizadas: 100,
  },
];

export const REGRA_CASCATA = {
  codigo: 'REMANEJ-CASCATA-LEI-12711',
  versao: 'v1',
  tipo: 'criterio_remanejamento',
  declaracaoDaRegra: {
    fallbackCodigo: 'AC',
    ordens: [{ origem: 'LB_PPI', destinos: ['LB_Q', 'AC'] }],
  },
  invariantes: [],
  baseLegal: 'Portaria MEC nº 704/2025',
  hash: 'hash-cascata-v1',
  modalidadesAdmitidas: null,
  ramoDaDistribuicao: null,
};

/** Regra existente no catálogo, mas com `declaracaoDaRegra` que não bate com o shape que `matrizDaRegra` reconhece. */
export const REGRA_CASCATA_SEM_MATRIZ = {
  codigo: 'REMANEJ-CASCATA-SEM-MATRIZ',
  versao: 'v1',
  tipo: 'criterio_remanejamento',
  declaracaoDaRegra: {},
  invariantes: [],
  baseLegal: 'Portaria MEC nº 704/2025',
  hash: 'hash-cascata-sem-matriz',
  modalidadesAdmitidas: null,
  ramoDaDistribuicao: null,
};

/** A modalidade como o snapshot a guarda; o que não interessa ao teste fica vazio. */
export function gravadaDe(descricao: string, composicaoVagas: string): ModalidadeGravada {
  return {
    descricao,
    composicaoVagas,
    composicaoOrigemCodigo: null,
    regraRemanejamento: null,
    remanejamentoDestino: null,
    remanejamentoPar: null,
    remanejamentoFallback: null,
  };
}

const MODALIDADES_DA_CASCATA = [
  { id: LB_PPI, codigo: 'LB_PPI' },
  { id: LB_Q, codigo: 'LB_Q' },
  { id: AC_CASCATA, codigo: 'AC' },
];

const QUADRO_DA_CASCATA = [
  { modalidadeId: LB_PPI, quantidade: '10' },
  { modalidadeId: LB_Q, quantidade: '10' },
  { modalidadeId: AC_CASCATA, quantidade: '80' },
];

/** Oferta federal com as três modalidades: cobre fallback e o destino da origem. */
export function distribuicaoComCascata(): DistribuicaoDeVagas {
  return distribuicaoFederal({
    ofertaCursoId: OFERTA_CASCATA,
    voBase: '100',
    regraDistribuicaoVersao: 'v1',
    regraAjusteCodigo: 'AJUSTE-PADRAO',
    regraAjusteVersao: 'v1',
    modalidades: MODALIDADES_DA_CASCATA,
    quadro: QUADRO_DA_CASCATA,
  });
}

export const REGRA_INSTITUCIONAL = {
  codigo: 'DISTRIB-VAGAS-INSTITUCIONAL',
  versao: 'v1',
  tipo: 'regra_distribuicao_vagas',
  declaracaoDaRegra: {},
  invariantes: [],
  baseLegal: 'Res. Unifesspa 532/2021',
  hash: 'hash-institucional',
  modalidadesAdmitidas: null,
  ramoDaDistribuicao: 'QUADRO_FIXADO_NO_EDITAL',
};

/** O rol fechado coincide, de propósito, com o catálogo de duas modalidades já usado nos demais testes. */
export const REGRA_PSIQ = {
  codigo: 'DISTRIB-VAGAS-PSIQ',
  versao: 'v1',
  tipo: 'regra_distribuicao_vagas',
  declaracaoDaRegra: {},
  invariantes: [],
  baseLegal: 'Portaria Normativa MEC 18/2012',
  hash: 'hash-psiq',
  modalidadesAdmitidas: ['AC_I', 'AC_Q'],
  ramoDaDistribuicao: 'QUADRO_FIXADO_NO_EDITAL',
};

export interface ServicosDasVagas {
  readonly estado: EstadoDoPassoDeVagas;
  readonly simulacao: SimulacaoDoQuadro;
  readonly conferencia: ConferenciaDoQuadro;
  readonly catalogos: CatalogosDeDistribuicao;
}

export function servicosDe(fixture: ComponentFixture<VagasPassoComponent>): ServicosDasVagas {
  const injetor = fixture.debugElement.injector;
  return {
    estado: injetor.get(EstadoDoPassoDeVagas),
    simulacao: injetor.get(SimulacaoDoQuadro),
    conferencia: injetor.get(ConferenciaDoQuadro),
    catalogos: injetor.get(CatalogosDeDistribuicao),
  };
}
