import {
  PAPEL_DEFINITIVO,
  PAPEL_PRELIMINAR,
  type RecursoDaFase,
  type RegraDeDeliberacaoDaBanca,
} from '../../processo-seletivo.models';
import {
  PARAMETROS_SEM_INSTANCIA_SUPERIOR,
  umaLeituraDoRecurso,
} from '../../shared/configuracao-do-recurso/parametros-do-recurso.testing';
import { COLEGIADA } from '../../shared/deliberacao/regra-de-deliberacao.testing';
import { ID_BANCA_HETERO, PROBLEM_JSON, PROCESSO_ID, ROTA_FASES } from './cronograma.testing';
import type { ContextoDoCronograma } from './cronograma-passo.testing';

export const REGRA_DO_RECURSO: RecursoDaFase = {
  regraCodigo: 'REGRA_DO_RECURSO',
  regraVersao: '1',
  ...PARAMETROS_SEM_INSTANCIA_SUPERIOR,
  prazoValor: '3',
  atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
  leitura: umaLeituraDoRecurso(),
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

  /** A primeira fase passa a requerer uma banca, com a regra de deliberação informada. */
  readonly requererBanca = (regraDeDeliberacao: RegraDeDeliberacaoDaBanca = COLEGIADA): void => {
    const [fase] = this.tela.store.draft().cronograma.fases;
    const banca = {
      id: null,
      identificadorLocal: ID_BANCA_HETERO,
      copiaDoTipo: null,
      tipoBancaId: ID_BANCA_HETERO,
      categoriasDocumentoIds: [],
      regraDeDeliberacao,
    };
    this.tela.store.patchObjectSection('cronograma', {
      fases: [{ ...fase, bancasRequeridas: [banca] }],
    });
    this.tela.detectar();
  };

  readonly bloco: TextoDoBloco = (id) =>
    this.tela.nativo.querySelector(`#${id}`)?.textContent?.replace(/\s+/g, ' ') ?? null;
}
