import { TestBed } from '@angular/core/testing';
import { type ApiResult, ProblemI18nService } from '@uniplus/shared-core/http';
import { VagasDoProcessoApi } from '@uniplus/shared-data/selecao';
import { errorResult, mockProblemDetails, okResult } from '@uniplus/shared-testing';
import { Subject, Subscription } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { DistribuicaoDeVagas } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { distribuicao } from '../distribuicao-de-vagas.testing';
import { quantidadeSimulada, simulada } from '../simulacao.testing';

import { EstadoDoPassoDeVagas } from './estado-do-passo-de-vagas';
import { SimulacaoDoQuadro } from './simulacao-do-quadro.service';

import { signal } from '@angular/core';
import type { ConfiguracaoDistribuicaoVagasDto } from '@uniplus/shared-data/selecao';

type Resposta = ApiResult<readonly ConfiguracaoDistribuicaoVagasDto[]>;

function montar(ofertas: readonly DistribuicaoDeVagas[], processoId: string | null = 'processo-1') {
  const resposta = new Subject<Resposta>();
  const simularDistribuicaoVagas = vi.fn(() => resposta);
  const estado = {
    distribuicoes: signal(ofertas),
    simulacao: signal<ReadonlyMap<string, ConfiguracaoDistribuicaoVagasDto>>(new Map()),
    simulacaoEmVoo: signal<Subscription | null>(null),
    erroDaSimulacao: signal<string | null>(null),
    versaoDoQuadro: signal(1),
    abandonarSimulacaoEmVoo: vi.fn(() => {
      estado.simulacaoEmVoo()?.unsubscribe();
      estado.simulacaoEmVoo.set(null);
    }),
  };
  const geracao = signal(1);
  TestBed.configureTestingModule({
    providers: [
      SimulacaoDoQuadro,
      { provide: EstadoDoPassoDeVagas, useValue: estado },
      {
        provide: ProcessoSeletivoStore,
        useValue: { processoSeletivoId: () => processoId, geracao },
      },
      { provide: VagasDoProcessoApi, useValue: { simularDistribuicaoVagas } },
      {
        provide: ProblemI18nService,
        useValue: { resolve: (problema: { title: string }) => problema },
      },
    ],
  });
  const servico = TestBed.inject(SimulacaoDoQuadro);
  return { servico, estado, geracao, resposta, simularDistribuicaoVagas };
}

describe('SimulacaoDoQuadro', () => {
  const ofertaUm = distribuicao({ ofertaCursoId: 'oferta-1', voBase: '40' });
  const ofertaDois = distribuicao({ ofertaCursoId: 'oferta-2', voBase: '10' });

  it('não pede simulação sem processo ou sem ofertas', () => {
    const semProcesso = montar([ofertaUm], null);
    semProcesso.servico.simular();
    expect(semProcesso.simularDistribuicaoVagas).not.toHaveBeenCalled();
    TestBed.resetTestingModule();

    const semOfertas = montar([]);
    semOfertas.servico.simular();
    expect(semOfertas.simularDistribuicaoVagas).not.toHaveBeenCalled();
  });

  it('indica simulação em curso e instala o resultado por oferta ao receber', () => {
    const { servico, estado, resposta } = montar([ofertaUm]);
    servico.simular();
    expect(servico.simulando()).toBe(true);

    resposta.next(okResult([simulada('oferta-1')]));

    expect(servico.simulando()).toBe(false);
    expect(servico.calculado(ofertaUm)?.ofertaCursoOrigemId).toBe('oferta-1');
    expect(estado.erroDaSimulacao()).toBeNull();
  });

  it('mostra o título do problema quando o servidor recusa a simulação', () => {
    const { servico, estado, resposta } = montar([ofertaUm]);
    servico.simular();

    resposta.next(errorResult(mockProblemDetails({ title: 'Quadro recusado', status: 422 })));

    expect(estado.erroDaSimulacao()).toBe('Quadro recusado');
    expect(estado.simulacao().size).toBe(0);
    expect(servico.simulando()).toBe(false);
  });

  it('informa falha genérica quando a requisição dá erro', () => {
    const { servico, estado, resposta } = montar([ofertaUm]);
    servico.simular();

    resposta.error(new Error('rede'));

    expect(estado.erroDaSimulacao()).toBe('Não foi possível simular o quadro. Tente novamente.');
    expect(servico.simulando()).toBe(false);
  });

  it('descarta a resposta de um quadro editado enquanto ela vinha', () => {
    const { servico, estado, resposta } = montar([ofertaUm]);
    servico.simular();
    estado.versaoDoQuadro.set(2);

    resposta.next(okResult([simulada('oferta-1')]));

    expect(estado.simulacao().size).toBe(0);
    expect(servico.simulando()).toBe(true);
  });

  it('descarta a falha de um processo trocado enquanto a requisição vinha', () => {
    const { servico, estado, geracao, resposta } = montar([ofertaUm]);
    servico.simular();
    geracao.set(2);

    resposta.error(new Error('rede'));

    expect(estado.erroDaSimulacao()).toBeNull();
  });

  it('abandona a simulação anterior ao pedir outra e limpa o erro antigo', () => {
    const { servico, estado } = montar([ofertaUm]);
    estado.erroDaSimulacao.set('erro antigo');
    servico.simular();
    const primeira = estado.simulacaoEmVoo();

    servico.simular();

    expect(primeira?.closed).toBe(true);
    expect(estado.erroDaSimulacao()).toBeNull();
  });

  describe('com o resultado instalado', () => {
    function simulado() {
      const montagem = montar([ofertaUm, ofertaDois]);
      montagem.estado.simulacao.set(
        new Map([
          [
            'oferta-1',
            simulada('oferta-1', {
              totalDeVagasDoEdital: 45,
              quadro: [quantidadeSimulada('m-ac', 'AC', 30)],
            }),
          ],
        ]),
      );
      return montagem.servico;
    }

    it('soma as vagas informadas e as que o edital publica', () => {
      const servico = simulado();
      expect(servico.totalGeralDeVagas()).toBe(50);
      expect(servico.totalGeralPublicado()).toBe(45);
    });

    it('mostra a quantidade calculada ou o traço quando a modalidade não tem resultado', () => {
      const servico = simulado();
      expect(servico.quantidadeCalculada(ofertaUm, 'm-ac')).toBe('30');
      expect(servico.quantidadeCalculada(ofertaUm, 'm-outra')).toBe('—');
      expect(servico.quantidadeCalculada(ofertaDois, 'm-ac')).toBe('—');
    });

    it('soma a coluna declarada e a calculada de uma modalidade', () => {
      const servico = simulado();
      expect(servico.totalDeclaradoDe('m-inst')).toBe(20);
      expect(servico.totalCalculadoDe('m-ac')).toBe(30);
      expect(servico.conferencia()).toBeDefined();
      expect(servico.haConferencia()).toBe(false);
    });
  });
});
