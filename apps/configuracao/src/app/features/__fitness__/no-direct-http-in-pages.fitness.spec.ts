import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_FEATURES_ROOT = path.resolve(__dirname, '..');

function listarTsFiles(root: string): string[] {
  const arquivos: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__fitness__') continue;
      arquivos.push(...listarTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      arquivos.push(fullPath);
    }
  }
  return arquivos;
}

function removerComentarios(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('Fitness — Configuração pages não usam HttpClient direto', () => {
  it('features consomem APIs via @uniplus/shared-data/*', () => {
    const violacoes: string[] = [];

    for (const filePath of listarTsFiles(APP_FEATURES_ROOT)) {
      const source = removerComentarios(fs.readFileSync(filePath, 'utf-8'));
      const relativo = path.relative(path.resolve(__dirname, '../../../../..'), filePath);

      if (/from\s+['"]@angular\/common\/http['"]/.test(source) && /\bHttpClient\b/.test(source)) {
        violacoes.push(`${relativo}: importa HttpClient diretamente`);
      }

      if (/\binject\(\s*HttpClient\s*\)/.test(source)) {
        violacoes.push(`${relativo}: injeta HttpClient diretamente`);
      }
    }

    expect(
      violacoes,
      violacoes.length > 0
        ? `\nUse services de @uniplus/shared-data/* retornando ApiResult<T>:\n${violacoes.join('\n')}`
        : '',
    ).toEqual([]);
  });
});
