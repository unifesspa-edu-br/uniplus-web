import { join } from 'node:path';
import { createProjectGraphAsync, workspaceRoot } from '@nx/devkit';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const REGRA_DE_FRONTEIRA = '@nx/enforce-module-boundaries';
const REGRA_DO_ARQUIVO_DE_TESTE = 'apoio-de-teste/arquivo-de-teste-fora-da-producao';
const APOIO_DE_TESTE = '@uniplus/shared-testing';
const APOIO_POR_CAMINHO_RELATIVO =
  '../../../../../../libs/shared-testing/src/lib/relogio-controlado.testing';

interface Analise {
  regras: string[];
  analiseSemFalha: boolean;
}

interface ArquivoDeProducao {
  projeto: string;
  arquivo: string;
}

async function analisar(projeto: string, arquivo: string, codigo: string): Promise<Analise> {
  const raiz = join(workspaceRoot, projeto);
  const [resultado] = await new ESLint({ cwd: raiz }).lintText(`${codigo}\n`, {
    filePath: join(raiz, arquivo),
  });
  const mensagens = resultado.messages;
  return {
    regras: mensagens.flatMap((mensagem) => (mensagem.ruleId ? [mensagem.ruleId] : [])),
    analiseSemFalha:
      resultado.fatalErrorCount === 0 && mensagens.every((mensagem) => mensagem.ruleId !== null),
  };
}

function importacao(origem: string): string {
  return `import '${origem}';`;
}

const RESPOSTAS_PELO_APOIO = `import { okResult } from '${APOIO_DE_TESTE}';\nokResult(1);`;

const ARQUIVOS_DE_PRODUCAO_COM_REGRAS_REDEFINIDAS: ArquivoDeProducao[] = [
  { projeto: 'apps/configuracao', arquivo: 'src/app/features/x/prova.page.ts' },
  { projeto: 'apps/selecao', arquivo: 'src/app/features/x/prova.page.ts' },
  { projeto: 'libs/shared-inscricao', arquivo: 'src/lib/x/prova.ts' },
];

const REFERENCIAS_A_ARQUIVO_DE_TESTE = [
  "import { a } from './prova.testing';",
  "export * from './prova.testing';",
  "export { a } from '../x/prova.spec';",
  "import('./prova.testing');",
  "import '../test-setup';",
  "import './prova.testing.js';",
  "const a = require('./prova.testing');",
  "import a = require('./prova.testing');",
];

const IMPORTS_COM_REQUIRE = [
  "import apoio = require('@uniplus/shared-testing');",
  "import v = require('vitest');",
  "import a = require('./qualquer');",
];

describe('fronteira do apoio de teste unitário', () => {
  beforeAll(async () => {
    await createProjectGraphAsync();
  });

  describe('recusa o apoio de teste e o Vitest', () => {
    it.each([
      ['app', 'apps/portal', 'src/app/features/x/prova.ts', importacao(APOIO_DE_TESTE)],
      [
        'app que redefine as restrições de import',
        'apps/configuracao',
        'src/app/features/x/prova.page.ts',
        importacao(APOIO_DE_TESTE),
      ],
      ['lib', 'libs/shared-ui', 'src/lib/x/prova.ts', importacao(APOIO_DE_TESTE)],
      ['lib, para o Vitest', 'libs/shared-ui', 'src/lib/x/prova.ts', importacao('vitest')],
      [
        'spec do shared-core, que o apoio de teste usa',
        'libs/shared-core',
        'src/lib/x/prova.spec.ts',
        importacao(APOIO_DE_TESTE),
      ],
      [
        'apoio de teste que importa lib diferente do shared-core',
        'libs/shared-testing',
        'src/lib/x/prova.testing.ts',
        importacao('@uniplus/shared-ui'),
      ],
      [
        'apoio importa shared-data inteiro',
        'libs/shared-testing',
        'src/lib/x/prova.testing.ts',
        importacao('@uniplus/shared-data'),
      ],
      [
        'app importa e2e',
        'apps/portal',
        'src/app/features/x/prova.ts',
        importacao('@uniplus/shared-e2e'),
      ],
      [
        'app importa conferência e2e',
        'apps/portal',
        'src/app/features/x/prova.ts',
        importacao('@uniplus/shared-e2e/conferencia-do-contrato'),
      ],
      [
        'app importa documento',
        'apps/portal',
        'src/app/features/x/prova.ts',
        importacao('@uniplus/shared-data/openapi/portal.openapi.json'),
      ],
      [
        'shared-data de produção importa documento',
        'libs/shared-data',
        'src/lib/x/prova.ts',
        importacao('@uniplus/shared-data/openapi/selecao.openapi.json'),
      ],
      [
        'app, por caminho relativo',
        'apps/portal',
        'src/app/features/x/prova.ts',
        importacao(APOIO_POR_CAMINHO_RELATIVO),
      ],
    ])('em %s', async (_caso, projeto, arquivo, codigo) => {
      const { regras } = await analisar(projeto, arquivo, codigo);

      expect(regras).toContain(REGRA_DE_FRONTEIRA);
    });
  });

  describe('recusa referência a arquivo de teste em arquivo de produção', () => {
    const casos = ARQUIVOS_DE_PRODUCAO_COM_REGRAS_REDEFINIDAS.flatMap((producao) =>
      REFERENCIAS_A_ARQUIVO_DE_TESTE.map((codigo) => ({ ...producao, codigo })),
    );

    it.each(casos)('$projeto: $codigo', async ({ projeto, arquivo, codigo }) => {
      const { regras } = await analisar(projeto, arquivo, codigo);

      expect(regras).toContain(REGRA_DO_ARQUIVO_DE_TESTE);
    });
  });

  describe('recusa import com require em arquivo de produção', () => {
    const casos = ARQUIVOS_DE_PRODUCAO_COM_REGRAS_REDEFINIDAS.flatMap((producao) =>
      IMPORTS_COM_REQUIRE.map((codigo) => ({ ...producao, codigo })),
    );

    it.each(casos)('$projeto: $codigo', async ({ projeto, arquivo, codigo }) => {
      const { regras } = await analisar(projeto, arquivo, codigo);

      expect(regras).toContain(REGRA_DO_ARQUIVO_DE_TESTE);
    });
  });

  describe('recusa ponto de entrada de teste em arquivo de produção', () => {
    it.each([
      ['apoio das respostas da API', importacao('@uniplus/shared-core/http/testing')],
      ['teste do Angular', importacao('@angular/core/testing')],
    ])('%s', async (_caso, codigo) => {
      const { regras } = await analisar('apps/portal', 'src/app/features/x/prova.ts', codigo);

      expect(regras).toContain(REGRA_DO_ARQUIVO_DE_TESTE);
    });
  });

  it('recusa reexportação da conferência no índice e2e', async () => {
    const { regras } = await analisar(
      'libs/shared-e2e',
      'src/index.ts',
      "export * from './lib/conferencia-do-contrato.testing';",
    );
    expect(regras).toContain(REGRA_DO_ARQUIVO_DE_TESTE);
  });

  describe('aceita o que a fronteira permite', () => {
    const PRODUCAO = 'src/app/features/x/prova.ts';
    const SPEC = 'src/app/features/x/prova.spec.ts';

    it.each([
      [
        'apoio importa documento',
        'libs/shared-testing',
        'src/lib/x/prova.testing.ts',
        "import('@uniplus/shared-data/openapi/portal.openapi.json');",
      ],
      [
        'spec do shared-data importa documento',
        'libs/shared-data',
        'src/lib/x/prova.spec.ts',
        importacao('@uniplus/shared-data/openapi/selecao.openapi.json'),
      ],
      [
        'arquivo .testing do app importa documento',
        'apps/selecao',
        'src/app/features/x/prova.testing.ts',
        importacao('@uniplus/shared-data/openapi/selecao.openapi.json'),
      ],
      [
        'e2e importa conferência',
        'apps/selecao-e2e',
        'src/prova.spec.ts',
        importacao('@uniplus/shared-e2e/conferencia-do-contrato'),
      ],
      [
        'shared-data importa apoio',
        'libs/shared-data',
        'src/lib/prova.spec.ts',
        importacao(APOIO_DE_TESTE),
      ],
      ['spec importa o apoio de teste', 'apps/portal', SPEC, importacao(APOIO_DE_TESTE)],
      ['spec importa as respostas da API pelo apoio', 'apps/selecao', SPEC, RESPOSTAS_PELO_APOIO],
      ['spec usa import com require', 'apps/portal', SPEC, "import v = require('vitest');"],
      ['spec importa o Vitest', 'apps/portal', SPEC, importacao('vitest')],
      ['spec importa o arquivo .testing', 'apps/portal', SPEC, importacao('./prova.testing')],
      [
        'arquivo .testing importa o apoio de teste',
        'apps/portal',
        'src/app/features/x/prova.testing.ts',
        importacao(APOIO_DE_TESTE),
      ],
      [
        'produção importa outro de produção',
        'apps/portal',
        PRODUCAO,
        importacao('./prova.service'),
      ],
      [
        'produção importa módulo que só parece de teste',
        'apps/portal',
        PRODUCAO,
        importacao('./testing-library'),
      ],
      [
        'produção importa módulo cujo nome só termina como setup',
        'apps/portal',
        PRODUCAO,
        importacao('./contest-setup'),
      ],
    ])('%s', async (_caso, projeto, arquivo, codigo) => {
      const analise = await analisar(projeto, arquivo, codigo);

      expect(analise.analiseSemFalha).toBe(true);
      expect(analise.regras).not.toContain(REGRA_DE_FRONTEIRA);
      expect(analise.regras).not.toContain(REGRA_DO_ARQUIVO_DE_TESTE);
    });
  });
});
