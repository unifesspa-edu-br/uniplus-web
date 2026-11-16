import { HttpTestingController } from '@angular/common/http/testing';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { abrirPasso, criarPassoDeVagas, PassoDeVagas } from './passo-de-vagas.testing';
import { quantidadeSimulada, simulada } from './simulacao.testing';
import { VagasPassoComponent } from './vagas.component';
import {
  ACEITA_AS_OPCOES,
  AC_CASCATA,
  BASE,
  LB_PPI,
  LB_Q,
  MODALIDADES_CASCATA,
  OFERTAS_CASCATA,
  OFERTA_CASCATA,
  PROCESSO_ID,
  REGRA_CASCATA,
  REGRA_CASCATA_SEM_MATRIZ,
  ServicosDasVagas,
  declararUmaOpcaoJaGravada,
} from './vagas.testing';

const ROTA_DO_PROCESSO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}`;
export const ROTA_CASCATA_TESTE = `${ROTA_DO_PROCESSO}/cascata-remanejamento`;
export const ROTA_DISTRIBUICAO_TESTE = `${ROTA_DO_PROCESSO}/distribuicao-vagas`;
export const ROTA_PROCESSO_LIDO_TESTE = ROTA_DO_PROCESSO;
export const ROTA_SIMULACAO_TESTE = `${ROTA_DISTRIBUICAO_TESTE}/simulacao`;

export interface PassoDeVagasComCascata {
  readonly componente: VagasPassoComponent;
  readonly store: ProcessoSeletivoStore;
  readonly controller: HttpTestingController;
  readonly servicos: ServicosDasVagas;
  readonly detectar: () => void;
  readonly simularEConferirDistribuicao: () => void;
  readonly escolherRegraCascataNaTela: (valor: string) => void;
}

/** O passo de vagas com os catálogos da cascata respondidos e o processo já gravado. */
export async function montarPassoComCascata(): Promise<PassoDeVagasComCascata> {
  const passo = await criarPassoDeVagas([ACEITA_AS_OPCOES]);
  declararUmaOpcaoJaGravada(passo.store);
  abrirPasso(passo, {
    ofertas: OFERTAS_CASCATA,
    modalidades: MODALIDADES_CASCATA,
    regras: regrasDeRemanejamento,
  });

  passo.store.processoSeletivoId.set(PROCESSO_ID);
  return comCascata(passo);
}

function regrasDeRemanejamento(tipo: string | null): readonly unknown[] {
  return tipo === 'criterio_remanejamento' ? [REGRA_CASCATA, REGRA_CASCATA_SEM_MATRIZ] : [];
}

function comCascata(passo: PassoDeVagas): PassoDeVagasComCascata {
  const { fixture } = passo;
  const detectar = () => fixture.detectChanges();

  return {
    ...passo,
    componente: fixture.componentInstance,
    detectar,
    simularEConferirDistribuicao: () => simularDistribuicao(passo),
    escolherRegraCascataNaTela: (valor) =>
      escolherRegraNaTela(fixture.nativeElement as HTMLElement, detectar, valor),
  };
}

function simularDistribuicao(passo: PassoDeVagas): void {
  passo.servicos.simulacao.simular();
  passo.controller.expectOne(ROTA_SIMULACAO_TESTE).flush([
    simulada(OFERTA_CASCATA, {
      quadro: [
        quantidadeSimulada(LB_PPI, 'LB_PPI', 10),
        quantidadeSimulada(LB_Q, 'LB_Q', 10),
        quantidadeSimulada(AC_CASCATA, 'AC', 80),
      ],
      totalDeVagasDoEdital: 100,
    }),
  ]);
}

/** Interage com o `<select>` real da seção da cascata, no molde do teste do seletor de regra da distribuição. */
function escolherRegraNaTela(raiz: HTMLElement, detectar: () => void, valor: string): void {
  const campo = raiz.querySelector<HTMLSelectElement>('#c-regra-cascata');
  if (campo === null) throw new Error('Campo #c-regra-cascata não encontrado no template.');
  campo.value = valor;
  campo.dispatchEvent(new Event('change'));
  detectar();
}
