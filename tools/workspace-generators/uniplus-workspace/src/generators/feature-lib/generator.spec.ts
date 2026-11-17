import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readJson, Tree, writeJson } from '@nx/devkit';
import { beforeEach, describe, expect, it } from 'vitest';
import featureLibGenerator, { SCOPES_VALIDOS } from './generator';
import type { FeatureLibType } from './schema';

const FORMATO_INVALIDO = (nome: string): string =>
  `Nome inválido "${nome}". Use o formato <scope>/<name> (ex: selecao/feature-editais-detail).`;

const SCOPE_INVALIDO = (scope: string): string =>
  `Scope inválido "${scope}". Scopes válidos: selecao, ingresso, portal, configuracao.`;

const NOME_DE_LIB_INVALIDO = (nome: string): string =>
  `Nome de lib inválido "${nome}". Use kebab-case ASCII começando por letra (ex: feature-editais-detail).`;

const DIRETORIO_OCUPADO = (diretorio: string): string =>
  `Diretório ${diretorio} já existe. Escolha outro nome ou apague antes de gerar.`;

const PATH_JA_REGISTRADO = (importPath: string): string =>
  `Path "${importPath}" já registrado em tsconfig.base.json. Provavelmente a lib já existe ou o nome conflita.`;

const ARQUIVOS_DA_LIB = [
  'eslint.config.mjs',
  'ng-package.json',
  'package.json',
  'project.json',
  'src/index.ts',
  'src/lib/foo.spec.ts',
  'src/lib/foo.ts',
  'src/lib/index.ts',
  'src/test-setup.ts',
  'tsconfig.json',
  'tsconfig.lib.json',
  'tsconfig.lib.prod.json',
  'tsconfig.spec.json',
  'vite.config.mts',
];

async function gerar(tree: Tree, name: string, type: FeatureLibType = 'feature'): Promise<void> {
  await featureLibGenerator(tree, { name, type });
}

function paths(tree: Tree): Record<string, string[]> {
  return readJson(tree, 'tsconfig.base.json').compilerOptions.paths;
}

function listarArquivos(tree: Tree, diretorio: string, prefixo = ''): string[] {
  return tree.children(diretorio).flatMap((filho) => {
    const caminho = `${diretorio}/${filho}`;
    return tree.isFile(caminho)
      ? [`${prefixo}${filho}`]
      : listarArquivos(tree, caminho, `${prefixo}${filho}/`);
  });
}

describe('featureLibGenerator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('formato do nome', () => {
    it('recusa nome sem barra e não cria nada em libs/', async () => {
      await expect(gerar(tree, 'foo')).rejects.toHaveProperty('message', FORMATO_INVALIDO('foo'));

      expect(tree.exists('libs')).toBe(false);
    });

    it('recusa nome com duas barras', async () => {
      await expect(gerar(tree, 'selecao/foo/bar')).rejects.toHaveProperty(
        'message',
        FORMATO_INVALIDO('selecao/foo/bar'),
      );
    });
  });

  describe('scope', () => {
    it.each(['shared/x', 'admin/x'])('recusa scope fora do conjunto em %s', async (nome) => {
      const scope = nome.split('/')[0];

      await expect(gerar(tree, nome)).rejects.toHaveProperty('message', SCOPE_INVALIDO(scope));
    });

    it('aceita o scope configuracao e o tagueia no eixo de scope', async () => {
      await gerar(tree, 'configuracao/foo');

      expect(readJson(tree, 'libs/configuracao/foo/project.json').tags).toEqual([
        'scope:configuracao',
        'type:feature',
      ]);
    });

    it('recusa scope com maiúscula', async () => {
      await expect(gerar(tree, 'Selecao/foo')).rejects.toHaveProperty(
        'message',
        SCOPE_INVALIDO('Selecao'),
      );
    });

    it('verifica o scope antes do nome da lib', async () => {
      await expect(gerar(tree, 'shared/1x')).rejects.toHaveProperty(
        'message',
        SCOPE_INVALIDO('shared'),
      );
    });
  });

  describe('nome da lib', () => {
    it('aceita hífen e dígito depois da primeira letra', async () => {
      await gerar(tree, 'selecao/feature-editais-2');

      expect(paths(tree)['@uniplus/selecao-feature-editais-2']).toEqual([
        'libs/selecao/feature-editais-2/src/index.ts',
      ]);
    });

    it('recusa nome que começa por dígito', async () => {
      await expect(gerar(tree, 'selecao/1x')).rejects.toHaveProperty(
        'message',
        NOME_DE_LIB_INVALIDO('1x'),
      );
    });

    it('recusa nome não ASCII citando o nome informado', async () => {
      await expect(gerar(tree, 'selecao/inscrição')).rejects.toHaveProperty(
        'message',
        NOME_DE_LIB_INVALIDO('inscrição'),
      );
    });

    it('recusa nome vazio', async () => {
      await expect(gerar(tree, 'selecao/')).rejects.toHaveProperty(
        'message',
        NOME_DE_LIB_INVALIDO(''),
      );
    });

    it.each([
      'FeatureEditaisDetail',
      'feature_editais_detail',
      'foo-',
      'foo--bar',
      'foo\n',
      'Foo',
      '1foo',
    ])('recusa nome fora de kebab-case em %j', async (nome) => {
      await expect(gerar(tree, `selecao/${nome}`)).rejects.toHaveProperty(
        'message',
        NOME_DE_LIB_INVALIDO(nome),
      );
    });
  });

  describe('diretório e path mapping', () => {
    it('recusa diretório já ocupado sem alterar o tsconfig.base.json', async () => {
      tree.write('libs/selecao/foo/ocupado.txt', 'x');
      const antes = readJson(tree, 'tsconfig.base.json');

      await expect(gerar(tree, 'selecao/foo')).rejects.toHaveProperty(
        'message',
        DIRETORIO_OCUPADO('libs/selecao/foo'),
      );

      expect(readJson(tree, 'tsconfig.base.json')).toEqual(antes);
    });

    it('verifica o diretório antes do path', async () => {
      tree.write('libs/selecao/foo/ocupado.txt', 'x');
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: { paths: { '@uniplus/selecao-foo': ['outro/lugar.ts'] } },
      });

      await expect(gerar(tree, 'selecao/foo')).rejects.toHaveProperty(
        'message',
        DIRETORIO_OCUPADO('libs/selecao/foo'),
      );
    });

    it('recusa path já registrado sem sobrescrever o valor', async () => {
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: { paths: { '@uniplus/selecao-foo': ['outro/lugar.ts'] } },
      });

      await expect(gerar(tree, 'selecao/foo')).rejects.toHaveProperty(
        'message',
        PATH_JA_REGISTRADO('@uniplus/selecao-foo'),
      );

      expect(paths(tree)['@uniplus/selecao-foo']).toEqual(['outro/lugar.ts']);
    });

    it('registra o path novo para o index da lib e mantém os existentes', async () => {
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: { paths: { '@uniplus/existente': ['libs/existente/src/index.ts'] } },
      });

      await gerar(tree, 'selecao/foo');

      expect(paths(tree)).toEqual({
        '@uniplus/existente': ['libs/existente/src/index.ts'],
        '@uniplus/selecao-foo': ['libs/selecao/foo/src/index.ts'],
      });
    });

    it('cria compilerOptions.paths quando o tsconfig.base.json não tem compilerOptions', async () => {
      writeJson(tree, 'tsconfig.base.json', {});

      await gerar(tree, 'selecao/foo');

      expect(paths(tree)).toEqual({
        '@uniplus/selecao-foo': ['libs/selecao/foo/src/index.ts'],
      });
    });

    it('gera projetos e paths distintos para o mesmo nome em scopes diferentes', async () => {
      await gerar(tree, 'selecao/foo');
      await gerar(tree, 'portal/foo');

      expect(readJson(tree, 'libs/selecao/foo/project.json').name).toBe('selecao-foo');
      expect(readJson(tree, 'libs/portal/foo/project.json').name).toBe('portal-foo');
      expect(Object.keys(paths(tree))).toEqual(
        expect.arrayContaining(['@uniplus/selecao-foo', '@uniplus/portal-foo']),
      );
    });
  });

  describe('arquivos gerados', () => {
    const combinacoes = SCOPES_VALIDOS.flatMap((scope) =>
      (['feature', 'data-access'] as const).map((type): [string, FeatureLibType] => [scope, type]),
    );

    it.each(combinacoes)('configura o project.json do scope %s e tipo %s', async (scope, type) => {
      await gerar(tree, `${scope}/foo`, type);

      const projeto = readJson(tree, `libs/${scope}/foo/project.json`);

      expect(projeto).toMatchObject({
        name: `${scope}-foo`,
        prefix: scope,
        sourceRoot: `libs/${scope}/foo/src`,
        tags: [`scope:${scope}`, `type:${type}`],
      });
    });

    it('gera os templates sem o sufixo __tmpl__ e com o nome da lib no arquivo', async () => {
      await gerar(tree, 'selecao/foo');

      expect(listarArquivos(tree, 'libs/selecao/foo').sort()).toEqual(ARQUIVOS_DA_LIB);
    });

    it('usa o importPath como name do package.json', async () => {
      await gerar(tree, 'selecao/foo');

      expect(readJson(tree, 'libs/selecao/foo/package.json').name).toBe('@uniplus/selecao-foo');
    });
  });
});
