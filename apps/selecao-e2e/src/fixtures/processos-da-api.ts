import { chamarApi } from '@uniplus/shared-e2e';

interface ProcessoListado {
  readonly id: string;
  readonly nome: string;
  readonly status: string;
}

/** Os processos publicados cujo nome começa por `prefixo`, como a listagem da API os devolve. */
export async function processosPublicadosComNome(prefixo: string): Promise<readonly ProcessoListado[]> {
  const lista = await chamarApi<ProcessoListado[]>('manoel.aparicio', 'GET', '/api/selecao/processos-seletivos?limit=100');
  return lista.corpo.filter((processo) => processo.nome.startsWith(prefixo) && processo.status === 'publicado');
}

/** Quantas inscrições a primeira página da listagem do processo traz (até 100). */
export async function inscricoesDoProcesso(processoId: string): Promise<number> {
  const lista = await chamarApi<unknown[]>(
    'diogo.souza',
    'GET',
    `/api/selecao/processos-seletivos/${processoId}/inscricoes?limit=100`,
    { cabecalhos: { accept: 'application/vnd.uniplus.inscricao-do-processo.v1+json' } },
  );
  if (!Array.isArray(lista.corpo)) {
    throw new Error(`Listar as inscrições de ${processoId} respondeu ${lista.status}.`);
  }
  return lista.corpo.length;
}
