import { spawnSync } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';
import { OPERADOR_DO_ROTEIRO, garantirOperadorDoRoteiro } from '@uniplus/shared-e2e';

export function caminhoDoRoteiro(
  variavel: 'E2E_ROTEIRO_DO_PROCESSO' | 'E2E_ROTEIRO_DAS_NOTAS_DO_ENEM',
): string {
  const caminho = process.env[variavel];
  if (!caminho?.trim()) {
    throw new Error(`Defina ${variavel} com o caminho do roteiro correspondente da main da API.`);
  }
  return caminho;
}

const ID_DO_PROCESSO = /PROCESSO_ID=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;

function identificarProcessoCriado(saida: string): string {
  const id = ID_DO_PROCESSO.exec(saida)?.[1];
  if (id === undefined) {
    throw new Error(
      `O roteiro terminou sem informar o PROCESSO_ID.\n${saida.trim().split('\n').slice(-6).join('\n')}`,
    );
  }
  return id;
}

function verificarExecucaoDoRoteiro(
  execucao: { status: number | null; signal: NodeJS.Signals | null },
  saida: string,
): void {
  if (execucao.status !== 0) {
    throw new Error(
      `O roteiro terminou com status ${String(execucao.status ?? execucao.signal)}.\n${saida.trim().split('\n').slice(-12).join('\n')}`,
    );
  }
}

function executarRoteiro(
  comando: string,
  argumentos: readonly string[],
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
) {
  return spawnSync(comando, argumentos, {
    env: { ...env, ADMIN_USER: OPERADOR_DO_ROTEIRO },
    encoding: 'utf-8',
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
  });
}

/**
 * Roda um roteiro da uniplus-api e devolve o id do processo que ele criou, lido da saída do próprio
 * roteiro: localizar o processo pela listagem do banco compartilhado pode achar outro de mesmo nome.
 * O roteiro escreve o andamento e a recusa da API no stderr, sem token nem senha, e a falha leva o
 * fim desse registro na mensagem. O roteiro roda como `OPERADOR_DO_ROTEIRO`, que recebe antes os
 * perfis de que ele precisa.
 */
export async function rodarRoteiroDeProcesso(
  comando: string,
  argumentos: readonly string[],
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<string> {
  await garantirOperadorDoRoteiro();
  const execucao = executarRoteiro(comando, argumentos, env, timeoutMs);
  const saida = stripVTControlCharacters(`${execucao.stdout}\n${execucao.stderr}`);
  verificarExecucaoDoRoteiro(execucao, saida);
  return identificarProcessoCriado(saida);
}
