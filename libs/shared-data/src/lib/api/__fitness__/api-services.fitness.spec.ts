import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Fitness tests dos services HTTP do `shared-data`. Enforce padrões binding
 * estabelecidos no Frontend Milestone B (ADRs 0011/0012/0013/0014/0016):
 *
 * 1. Toda classe `@Injectable` em `*.api.ts` retorna `Observable<ApiResult<T>>`
 *    (nunca `Observable<T>` cru) — discriminated union ApiResult é o boundary
 *    canônico do consumer (ADR-0011/0012).
 * 2. Toda chamada HTTP em `*.api.ts` declara vendor MIME via
 *    `withVendorMime(...)` no `HttpContext` — versionamento per-resource
 *    (ADR-0028 backend, ADR-0016 cliente).
 *
 * Estratégia: glob + readFileSync + regex. Frágil-mas-suficiente: pega
 * regression cosmético (caller esquece pattern); não substitui code review
 * humano. Quando 5+ services existirem, considerar AST analysis via ts-morph.
 */

const API_GLOB_ROOT = path.resolve(__dirname, '..');

/**
 * Colapsa assinaturas multi-linha em linhas únicas. Algoritmo simples:
 * conta `(` e `)` linha-a-linha; quando uma linha tem mais aberturas que
 * fechamentos, agrupa as subsequentes até o saldo zerar. Cobre o caso de
 * `metodo(\n  arg1,\n  arg2,\n): ReturnType` que é a prática idiomática
 * para 2+ argumentos. Ignora parens dentro de strings ou comentários por
 * simplicidade — basta pra source TypeScript real (raros edge cases).
 */
function collapseMultilineParens(lines: readonly string[]): string[] {
  const resultado: string[] = [];
  let buffer = '';
  let parenSaldo = 0;

  for (const line of lines) {
    if (parenSaldo === 0) {
      buffer = line;
    } else {
      buffer += ' ' + line.trim();
    }

    for (const ch of line) {
      if (ch === '(') parenSaldo++;
      else if (ch === ')') parenSaldo--;
    }

    if (parenSaldo === 0) {
      resultado.push(buffer);
      buffer = '';
    }
  }

  // Linha aberta no final do arquivo (não deveria acontecer em source válido).
  if (buffer.length > 0) resultado.push(buffer);

  return resultado;
}

function listarApiFiles(root: string): string[] {
  const arquivos: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      // Skip the __fitness__ folder itself.
      if (entry.name === '__fitness__') continue;
      arquivos.push(...listarApiFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.api.ts') && !entry.name.endsWith('.spec.ts')) {
      arquivos.push(fullPath);
    }
  }
  return arquivos;
}

const apiFiles = listarApiFiles(API_GLOB_ROOT);

describe('Fitness — services HTTP em libs/shared-data/src/lib/api/', () => {
  it('encontra ao menos 1 arquivo *.api.ts (sanity check)', () => {
    expect(apiFiles.length).toBeGreaterThan(0);
  });

  describe.each(apiFiles)('%s', (filePath) => {
    const source = fs.readFileSync(filePath, 'utf-8');

    it('expõe classe @Injectable', () => {
      expect(source).toMatch(/@Injectable\(\{[^}]*providedIn:\s*'root'[^}]*\}\)/);
    });

    it('todo método público que retorna Observable também retorna ApiResult<T>', () => {
      // Normaliza assinaturas multi-linha colapsando-as numa única linha
      // antes da análise. Algoritmo: paren counter — quando uma linha abre
      // `(` sem fechar na mesma linha, junta linhas subsequentes até o paren
      // count zerar. Cobre `criar(\n  arg1,\n  arg2,\n): Observable<...>`
      // sem cair no problema do regex `[\s\S]*?` greedy-lazy que atravessa
      // múltiplos blocos.
      const lines = collapseMultilineParens(source.split('\n'));
      const violacoes: string[] = [];

      for (const line of lines) {
        // Linhas com `): Observable<` ou `): Promise<` em método public top-level.
        const isMethodSignature = /^\s{2}(?!private|protected|static|constructor)\w+[^(]*\([^)]*\):\s*(Observable|Promise)</.test(line);
        if (!isMethodSignature) continue;

        // Promise é proibido em service HTTP — toda chamada deve usar Observable
        // (HttpClient é Observable-first; Promise quebra interceptor pipeline).
        if (/\):\s*Promise</.test(line)) {
          violacoes.push(`Promise no retorno: ${line.trim()}`);
          continue;
        }

        // Para Observable: deve envelopar em ApiResult.
        if (!/Observable<\s*ApiResult\s*</.test(line)) {
          violacoes.push(`Observable cru sem ApiResult: ${line.trim()}`);
        }
      }

      expect(violacoes).toEqual([] as string[]);
    });

    it('importa withVendorMime de @uniplus/shared-core (versionamento per-resource ADR-0016/0028)', () => {
      expect(source).toMatch(/from\s+['"]@uniplus\/shared-core['"]/);
      expect(source).toMatch(/withVendorMime/);
    });

    it('chama withVendorMime em pelo menos 1 ponto do código (uso real, não só import)', () => {
      // Regex conta call sites — `withVendorMime(` em meio ao código (não só
      // na linha de import). Pelo menos 1 = pelo menos 1 endpoint declara
      // versão. Múltiplos seria preferível (cobre todos endpoints), mas
      // forcar isto requer AST analysis — por ora, sinal mínimo.
      const callSites = source.match(/withVendorMime\([^)]+\)/g) ?? [];
      expect(callSites.length).toBeGreaterThan(0);
    });
  });
});
