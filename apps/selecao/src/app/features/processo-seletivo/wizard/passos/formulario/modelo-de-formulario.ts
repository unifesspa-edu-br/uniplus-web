import type { ModeloFormularioView } from '@uniplus/shared-data/configuracao';
import type { AplicacaoDeModeloDto, FormularioDto } from '@uniplus/shared-data/selecao';

import type { DerivacaoDeFato, FormularioDeInscricao } from '../../processo-seletivo.models';
import { fatosColetadosPor, type ProcessoComFormularios } from './formulario-do-processo';
import {
  comFormulario,
  formularioDoServidorNaFinalidade,
  formulariosDoRascunho,
} from './formularios-por-finalidade';

/**
 * Partir de um modelo (UNI-REQ-0144): o processo copia um modelo de formulário da Configuração
 * para a finalidade dele. A cópia é feita pelo servidor, que substitui o formulário inteiro e
 * relata o que fez; aqui ficam a oferta dos modelos, a fase que o formulário nascido da cópia
 * precisa, a projeção do resultado no rascunho e o resumo que o operador lê.
 */

/** Um modelo como a aba o oferece. */
export interface ModeloOferecido {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
}

/**
 * Os modelos de cada finalidade, por nome. A listagem chega filtrada pelo tipo do processo e pelos
 * ativos — quem decide o que serve ao processo é o servidor —, e cada aba oferece só os da
 * finalidade dela.
 */
export function modelosPorFinalidade(
  modelos: readonly ModeloFormularioView[],
): ReadonlyMap<string, readonly ModeloOferecido[]> {
  const porFinalidade = new Map<string, ModeloOferecido[]>();
  for (const modelo of modelos) {
    const daFinalidade = porFinalidade.get(modelo.finalidade) ?? [];
    daFinalidade.push({ id: modelo.id, codigo: modelo.codigo, nome: modelo.nome });
    porFinalidade.set(modelo.finalidade, daFinalidade);
  }
  for (const daFinalidade of porFinalidade.values()) {
    daFinalidade.sort((um, outro) => um.nome.localeCompare(outro.nome, 'pt-BR'));
  }
  return porFinalidade;
}

/**
 * A fase que a aplicação precisa declarar depois da cópia. A cópia preserva a fase do formulário
 * que já existe com uma; o que nasce dela — ou o que existia sem fase — fica sem, e a publicação
 * recusa formulário sem fase. Então a fase da aba vai no cabeçalho logo em seguida, e precisa
 * existir no cronograma GRAVADO: sem ela, a aplicação não começa.
 */
export type FaseDaAplicacao =
  | { readonly declarar: false }
  | { readonly declarar: true; readonly faseId: string }
  | { readonly declarar: true; readonly faseId: null };

export function faseQueAAplicacaoDeclara(
  gravado: FormularioDto | null,
  faseCodigo: string,
  fasesGravadas: readonly { readonly id: string; readonly codigo: string }[],
): FaseDaAplicacao {
  if (gravado?.faseId != null) return { declarar: false };
  return {
    declarar: true,
    faseId: fasesGravadas.find((fase) => fase.codigo === faseCodigo)?.id ?? null,
  };
}

/** O processo relido como a projeção da aplicação o precisa: os formulários, as fases e as derivações. */
export interface ProcessoAposAplicacao extends ProcessoComFormularios {
  readonly regrasDerivacao: readonly DerivacaoDeFato[];
}

/**
 * O rascunho depois da aplicação, com o que o servidor mudou e só isso:
 * - o formulário da finalidade aplicada, como o servidor o tem — sem fase gravada, com a da aba,
 *   que é a que o cabeçalho declara em seguida;
 * - na inscrição, os outros formulários de onde a cópia trouxe fatos, como o servidor os deixou;
 * - as derivações que a cópia trouxe do catálogo, somadas às do rascunho.
 *
 * O resto do rascunho — as outras abas e as derivações que o operador editou — fica como está.
 */
export function comAplicacaoDoServidor(
  rascunho: FormularioDeInscricao,
  servidor: ProcessoAposAplicacao,
  relato: AplicacaoDeModeloDto,
  faseDaAba: string,
): FormularioDeInscricao {
  const aplicado = formularioDoServidorNaFinalidade(servidor, relato.finalidade);
  if (aplicado === null) return rascunho;

  let formulario = comFormulario(rascunho, {
    ...aplicado,
    faseCodigo: aplicado.faseCodigo === '' ? faseDaAba : aplicado.faseCodigo,
  });

  const trazidos = new Set(relato.fatosTrazidosParaAInscricao);
  for (const outro of formulariosDoRascunho(rascunho)) {
    if (
      outro.finalidade === relato.finalidade ||
      !fatosColetadosPor(outro.conteudo).some((fato) => trazidos.has(fato))
    )
      continue;
    const doServidor = formularioDoServidorNaFinalidade(servidor, outro.finalidade);
    if (doServidor !== null) formulario = comFormulario(formulario, doServidor);
  }

  const copiadas = new Set(relato.derivacoesCopiadas);
  if (copiadas.size === 0) return formulario;
  return {
    ...formulario,
    derivacao: [
      ...formulario.derivacao.filter((derivacao) => !copiadas.has(derivacao.codigoFato)),
      ...servidor.regrasDerivacao.filter((derivacao) => copiadas.has(derivacao.codigoFato)),
    ],
  };
}

const MOTIVOS_DO_DESCARTE: Readonly<Record<string, string>> = {
  FATO_DESATIVADO: 'desativado no catálogo',
  FATO_NAO_COLETAVEL: 'não pode mais ser coletado',
  VERSAO_DE_TERMO_REMOVIDA: 'versão do termo removida',
};

/**
 * O resumo da aplicação, em frases: o que a cópia acrescentou, o que ficou em outro formulário e o
 * que ficou de fora. `acrescentados` são os campos que o processo pressupõe e o modelo não trazia —
 * a reconciliação os põe no rascunho depois da cópia.
 */
export function resumoDaAplicacao(
  relato: AplicacaoDeModeloDto,
  modelo: string,
  acrescentados: readonly string[],
  nomeDoFato: (codigo: string) => string,
): readonly string[] {
  const nomes = (codigos: readonly string[]): string => codigos.map(nomeDoFato).join(', ');
  const frases = [`O formulário passou a ser a cópia do modelo ${modelo}.`];
  if (acrescentados.length > 0) {
    frases.push(
      `Acrescentados porque o processo os pressupõe (exigências documentais, derivação ou desempate): ${nomes(acrescentados)}. Grave o passo para levá-los ao processo.`,
    );
  }
  if (relato.fatosTrazidosParaAInscricao.length > 0) {
    frases.push(
      `Trazidos de outro formulário para a inscrição: ${nomes(relato.fatosTrazidosParaAInscricao)}.`,
    );
  }
  if (relato.fatosMantidosNaInscricao.length > 0) {
    frases.push(
      `Mantidos no formulário de inscrição, que já os coleta, e fora desta cópia: ${nomes(relato.fatosMantidosNaInscricao)}. As condições deste formulário podem citá-los.`,
    );
  }
  if (relato.descartados.length > 0) {
    const partes = relato.descartados.map(
      (parte) =>
        `${parte.parte === 'TERMO' ? parte.codigo : nomeDoFato(parte.codigo)} (${MOTIVOS_DO_DESCARTE[parte.motivo] ?? parte.motivo})`,
    );
    frases.push(
      `Fora da cópia porque o catálogo mudou depois do modelo: ${partes.join(', ')}. A correção é editar o modelo.`,
    );
  }
  if (relato.derivacoesCopiadas.length > 0) {
    frases.push(
      `Regras de derivação copiadas do catálogo para o processo: ${nomes(relato.derivacoesCopiadas)}.`,
    );
  }
  return frases;
}

/**
 * A aplicação que ficou sem desfecho conhecido no rascunho. Sem confirmação, o envio falhou por
 * rede ou 5xx e a cópia pode ter acontecido: só a nova tentativa do MESMO modelo, idempotente pela
 * mesma chave, resolve — outro modelo trocaria a chave, e a primeira cópia ainda poderia chegar
 * por cima dele. Sem releitura, a cópia aconteceu e só recarregar o processo traz o que ela fez.
 */
export interface AplicacaoEmAberto {
  readonly modeloId: string;
  readonly modeloNome: string;
  readonly copiaConfirmada: boolean;
}

/** O que a aba e a trava do passo dizem da aplicação em aberto, com o que resolve cada caso. */
export function textoDaAplicacaoEmAberto(
  nomeDaFinalidade: string,
  emAberto: AplicacaoEmAberto,
): string {
  return emAberto.copiaConfirmada
    ? `O modelo “${emAberto.modeloNome}” foi aplicado ao formulário de ${nomeDaFinalidade}, mas não foi possível reler o processo. Recarregue o processo antes de continuar, para não gravar por cima da cópia.`
    : `Não foi possível confirmar se o modelo “${emAberto.modeloNome}” foi aplicado ao formulário de ${nomeDaFinalidade}. Aplique o mesmo modelo de novo ou recarregue o processo antes de continuar, para não gravar por cima da cópia.`;
}
