import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Confere a presença de withVendorMime nos GETs dos serviços de API.
 * A contagem por arquivo mantém as exceções previstas no contrato.
 */
const API_GLOB_ROOT = path.resolve(__dirname, '..');

function listarApiFiles(root: string): string[] {
  const arquivos: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      // Skip the __fitness__ folder itself.
      if (entry.name === '__fitness__') continue;
      arquivos.push(...listarApiFiles(fullPath));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.api.ts') &&
      !entry.name.endsWith('.spec.ts')
    ) {
      arquivos.push(fullPath);
    }
  }
  return arquivos;
}

const apiFiles = listarApiFiles(API_GLOB_ROOT);

/**
 * GETs que o contrato da API ainda serve só como JSON simples, sem vendor MIME: pedir um Accept
 * versionado que o servidor não produz resultaria em 406. A quantidade é fixa por arquivo; um GET
 * novo sem vendor MIME volta a falhar o teste.
 */
const GETS_SEM_VENDOR_MIME_NO_CONTRATO: Readonly<Record<string, number>> = {
  'versoes-do-perfil.api.ts': 2,
};

describe('Fitness — services HTTP em libs/shared-data/src/lib/api/', () => {
  it('encontra ao menos 1 arquivo *.api.ts (sanity check)', () => {
    expect(apiFiles.length).toBeGreaterThan(0);
  });

  describe.each(apiFiles)('%s', (filePath) => {
    const rawSource = fs.readFileSync(filePath, 'utf-8');

    // Strip comentários globalmente — todos os checks operam sobre código
    // executável, não JSDoc/inline. Evita falsos negativos onde exemplos
    // em comentários satisfazem regex de production code (problema
    // recorrente em fitness baseado em regex).
    const source = rawSource
      .replace(/\/\*[\s\S]*?\*\//g, '') // /* ... */ e /** ... */
      .replace(/\/\/.*$/gm, ''); // // linha

    it('toda chamada this.http.get(...) compõe withVendorMime no contexto (ADR-0016)', () => {
      // ADR-0016 cobre vendor MIME em GETs (Accept versionado). Mutações
      // (POST/PUT/PATCH) ficam fora porque usam versionamento por Content-Type
      // quando aplicável (ADR-0016 §"Esta ADR não decide" sobre POST/PUT).
      // Invariante: ≥1 call site de withVendorMime() por this.http.get<>.
      const getCalls = (source.match(/this\.http\.get</g) ?? []).length;
      const vendorMimeCalls = (source.match(/withVendorMime\([^)]+\)/g) ?? []).length;

      // Arquivo sem GETs ainda passa sem withVendorMime — não força redundância.
      if (getCalls === 0) {
        return;
      }

      const dispensados = GETS_SEM_VENDOR_MIME_NO_CONTRATO[path.basename(filePath)] ?? 0;
      const esperados = getCalls - dispensados;

      expect(
        vendorMimeCalls,
        `\nEsperado ≥${esperados} call sites de withVendorMime() (1 por this.http.get<>); ` +
          `encontrado ${vendorMimeCalls}. ADR-0016 exige Accept versionado em todo GET de recurso versionado.`,
      ).toBeGreaterThanOrEqual(esperados);
    });
  });
});
