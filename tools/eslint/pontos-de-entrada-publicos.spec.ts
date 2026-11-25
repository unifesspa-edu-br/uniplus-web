import { createProjectGraphAsync } from '@nx/devkit';
import { beforeAll, describe, expect, it } from 'vitest';
import { analisar, importacao } from './analise-do-lint.testing';
import { pontosDeEntradaPublicos } from './pontos-de-entrada-publicos.mjs';

const REGRA = 'fronteira-das-bibliotecas/ponto-de-entrada-publico';
const PORTAL = 'apps/portal';
const PRODUCAO = 'src/app/prova.ts';
const SPEC = 'src/app/prova.spec.ts';
const TESTING = 'src/lib/prova.testing.ts';
const CONTRATO = '@uniplus/shared-data/openapi/exemplos/selecao/documento.json';

beforeAll(async () => {
  await createProjectGraphAsync();
});

describe('pontos de entrada públicos', () => {
  const raizes = ['shared-ui', 'shared-auth', 'shared-core', 'shared-data', 'shared-inscricao'];
  const recusados = [
    ...raizes.map((nome) => [nome, PORTAL, PRODUCAO, importacao(`@uniplus/${nome}`)]),
    ['tipo', PORTAL, SPEC, "import type { X } from '@uniplus/shared-data';"],
    ['exportação total', PORTAL, PRODUCAO, "export * from '@uniplus/shared-data';"],
    ['exportação nomeada', PORTAL, PRODUCAO, "export {} from '@uniplus/shared-data';"],
    ['importação dinâmica', PORTAL, PRODUCAO, "import('@uniplus/shared-data');"],
    ['require', PORTAL, PRODUCAO, "require('@uniplus/shared-data');"],
    ['caminho interno', PORTAL, PRODUCAO, importacao('@uniplus/shared-data/src/lib/x')],
    [
      'caminho após ponto público',
      PORTAL,
      PRODUCAO,
      importacao('@uniplus/shared-ui/components/src/index'),
    ],
    ['nome parecido', PORTAL, PRODUCAO, importacao('@uniplus/shared-ui/componentsx')],
    ...['testing', 'interceptor-testing'].flatMap((nome) => [
      [`${nome} no spec`, PORTAL, SPEC, importacao(`@uniplus/shared-core/http/${nome}`)],
      [
        `${nome} na produção`,
        'libs/shared-auth',
        'src/lib/prova.ts',
        importacao(`@uniplus/shared-core/http/${nome}`),
      ],
    ]),
    ['segmento ponto', PORTAL, SPEC, importacao('@uniplus/shared-data/./tokens')],
    ['ponto no contrato', PORTAL, SPEC, importacao('@uniplus/shared-data/openapi/../src/lib/x')],
    [
      'ponto no apoio',
      'libs/shared-testing',
      TESTING,
      importacao('@uniplus/shared-data/openapi/../src/lib/x'),
    ],
    [
      'lib de domínio',
      'libs/shared-inscricao',
      'src/lib/prova.ts',
      importacao('@uniplus/shared-ui'),
    ],
    ['e2e', 'apps/selecao-e2e', 'src/prova.spec.ts', importacao('@uniplus/shared-data')],
    [
      'página de seleção',
      'apps/selecao',
      'src/app/features/assistente/prova.page.ts',
      importacao('@uniplus/shared-data'),
    ],
    [
      'página de configuração',
      'apps/configuracao',
      'src/app/features/x/prova.page.ts',
      importacao('@uniplus/shared-data'),
    ],
    ['raiz no apoio', 'libs/shared-testing', TESTING, importacao('@uniplus/shared-core')],
  ];

  it.each(recusados)('recusa %s', async (_caso, projeto, arquivo, codigo) => {
    const resultado = await analisar(projeto, arquivo, codigo);
    expect(resultado.analiseSemFalha).toBe(true);
    expect(resultado.regras).toContain(REGRA);
  });

  const aceitos = [
    ...pontosDeEntradaPublicos.map((ponto: string) => [ponto, PORTAL, SPEC, importacao(ponto)]),
    [
      'próprio auth',
      'libs/shared-auth',
      'src/lib/prova.ts',
      importacao('@uniplus/shared-auth/bootstrap'),
    ],
    [
      'próprio data',
      'libs/shared-data',
      'src/lib/prova.ts',
      importacao('@uniplus/shared-data/tokens'),
    ],
    ['documento no app', PORTAL, 'src/app/prova.testing.ts', importacao(CONTRATO)],
    ['documento no apoio', 'libs/shared-testing', TESTING, `import('${CONTRATO}');`],
    ...['testing', 'interceptor-testing'].map((nome) => [
      nome,
      'libs/shared-testing',
      TESTING,
      importacao(`@uniplus/shared-core/http/${nome}`),
    ]),
    ...[
      '@uniplus/shared-utils',
      '@uniplus/shared-testing',
      '@uniplus/shared-e2e',
      './prova.service',
      '@angular/core',
    ].map((nome) => [nome, PORTAL, SPEC, importacao(nome)]),
  ];

  it.each(aceitos)('aceita %s', async (_caso, projeto, arquivo, codigo) => {
    const resultado = await analisar(projeto, arquivo, codigo);
    expect(resultado.analiseSemFalha).toBe(true);
    expect(resultado.regras).not.toContain(REGRA);
  });
});
