import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  names,
  Tree,
  updateJson,
} from '@nx/devkit';
import * as path from 'node:path';
import type { FeatureLibSchema } from './schema';

const SCOPES_VALIDOS = ['selecao', 'ingresso', 'portal'] as const;
type Scope = (typeof SCOPES_VALIDOS)[number];

interface NormalizedOptions {
  scope: Scope;
  name: string;
  type: FeatureLibSchema['type'];
  projectRoot: string;
  projectName: string;
  importPath: string;
  prefix: string;
}

function normalizarOpcoes(options: FeatureLibSchema): NormalizedOptions {
  const partes = options.name.split('/');
  if (partes.length !== 2) {
    throw new Error(
      `Nome inválido "${options.name}". Use o formato <scope>/<name> (ex: selecao/feature-editais-detail).`,
    );
  }
  const [scope, rawName] = partes;
  if (!SCOPES_VALIDOS.includes(scope as Scope)) {
    throw new Error(
      `Scope inválido "${scope}". Scopes válidos: ${SCOPES_VALIDOS.join(', ')}.`,
    );
  }
  const nomeNormalizado = names(rawName).fileName;
  if (!/^[a-z][-a-z0-9]*$/.test(nomeNormalizado)) {
    throw new Error(
      `Nome de lib inválido "${rawName}". Use kebab-case ASCII começando por letra (ex: feature-editais-detail).`,
    );
  }
  return {
    scope: scope as Scope,
    name: nomeNormalizado,
    type: options.type,
    projectRoot: joinPathFragments('libs', scope, nomeNormalizado),
    projectName: nomeNormalizado,
    importPath: `@uniplus/${scope}-${nomeNormalizado}`,
    prefix: scope,
  };
}

function registrarPathMapping(tree: Tree, opts: NormalizedOptions): void {
  updateJson(tree, 'tsconfig.base.json', (json) => {
    json.compilerOptions = json.compilerOptions ?? {};
    json.compilerOptions.paths = json.compilerOptions.paths ?? {};
    if (json.compilerOptions.paths[opts.importPath]) {
      throw new Error(
        `Path "${opts.importPath}" já registrado em tsconfig.base.json. Provavelmente a lib já existe ou o nome conflita.`,
      );
    }
    json.compilerOptions.paths[opts.importPath] = [
      `${opts.projectRoot}/src/index.ts`,
    ];
    return json;
  });
}

export default async function featureLibGenerator(
  tree: Tree,
  options: FeatureLibSchema,
): Promise<void> {
  const opts = normalizarOpcoes(options);

  if (tree.exists(opts.projectRoot)) {
    throw new Error(
      `Diretório ${opts.projectRoot} já existe. Escolha outro nome ou apague antes de gerar.`,
    );
  }

  generateFiles(
    tree,
    path.join(__dirname, 'files'),
    opts.projectRoot,
    {
      ...opts,
      tmpl: '',
      // EJS helpers para os templates
      tags: JSON.stringify([`scope:${opts.scope}`, `type:${opts.type}`]),
    },
  );

  registrarPathMapping(tree, opts);

  await formatFiles(tree);
}
