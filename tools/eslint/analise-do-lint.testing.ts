import { join } from 'node:path';
import { workspaceRoot } from '@nx/devkit';
import { ESLint } from 'eslint';

export async function analisar(projeto: string, arquivo: string, codigo: string) {
  const raiz = join(workspaceRoot, projeto);
  const [resultado] = await new ESLint({ cwd: raiz }).lintText(`${codigo}\n`, {
    filePath: join(raiz, arquivo),
  });
  const mensagens = resultado.messages;
  return {
    mensagens,
    regras: mensagens.flatMap((mensagem) => (mensagem.ruleId ? [mensagem.ruleId] : [])),
    analiseSemFalha:
      resultado.fatalErrorCount === 0 && mensagens.every((mensagem) => mensagem.ruleId !== null),
  };
}

export function importacao(origem: string): string {
  return `import '${origem}';`;
}
