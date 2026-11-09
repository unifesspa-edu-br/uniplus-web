import { expect } from '@playwright/test';

import {
  GESTOR_DE_ACESSOS,
  PROTECAO_DE_DADOS,
  SEGUNDO_GESTOR_DE_ACESSOS,
  acharNaListagem,
  chamarApi,
  type RespostaDaApi,
} from './backend-real';
import { PDF_MINIMO, enviarPelaUrlAssinada } from './envio-de-arquivo';

/** Quem propõe as versões da simulação; quem aprova é sempre outra pessoa. */
export const AUTOR_DAS_VERSOES = SEGUNDO_GESTOR_DE_ACESSOS;

const ESPERA_DA_VERIFICACAO_MS = 60_000;
const RAIZ = '/api/autorizacao/perfis';

export interface EnvioDaVersao {
  readonly perfilId: string;
  readonly versaoId: string;
  readonly urlDeEnvio: string;
  readonly tipoDeMidia: string;
}

export interface VersaoPendenteLida {
  readonly versaoId: string;
  readonly situacaoDoDocumento: string;
  readonly etapaAtual: string;
  readonly exigeProtecaoDeDados: boolean;
  readonly permissoes: readonly { readonly codigo: string }[];
}

export interface PerfilLido {
  readonly id: string;
  readonly nome: string;
  readonly composicaoEmVigor: { readonly permissoes: readonly { readonly codigo: string }[] } | null;
  readonly versaoPendente: VersaoPendenteLida | null;
}

export interface DadosDaVersao {
  readonly nome: string;
  readonly descricao: string;
  readonly permissoes: readonly string[];
  readonly protocolo: string;
}

export const ordenadas = (codigos: readonly string[]): string[] => [...codigos].sort();

export async function lerPerfil(perfilId: string, quem = AUTOR_DAS_VERSOES): Promise<PerfilLido> {
  const lido = await chamarApi<PerfilLido>(quem, 'GET', `${RAIZ}/${perfilId}`);
  expect(lido.status, `ler o perfil ${perfilId}: ${JSON.stringify(lido.corpo)}`).toBe(200);
  return lido.corpo;
}

/** Cria o perfil com a primeira versão pendente, ou propõe versão nova a um perfil que existe. */
export async function proporVersao(dados: DadosDaVersao, perfilId: string | null): Promise<EnvioDaVersao> {
  const corpo = {
    ...dados,
    permissoes: ordenadas(dados.permissoes),
    tamanhoDoDocumento: PDF_MINIMO.length,
    ...(perfilId === null ? {} : { motivoDaRemocao: null, categoriaDaRemocao: null }),
  };
  const resposta =
    perfilId === null
      ? await chamarApi<EnvioDaVersao>(AUTOR_DAS_VERSOES, 'POST', RAIZ, { corpo })
      : await chamarApi<EnvioDaVersao>(AUTOR_DAS_VERSOES, 'POST', `${RAIZ}/${perfilId}/versoes`, { corpo });
  expect(resposta.status, `propor a versão de "${dados.nome}": ${JSON.stringify(resposta.corpo)}`).toBe(201);
  return resposta.corpo;
}

/** Leva o PDF ao armazenamento e confirma o envio; a API verifica o arquivo em seguida. */
export async function enviarDocumentoDaVersao(envio: EnvioDaVersao): Promise<void> {
  const etag = await enviarPelaUrlAssinada(envio.urlDeEnvio, envio.tipoDeMidia, PDF_MINIMO);
  const base = `${RAIZ}/${envio.perfilId}/versoes/${envio.versaoId}`;
  const confirmado = await chamarApi(AUTOR_DAS_VERSOES, 'POST', `${base}/documento/confirmacao`, { corpo: { etag } });
  expect(confirmado.status, `confirmar o documento da versão ${envio.versaoId}: ${JSON.stringify(confirmado.corpo)}`).toBe(200);
}

/** Espera a verificação do documento, que é assíncrona, e devolve a versão pendente já aprovável. */
export async function aguardarDocumentoVerificado(perfilId: string): Promise<VersaoPendenteLida> {
  const limite = Date.now() + ESPERA_DA_VERIFICACAO_MS;
  for (;;) {
    const { versaoPendente } = await lerPerfil(perfilId);
    if (versaoPendente?.situacaoDoDocumento === 'verificado') return versaoPendente;
    if (versaoPendente?.situacaoDoDocumento === 'recusado' || Date.now() > limite) {
      throw new Error(`O documento da versão pendente do perfil ${perfilId} não foi verificado.`);
    }
    await new Promise((resolver) => setTimeout(resolver, 1_000));
  }
}

export function decidirVersao(
  quem: string,
  versao: Pick<EnvioDaVersao, 'perfilId' | 'versaoId'>,
  etapa: 'gestao_de_acessos' | 'protecao_de_dados',
): Promise<RespostaDaApi> {
  return chamarApi(quem, 'POST', `${RAIZ}/${versao.perfilId}/versoes/${versao.versaoId}/aprovacao`, { corpo: { etapa } });
}

/** Aprova a versão pendente nas etapas que ela exige, cada uma por uma pessoa que não a propôs. */
export async function aprovarVersaoPendente(perfilId: string, versao: VersaoPendenteLida): Promise<void> {
  const identificada = { perfilId, versaoId: versao.versaoId };
  const funcional = await decidirVersao(GESTOR_DE_ACESSOS, identificada, 'gestao_de_acessos');
  expect(funcional.status, `aprovar a versão ${versao.versaoId} na gestão de acessos: ${JSON.stringify(funcional.corpo)}`).toBe(200);
  if (!versao.exigeProtecaoDeDados) return;
  const protecao = await decidirVersao(PROTECAO_DE_DADOS, identificada, 'protecao_de_dados');
  expect(protecao.status, `aprovar a versão ${versao.versaoId} na proteção de dados: ${JSON.stringify(protecao.corpo)}`).toBe(200);
}

/** Cancela a versão pendente que uma execução interrompida deixou, para a próxima proposta caber. */
export async function cancelarVersaoPendente(perfilId: string, versaoId: string): Promise<void> {
  const cancelada = await chamarApi(AUTOR_DAS_VERSOES, 'POST', `${RAIZ}/${perfilId}/versoes/${versaoId}/cancelamento`, {
    corpo: { motivo: 'Execução anterior da simulação interrompida.' },
  });
  expect(cancelada.status, `cancelar a versão ${versaoId}: ${JSON.stringify(cancelada.corpo)}`).toBe(200);
}

interface PerfilListado {
  readonly id: string;
  readonly nome: string;
}

const mesmasPermissoes = (a: readonly string[], b: readonly string[]): boolean =>
  JSON.stringify(ordenadas(a)) === JSON.stringify(ordenadas(b));

function jaEmVigor(perfil: PerfilLido, permissoes: readonly string[]): boolean {
  const emVigor = perfil.composicaoEmVigor?.permissoes.map((p) => p.codigo) ?? [];
  return mesmasPermissoes(emVigor, permissoes);
}

/**
 * Garante um perfil com exatamente estas permissões em vigor: cria quando não existe e propõe
 * versão nova quando a composição difere, aprovando-a pelas etapas que ela exige. Pode rodar de
 * novo sobre a mesma base.
 */
export async function garantirPerfil(
  nome: string,
  descricao: string,
  permissoes: readonly string[],
): Promise<string> {
  const existente = await acharNaListagem<PerfilListado>(
    AUTOR_DAS_VERSOES,
    '/api/autorizacao/perfis?limit=100',
    (perfil) => perfil.nome === nome,
  );
  const perfil = existente === undefined ? null : await lerPerfil(existente.id);
  if (perfil !== null && jaEmVigor(perfil, permissoes)) return perfil.id;
  if (perfil?.versaoPendente) await cancelarVersaoPendente(perfil.id, perfil.versaoPendente.versaoId);
  const envio = await proporVersao({ nome, descricao, permissoes, protocolo: `E2E-${Date.now()}` }, perfil?.id ?? null);
  await enviarDocumentoDaVersao(envio);
  await aprovarVersaoPendente(envio.perfilId, await aguardarDocumentoVerificado(envio.perfilId));
  return envio.perfilId;
}
