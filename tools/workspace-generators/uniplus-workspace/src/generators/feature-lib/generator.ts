import { formatFiles, generateFiles, joinPathFragments, Tree, updateJson } from '@nx/devkit';
import * as path from 'node:path';
import type { FeatureLibSchema } from './schema';

export const SCOPES_VALIDOS = ['selecao', 'ingresso', 'portal', 'configuracao'] as const;
type Scope = (typeof SCOPES_VALIDOS)[number];

interface OpcoesValidadas {
  scope: Scope;
  name: string;
  type: FeatureLibSchema['type'];
}

/** Os campos em inglês são as variáveis que os templates de `files/` consomem. */
interface ConfiguracaoDaLib extends OpcoesValidadas {
  projectRoot: string;
  /**
   * Prefixado pelo scope (`<scope>-<name>`) para garantir unicidade no Nx graph quando dois
   * scopes diferentes geram libs com o mesmo `<name>` (ex: `selecao/foo` e `portal/foo`). Sem o
   * prefixo, ambos sairiam como project `foo` e o graph resolution quebraria. Manter alinhado
   * com `importPath` (`@uniplus/<scope>-<name>`).
   */
  projectName: string;
  importPath: string;
  prefix: string;
  tags: string[];
}

function separarScopeENome(nomeQualificado: string): [string, string] {
  const partes = nomeQualificado.split('/');
  if (partes.length !== 2) {
    throw new Error(
      `Nome inválido "${nomeQualificado}". Use o formato <scope>/<name> (ex: selecao/feature-editais-detail).`,
    );
  }
  const [scope, nome] = partes;
  return [scope, nome];
}

function exigirScopeValido(scope: string): Scope {
  const scopeValido = SCOPES_VALIDOS.find((valido) => valido === scope);
  if (!scopeValido) {
    throw new Error(`Scope inválido "${scope}". Scopes válidos: ${SCOPES_VALIDOS.join(', ')}.`);
  }
  return scopeValido;
}

function exigirNomeDaLibValido(nome: string): string {
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(nome)) {
    throw new Error(
      `Nome de lib inválido "${nome}". Use kebab-case ASCII começando por letra (ex: feature-editais-detail).`,
    );
  }
  return nome;
}

function validarOpcoes(options: FeatureLibSchema): OpcoesValidadas {
  const [scopeInformado, nomeInformado] = separarScopeENome(options.name);
  const scope = exigirScopeValido(scopeInformado);
  const name = exigirNomeDaLibValido(nomeInformado);
  return { scope, name, type: options.type };
}

function montarConfiguracaoDaLib(opcoes: OpcoesValidadas): ConfiguracaoDaLib {
  const { scope, name, type } = opcoes;
  return {
    ...opcoes,
    projectRoot: joinPathFragments('libs', scope, name),
    projectName: `${scope}-${name}`,
    importPath: `@uniplus/${scope}-${name}`,
    prefix: scope,
    tags: [`scope:${scope}`, `type:${type}`],
  };
}

function exigirDiretorioLivre(tree: Tree, projectRoot: string): void {
  if (tree.exists(projectRoot)) {
    throw new Error(
      `Diretório ${projectRoot} já existe. Escolha outro nome ou apague antes de gerar.`,
    );
  }
}

function gerarArquivosDaLib(tree: Tree, configuracao: ConfiguracaoDaLib): void {
  generateFiles(tree, path.join(__dirname, 'files'), configuracao.projectRoot, {
    ...configuracao,
    tmpl: '',
    tags: JSON.stringify(configuracao.tags),
  });
}

function registrarPathMapping(tree: Tree, { importPath, projectRoot }: ConfiguracaoDaLib): void {
  updateJson(tree, 'tsconfig.base.json', (json) => {
    json.compilerOptions ??= {};
    json.compilerOptions.paths ??= {};
    if (json.compilerOptions.paths[importPath]) {
      throw new Error(
        `Path "${importPath}" já registrado em tsconfig.base.json. Provavelmente a lib já existe ou o nome conflita.`,
      );
    }
    json.compilerOptions.paths[importPath] = [`${projectRoot}/src/index.ts`];
    return json;
  });
}

export default async function featureLibGenerator(
  tree: Tree,
  options: FeatureLibSchema,
): Promise<void> {
  const configuracao = montarConfiguracaoDaLib(validarOpcoes(options));
  exigirDiretorioLivre(tree, configuracao.projectRoot);
  gerarArquivosDaLib(tree, configuracao);
  registrarPathMapping(tree, configuracao);
  await formatFiles(tree);
}
