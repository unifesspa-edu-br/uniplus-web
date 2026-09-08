import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Fitness test do wizard de Processo Seletivo (`#511`): impede a volta de
 * catálogos institucionais locais para conceitos cujo vocabulário pertence
 * à API, depois que `#480`–`#482` migraram seus consumidores. Inventário
 * reconciliado na própria issue `#511` e detalhado no §7 do plano de
 * execução da frente ("o wizard vai até a publicação").
 *
 * O gate distingue três coisas, ou reprova o que deve passar:
 *
 * 1. **rótulos de navegação** — `PASSOS`, `STEP_LABELS`, `REVIEW_NAMES` em
 *    `processo-seletivo.data.ts`. Não são vocabulário institucional, ficam.
 * 2. **códigos de vocabulário fechado que a própria API devolve, e sobre os
 *    quais a interface decide** — `'SEGUE_CASCATA'`/`'DESTINO_UNICO'`
 *    (`distribuicao-de-vagas.ts`, `cascata-de-remanejamento.ts`), os códigos
 *    do ramo federal de distribuição (`REGRAS_RAMO_FEDERAL`), `'PCD'`
 *    (`CODIGO_CONDICAO_PCD`, linha protegida do ADR-0067) e os códigos
 *    discriminadores de regra em `classificacao-para-comando.ts` e
 *    `desempate-para-comando.ts` (`ELIM-*`, `DESEMPATE-*`). A lógica que
 *    depende deles não é escrevível sem citá-los, e já estão em produção nas
 *    Stories mergeadas — passam. O gate nunca os alcança: eles não vivem em
 *    `processo-seletivo.data.ts` nem usam um dos nomes do inventário banido
 *    abaixo.
 * 3. **catálogo local paralelo** — lista de opções institucionais que
 *    deveria vir de um client de API. Reprova.
 *
 * `DOCUMENTO_GRUPOS` é exceção nomeada e temporária: pertence à `#483`, que
 * não está nesta frente (ver comentário no próprio export, em
 * `processo-seletivo.data.ts`). Sem essa exceção o gate nasceria vermelho
 * por causa de uma Story fora da fila.
 *
 * Estratégia: glob + readFileSync + regex sobre exports, no molde de
 * `no-direct-http-in-pages.fitness.spec.ts`. Não bane por substring
 * genérica (nota técnica da issue `#511`) — ancora em nomes de export
 * específicos e no diretório do wizard, para não reprovar a exceção do
 * item 2.
 */

const STEPS_ROOT = path.resolve(__dirname, '../processo-seletivo/steps');
const DATA_FILE = path.join(STEPS_ROOT, 'processo-seletivo.data.ts');

/**
 * Inventário reconciliado (issue `#511`): conceito → fonte canônica e Story
 * dona da migração. Usado só para compor a mensagem de falha — o veredito é
 * puramente estrutural (o nome do export), não depende deste texto.
 */
const CATALOGO_BANIDO: Readonly<Record<string, { fonte: string; story: string }>> = {
  CURSOS: {
    fonte: 'OfertasCursoApi — a seleção persiste oferta, não curso abstrato',
    story: '#481',
  },
  ATENDIMENTO_CONDICOES: {
    fonte: 'condicoes-atendimento.api (client de Configuração)',
    story: '#481',
  },
  ATENDIMENTO_RECURSOS: {
    fonte: 'recurso-acessibilidade.api (client de Configuração)',
    story: '#481',
  },
  PCD_TIPOS: {
    fonte: 'tipo-deficiencia.api (client de Configuração)',
    story: '#481',
  },
  CRITERIOS_DESEMPATE: {
    fonte: 'GET /regras-catalogo?tipo=criterio_desempate',
    story: '#482',
  },
  DOC_ETAPAS: {
    fonte: 'fases canônicas do cronograma',
    story: '#480 e #483',
  },
  POLOS: {
    fonte:
      'nenhuma — "local de prova" fica fora do MVP (Feature #477) até decisão própria do CEPS/PO',
    story: 'remoção/reconciliação em #481',
  },
};

/** Rótulos de navegação e a exceção temporária — decisão 2 do plano da frente. */
const EXPORTS_PERMITIDOS_EM_DATA_TS = new Set([
  'PASSOS',
  'STEP_LABELS',
  'REVIEW_NAMES',
  'DOCUMENTO_GRUPOS',
]);

function listarArquivosTs(root: string): string[] {
  const arquivos: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      arquivos.push(...listarArquivosTs(fullPath));
    } else if (entry.isFile() && fullPath.endsWith('.ts') && !fullPath.endsWith('.spec.ts')) {
      arquivos.push(fullPath);
    }
  }
  return arquivos;
}

// Mesmo motivo do molde de HttpClient: strip de comentários antes do regex
// evita que um exemplo em JSDoc (citando o nome banido para explicar a
// própria regra, como este arquivo faz) dispare falso positivo.
function semComentarios(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** Nomes declarados como `export const <NOME>` no source (sem comentários). */
function exportsConstDe(source: string): string[] {
  const regex = /export\s+const\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
  const nomes: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) {
    nomes.push(match[1]);
  }
  return nomes;
}

/** Dos exports do arquivo, quais batem com um nome do inventário banido. */
function exportsBanidosEm(source: string): string[] {
  return exportsConstDe(semComentarios(source)).filter((nome) => nome in CATALOGO_BANIDO);
}

describe('Fitness — vocabulário institucional não duplica no wizard de Processo Seletivo', () => {
  it('o passo "Locais de prova" não voltou — sem endpoint, POLOS não vira diretório de novo (Feature #477)', () => {
    expect(fs.existsSync(path.join(STEPS_ROOT, 'steps', 'polos'))).toBe(false);
  });

  describe('processo-seletivo.data.ts só exporta rótulo de navegação (mais a exceção temporária DOCUMENTO_GRUPOS — #483)', () => {
    const source = semComentarios(fs.readFileSync(DATA_FILE, 'utf-8'));
    const exportados = exportsConstDe(source);

    it('sanity check — o regex está lendo o arquivo certo (0 exports seria suspeito)', () => {
      expect(exportados.length).toBeGreaterThan(0);
      expect(exportados).toContain('PASSOS');
    });

    it.each(exportados)('"%s" está na allowlist de rótulo de navegação ou é a exceção nomeada', (nome) => {
      expect(
        EXPORTS_PERMITIDOS_EM_DATA_TS.has(nome),
        `\nprocesso-seletivo.data.ts exporta "${nome}", que não é rótulo de navegação ` +
          `(PASSOS/STEP_LABELS/REVIEW_NAMES) nem a exceção temporária DOCUMENTO_GRUPOS (#483).\n` +
          `Se "${nome}" é uma lista de valores aceitos de um catálogo institucional, ela pertence a um ` +
          `client de API (uniplus/shared-data) — confira o inventário reconciliado na issue #511.\n` +
          `Se é rótulo de apresentação legítimo, adicione o nome a EXPORTS_PERMITIDOS_EM_DATA_TS neste fitness test.`,
      ).toBe(true);
    });
  });

  describe('nenhum arquivo do wizard reexporta um catálogo do inventário banido, mesmo fora de data.ts', () => {
    const arquivos = listarArquivosTs(STEPS_ROOT);

    it('sanity check — o glob percorre o diretório de passos do wizard', () => {
      expect(arquivos.length).toBeGreaterThan(10);
    });

    it.each(arquivos)('%s', (filePath) => {
      const source = fs.readFileSync(filePath, 'utf-8');
      const banidos = exportsBanidosEm(source);
      const relativePath = path.relative(path.resolve(__dirname, '../../../../../..'), filePath);

      expect(
        banidos,
        banidos
          .map(
            (nome) =>
              `\nArquivo: ${relativePath}\n` +
              `Exporta "${nome}", catálogo institucional banido pela #511.\n` +
              `Fonte canônica: ${CATALOGO_BANIDO[nome].fonte}.\n` +
              `Story dona da migração: ${CATALOGO_BANIDO[nome].story}.`,
          )
          .join('\n'),
      ).toEqual([]);
    });
  });

  // Prova negativa da própria regra (DoD da #511): mostra que o checker
  // reprova a reintrodução de um catálogo banido, sem tocar em arquivo real
  // do wizard — a fonte é sintética, só para exercitar exportsBanidosEm().
  describe('prova negativa — o gate reprova a reintrodução de um catálogo banido', () => {
    it('sinaliza export local de POLOS', () => {
      const fonteSintetica = `
        export const PASSOS = [{ rotulo: 'x' }];
        export const POLOS = ['Marabá (PA)', 'Canaã dos Carajás (PA)'] as const;
      `;
      expect(exportsBanidosEm(fonteSintetica)).toEqual(['POLOS']);
    });

    it('sinaliza export local de CRITERIOS_DESEMPATE', () => {
      const fonteSintetica = `export const CRITERIOS_DESEMPATE = [{ id: 1, label: 'Idade' }];`;
      expect(exportsBanidosEm(fonteSintetica)).toEqual(['CRITERIOS_DESEMPATE']);
    });

    it('NÃO sinaliza a exceção nomeada — código de vocabulário fechado citado pela lógica (SEGUE_CASCATA, PCD, ramo federal)', () => {
      const fonteSintetica = `
        const SEGUE_CASCATA = 'SEGUE_CASCATA';
        export const CODIGO_CONDICAO_PCD = 'PCD';
        const REGRAS_RAMO_FEDERAL = ['DISTRIB-VAGAS-LEI-12711', 'DISTRIB-VAGAS-LEI-12711-COM-AC-PCD'];
        export function ehRamoFederal(codigo: string) {
          return REGRAS_RAMO_FEDERAL.includes(codigo);
        }
      `;
      expect(exportsBanidosEm(fonteSintetica)).toEqual([]);
    });

    it('NÃO sinaliza rótulo de navegação nem a exceção temporária DOCUMENTO_GRUPOS', () => {
      const fonteSintetica = `
        export const PASSOS = [];
        export const STEP_LABELS = [];
        export const REVIEW_NAMES = [];
        export const DOCUMENTO_GRUPOS = [];
      `;
      expect(exportsBanidosEm(fonteSintetica)).toEqual([]);
    });
  });
});
