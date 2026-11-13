import { expect } from '@playwright/test';

import { SEGUNDO_GESTOR_DE_ACESSOS, chamarApi } from './backend-real';
import { garantirPerfil } from './versoes-de-perfil-reais';
import { garantirConcessao, garantirRepresentantes } from './concessoes-reais';

const SIGLA_DO_CERTAME = 'CEPS';
let unidadeGuardada: Promise<string> | undefined;

/**
 * Unidade que administra o certame de Medicina nesta base. O id muda a cada base, então vem da
 * API, pela sigla da unidade que o roteiro do processo usa como administradora; é o mesmo id que
 * o processo congela em `unidadeAdministradora.origemId`. `E2E_UNIDADE_ID` a substitui por escolha explícita.
 */
export function unidadeDoCertame(): Promise<string> {
  unidadeGuardada ??= (async () => {
    const informada = process.env['E2E_UNIDADE_ID'];
    return informada !== undefined && informada !== '' ? informada : lerUnidadeDoCertame();
  })();
  return unidadeGuardada;
}

async function lerUnidadeDoCertame(): Promise<string> {
  const resposta = await chamarApi<{ id: string; sigla: string }[]>(
    SEGUNDO_GESTOR_DE_ACESSOS,
    'GET',
    '/api/organizacao/unidades?limit=100',
  );
  const unidades = Array.isArray(resposta.corpo) ? resposta.corpo : [];
  const unidade = unidades.find((u) => u.sigla === SIGLA_DO_CERTAME);
  if (unidade === undefined) {
    throw new Error(
      `A unidade ${SIGLA_DO_CERTAME} não existe nesta base. Rode scripts/roteiro-processo-teste-inscricao.sh da uniplus-api antes da spec, ou informe E2E_UNIDADE_ID.`,
    );
  }
  return unidade.id;
}

const PROJECAO = 'E2E projeção — ';

/** Permissão de dado e de arquivo por classe, na ordem do catálogo da Seleção. */
const DADOS_ATE_PESSOAL = [
  'selecao:dados-publicos:consultar',
  'selecao:dados-internos:consultar',
  'selecao:dados-pessoais:consultar',
];
const DOCUMENTOS_ATE_PESSOAL = [
  'selecao:documentos-publicos:consultar',
  'selecao:documentos-internos:consultar',
  'selecao:documentos-pessoais:consultar',
];
const ACESSO = ['selecao:inscricoes:consultar', 'selecao:processos:acompanhar'];

/** Persona fictícia do portal e o perfil que a simulação lhe concede. */
export const ACESSOS_DA_SIMULACAO = [
  {
    persona: 'diogo.souza',
    nome: `${PROJECAO}Operação completa do CEPS, com a classe do identificador`,
    permissoes: [
      ...ACESSO,
      ...DADOS_ATE_PESSOAL,
      'selecao:dados-sensiveis:consultar',
      'selecao:dados-identificadores:consultar',
      'selecao:dados-identificadores:revelar',
      ...DOCUMENTOS_ATE_PESSOAL,
      'selecao:documentos-identificadores:consultar',
      'selecao:documentos-sensiveis:consultar',
    ],
  },
  {
    persona: 'leandro.viana',
    nome: `${PROJECAO}Avaliação cega`,
    permissoes: [...ACESSO, 'selecao:dados-publicos:consultar'],
  },
  {
    persona: 'kevin.carvalho',
    nome: `${PROJECAO}Operação sem sensível e sem revelação`,
    permissoes: [...ACESSO, ...DADOS_ATE_PESSOAL, ...DOCUMENTOS_ATE_PESSOAL],
  },
  {
    persona: 'helena.rezende',
    nome: `${PROJECAO}Só o número mascarado`,
    permissoes: [...ACESSO, 'selecao:dados-identificadores:consultar'],
  },
  {
    persona: 'manoel.aparicio',
    nome: `${PROJECAO}Só o acesso às inscrições`,
    permissoes: ['selecao:inscricoes:consultar'],
  },
  {
    persona: 'isabella.figueiredo',
    nome: `${PROJECAO}Manutenção do catálogo`,
    permissoes: [
      'configuracao:tipos-documento:manter',
      'configuracao:fatos-candidato:manter',
      'configuracao:fatos-candidato:consultar',
    ],
  },
] as const;

/** Monta os perfis e as concessões da simulação; pode rodar quantas vezes for preciso. */
export async function prepararAcessosDaSimulacao(): Promise<void> {
  const unidadeId = await unidadeDoCertame();
  for (const acesso of ACESSOS_DA_SIMULACAO) {
    const perfilId = await garantirPerfil(
      acesso.nome,
      `Perfil da simulação ponta a ponta: ${acesso.persona}.`,
      acesso.permissoes,
    );
    await garantirConcessao(acesso.persona, perfilId, unidadeId);
  }
}

interface ItemDaProtecao {
  readonly tipo: string;
  readonly id: string;
  readonly codigo: string;
  readonly classificacaoProtecao: string;
  readonly hipoteseLegal: string;
  readonly finalidadeTratamento: string;
  readonly aprovacao: { readonly ciclo: number; readonly manifestacoesNoCiclo: number };
}

const CRIADO_POR_SPEC = /_\d{10,}$/;

/**
 * Leva o catálogo inicial ao estado aprovado, como o Representante do controlador faria: a
 * administradora envia a solicitação dos itens pendentes e o Representante substituto, garantido
 * antes (numa base nova ele ainda não existe), aprova cada item solicitado com a classificação
 * proposta. Sem isso a API recusa vincular qualquer fato ou tipo à configuração.
 *
 * Só o catálogo inicial entra: o item que uma spec cria leva o instante da criação no fim do
 * código (`..._1793590782604`) e fica com a spec, que decide quando e como ele é solicitado.
 */
export async function aprovarCatalogoInicial(): Promise<number> {
  await garantirRepresentantes();
  await solicitarAprovacaoDoCatalogoInicial();
  const fila = await chamarApi<ItemDaProtecao[]>(
    APROVA_O_CATALOGO,
    'GET',
    `${PROTECAO_DO_CATALOGO}?situacao=SOLICITADA`,
  );
  const aAprovar = fila.corpo.filter(doCatalogoInicial);
  for (const item of aAprovar) {
    await aprovarItem(item);
  }
  return aAprovar.length;
}

const PROTECAO_DO_CATALOGO = '/api/configuracao/admin/protecao-do-catalogo';
const MANTEM_O_CATALOGO = 'isabella.figueiredo';
const APROVA_O_CATALOGO = 'caroline.jesus';
const doCatalogoInicial = (item: ItemDaProtecao): boolean => !CRIADO_POR_SPEC.test(item.codigo);

async function solicitarAprovacaoDoCatalogoInicial(): Promise<void> {
  const pendentes = await chamarApi<ItemDaProtecao[]>(
    MANTEM_O_CATALOGO,
    'GET',
    `${PROTECAO_DO_CATALOGO}?situacao=PENDENTE`,
  );
  const aSolicitar = pendentes.corpo.filter(doCatalogoInicial);
  if (aSolicitar.length === 0) return;
  const itens = aSolicitar.map((item) => ({ cadastro: item.tipo, id: item.id }));
  const caminho = `${PROTECAO_DO_CATALOGO}/solicitacoes`;
  const solicitacao = await chamarApi(MANTEM_O_CATALOGO, 'POST', caminho, { corpo: { itens } });
  expect(solicitacao.status, 'solicitar a aprovação do catálogo').toBe(200);
}

/**
 * Aprova o item com a classificação, a hipótese legal e a finalidade propostas, e com o ciclo e a
 * contagem de manifestações lidos na fila, que a decisão sempre leva.
 */
async function aprovarItem(item: ItemDaProtecao): Promise<void> {
  const { classificacaoProtecao, hipoteseLegal, finalidadeTratamento } = item;
  const { ciclo, manifestacoesNoCiclo } = item.aprovacao;
  const decisao = await chamarApi(APROVA_O_CATALOGO, 'POST', PROTECAO_DO_CATALOGO, {
    corpo: {
      cadastro: item.tipo,
      itemId: item.id,
      decisao: 'APROVAR',
      ...{ classificacaoProtecao, hipoteseLegal, finalidadeTratamento },
      ...{ ciclo, manifestacoesNoCiclo },
    },
  });
  expect(decisao.status, `aprovar ${item.id}`).toBe(204);
}

/**
 * Quem roda o roteiro de montagem do processo. Uma persona que nenhuma spec usa em asserção de
 * permissão: dar a uma das personas das specs os cadastros e a configuração do certame mudaria o
 * que elas presumem ter (a matriz de permissões exige a lista exata de cada uma).
 */
export const OPERADOR_DO_ROTEIRO = 'cecilia.moura';

const CADASTROS_MANTIDOS_PELO_ROTEIRO = [
  'campi',
  'cursos',
  'ofertas-curso',
  'locais-oferta',
  'modalidades',
  'tipos-processo',
  'tipos-etapa',
  'tipos-banca',
  'tipos-documento',
  'tipos-deficiencia',
  'categorias-documento',
  'condicoes-atendimento',
  'recursos-acessibilidade',
  'fases-canonicas',
  'precedencias-fase',
  'calendarios-dias-uteis',
  'pesos-area-enem',
  'base-legal-bonus-regional',
  'referencias-reserva-demografica',
  'termos-consentimento',
  'modelos-formulario',
  'fatos-candidato',
];

/** Cadastros e publicações: escopo de instituição. */
const PERMISSOES_DE_CADASTRO_DO_ROTEIRO = [
  'publicacoes:tipos-ato:manter',
  'publicacoes:atos-normativos:registrar',
  'organizacao:instituicao:manter',
  'organizacao:unidades:manter',
  ...CADASTROS_MANTIDOS_PELO_ROTEIRO.map((cadastro) => `configuracao:${cadastro}:manter`),
  'configuracao:fatos-candidato:consultar',
  'configuracao:modelos-formulario:consultar',
  'configuracao:tipos-processo:consultar',
  'selecao:motivos-de-decisao:manter',
  'selecao:obrigatoriedades-legais:manter',
  'selecao:leiautes-inep:consultar',
  'selecao:regras-catalogo:consultar',
];

/** Processo seletivo: escopo na unidade do certame. */
const PERMISSOES_DE_PROCESSO_DO_ROTEIRO = [
  'selecao:processos:configurar',
  'selecao:processos:publicar',
  'selecao:processos:acompanhar',
  'selecao:inscricoes:consultar',
  'selecao:dados-publicos:consultar',
  'selecao:dados-internos:consultar',
  'selecao:documentos-publicos:consultar',
  'selecao:documentos-internos:consultar',
];

const PERFIS_DO_OPERADOR = [
  {
    nome: 'Operador do roteiro — cadastros e publicações (E2E)',
    permissoes: PERMISSOES_DE_CADASTRO_DO_ROTEIRO,
  },
  {
    nome: 'Operador do roteiro — processo seletivo (E2E)',
    permissoes: PERMISSOES_DE_PROCESSO_DO_ROTEIRO,
  },
] as const;

let operadorGuardado: Promise<void> | undefined;

/**
 * Garante que o operador do roteiro tenha os dois perfis, o de cadastros (institucional) e o do
 * processo (na unidade do certame). Idempotente; a falha não fica guardada.
 */
export function garantirOperadorDoRoteiro(): Promise<void> {
  operadorGuardado ??= concederPerfisDoOperador().catch((erro: unknown) => {
    operadorGuardado = undefined;
    throw erro;
  });
  return operadorGuardado;
}

async function concederPerfisDoOperador(): Promise<void> {
  const unidadeId = await unidadeDoCertame();
  for (const perfil of PERFIS_DO_OPERADOR) {
    const perfilId = await garantirPerfil(
      perfil.nome,
      `Perfil do roteiro que monta o processo seletivo: ${OPERADOR_DO_ROTEIRO}.`,
      perfil.permissoes,
    );
    await garantirConcessao(OPERADOR_DO_ROTEIRO, perfilId, unidadeId);
  }
}
