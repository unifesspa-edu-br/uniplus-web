import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Fitness cross-app do runtime config (ADR-0021):
 *
 * Para cada app de produção (selecao, ingresso, portal), garante que:
 *
 * 1. `app.config.ts` importa `provideRuntimeConfig` de `@uniplus/shared-data`.
 * 2. `app.config.ts` importa `provideAuth` de `@uniplus/shared-auth`.
 * 3. `provideRuntimeConfig()` aparece **antes** de `provideAuth()` no
 *    array `providers` — ordem é binding (Angular respeita ordem dos
 *    `APP_INITIALIZER` conforme aparecem no array; runtime-config DEVE
 *    popular `AUTH_CONFIG` antes do appInitializer de auth ser chamado).
 * 4. `app.config.ts` NÃO importa de `'../environments/environment'`
 *    (substituído por `AppConfigService` em runtime).
 *
 * Estratégia: parsing de string + regex. Falha aqui = bootstrap em
 * produção pode subir com placeholder URLs ou ordem incorreta de
 * appInitializer.
 *
 * Adicionar 4º app: append em `APPS` — fitness adiciona automaticamente.
 */

const APPS = ['selecao', 'ingresso', 'portal'] as const;

const WORKSPACE_ROOT = path.resolve(__dirname, '../../../../..');

function lerAppConfig(app: string): { conteudo: string; conteudoSemComentarios: string; relativo: string } {
  const filePath = path.join(WORKSPACE_ROOT, 'apps', app, 'src/app/app.config.ts');
  const conteudo = fs.readFileSync(filePath, 'utf-8');
  // Strip comentários antes do indexOf de chamadas — caso contrário, menções
  // a `provideAuth()` em JSDoc/inline produzem falsos positivos na verificação
  // de ordem. Cobre `// linha`, `/* bloco */` e `/** JSDoc */`.
  const conteudoSemComentarios = conteudo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  return {
    conteudo,
    conteudoSemComentarios,
    relativo: path.relative(WORKSPACE_ROOT, filePath),
  };
}

describe('Fitness — apps app.config.ts (runtime config + auth, ADR-0021)', () => {
  describe.each(APPS)('app: %s', (app) => {
    const { conteudo, conteudoSemComentarios, relativo } = lerAppConfig(app);

    it('importa provideRuntimeConfig de @uniplus/shared-data', () => {
      const importou = /import\s+\{[^}]*\bprovideRuntimeConfig\b[^}]*\}\s+from\s+['"]@uniplus\/shared-data['"]/.test(conteudo);
      expect(
        importou,
        `\nArquivo: ${relativo}\nFalta importar provideRuntimeConfig — runtime-config.json não será carregado e AUTH_CONFIG/BASE_PATHs não terão factory.`,
      ).toBe(true);
    });

    it('importa provideAuth de @uniplus/shared-auth', () => {
      const importou = /import\s+\{[^}]*\bprovideAuth\b[^}]*\}\s+from\s+['"]@uniplus\/shared-auth['"]/.test(conteudo);
      expect(
        importou,
        `\nArquivo: ${relativo}\nFalta importar provideAuth — Keycloak não será inicializado.`,
      ).toBe(true);
    });

    it('chama provideRuntimeConfig() ANTES de provideAuth() no array providers', () => {
      const indiceRuntime = conteudoSemComentarios.indexOf('provideRuntimeConfig(');
      const indiceAuth = conteudoSemComentarios.indexOf('provideAuth(');
      expect(indiceRuntime, `\nArquivo: ${relativo}\nprovideRuntimeConfig() não chamado.`).toBeGreaterThan(-1);
      expect(indiceAuth, `\nArquivo: ${relativo}\nprovideAuth() não chamado.`).toBeGreaterThan(-1);
      expect(
        indiceRuntime,
        `\nArquivo: ${relativo}\nOrdem incorreta: provideRuntimeConfig() DEVE aparecer antes de provideAuth() — caso contrário, AUTH_CONFIG não está populado quando AuthService.init é chamado.`,
      ).toBeLessThan(indiceAuth);
    });

    it('NÃO importa de ../environments/environment (use AppConfigService)', () => {
      const importouEnv = /from\s+['"]\.\.\/environments\/environment['"]/.test(conteudo);
      expect(
        importouEnv,
        `\nArquivo: ${relativo}\nimport de environments/environment é vedado em app.config.ts pós-ADR-0021. Consuma AppConfigService via factory de provideRuntimeConfig() (que provê AUTH_CONFIG, SELECAO_BASE_PATH, INGRESSO_BASE_PATH).`,
      ).toBe(false);
    });
  });
});
