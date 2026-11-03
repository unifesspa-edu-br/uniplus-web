import { acharNaListagem, chamarApi } from '@uniplus/shared-e2e';

export interface ProcessoListado {
  readonly id: string;
  readonly nome: string;
  readonly status: string;
}

/** Todos os processos da listagem, percorrendo as páginas até o fim. */
export async function listarProcessos(): Promise<readonly ProcessoListado[]> {
  const todos: ProcessoListado[] = [];
  await acharNaListagem<ProcessoListado>('manoel.aparicio', '/api/selecao/processos-seletivos?limit=100', (processo) => {
    todos.push(processo);
    return false;
  });
  return todos;
}

/** Os processos publicados cujo nome começa por `prefixo`. */
export async function processosPublicadosComNome(prefixo: string): Promise<readonly ProcessoListado[]> {
  return (await listarProcessos()).filter((processo) => processo.nome.startsWith(prefixo) && processo.status === 'publicado');
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
