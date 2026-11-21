import { PROBLEM_JSON, PROCESSO_ID, ROTA_ETAPAS, ROTA_FASES } from './cronograma.testing';
import type { ContextoDoCronograma } from './cronograma-passo.testing';
import {
  type ErroDaFase,
  PAGINAS_DE_ERRO,
  type TextoDoBloco,
} from './cronograma-recusas-das-fases.testing';

/** `field` ausente é a causa geral, que a API envia sem apontar campo. */
export type ErroDaEtapa = ErroDaFase;

const SEM_CONTEUDO = { status: 204, statusText: 'No Content' };
const NAO_PROCESSAVEL = {
  status: 422,
  statusText: 'Unprocessable Content',
  headers: PROBLEM_JSON,
};

function recusaDeValidacao(erros: readonly ErroDaEtapa[]): object {
  return {
    type: `${PAGINAS_DE_ERRO}uniplus.validacao`,
    title: 'Validação',
    status: 422,
    code: 'uniplus.validacao',
    traceId: '00000000000000000000000000000009',
    errors: erros,
  };
}

/** Conduz a gravação do cronograma até a recusa do servidor às etapas, que traz os erros pedidos. */
export class AjudantesDeRecusasDasEtapas {
  constructor(private readonly tela: ContextoDoCronograma) {}

  readonly recusarEtapas = async (erros: readonly ErroDaEtapa[]) => {
    this.tela.store.processoSeletivoId.set(PROCESSO_ID);
    const gravacao = this.tela.componente.persistir();
    this.tela.controller.expectOne(ROTA_FASES).flush(null, SEM_CONTEUDO);
    await this.tela.proximoPasso();
    this.tela.controller.expectOne(ROTA_ETAPAS).flush(recusaDeValidacao(erros), NAO_PROCESSAVEL);
    const resultado = await gravacao;
    this.tela.detectar();
    return resultado;
  };

  readonly bloco: TextoDoBloco = (id) =>
    this.tela.nativo.querySelector(`#${id}`)?.textContent?.replace(/\s+/g, ' ') ?? null;
}

/** O que os cenários de recusa precisam do código e da mensagem de uma recusa de teste. */
export const recusaDaEtapa = (field: string, message = `Recusa de ${field}.`): ErroDaEtapa => ({
  field,
  code: 'uniplus.selecao.etapa_processo.recusa_de_teste',
  message,
});
