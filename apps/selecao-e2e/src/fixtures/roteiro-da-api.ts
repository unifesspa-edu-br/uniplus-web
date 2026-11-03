import { spawnSync } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';

const ID_DO_PROCESSO = /PROCESSO_ID=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;

/**
 * Roda um roteiro da uniplus-api e devolve o id do processo que ele criou, lido da saída do próprio
 * roteiro: localizar o processo pela listagem do banco compartilhado pode achar outro de mesmo nome.
 * O roteiro escreve o andamento e a recusa da API no stderr, sem token nem senha, e a falha leva o
 * fim desse registro na mensagem.
 */
export function rodarRoteiroDeProcesso(
  comando: string,
  argumentos: readonly string[],
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): string {
  const execucao = spawnSync(comando, argumentos, { env, encoding: 'utf-8', timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 });
  const saida = stripVTControlCharacters(`${execucao.stdout}\n${execucao.stderr}`);
  if (execucao.status !== 0) {
    throw new Error(
      `O roteiro terminou com status ${String(execucao.status ?? execucao.signal)}.\n${saida.trim().split('\n').slice(-12).join('\n')}`,
    );
  }
  const id = ID_DO_PROCESSO.exec(saida)?.[1];
  if (id === undefined) {
    throw new Error(`O roteiro terminou sem informar o PROCESSO_ID.\n${saida.trim().split('\n').slice(-6).join('\n')}`);
  }
  return id;
}
