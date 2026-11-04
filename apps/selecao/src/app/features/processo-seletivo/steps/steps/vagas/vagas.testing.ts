import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { DebugElement } from '@angular/core';
import { type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ConfirmDialogComponent } from '@uniplus/shared-ui/components';
import { of } from 'rxjs';

import { DistribuicaoDeVagas, ModalidadeGravada } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CatalogosDeDistribuicao } from './catalogos-de-distribuicao.service';
import { ConferenciaDoQuadro } from './servicos/conferencia-do-quadro.service';
import { EstadoDoPassoDeVagas } from './servicos/estado-do-passo-de-vagas';
import { SimulacaoDoQuadro } from './servicos/simulacao-do-quadro.service';
import { VagasStepComponent } from './vagas.component';

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
  return {
    ofertaCursoId,
    voBase: '40',
    pr: '0,5',
    regraDistribuicaoCodigo: 'DISTRIB-VAGAS-INSTITUCIONAL',
    regraDistribuicaoVersao: 'v1',
    regraAjusteCodigo: null,
    regraAjusteVersao: null,
    referenciaReservaDemograficaId: null,
    modalidades: [{ id: MODALIDADE, codigo: 'AC_I' }],
    quadro: [{ modalidadeId: MODALIDADE, quantidade: '2' }],
  };
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
    composicaoVagas: 'RETIRA_DE',
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
    composicaoVagas: 'RETIRA_DE',
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
    composicaoVagas: 'RETIRA_DE',
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
  esquemaArgs: {
    fallbackCodigo: 'AC',
    ordens: [{ origem: 'LB_PPI', destinos: ['LB_Q', 'AC'] }],
  },
  invariantes: [],
  baseLegal: 'Portaria MEC nº 704/2025',
  hash: 'hash-cascata-v1',
  modalidadesAdmitidas: null,
};

/** Regra existente no catálogo, mas com `esquemaArgs` que não bate com o shape que `matrizDaRegra` reconhece. */
export const REGRA_CASCATA_SEM_MATRIZ = {
  codigo: 'REMANEJ-CASCATA-SEM-MATRIZ',
  versao: 'v1',
  tipo: 'criterio_remanejamento',
  esquemaArgs: {},
  invariantes: [],
  baseLegal: 'Portaria MEC nº 704/2025',
  hash: 'hash-cascata-sem-matriz',
  modalidadesAdmitidas: null,
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

/** Oferta federal com as três modalidades: cobre fallback e o destino da origem. */
export function distribuicaoComCascata(): DistribuicaoDeVagas {
  return {
    ofertaCursoId: OFERTA_CASCATA,
    voBase: '100',
    pr: '0,5',
    regraDistribuicaoCodigo: 'DISTRIB-VAGAS-LEI-12711',
    regraDistribuicaoVersao: 'v1',
    regraAjusteCodigo: 'AJUSTE-PADRAO',
    regraAjusteVersao: 'v1',
    referenciaReservaDemograficaId: 'ref-1',
    modalidades: [
      { id: LB_PPI, codigo: 'LB_PPI' },
      { id: LB_Q, codigo: 'LB_Q' },
      { id: AC_CASCATA, codigo: 'AC' },
    ],
    quadro: [
      { modalidadeId: LB_PPI, quantidade: '10' },
      { modalidadeId: LB_Q, quantidade: '10' },
      { modalidadeId: AC_CASCATA, quantidade: '80' },
    ],
  };
}

export const REGRA_INSTITUCIONAL = {
  codigo: 'DISTRIB-VAGAS-INSTITUCIONAL',
  versao: 'v1',
  tipo: 'regra_distribuicao_vagas',
  esquemaArgs: {},
  invariantes: [],
  baseLegal: 'Res. Unifesspa 532/2021',
  hash: 'hash-institucional',
  modalidadesAdmitidas: null,
};

/** O rol fechado coincide, de propósito, com o catálogo de duas modalidades já usado nos demais testes. */
export const REGRA_PSIQ = {
  codigo: 'DISTRIB-VAGAS-PSIQ',
  versao: 'v1',
  tipo: 'regra_distribuicao_vagas',
  esquemaArgs: {},
  invariantes: [],
  baseLegal: 'Portaria Normativa MEC 18/2012',
  hash: 'hash-psiq',
  modalidadesAdmitidas: ['AC_I', 'AC_Q'],
};

export interface ServicosDasVagas {
  readonly estado: EstadoDoPassoDeVagas;
  readonly simulacao: SimulacaoDoQuadro;
  readonly conferencia: ConferenciaDoQuadro;
  readonly catalogos: CatalogosDeDistribuicao;
}

export function servicosDe(fixture: ComponentFixture<VagasStepComponent>): ServicosDasVagas {
  const injetor = fixture.debugElement.injector;
  return {
    estado: injetor.get(EstadoDoPassoDeVagas),
    simulacao: injetor.get(SimulacaoDoQuadro),
    conferencia: injetor.get(ConferenciaDoQuadro),
    catalogos: injetor.get(CatalogosDeDistribuicao),
  };
}

const DIALOGO_DA_REMOCAO = 0;
const DIALOGO_DA_TROCA_DE_REGRA = 1;
const DIALOGO_DO_REAPLICAR_ROL = 2;

/** O que o operador faz na tela do passo: clica, digita e escolhe, e a tela reage. */
export class TelaDasVagas {
  constructor(private readonly fixture: ComponentFixture<VagasStepComponent>) {}

  /** Deixa a tela refletir o que mudou no rascunho. */
  atualizar(): void {
    this.fixture.detectChanges();
  }

  pedirRemocao(ofertaCursoId: string): void {
    this.clicar(this.deLista('button[aria-label^="Remover "]', ofertaCursoId));
  }

  confirmarRemocao(): void {
    this.dialogo(DIALOGO_DA_REMOCAO).triggerEventHandler('confirmed', undefined);
    this.fixture.detectChanges();
  }

  cancelarRemocao(): void {
    this.dialogo(DIALOGO_DA_REMOCAO).triggerEventHandler('cancelled', undefined);
    this.fixture.detectChanges();
  }

  avisoDaRemocao(): string {
    return this.dialogo(DIALOGO_DA_REMOCAO).nativeElement.textContent ?? '';
  }

  alterarVoBase(ofertaCursoId: string, valor: string): void {
    const campo = this.deLista('input[aria-label^="Total de vagas de"]', ofertaCursoId);
    this.digitar(campo as HTMLInputElement, valor);
  }

  escolherRegra(valor: string): void {
    const campo = this.raiz.querySelector<HTMLSelectElement>('select#f-regra');
    if (campo === null) throw new Error('O seletor de regra não está na tela.');
    campo.value = valor;
    campo.dispatchEvent(new Event('change'));
    this.fixture.detectChanges();
  }

  confirmarTrocaDeRegra(): void {
    this.dialogo(DIALOGO_DA_TROCA_DE_REGRA).triggerEventHandler('confirmed', undefined);
    this.fixture.detectChanges();
  }

  cancelarTrocaDeRegra(): void {
    this.dialogo(DIALOGO_DA_TROCA_DE_REGRA).triggerEventHandler('cancelled', undefined);
    this.fixture.detectChanges();
  }

  /** A ação de recompor só existe na tela quando a recomposição muda alguma coisa. */
  oferecePorRecomporORol(): boolean {
    return this.botaoComTexto('Recompor pelo rol da regra atual') !== undefined;
  }

  reaplicarRolDaRegra(): void {
    this.clicar(this.botaoComTexto('Recompor pelo rol da regra atual'));
  }

  confirmarReaplicarRol(): void {
    this.dialogo(DIALOGO_DO_REAPLICAR_ROL).triggerEventHandler('confirmed', undefined);
    this.fixture.detectChanges();
  }

  cancelarReaplicarRol(): void {
    this.dialogo(DIALOGO_DO_REAPLICAR_ROL).triggerEventHandler('cancelled', undefined);
    this.fixture.detectChanges();
  }

  aplicarPadraoATodas(): void {
    this.clicar(this.botaoComTexto('Aplicar o padrão a todas as ofertas'));
  }

  alternarModalidade(codigo: string): void {
    const marcador = Array.from(this.raiz.querySelectorAll('.checkbox-grid label.check-item'))
      .find((rotulo) => rotulo.textContent?.trim().startsWith(`${codigo} —`))
      ?.querySelector('input');
    this.clicar(marcador ?? undefined);
  }

  private get raiz(): HTMLElement {
    return this.fixture.nativeElement as HTMLElement;
  }

  private dialogo(indice: number): DebugElement {
    return this.fixture.debugElement.queryAll(By.directive(ConfirmDialogComponent))[indice];
  }

  private botaoComTexto(texto: string): HTMLElement | undefined {
    return Array.from(this.raiz.querySelectorAll<HTMLElement>('button')).find(
      (botao) => botao.textContent?.trim() === texto,
    );
  }

  /** O elemento da linha da oferta: a ordem na tela é a do quadro. */
  private deLista(seletor: string, ofertaCursoId: string): HTMLElement | undefined {
    const ofertas = this.fixture.debugElement.injector.get(ProcessoSeletivoStore).draft()
      .vagas.ofertas;
    const indice = ofertas.findIndex((oferta) => oferta.ofertaCursoId === ofertaCursoId);
    return this.raiz.querySelectorAll<HTMLElement>(seletor)[indice];
  }

  private digitar(campo: HTMLInputElement, valor: string): void {
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    this.fixture.detectChanges();
  }

  private clicar(elemento: HTMLElement | undefined): void {
    if (elemento === undefined) throw new Error('O controle não está na tela.');
    elemento.click();
    this.fixture.detectChanges();
  }
}
