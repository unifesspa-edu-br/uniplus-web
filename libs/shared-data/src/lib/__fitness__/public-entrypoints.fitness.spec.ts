import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Fitness dos contratos publicos granulares das libs Angular.
 *
 * O PR #378 precisou trocar root barrels por subpaths para preservar bundle.
 * Este gate garante que os subpaths usados por apps sao secondary entrypoints
 * reais de ng-packagr, nao aliases wildcard para `src/lib/*`.
 */

const WORKSPACE_ROOT = path.resolve(__dirname, '../../../../..');
const APP_ROOTS = ['apps/selecao/src', 'apps/ingresso/src', 'apps/portal/src'] as const;

const ENTRYPOINTS = {
  '@uniplus/shared-ui/components': 'libs/shared-ui/components',
  '@uniplus/shared-ui/notifications': 'libs/shared-ui/notifications',
  '@uniplus/shared-ui/shell': 'libs/shared-ui/shell',
  '@uniplus/shared-auth/bootstrap': 'libs/shared-auth/bootstrap',
  '@uniplus/shared-auth/components': 'libs/shared-auth/components',
  '@uniplus/shared-auth/guards': 'libs/shared-auth/guards',
  '@uniplus/shared-auth/interceptors': 'libs/shared-auth/interceptors',
  '@uniplus/shared-data/config': 'libs/shared-data/config',
  '@uniplus/shared-data/ingresso': 'libs/shared-data/ingresso',
  '@uniplus/shared-data/selecao': 'libs/shared-data/selecao',
  '@uniplus/shared-core/dom': 'libs/shared-core/dom',
  '@uniplus/shared-core/http': 'libs/shared-core/http',
  '@uniplus/shared-core/interceptors': 'libs/shared-core/interceptors',
  '@uniplus/shared-core/notifications': 'libs/shared-core/notifications',
} as const;

const ROOT_BARRELS = new Set([
  '@uniplus/shared-ui',
  '@uniplus/shared-auth',
  '@uniplus/shared-data',
  '@uniplus/shared-core',
]);

function listarTsFiles(root: string): string[] {
  const arquivos: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      arquivos.push(...listarTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      arquivos.push(fullPath);
    }
  }
  return arquivos;
}

function removerComentarios(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function importsUniplusShared(source: string): string[] {
  const imports: string[] = [];
  const semComentarios = removerComentarios(source);
  const re = /from\s+['"](@uniplus\/shared-(?:ui|auth|data|core)(?:\/[^'"]+)?)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(semComentarios)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

describe('Fitness — public secondary entrypoints das apps', () => {
  it('todo entrypoint permitido e um secondary entrypoint ng-packagr real', () => {
    const ausentes: string[] = [];

    for (const [specifier, relativeRoot] of Object.entries(ENTRYPOINTS)) {
      const ngPackage = path.join(WORKSPACE_ROOT, relativeRoot, 'ng-package.json');
      const index = path.join(WORKSPACE_ROOT, relativeRoot, 'src/index.ts');
      if (!fs.existsSync(ngPackage) || !fs.existsSync(index)) {
        ausentes.push(`${specifier} -> ${relativeRoot}`);
      }
    }

    expect(
      ausentes,
      ausentes.length > 0
        ? `\nEntrypoints permitidos sem ng-package.json ou src/index.ts:\n${ausentes.join('\n')}`
        : '',
    ).toEqual([]);
  });

  it('apps importam somente entrypoints publicos granulares das libs shared-*', () => {
    const permitidos = new Set(Object.keys(ENTRYPOINTS));
    const violacoes: string[] = [];

    for (const appRoot of APP_ROOTS) {
      const absoluto = path.join(WORKSPACE_ROOT, appRoot);
      for (const filePath of listarTsFiles(absoluto)) {
        const source = fs.readFileSync(filePath, 'utf-8');
        const relativo = path.relative(WORKSPACE_ROOT, filePath);

        for (const specifier of importsUniplusShared(source)) {
          if (ROOT_BARRELS.has(specifier)) {
            violacoes.push(`${relativo}: usa root barrel ${specifier}`);
            continue;
          }

          if (!permitidos.has(specifier)) {
            violacoes.push(`${relativo}: usa subpath nao publico ${specifier}`);
          }
        }
      }
    }

    expect(
      violacoes,
      violacoes.length > 0
        ? `\nImports shared-* fora dos secondary entrypoints publicos:\n${violacoes.join('\n')}`
        : '',
    ).toEqual([]);
  });

  it('tsconfig.base.json nao expoe wildcard shared-* para src/lib/*', () => {
    const tsconfig = JSON.parse(
      fs.readFileSync(path.join(WORKSPACE_ROOT, 'tsconfig.base.json'), 'utf-8'),
    ) as { compilerOptions?: { paths?: Record<string, string[]> } };
    const paths = tsconfig.compilerOptions?.paths ?? {};
    const wildcards = Object.entries(paths)
      .filter(([alias]) => /^@uniplus\/shared-(ui|auth|data|core)\/\*$/.test(alias))
      .map(([alias, values]) => `${alias} -> ${values.join(', ')}`);

    expect(
      wildcards,
      wildcards.length > 0
        ? `\nAliases wildcard shared-* removidos sao proibidos:\n${wildcards.join('\n')}`
        : '',
    ).toEqual([]);
  });
});
