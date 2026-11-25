import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Garante que os aplicativos importem somente pontos de entrada públicos e
 * granulares das bibliotecas compartilhadas. Esses pontos são pacotes reais
 * do ng-packagr, não apelidos coringa para `src/lib/*`.
 */

const WORKSPACE_ROOT = path.resolve(__dirname, '../../../../..');
const APP_ROOTS = [
  'apps/selecao/src',
  'apps/ingresso/src',
  'apps/portal/src',
  'apps/configuracao/src',
] as const;

const ENTRYPOINTS = {
  '@uniplus/shared-ui/components': 'libs/shared-ui/components',
  '@uniplus/shared-ui/notifications': 'libs/shared-ui/notifications',
  '@uniplus/shared-ui/shell': 'libs/shared-ui/shell',
  '@uniplus/shared-auth/bootstrap': 'libs/shared-auth/bootstrap',
  '@uniplus/shared-auth/components': 'libs/shared-auth/components',
  '@uniplus/shared-ui/pipes': 'libs/shared-ui/pipes',
  '@uniplus/shared-auth/guards': 'libs/shared-auth/guards',
  '@uniplus/shared-auth/interceptors': 'libs/shared-auth/interceptors',
  '@uniplus/shared-data/autorizacao': 'libs/shared-data/autorizacao',
  '@uniplus/shared-data/config': 'libs/shared-data/config',
  '@uniplus/shared-data/configuracao': 'libs/shared-data/configuracao',
  '@uniplus/shared-data/geo': 'libs/shared-data/geo',
  '@uniplus/shared-data/ingresso': 'libs/shared-data/ingresso',
  '@uniplus/shared-data/organizacao': 'libs/shared-data/organizacao',
  '@uniplus/shared-data/portal': 'libs/shared-data/portal',
  '@uniplus/shared-data/publicacoes': 'libs/shared-data/publicacoes',
  '@uniplus/shared-data/selecao': 'libs/shared-data/selecao',
  '@uniplus/shared-data/utils': 'libs/shared-data/utils',
  '@uniplus/shared-core/dom': 'libs/shared-core/dom',
  '@uniplus/shared-core/http': 'libs/shared-core/http',
  '@uniplus/shared-core/idempotency': 'libs/shared-core/idempotency',
  '@uniplus/shared-core/interceptors': 'libs/shared-core/interceptors',
  '@uniplus/shared-core/notifications': 'libs/shared-core/notifications',
  '@uniplus/shared-core/relogio': 'libs/shared-core/relogio',
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

function importacaoDeContratoPermitida(importacao: string): boolean {
  return importacao.startsWith('@uniplus/shared-data/openapi/') && !importacao.includes('..');
}

function importacaoPermitida(importacao: string, permitidos: Set<string>): boolean {
  return permitidos.has(importacao) || importacaoDeContratoPermitida(importacao);
}

describe('Pontos de entrada públicos das bibliotecas compartilhadas', () => {
  it('permite somente apelidos válidos dos documentos do contrato', () => {
    const documento = '@uniplus/shared-data/openapi/exemplos/selecao/documento.json';

    expect(importacaoDeContratoPermitida(documento)).toBe(true);
    expect(importacaoDeContratoPermitida('@uniplus/shared-ui/openapi/documento.json')).toBe(false);
    expect(importacaoDeContratoPermitida('@uniplus/shared-data/openapi/../src/lib/x')).toBe(false);
  });

  it('todo ponto de entrada permitido é um pacote real do ng-packagr', () => {
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
        ? `\nPontos de entrada permitidos sem ng-package.json ou src/index.ts:\n${ausentes.join('\n')}`
        : '',
    ).toEqual([]);
  });

  it('aplicativos importam somente pontos de entrada públicos granulares das bibliotecas shared-*', () => {
    const permitidos = new Set(Object.keys(ENTRYPOINTS));
    const violacoes: string[] = [];

    for (const appRoot of APP_ROOTS) {
      const absoluto = path.join(WORKSPACE_ROOT, appRoot);
      for (const filePath of listarTsFiles(absoluto)) {
        const source = fs.readFileSync(filePath, 'utf-8');
        const relativo = path.relative(WORKSPACE_ROOT, filePath);

        for (const specifier of importsUniplusShared(source)) {
          if (ROOT_BARRELS.has(specifier)) {
            violacoes.push(`${relativo}: usa a raiz da biblioteca ${specifier}`);
            continue;
          }

          if (!importacaoPermitida(specifier, permitidos)) {
            violacoes.push(`${relativo}: usa ponto de entrada não público ${specifier}`);
          }
        }
      }
    }

    expect(
      violacoes,
      violacoes.length > 0
        ? `\nImportações shared-* fora dos pontos de entrada públicos:\n${violacoes.join('\n')}`
        : '',
    ).toEqual([]);
  });

  it('tsconfig.base.json não expõe apelido coringa shared-* para src/lib/*', () => {
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
        ? `\nApelidos coringa shared-* removidos são proibidos:\n${wildcards.join('\n')}`
        : '',
    ).toEqual([]);
  });
});
