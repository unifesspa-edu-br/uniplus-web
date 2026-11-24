import { expect, type Locator, type Page } from '@playwright/test';
import { chamarApi } from '@uniplus/shared-e2e';
import {
  PERSONA_DA_CONFIGURACAO,
  opcoesDasCaixas,
  type LeitorDeOpcoes,
  type NomeDoVocabulario,
} from './vocabularios-reais';

/** Um campo da tela que oferece as opções de um vocabulário da API. */
export interface CampoDoVocabulario {
  readonly vocabulario: NomeDoVocabulario;
  readonly localizar: (pagina: Page) => Locator;
  readonly ler?: LeitorDeOpcoes;
}

/** Uma tela de configuração: a rota, o passo que abre o formulário e os campos de enum dele. */
export interface TelaComVocabulario {
  readonly nome: string;
  readonly rota: string;
  readonly abrirFormulario: (pagina: Page) => Promise<void>;
  readonly campos: readonly CampoDoVocabulario[];
}

const combobox = (pagina: Page, nome: RegExp): Locator =>
  pagina.getByRole('combobox', { name: nome });

async function abrirPeloBotao(pagina: Page, botao: string): Promise<void> {
  await pagina.getByRole('button', { name: botao }).first().click();
}

/** A fase canônica não tem criação: o formulário que oferece a origem da data é o de edição. */
async function abrirEdicaoDeUmaFase(pagina: Page): Promise<void> {
  const fases = await chamarApi<{ codigo: string }[]>(
    PERSONA_DA_CONFIGURACAO,
    'GET',
    '/api/configuracao/fases-canonicas?limit=1',
  );
  expect(fases.status, 'Leitura das fases canônicas').toBe(200);
  const [fase] = fases.corpo;
  if (fase === undefined) throw new Error('A base não tem fase canônica para abrir a edição.');
  await pagina.getByRole('searchbox', { name: 'Buscar fase canônica' }).fill(fase.codigo);
  await pagina.getByRole('button', { name: `Editar fase canônica ${fase.codigo}` }).click();
}

/** Só uma natureza que não é ampla abre a seção de remanejamento, onde está a regra. */
async function escolherNaturezaComRemanejamento(pagina: Page): Promise<void> {
  const natureza = combobox(pagina, /^Natureza legal/);
  await expect(natureza.locator('option[value="ACAO_AFIRMATIVA"]')).toBeAttached();
  await natureza.selectOption('ACAO_AFIRMATIVA');
}

async function abrirNovoDiaNaoUtil(pagina: Page): Promise<void> {
  await pagina.getByRole('button', { name: 'Adicionar dia' }).click();
}

const formularioDaOferta = (pagina: Page): Locator => pagina.locator('#cfg-oferta-curso-form');

const CAMPOS_DA_MODALIDADE: readonly CampoDoVocabulario[] = [
  { vocabulario: 'naturezas-legais', localizar: (p) => combobox(p, /^Natureza legal/) },
  { vocabulario: 'composicoes-vagas', localizar: (p) => combobox(p, /^Composição de vagas/) },
  { vocabulario: 'regras-remanejamento', localizar: (p) => combobox(p, /^Regra de remanejamento/) },
  {
    vocabulario: 'acoes-quando-indeferido',
    localizar: (p) => combobox(p, /^Ação quando indeferido/),
  },
];

const CAMPOS_DA_OFERTA: readonly CampoDoVocabulario[] = [
  {
    vocabulario: 'programas-oferta',
    localizar: (p) => formularioDaOferta(p).getByRole('combobox', { name: /^Programa de oferta/ }),
  },
  {
    vocabulario: 'formatos-pedagogicos',
    localizar: (p) => formularioDaOferta(p).getByRole('combobox', { name: /^Formato pedagógico/ }),
  },
  {
    vocabulario: 'regimes-funcionamento',
    localizar: (p) =>
      formularioDaOferta(p).getByRole('combobox', { name: /^Regime de funcionamento/ }),
  },
  {
    vocabulario: 'regimes-turno',
    localizar: (p) => formularioDaOferta(p).getByRole('combobox', { name: /^Regime de turno/ }),
  },
  {
    vocabulario: 'turnos-oferta',
    localizar: (p) => formularioDaOferta(p).getByRole('group', { name: /^Turnos/ }),
    ler: opcoesDasCaixas,
  },
];

export const TELAS_COM_VOCABULARIO: readonly TelaComVocabulario[] = [
  {
    nome: 'Modalidade de concorrência',
    rota: '/modalidades/novo',
    abrirFormulario: escolherNaturezaComRemanejamento,
    campos: CAMPOS_DA_MODALIDADE,
  },
  {
    nome: 'Local de oferta',
    rota: '/locais-oferta',
    abrirFormulario: (pagina) => abrirPeloBotao(pagina, 'Novo local de oferta'),
    campos: [
      {
        vocabulario: 'tipos-local-oferta',
        localizar: (p) =>
          p.getByRole('region', { name: 'Classificação' }).getByRole('combobox', { name: /^Tipo/ }),
      },
    ],
  },
  {
    nome: 'Fase canônica',
    rota: '/fases-canonicas',
    abrirFormulario: abrirEdicaoDeUmaFase,
    campos: [
      {
        vocabulario: 'origens-data-fase',
        localizar: (p) =>
          p.locator('#cfg-fase-canonica-form').getByRole('combobox', { name: /^Origem da data/ }),
      },
    ],
  },
  {
    nome: 'Calendário de dias úteis',
    rota: '/calendario-dias-uteis/novo',
    abrirFormulario: abrirNovoDiaNaoUtil,
    campos: [
      { vocabulario: 'abrangencias-dia-nao-util', localizar: (p) => combobox(p, /^Abrangência/) },
    ],
  },
  {
    nome: 'Termo de consentimento',
    rota: '/termos-consentimento/novo',
    abrirFormulario: async () => undefined,
    campos: [{ vocabulario: 'formas-aceite', localizar: (p) => combobox(p, /^Forma de aceite/) }],
  },
  {
    nome: 'Oferta de curso',
    rota: '/ofertas-curso',
    abrirFormulario: (pagina) => abrirPeloBotao(pagina, 'Nova oferta de curso'),
    campos: CAMPOS_DA_OFERTA,
  },
];
