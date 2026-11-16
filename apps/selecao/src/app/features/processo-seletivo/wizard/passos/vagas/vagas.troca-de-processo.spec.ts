import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { montarPassoEmGravacao } from './vagas.gravacao.testing';
import { TelaDasVagas } from './tela-das-vagas.testing';
import { VagasPassoComponent } from './vagas.component';
import {
  OFERTA,
  OUTRA_OFERTA,
  ROTA_DISTRIBUICAO,
  ROTA_SIMULACAO,
  comReleitura,
  distribuicao,
  ServicosDasVagas,
} from './vagas.testing';

describe('VagasPassoComponent — padrão e troca de processo', () => {
  let componente: VagasPassoComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let servicos: ServicosDasVagas;
  let operador: TelaDasVagas;
  let simular: (ofertas: readonly string[]) => void;

  beforeEach(async () => {
    ({ componente, store, controller, servicos, operador, simular } =
      await montarPassoEmGravacao());
  });

  afterEach(() => controller.verify());

  /** O editor reusa o componente; quem troca de processo é a geração do store. */
  function trocarDeProcesso(): void {
    store.geracao.update((valor) => valor + 1);
    TestBed.tick();
  }

  /**
   * A rota é reusada entre processos e `store.reset()` não alcança signal de
   * componente. Como a cobertura é verificada por id de oferta, o resultado do
   * processo anterior valeria para o novo sempre que as ofertas coincidissem —
   * e são as mesmas quando os dois usam o catálogo de cursos da instituição.
   */
  it('descarta a simulação ao trocar de processo', () => {
    simular([OFERTA, OUTRA_OFERTA]);
    expect(servicos.estado.simulacaoCobreOQuadro()).toBe(true);

    trocarDeProcesso();

    expect(servicos.estado.simulacaoCobreOQuadro()).toBe(false);
  });

  /** O padrão guardado pertence ao processo em que foi guardado. */
  it('descarta o padrão preservado ao trocar de processo', () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicao(OFERTA)] });
    operador.pedirRemocao(OFERTA);
    operador.confirmarRemocao();
    expect(servicos.estado.padrao().regraDistribuicaoCodigo).toBe('DISTRIB-VAGAS-INSTITUCIONAL');

    trocarDeProcesso();

    expect(servicos.estado.padrao().regraDistribuicaoCodigo).toBe('');
    expect(servicos.estado.padrao().modalidades).toEqual([]);
  });

  /**
   * O contrato guarda regra e percentual por oferta, então um processo criado
   * por outro caminho pode chegar heterogêneo. A tela mostra o padrão da
   * primeira e enviaria os valores de cada uma: gravar assim seria confirmar
   * um quadro e declarar outro.
   */
  it('recusa gravar com oferta fora do padrão em tela', async () => {
    store.patchObjectSection('vagas', {
      ofertas: [distribuicao(OFERTA), { ...distribuicao(OUTRA_OFERTA), pr: '0,75' }],
    });

    expect(servicos.estado.ofertasForaDoPadrao()).toHaveLength(1);

    const resultado = await comReleitura(controller, componente.persistir());
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((m) => m.includes('diferentes do padrão'))).toBe(true);
    controller.expectNone(ROTA_DISTRIBUICAO);
  });

  it('uniformiza o quadro ao aplicar o padrão a todas', () => {
    store.patchObjectSection('vagas', {
      ofertas: [distribuicao(OFERTA), { ...distribuicao(OUTRA_OFERTA), pr: '0,75' }],
    });
    operador.atualizar();

    operador.aplicarPadraoATodas();

    expect(servicos.estado.ofertasForaDoPadrao()).toEqual([]);
    expect(store.draft().vagas.ofertas.map((item) => item.pr)).toEqual(['0,5', '0,5']);
  });

  /** A troca de processo devolve o botão de simular ao processo novo. */
  it('desliga o indicador de simulação ao trocar de processo', () => {
    servicos.simulacao.simular();
    controller.expectOne(ROTA_SIMULACAO);
    expect(servicos.simulacao.simulando()).toBe(true);

    trocarDeProcesso();

    expect(servicos.simulacao.simulando()).toBe(false);
  });

  /** O que sobra do processo anterior não pertence ao que está aberto. */
  it('descarta o restante do estado local ao trocar de processo', () => {
    servicos.estado.ofertasMarcadas.set(new Set([OFERTA]));
    servicos.estado.filtroDeOferta.set('medicina');
    operador.pedirRemocao(OUTRA_OFERTA);
    servicos.estado.erroDaSimulacao.set('falha anterior');

    trocarDeProcesso();

    expect(servicos.estado.ofertasMarcadas().size).toBe(0);
    expect(servicos.estado.filtroDeOferta()).toBe('');
    expect(servicos.estado.remocaoPendente()).toBeNull();
    expect(servicos.estado.erroDaSimulacao()).toBeNull();
  });
});
