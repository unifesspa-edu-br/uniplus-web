import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Fitness test do app `selecao`: pages container (`*.page.ts`) NÃO importam
 * `HttpClient` diretamente. HTTP é responsabilidade dos services em
 * `libs/shared-data` (ADR-0017 container/presentational; pages orquestram
 * services via `inject()`).
 *
 * Estratégia: glob + readFileSync + regex. Se uma futura page tentar
 * `inject(HttpClient)` ou `import { HttpClient } from '@angular/common/http'`,
 * o test falha — caller é direcionado a mover lógica para um service em
 * `shared-data` que retorne `Observable<ApiResult<T>>`.
 */

const FEATURES_ROOT = path.resolve(__dirname, '..');

function listarPages(root: string): string[] {
  const arquivos: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__fitness__') continue;
      arquivos.push(...listarPages(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.page.ts') && !entry.name.endsWith('.spec.ts')) {
      arquivos.push(fullPath);
    }
  }
  return arquivos;
}

const pageFiles = listarPages(FEATURES_ROOT);

describe('Fitness — pages container em apps/selecao/src/app/features/', () => {
  it('encontra ao menos 1 *.page.ts (sanity check)', () => {
    expect(pageFiles.length).toBeGreaterThan(0);
  });

  describe.each(pageFiles)('%s', (filePath) => {
    const source = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(path.resolve(__dirname, '../../../../../..'), filePath);

    it('NÃO importa HttpClient de @angular/common/http (use service em @uniplus/shared-data)', () => {
      // Falha se o page tem import de HttpClient — pages devem orquestrar
      // services em shared-data via inject(EditaisApi) etc., não fazer HTTP
      // direto. ADR-0017 container/presentational + ADR-0011/0012.
      const importsHttpClient = /import\s+\{[^}]*\bHttpClient\b[^}]*\}\s+from\s+['"]@angular\/common\/http['"]/.test(source);
      expect(importsHttpClient).toBe(
        false,
        `\nArquivo: ${relativePath}\n` +
          `Pages container não devem importar HttpClient direto. Crie um service em libs/shared-data/src/lib/api/<modulo>/<recurso>.api.ts ` +
          `que retorne Observable<ApiResult<T>> e injete-o via inject(<MeuApi>) na page (ADR-0017).`,
      );
    });

    it('NÃO faz inject(HttpClient) (signal de HTTP direto na page)', () => {
      const injectsHttpClient = /inject\(\s*HttpClient\s*\)/.test(source);
      expect(injectsHttpClient).toBe(
        false,
        `\nArquivo: ${relativePath}\n` +
          `inject(HttpClient) na page é HTTP direto — extraia para um service em shared-data.`,
      );
    });
  });
});
