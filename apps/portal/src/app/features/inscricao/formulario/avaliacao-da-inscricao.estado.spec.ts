import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, type Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ApiResult, apiFailure, apiOk } from '@uniplus/shared-core/http';
import type {
  AvaliacaoDaInscricaoDto,
  AvaliacaoDaInscricaoRequest,
} from '@uniplus/shared-data/selecao';
import type { SimulacaoDoFormulario } from '@uniplus/shared-ui/components';

import { AvaliacaoDaInscricaoEstado, ESPERA_DA_CONSULTA_MS } from './avaliacao-da-inscricao.estado';
import { InscricaoDoCandidatoService } from './inscricao-do-candidato.service';

const PROCESSO = '0199e000-0000-7000-8000-0000000000d1';
const DEPENDENCIAS = { fatos: ['CONCORRER_EP', 'FAMILIA.RENDA'], grupos: ['FAMILIA'] };

const avaliacao = (...nomes: string[]): AvaliacaoDaInscricaoDto => ({
  modalidades: {
    derivada: true,
    situacao: 'CONCORRE',
    itens: nomes.map((nome, ordem) => ({ codigo: nome, nome, ordem })),
    pendencias: [],
  },
});
const ok = (dado: AvaliacaoDaInscricaoDto): ApiResult<AvaliacaoDaInscricaoDto> =>
  apiOk(dado, 200, new HttpHeaders());

/** O serviço que guarda cada consulta e só responde quando o teste manda. */
class ServicoDublê {
  readonly consultas: { corpo: AvaliacaoDaInscricaoRequest; resposta: Subject<unknown> }[] = [];
  avaliar = (_: string, corpo: AvaliacaoDaInscricaoRequest): Observable<unknown> => {
    const resposta = new Subject<unknown>();
    this.consultas.push({ corpo, resposta });
    return resposta;
  };
  responder(indice: number, resultado: ApiResult<AvaliacaoDaInscricaoDto>): void {
    this.consultas[indice].resposta.next(resultado);
    this.consultas[indice].resposta.complete();
  }
}

describe('AvaliacaoDaInscricaoEstado', () => {
  let estado: AvaliacaoDaInscricaoEstado;
  let servico: ServicoDublê;

  beforeEach(() => {
    vi.useFakeTimers();
    servico = new ServicoDublê();
    TestBed.configureTestingModule({
      providers: [
        AvaliacaoDaInscricaoEstado,
        { provide: InscricaoDoCandidatoService, useValue: servico },
      ],
    });
    estado = TestBed.inject(AvaliacaoDaInscricaoEstado);
    estado.iniciar(PROCESSO, avaliacao('Ampla concorrência'), DEPENDENCIAS, {});
  });

  afterEach(() => vi.useRealTimers());

  const mudar = (simulacao: SimulacaoDoFormulario): void =>
    estado.respostasMudaram(simulacao, () => ({
      respostas: simulacao.respostas ?? {},
      grupos: null,
    }));
  const nomes = (): string[] => estado.naTela()?.modalidades?.itens.map((m) => m.nome) ?? [];

  it('abre com a avaliação que veio com a inscrição, sem consultar', () => {
    expect(nomes()).toEqual(['Ampla concorrência']);
    expect(servico.consultas).toHaveLength(0);
  });

  it('mudar uma resposta de que a avaliação não depende não consulta', () => {
    mudar({ respostas: { EMAIL: 'fernanda@exemplo.com' } });
    vi.advanceTimersByTime(ESPERA_DA_CONSULTA_MS);

    expect(servico.consultas).toHaveLength(0);
  });

  it('agrupa as mudanças seguidas numa consulta só, depois da espera', () => {
    mudar({ respostas: { CONCORRER_EP: true } });
    vi.advanceTimersByTime(ESPERA_DA_CONSULTA_MS - 1);
    mudar({ respostas: { CONCORRER_EP: false } });
    vi.advanceTimersByTime(ESPERA_DA_CONSULTA_MS - 1);

    expect(servico.consultas).toHaveLength(0);
    expect(estado.naTela()?.calculando).toBe(true);

    vi.advanceTimersByTime(1);
    expect(servico.consultas.map((c) => c.corpo.respostas)).toEqual([{ CONCORRER_EP: false }]);
  });

  it('o subitem de um integrante e a quantidade de integrantes também consultam', () => {
    mudar({ grupos: { FAMILIA: [{ id: 'membro-1', respostas: { RENDA: 900 } }] } });
    vi.advanceTimersByTime(ESPERA_DA_CONSULTA_MS);
    mudar({ grupos: { FAMILIA: [{ id: 'membro-1', respostas: { RENDA: 1900 } }] } });
    vi.advanceTimersByTime(ESPERA_DA_CONSULTA_MS);

    expect(servico.consultas).toHaveLength(2);
  });

  it('a resposta de uma consulta já superada não sobrescreve a mais nova', () => {
    mudar({ respostas: { CONCORRER_EP: true } });
    vi.advanceTimersByTime(ESPERA_DA_CONSULTA_MS);
    mudar({ respostas: { CONCORRER_EP: false } });
    vi.advanceTimersByTime(ESPERA_DA_CONSULTA_MS);

    servico.responder(1, ok(avaliacao('Ampla concorrência')));
    servico.responder(0, ok(avaliacao('Ampla concorrência', 'Escola pública')));

    expect(nomes()).toEqual(['Ampla concorrência']);
    expect(estado.naTela()?.calculando).toBe(false);
  });

  it('a resposta que chega depois de nova mudança, antes da consulta nova sair, é descartada', () => {
    mudar({ respostas: { CONCORRER_EP: true } });
    vi.advanceTimersByTime(ESPERA_DA_CONSULTA_MS);
    mudar({ respostas: { CONCORRER_EP: false } });

    servico.responder(0, ok(avaliacao('Ampla concorrência', 'Escola pública')));

    expect(nomes()).toEqual(['Ampla concorrência']);
    expect(estado.naTela()?.calculando).toBe(true);
  });

  it('a avaliação que volta do salvar só vale se nenhuma resposta de que ela depende mudou', () => {
    const revisaoDoSalvar = estado.revisao();
    mudar({ respostas: { CONCORRER_EP: true } });

    estado.aplicarDaGravacao(avaliacao('Escola pública'), revisaoDoSalvar);
    expect(nomes()).toEqual(['Ampla concorrência']);

    estado.aplicarDaGravacao(avaliacao('Escola pública'), estado.revisao());
    expect(nomes()).toEqual(['Escola pública']);
  });

  it('a falha mantém a última lista, diz que não atualizou e tentar de novo repete a consulta', () => {
    mudar({ respostas: { CONCORRER_EP: true } });
    vi.advanceTimersByTime(ESPERA_DA_CONSULTA_MS);
    servico.responder(
      0,
      apiFailure(
        {
          type: 'about:blank',
          title: 'Indisponível',
          status: 503,
          code: 'uniplus.erro_interno',
          traceId: '',
        },
        503,
        new HttpHeaders(),
      ),
    );

    expect(nomes()).toEqual(['Ampla concorrência']);
    expect(estado.naTela()?.erro).toBe('Não foi possível atualizar agora.');

    estado.tentarDeNovo();
    vi.advanceTimersByTime(ESPERA_DA_CONSULTA_MS);
    expect(servico.consultas).toHaveLength(2);
    expect(servico.consultas[1].corpo.respostas).toEqual({ CONCORRER_EP: true });
    expect(estado.naTela()?.erro).toBeNull();
  });
});
