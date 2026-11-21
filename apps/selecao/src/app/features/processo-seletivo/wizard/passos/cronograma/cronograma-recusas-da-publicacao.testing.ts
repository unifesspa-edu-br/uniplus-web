import { TestBed } from '@angular/core/testing';
import type { IdentificadorDoItem, ProblemDetails } from '@uniplus/shared-core/http';

import { PASSOS } from '../../processo-seletivo.data';
import { RecusasDaPublicacao } from '../../shared/recusas/recusas-da-publicacao.service';
import type { ContextoDoCronograma } from './cronograma-passo.testing';
import { PAGINAS_DE_ERRO } from './cronograma-recusas-das-fases.testing';

/** Uma causa da publicação recusada; sem `identificadores`, a API não apontou item de lista. */
export interface ErroDaPublicacao {
  readonly field?: string;
  readonly code: string;
  readonly message: string;
  readonly identificadores?: readonly IdentificadorDoItem[];
}

export const SEM_DEFINITIVO =
  'uniplus.selecao.processo_seletivo.fase_sem_definitivo_sem_data_final';
export const PRELIMINAR_SEM_DEFINITIVO =
  'uniplus.selecao.processo_seletivo.fase_com_preliminar_sem_definitivo';

export const daFase = (codigo: string): IdentificadorDoItem => ({
  lista: 'fases',
  identificador: codigo,
});
export const daEtapa = (id: string): IdentificadorDoItem => ({
  lista: 'etapas',
  identificador: id,
});
export const doRecurso = (id: string): IdentificadorDoItem => ({
  lista: 'recursos',
  identificador: id,
});

function problemaDaPublicacao(erros: readonly ErroDaPublicacao[]): ProblemDetails {
  return {
    type: `${PAGINAS_DE_ERRO}uniplus.validacao`,
    title: 'A configuração não pode ser publicada',
    status: 422,
    code: 'uniplus.validacao',
    traceId: '00000000000000000000000000000001',
    errors: erros,
  };
}

/** Conduz a tela do Cronograma até a resposta recusada da publicação, que a Revisão registra. */
export class AjudantesDaPublicacaoRecusada {
  readonly publicacao = TestBed.inject(RecusasDaPublicacao);

  constructor(private readonly tela: ContextoDoCronograma) {}

  readonly recusar = (...erros: readonly ErroDaPublicacao[]): void => {
    this.publicacao.registrar(problemaDaPublicacao(erros), 'A publicação foi recusada.');
    this.tela.detectar();
  };

  /** A pessoa usou "Ir ao campo" na Revisão: o Cronograma passa a ser o passo visível. */
  readonly irAoCampo = async (ordem: number): Promise<void> => {
    const recusa = this.publicacao.recusas().find((candidata) => candidata.ordem === ordem);
    this.publicacao.destino.set(recusa ?? null);
    this.tela.store.goTo(PASSOS.findIndex((passo) => passo.rotulo === 'Cronograma'));
    this.tela.detectar();
    await this.tela.proximoPasso();
    this.tela.detectar();
  };

  readonly bloco = (id: string): string | null =>
    this.tela.nativo.querySelector(`#${id}`)?.textContent?.replace(/\s+/g, ' ') ?? null;
}
