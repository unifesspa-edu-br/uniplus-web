import { UnidadePrazo } from '@uniplus/shared-data/selecao';

import {
  PAPEL_DEFINITIVO,
  PAPEL_PRELIMINAR,
  type RecursoDaFase,
} from '../../processo-seletivo.models';
import { PROBLEM_JSON, PROCESSO_ID, ROTA_FASES } from './cronograma.testing';
import type { ContextoDoCronograma } from './cronograma-passo.testing';

export const REGRA_DO_RECURSO: RecursoDaFase = {
  regraCodigo: 'REGRA_DO_RECURSO',
  regraVersao: '1',
  prazoValor: '3',
  prazoUnidade: UnidadePrazo.diasUteis,
  atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
  suspensividadePrimeiraInstanciaValor: '',
  suspensividadePrimeiraInstanciaUnidade: '',
  admiteInstanciaSuperior: false,
  suspensividadeSegundaInstanciaValor: '',
  suspensividadeSegundaInstanciaUnidade: '',
  procedimentos: [],
};

export const PAGINAS_DE_ERRO = 'https://erros.exemplo.unifesspa.edu.br/erros/';

/** `field` ausente é a causa geral, que a API envia sem apontar campo. */
export interface ErroDaFase {
  readonly field?: string;
  readonly code: string;
  readonly message: string;
}

/** O que a pessoa vê de uma recusa: o texto do bloco que a mostra, ou `null` sem bloco. */
export type TextoDoBloco = (id: string) => string | null;

function recusaDeValidacao(erros: readonly ErroDaFase[]): object {
  return {
    type: `${PAGINAS_DE_ERRO}uniplus.validacao`,
    title: 'Validação',
    status: 422,
    code: 'uniplus.validacao',
    traceId: '00000000000000000000000000000009',
    errors: erros,
  };
}

const NAO_PROCESSAVEL = {
  status: 422,
  statusText: 'Unprocessable Content',
  headers: PROBLEM_JSON,
};

/** Conduz a gravação das fases até a recusa do servidor, que traz os erros pedidos. */
export class AjudantesDeRecusasDasFases {
  constructor(private readonly tela: ContextoDoCronograma) {}

  readonly recusarFases = async (erros: readonly ErroDaFase[]) => {
    this.tela.store.processoSeletivoId.set(PROCESSO_ID);
    const gravacao = this.tela.componente.persistir();
    this.tela.controller.expectOne(ROTA_FASES).flush(recusaDeValidacao(erros), NAO_PROCESSAVEL);
    const resultado = await gravacao;
    this.tela.detectar();
    return resultado;
  };

  /** A primeira fase passa a publicar preliminar e definitivo e a declarar a regra de recurso. */
  readonly declararRegraDeRecurso = (regra: RecursoDaFase = REGRA_DO_RECURSO): void => {
    const [fase] = this.tela.store.draft().cronograma.fases;
    const produtos = [
      { atoCodigo: 'RESULTADO_PRELIMINAR', papel: PAPEL_PRELIMINAR },
      { atoCodigo: 'RESULTADO_FINAL', papel: PAPEL_DEFINITIVO },
    ];
    this.tela.store.patchObjectSection('cronograma', {
      fases: [{ ...fase, produtos, regraRecurso: regra }],
    });
    this.tela.detectar();
  };

  readonly bloco: TextoDoBloco = (id) =>
    this.tela.nativo.querySelector(`#${id}`)?.textContent?.replace(/\s+/g, ' ') ?? null;
}
