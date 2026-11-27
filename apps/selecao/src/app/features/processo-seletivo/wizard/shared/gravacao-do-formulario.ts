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

/** Por onde a gravação passa: o registro de idempotência e a API do formulário. */
export interface DestinoDaGravacaoDoFormulario {
  readonly gravacao: GravacaoDoProcesso;
  readonly api: FormulariosDoProcessoApi;
}

interface AlvoDoFormulario {
  readonly processoSeletivoId: string;
  readonly codigo: string;
}

/**
 * Grava o formulário seguindo o plano: só o que difere do servidor, na ordem em
 * que a API aceita cada parte. Para no primeiro passo recusado; os anteriores ficaram gravados, e
 * quem chama relê o processo para comparar a próxima tentativa com o que ficou.
 *
 * Antes do primeiro passo confere que os itens podem ser enviados: o cabeçalho não se grava se eles
 * não puderem. Cada parte tem a sua chave, e o corpo leva o código: a mesma lista enviada a dois
 * formulários é outro comando.
 */
export async function gravarFormulario(
  destino: DestinoDaGravacaoDoFormulario,
  alvo: AlvoDoFormulario,
  servidor: FormularioParaGravar | null,
  desejado: FormularioDesejado,
): Promise<ResultadoGravacao> {
  if (itensParaEnvio(desejado.conteudo) === null) {
    return { ok: false, problem: LIMITE_QUE_NAO_E_NUMERO };
  }
  for (const passo of planoDeGravacao(servidor, desejado)) {
    const resultado = await gravarPasso(destino, alvo, passo, desejado);
    if (!resultado.ok) return resultado;
  }
  return { ok: true };
}

type Gravador = (
  destino: DestinoDaGravacaoDoFormulario,
  alvo: AlvoDoFormulario,
  desejado: FormularioDesejado,
) => Promise<ResultadoGravacao>;

const GRAVADORES: Readonly<Record<PassoDaGravacao, Gravador>> = {
  cabecalho: gravarCabecalho,
  itens: (destino, alvo, desejado) => gravarItens(destino, alvo, desejado, false),
  itensSemSecao: (destino, alvo, desejado) => gravarItens(destino, alvo, desejado, true),
  termos: gravarTermos,
};

function gravarPasso(
  destino: DestinoDaGravacaoDoFormulario,
  alvo: AlvoDoFormulario,
  passo: PassoDaGravacao,
  desejado: FormularioDesejado,
): Promise<ResultadoGravacao> {
  return GRAVADORES[passo](destino, alvo, desejado);
}

function gravarCabecalho(
  { gravacao, api }: DestinoDaGravacaoDoFormulario,
  { processoSeletivoId, codigo }: AlvoDoFormulario,
  desejado: FormularioDesejado,
): Promise<ResultadoGravacao> {
  const corpo = cabecalhoParaEnvio(desejado);
  return gravacao.gravar('cabecalhoDoFormulario', { codigo, corpo }, (contexto) =>
    api.definirCabecalhoDoFormulario(processoSeletivoId, codigo, corpo, contexto),
  );
}

function gravarItens(
  { gravacao, api }: DestinoDaGravacaoDoFormulario,
  { processoSeletivoId, codigo }: AlvoDoFormulario,
  desejado: FormularioDesejado,
  semSecao: boolean,
): Promise<ResultadoGravacao> {
  const corpo = itensParaEnvio(desejado.conteudo, semSecao);
  if (corpo === null) return Promise.resolve({ ok: false, problem: LIMITE_QUE_NAO_E_NUMERO });
  return gravacao.gravar('itensDoFormulario', { codigo, corpo }, (contexto) =>
    api.definirItensDoFormulario(processoSeletivoId, codigo, corpo, contexto),
  );
}

function gravarTermos(
  { gravacao, api }: DestinoDaGravacaoDoFormulario,
  { processoSeletivoId, codigo }: AlvoDoFormulario,
  desejado: FormularioDesejado,
): Promise<ResultadoGravacao> {
  const corpo = termosParaEnvio(desejado.conteudo);
  return gravacao.gravar('termosDoFormulario', { codigo, corpo }, (contexto) =>
    api.definirTermosDoFormulario(processoSeletivoId, codigo, corpo, contexto),
  );
}
