import { ProblemDetails, STATUS_HTTP } from '@uniplus/shared-core/http';
import { FormulariosDoProcessoApi } from '@uniplus/shared-data/selecao';

import {
  cabecalhoParaEnvio,
  itensParaEnvio,
  planoDeGravacao,
  termosParaEnvio,
  type FormularioParaGravar,
  type PassoDaGravacao,
} from '../passos/formulario/formulario-do-processo';
import { GravacaoDoProcesso } from './gravacao/gravacao-do-processo';
import type { ResultadoGravacao } from './gravacao/resultado-da-gravacao';

/** Limite digitado no formulário que não é número: a gravação nem sai, porque a API recusa número em texto. */
const LIMITE_QUE_NAO_E_NUMERO: ProblemDetails = {
  type: 'about:blank',
  title: 'Há limites ou deslocamentos do formulário que não são números.',
  status: STATUS_HTTP.RECUSA_DE_NEGOCIO,
  code: 'uniplus.client.numero_invalido',
  traceId: '',
};

type FormularioDesejado = FormularioParaGravar & { readonly faseId: string };

interface AlvoDoFormulario {
  readonly processoSeletivoId: string;
  readonly finalidade: string;
}

/**
 * Grava o formulário de uma finalidade seguindo o plano: só o que difere do servidor, na ordem em
 * que a API aceita cada parte. Para no primeiro passo recusado; os anteriores ficaram gravados, e
 * quem chama relê o processo para comparar a próxima tentativa com o que ficou.
 *
 * Cada parte tem a sua chave, e o corpo leva a finalidade: a mesma lista enviada a duas
 * finalidades é outro comando.
 */
export async function gravarFormulario(
  gravacao: GravacaoDoProcesso,
  api: FormulariosDoProcessoApi,
  alvo: AlvoDoFormulario,
  servidor: FormularioParaGravar | null,
  desejado: FormularioDesejado,
): Promise<ResultadoGravacao> {
  // Antes do primeiro passo: o cabeçalho não pode ser gravado se os itens não puderem.
  if (itensParaEnvio(desejado.conteudo) === null) {
    return { ok: false, problem: LIMITE_QUE_NAO_E_NUMERO };
  }
  for (const passo of planoDeGravacao(servidor, desejado)) {
    const resultado = await gravarPasso(gravacao, api, alvo, passo, desejado);
    if (!resultado.ok) return resultado;
  }
  return { ok: true };
}

function gravarPasso(
  gravacao: GravacaoDoProcesso,
  api: FormulariosDoProcessoApi,
  { processoSeletivoId, finalidade }: AlvoDoFormulario,
  passo: PassoDaGravacao,
  desejado: FormularioDesejado,
): Promise<ResultadoGravacao> {
  switch (passo) {
    case 'cabecalho': {
      const corpo = cabecalhoParaEnvio(desejado.faseId, desejado.conteudo);
      return gravacao.gravar('cabecalhoDoFormulario', { finalidade, corpo }, (contexto) =>
        api.definirCabecalhoDoFormulario(processoSeletivoId, finalidade, corpo, contexto),
      );
    }
    case 'itensSemSecao':
    case 'itens': {
      const corpo = itensParaEnvio(desejado.conteudo, passo === 'itensSemSecao');
      if (corpo === null) return Promise.resolve({ ok: false, problem: LIMITE_QUE_NAO_E_NUMERO });
      return gravacao.gravar('itensDoFormulario', { finalidade, corpo }, (contexto) =>
        api.definirItensDoFormulario(processoSeletivoId, finalidade, corpo, contexto),
      );
    }
    case 'termos': {
      const corpo = termosParaEnvio(desejado.conteudo);
      return gravacao.gravar('termosDoFormulario', { finalidade, corpo }, (contexto) =>
        api.definirTermosDoFormulario(processoSeletivoId, finalidade, corpo, contexto),
      );
    }
  }
}
