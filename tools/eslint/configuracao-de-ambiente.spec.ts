import { join } from 'node:path';
import { createProjectGraphAsync, workspaceRoot } from '@nx/devkit';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';
import { analisar, importacao } from './analise-do-lint.testing';

const APLICATIVOS = ['selecao', 'ingresso', 'portal', 'configuracao'];
const ARQUIVO = 'src/app/app.config.ts';
const REGRA = 'no-restricted-imports';

beforeAll(async () => {
  await createProjectGraphAsync();
});

describe('configuração de ambiente nos aplicativos', () => {
  it.each(APLICATIVOS)('recusa imports de ambiente em %s', async (aplicativo) => {
    for (const origem of ['../environments/environment', '../environments/environment.prod']) {
      const resultado = await analisar(`apps/${aplicativo}`, ARQUIVO, importacao(origem));
      expect(resultado.analiseSemFalha).toBe(true);
      expect(resultado.regras).toContain(REGRA);
    }
  });

  it.each(APLICATIVOS)('aceita a configuração real de %s', async (aplicativo) => {
    const raiz = join(workspaceRoot, 'apps', aplicativo);
    const [resultado] = await new ESLint({ cwd: raiz }).lintFiles(join(raiz, ARQUIVO));
    expect(resultado.fatalErrorCount).toBe(0);
    expect(resultado.messages.map((mensagem) => mensagem.ruleId)).not.toContain(REGRA);
  });
});
