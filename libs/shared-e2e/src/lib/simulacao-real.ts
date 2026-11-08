import { expect } from '@playwright/test';

import {
  SEGUNDO_GESTOR_DE_ACESSOS,
  chamarApi,
  garantirPerfil,
} from './backend-real';
import { garantirConcessao } from './concessoes-reais';

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
    if (informada !== undefined && informada !== '') {
      return informada;
    }
    const resposta = await chamarApi<{ id: string; sigla: string }[]>(
      SEGUNDO_GESTOR_DE_ACESSOS,
      'GET',
      '/api/organizacao/unidades?limit=100',
    );
    const unidade = Array.isArray(resposta.corpo) ? resposta.corpo.find((u) => u.sigla === SIGLA_DO_CERTAME) : undefined;
    if (unidade === undefined) {
      throw new Error(
        `A unidade ${SIGLA_DO_CERTAME} não existe nesta base. Rode scripts/roteiro-processo-teste-inscricao.sh da uniplus-api antes da spec, ou informe E2E_UNIDADE_ID.`,
      );
    }
    return unidade.id;
  })();
  return unidadeGuardada;
}

const PROJECAO = 'E2E projeção — ';

/** Permissão de dado e de arquivo por classe, na ordem do catálogo da Seleção. */
const DADOS_ATE_PESSOAL = ['selecao:dados-publicos:consultar', 'selecao:dados-internos:consultar', 'selecao:dados-pessoais:consultar'];
const DOCUMENTOS_ATE_PESSOAL = ['selecao:documentos-publicos:consultar', 'selecao:documentos-internos:consultar', 'selecao:documentos-pessoais:consultar'];
const ACESSO = ['selecao:inscricoes:consultar', 'selecao:processos:acompanhar'];

/** Persona fictícia do portal e o perfil que a simulação lhe concede. */
export const ACESSOS_DA_SIMULACAO = [
  {
    persona: 'diogo.souza',
    nome: `${PROJECAO}Operação completa do CEPS, com a classe do identificador`,
    permissoes: [
      ...ACESSO, ...DADOS_ATE_PESSOAL, 'selecao:dados-sensiveis:consultar',
      'selecao:dados-identificadores:consultar', 'selecao:dados-identificadores:revelar',
      ...DOCUMENTOS_ATE_PESSOAL, 'selecao:documentos-identificadores:consultar', 'selecao:documentos-sensiveis:consultar',
    ],
  },
  { persona: 'leandro.viana', nome: `${PROJECAO}Avaliação cega`, permissoes: [...ACESSO, 'selecao:dados-publicos:consultar'] },
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
  { persona: 'manoel.aparicio', nome: `${PROJECAO}Só o acesso às inscrições`, permissoes: ['selecao:inscricoes:consultar'] },
  {
    persona: 'isabella.figueiredo',
    nome: `${PROJECAO}Manutenção do catálogo`,
    permissoes: ['configuracao:tipos-documento:manter', 'configuracao:fatos-candidato:manter', 'configuracao:fatos-candidato:consultar'],
  },
  { persona: 'caroline.jesus', nome: `${PROJECAO}Aprovação da proteção do catálogo`, permissoes: ['configuracao:protecao-do-catalogo:aprovar'] },
] as const;

/** Monta os perfis e as concessões da simulação; pode rodar quantas vezes for preciso. */
export async function prepararAcessosDaSimulacao(): Promise<void> {
  const unidadeId = await unidadeDoCertame();
  for (const acesso of ACESSOS_DA_SIMULACAO) {
    const perfilId = await garantirPerfil(acesso.nome, `Perfil da simulação ponta a ponta: ${acesso.persona}.`, acesso.permissoes);
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
}

const CRIADO_POR_SPEC = /_\d{10,}$/;

/**
 * Leva o catálogo inicial ao estado aprovado, como a proteção de dados faria: a administradora
 * envia a solicitação dos itens pendentes e a proteção de dados aprova cada item solicitado com a
 * classificação proposta. Sem isso a API recusa vincular qualquer fato ou tipo à configuração.
 *
 * Só o catálogo inicial entra: o item que uma spec cria leva o instante da criação no fim do
 * código (`..._1793590782604`) e fica com a spec, que decide quando e como ele é solicitado.
 */
export async function aprovarCatalogoInicial(): Promise<number> {
  const caminho = '/api/configuracao/admin/protecao-do-catalogo';
  const doCatalogoInicial = (item: ItemDaProtecao): boolean => !CRIADO_POR_SPEC.test(item.codigo);
  const pendentes = await chamarApi<ItemDaProtecao[]>('isabella.figueiredo', 'GET', `${caminho}?situacao=PENDENTE`);
  const aSolicitar = pendentes.corpo.filter(doCatalogoInicial);
  if (aSolicitar.length > 0) {
    const solicitacao = await chamarApi('isabella.figueiredo', 'POST', `${caminho}/solicitacoes`, {
      corpo: { itens: aSolicitar.map((item) => ({ cadastro: item.tipo, id: item.id })) },
    });
    expect(solicitacao.status, 'solicitar a aprovação do catálogo').toBe(200);
  }
  const fila = await chamarApi<ItemDaProtecao[]>('caroline.jesus', 'GET', `${caminho}?situacao=SOLICITADA`);
  const aAprovar = fila.corpo.filter(doCatalogoInicial);
  for (const item of aAprovar) {
    const decisao = await chamarApi('caroline.jesus', 'POST', caminho, {
      corpo: {
        cadastro: item.tipo,
        itemId: item.id,
        decisao: 'APROVAR',
        classificacaoProtecao: item.classificacaoProtecao,
        hipoteseLegal: item.hipoteseLegal,
        finalidadeTratamento: item.finalidadeTratamento,
      },
    });
    expect(decisao.status, `aprovar ${item.id}`).toBe(204);
  }
  return aAprovar.length;
}


/**
 * Quem roda o roteiro de montagem do processo. Uma persona que nenhuma spec usa em asserção de
 * permissão: dar a uma das personas das specs os cadastros e a configuração do certame mudaria o
 * que elas presumem ter (a matriz de permissões exige a lista exata de cada uma).
 */
export const OPERADOR_DO_ROTEIRO = 'cecilia.moura';

const CADASTROS_MANTIDOS_PELO_ROTEIRO = [
  'campi', 'cursos', 'ofertas-curso', 'locais-oferta', 'modalidades', 'tipos-processo', 'tipos-etapa', 'tipos-banca',
  'tipos-documento', 'tipos-deficiencia', 'categorias-documento', 'condicoes-atendimento', 'recursos-acessibilidade',
  'fases-canonicas', 'precedencias-fase', 'calendarios-dias-uteis', 'pesos-area-enem', 'base-legal-bonus-regional',
  'referencias-reserva-demografica', 'termos-consentimento', 'modelos-formulario', 'fatos-candidato',
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
  'configuracao:protecao-do-catalogo:aprovar',
  'selecao:motivos-decisao-isencao:manter',
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
  { nome: 'Operador do roteiro — cadastros e publicações (E2E)', permissoes: PERMISSOES_DE_CADASTRO_DO_ROTEIRO },
  { nome: 'Operador do roteiro — processo seletivo (E2E)', permissoes: PERMISSOES_DE_PROCESSO_DO_ROTEIRO },
] as const;

let operadorGuardado: Promise<void> | undefined;

/**
 * Garante que o operador do roteiro tenha os dois perfis, o de cadastros (institucional) e o do
 * processo (na unidade do certame). Idempotente; a falha não fica guardada.
 */
export function garantirOperadorDoRoteiro(): Promise<void> {
  operadorGuardado ??= (async () => {
    const unidadeId = await unidadeDoCertame();
    for (const perfil of PERFIS_DO_OPERADOR) {
      const perfilId = await garantirPerfil(
        perfil.nome,
        `Perfil do roteiro que monta o processo seletivo: ${OPERADOR_DO_ROTEIRO}.`,
        perfil.permissoes,
      );
      await garantirConcessao(OPERADOR_DO_ROTEIRO, perfilId, unidadeId);
    }
  })().catch((erro: unknown) => {
    operadorGuardado = undefined;
    throw erro;
  });
  return operadorGuardado;
}
