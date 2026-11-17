import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readJson, workspaceRoot } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { ESLint } from 'eslint';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import featureLibGenerator, { SCOPES_VALIDOS } from './generator';
import type { FeatureLibType } from './schema';

const SEVERIDADE_ERRO = 2;
const SEVERIDADE_DESLIGADA = 0;

const LIMITE_DE_LINHAS_POR_ARQUIVO = { max: 400, skipBlankLines: false, skipComments: false };
const LIMITE_DE_LINHAS_POR_FUNCAO = { max: 15, skipBlankLines: false, skipComments: false };

const METRICAS_EXCETO_LIMITE_POR_FUNCAO = {
  'max-lines': [SEVERIDADE_ERRO, LIMITE_DE_LINHAS_POR_ARQUIVO],
  complexity: [SEVERIDADE_ERRO, 10],
  'max-params': [SEVERIDADE_ERRO, 4],
  'sonarjs/cognitive-complexity': [SEVERIDADE_ERRO, 15],
};

const METRICAS_DE_QUALIDADE: Record<string, unknown> = {
  ...METRICAS_EXCETO_LIMITE_POR_FUNCAO,
  'max-lines-per-function': [SEVERIDADE_ERRO, LIMITE_DE_LINHAS_POR_FUNCAO],
};

interface LibGerada {
  tags: string[];
  configuracaoDeLint: string;
}

interface DepConstraint {
  sourceTag: string;
}

const TIPOS_DO_SCHEMA: FeatureLibType[] = JSON.parse(
  readFileSync(join(__dirname, 'schema.json'), 'utf-8'),
).properties.type.enum;

const COMBINACOES_DE_SCOPE_E_TIPO = SCOPES_VALIDOS.flatMap((scope) =>
  TIPOS_DO_SCHEMA.map((type): [string, FeatureLibType] => [scope, type]),
);

async function gerarLib(scope: string, type: FeatureLibType): Promise<LibGerada> {
  const tree = createTreeWithEmptyWorkspace();
  await featureLibGenerator(tree, { name: `${scope}/foo`, type });
  return {
    tags: readJson(tree, `libs/${scope}/foo/project.json`).tags,
    configuracaoDeLint: tree.read(`libs/${scope}/foo/eslint.config.mjs`, 'utf-8') ?? '',
  };
}

function montarWorkspaceTemporario(raiz: string): void {
  symlinkSync(join(workspaceRoot, 'node_modules'), join(raiz, 'node_modules'));
  symlinkSync(join(workspaceRoot, 'eslint.config.mjs'), join(raiz, 'eslint.config.mjs'));
}

function instalarLibNoWorkspace(raiz: string, scope: string, configuracaoDaLib: string): string {
  const diretorioDaLib = join(raiz, 'libs', scope, 'foo');
  mkdirSync(diretorioDaLib, { recursive: true });
  writeFileSync(join(diretorioDaLib, 'eslint.config.mjs'), configuracaoDaLib);
  return diretorioDaLib;
}

async function configuracaoEfetivaDe(diretorioDaLib: string, arquivo: string) {
  return new ESLint({ cwd: diretorioDaLib }).calculateConfigForFile(arquivo);
}

async function regrasEfetivasDe(
  diretorioDaLib: string,
  arquivo: string,
): Promise<Record<string, unknown>> {
  const configuracao = await configuracaoEfetivaDe(diretorioDaLib, arquivo);
  return configuracao.rules ?? {};
}

function tagsComRestricaoDeDependencia(regras: Record<string, unknown>): string[] {
  const configuracaoDaRegra = regras['@nx/enforce-module-boundaries'] as [
    unknown,
    { depConstraints: DepConstraint[] },
  ];
  return configuracaoDaRegra[1].depConstraints.map((restricao) => restricao.sourceTag);
}

function severidadeDe(configuracaoDaRegra: unknown): unknown {
  return Array.isArray(configuracaoDaRegra) ? configuracaoDaRegra[0] : configuracaoDaRegra;
}

describe('lint da lib gerada', () => {
  let raizTemporaria: string;
  let diretorioDaLibSelecao: string;

  function regrasDe(arquivo: string): Promise<Record<string, unknown>> {
    return regrasEfetivasDe(diretorioDaLibSelecao, arquivo);
  }

  beforeAll(async () => {
    raizTemporaria = mkdtempSync(join(tmpdir(), 'uniplus-feature-lib-'));
    montarWorkspaceTemporario(raizTemporaria);
    const { configuracaoDeLint } = await gerarLib('selecao', 'feature');
    diretorioDaLibSelecao = instalarLibNoWorkspace(raizTemporaria, 'selecao', configuracaoDeLint);
  });

  afterAll(() => {
    rmSync(raizTemporaria, { recursive: true, force: true });
  });

  it.each(Object.keys(METRICAS_DE_QUALIDADE))(
    'barra no CI a regra %s no código da lib gerada',
    async (regra) => {
      const regras = await regrasDe('src/lib/foo.ts');

      expect(regras).toMatchObject({ [regra]: METRICAS_DE_QUALIDADE[regra] });
    },
  );

  it.each(['src/lib/foo.spec.ts', 'src/lib/foo.setup.ts'])(
    'desliga só o limite por função em %s da lib gerada',
    async (arquivo) => {
      const regras = await regrasDe(arquivo);

      expect(regras).toMatchObject(METRICAS_EXCETO_LIMITE_POR_FUNCAO);
      expect(severidadeDe(regras['max-lines-per-function'])).toBe(SEVERIDADE_DESLIGADA);
    },
  );

  it('não deixa comentário eslint-disable silenciar regra na lib gerada', async () => {
    const configuracao = await configuracaoEfetivaDe(diretorioDaLibSelecao, 'src/lib/foo.ts');

    expect(configuracao.linterOptions).toMatchObject({ noInlineConfig: true });
  });

  it('barra no CI o tamanho dos templates da lib gerada', async () => {
    const regras = await regrasDe('src/lib/foo.component.html');

    expect(regras).toMatchObject({
      'max-lines': [SEVERIDADE_ERRO, LIMITE_DE_LINHAS_POR_ARQUIVO],
    });
  });

  it.each(COMBINACOES_DE_SCOPE_E_TIPO)(
    'toda tag que a lib gerada recebe tem restrição de dependência no lint (%s, %s)',
    async (scope, type) => {
      const { tags, configuracaoDeLint } = await gerarLib(scope, type);
      const diretorioDaLib = instalarLibNoWorkspace(raizTemporaria, scope, configuracaoDeLint);

      const regras = await regrasEfetivasDe(diretorioDaLib, 'src/lib/foo.ts');

      expect(tagsComRestricaoDeDependencia(regras)).toEqual(expect.arrayContaining(tags));
    },
  );
});
