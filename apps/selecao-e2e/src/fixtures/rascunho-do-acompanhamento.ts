import { acharNaListagem, chamarApi, unidadeDoCertame } from '@uniplus/shared-e2e';
import type { ProcessoListado } from './processos-da-api';

const NOME = 'E2E Acompanhamento — processo em rascunho';

async function idDoTipoPsr(criador: string): Promise<string> {
  const tipos = await chamarApi<{ id: string; codigo: string }[]>(
    criador,
    'GET',
    '/api/configuracao/tipos-processo?limit=100',
  );
  const tipo = Array.isArray(tipos.corpo)
    ? tipos.corpo.find((t) => t.codigo === 'REGULAR_UNIFICADO')
    : undefined;
  if (tipo === undefined)
    throw new Error("Tipo de processo 'REGULAR_UNIFICADO' não encontrado no catálogo.");
  return tipo.id;
}

async function comandoDeCriacao(criador: string): Promise<object> {
  return {
    nome: NOME,
    tipoProcessoOrigemId: await idDoTipoPsr(criador),
    origemCandidatos: 'INSCRICAO_PROPRIA',
    unidadeAdministradoraOrigemId: await unidadeDoCertame(),
    localidadeCodigoIbge: '1504208',
    localidadeNome: 'Marabá',
    localidadeUf: 'PA',
    identificadorLegivel: 'e2e-acompanhamento-rascunho',
  };
}

async function criarRascunho(criador: string): Promise<string> {
  const corpo = await comandoDeCriacao(criador);
  const criado = await chamarApi<string | { id: string }>(
    criador,
    'POST',
    '/api/selecao/processos-seletivos',
    { corpo },
  );
  if (criado.status >= 300) {
    throw new Error(`Criar o rascunho falhou (${criado.status}): ${JSON.stringify(criado.corpo)}`);
  }
  return typeof criado.corpo === 'string' ? criado.corpo : criado.corpo.id;
}

/**
 * Um processo em rascunho da unidade do certame, criado por quem configura nela e reaproveitado nas
 * rodadas seguintes. Fica em rascunho: nenhuma spec o publica.
 */
export async function rascunhoDoAcompanhamento(criador: string): Promise<ProcessoListado> {
  // Rascunho só aparece a quem configura na unidade: a lista é lida por quem o criou.
  const existente = await acharNaListagem<ProcessoListado>(
    criador,
    '/api/selecao/processos-seletivos?limit=100',
    (processo) => processo.nome === NOME,
  );
  return (
    existente ?? {
      id: await criarRascunho(criador),
      nome: NOME,
      situacao: { codigo: 'RASCUNHO', rotulo: 'Rascunho' },
    }
  );
}
