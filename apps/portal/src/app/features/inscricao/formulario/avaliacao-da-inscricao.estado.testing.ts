import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, type Observable } from 'rxjs';
import { type ApiResult, apiFailure, apiOk } from '@uniplus/shared-core/http';
import type {
  AvaliacaoDaInscricaoDto,
  AvaliacaoDaInscricaoRequest,
} from '@uniplus/shared-data/selecao';
import type { SimulacaoDoFormulario } from '@uniplus/shared-ui/components';

import {
  AvaliacaoDaInscricaoEstado,
  type InicioDaAvaliacao,
} from './avaliacao-da-inscricao.estado';
import { InscricaoDoCandidatoService } from './inscricao-do-candidato.service';

export const PROCESSO = '0199e000-0000-7000-8000-0000000000d1';
export const DEPENDENCIAS = { fatos: ['CONCORRER_EP', 'FAMILIA.RENDA'], grupos: ['FAMILIA'] };

export const modalidadesDe = (...nomes: string[]): AvaliacaoDaInscricaoDto['modalidades'] => ({
  derivada: true,
  situacao: {
    codigo: 'CONCORRE' as NonNullable<AvaliacaoDaInscricaoDto['modalidades']['situacao']>['codigo'],
    rotulo: 'Concorrendo',
  },
  itens: nomes.map((nome, ordem) => ({ codigo: nome, nome, ordem })),
  pendencias: [],
});

const documentosDe = (...nomes: string[]): AvaliacaoDaInscricaoDto['documentos'] => ({
  fases: [
    {
      faseId: 'fase-1',
      codigo: 'INSCRICAO',
      ordem: 1,
      documentos: [],
      pendencias: [
        { fatoCodigo: 'RENDA', rotulo: `Renda de ${nomes.join(', ')}`, secaoCodigo: null },
      ],
    },
  ],
});

export const avaliacao = (...nomes: string[]): AvaliacaoDaInscricaoDto => ({
  modalidades: modalidadesDe(...nomes),
  documentos: documentosDe(...nomes),
});

export const comSegundaOpcao = (...nomes: string[]): AvaliacaoDaInscricaoDto => ({
  ...avaliacao('Ampla concorrência'),
  modalidadesSegundaOpcao: modalidadesDe(...nomes),
});

export const ok = (dado: AvaliacaoDaInscricaoDto): ApiResult<AvaliacaoDaInscricaoDto> =>
  apiOk(dado, 200, new HttpHeaders());

export const falha = (status: number, code: string, title = 'Recusa'): ApiResult<never> =>
  apiFailure({ type: 'about:blank', title, status, code, traceId: '' }, status, new HttpHeaders());

/** O serviço que guarda cada consulta e só responde quando o teste manda. */
export class ServicoDublê {
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
  corpos(): AvaliacaoDaInscricaoRequest[] {
    return this.consultas.map((c) => c.corpo);
  }
}

/** O que a inscrição traz para a avaliação começar; o que não vier em `inicio` leva o padrão do cenário. */
export const inicioPadrao = (inicio: Partial<InicioDaAvaliacao> = {}): InicioDaAvaliacao => ({
  processoId: PROCESSO,
  avaliacao: avaliacao('Ampla concorrência'),
  dependencias: DEPENDENCIAS,
  simulacao: {},
  oferta: null,
  segundaOferta: null,
  ...inicio,
});

/** O estado já iniciado com a avaliação da inscrição. */
export function criarEstado(inicio: Partial<InicioDaAvaliacao> = {}): {
  estado: AvaliacaoDaInscricaoEstado;
  servico: ServicoDublê;
} {
  const servico = new ServicoDublê();
  TestBed.configureTestingModule({
    providers: [
      AvaliacaoDaInscricaoEstado,
      { provide: InscricaoDoCandidatoService, useValue: servico },
    ],
  });
  const estado = TestBed.inject(AvaliacaoDaInscricaoEstado);
  estado.iniciar(inicioPadrao(inicio));
  return { estado, servico };
}

/** As respostas mudaram na tela: o corpo da consulta leva as respostas da simulação. */
export function mudar(estado: AvaliacaoDaInscricaoEstado, simulacao: SimulacaoDoFormulario): void {
  estado.respostasMudaram(simulacao, () => ({
    respostas: simulacao.respostas ?? {},
    grupos: null,
  }));
}

/** O candidato trocou as ofertas na tela: o corpo da consulta leva as duas. */
export function trocarOfertas(
  estado: AvaliacaoDaInscricaoEstado,
  oferta: string | null,
  segundaOferta: string | null,
): void {
  estado.ofertaMudou(oferta, segundaOferta, () => ({
    respostas: {},
    grupos: null,
    ofertaCursoId: oferta,
    ofertaCursoSegundaOpcaoId: segundaOferta,
  }));
}
