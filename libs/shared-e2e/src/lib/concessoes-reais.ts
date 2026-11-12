import { expect } from '@playwright/test';

import {
  GESTOR_DE_ACESSOS,
  REPRESENTANTE_DO_CONTROLADOR,
  SEGUNDO_GESTOR_DE_ACESSOS,
  SOLICITANTE_DE_PEDIDOS,
  acharNaListagem,
  chamarApi,
  identidadeDoToken,
  tokenDaPersona,
  type RespostaDaApi,
} from './backend-real';
import { PDF_MINIMO, enviarPelaUrlAssinada } from './envio-de-arquivo';

interface ConcessaoExistente {
  readonly beneficiario: { readonly sub: string };
  readonly escopo: { readonly unidadeId: string | null };
  readonly ativa: boolean;
}

interface PedidoCriado {
  readonly id: string;
  readonly situacao: string;
}

/**
 * Concede o perfil à persona pelo fluxo real de pedido: um terceiro solicita, a persona aceita,
 * o gestor de acessos aprova a adequação funcional e, quando o perfil traz dado pessoal ou
 * sensível, um Representante do controlador aprova a segunda etapa. Idempotente: concessão ativa
 * igual não é pedida de novo, e pedido em andamento é retomado. Antes, garante o titular e o
 * substituto do Representante, porque são eles que aprovam a segunda etapa.
 */
export async function garantirConcessao(
  beneficiario: string,
  perfilId: string,
  unidadeDaConcessao: string,
): Promise<void> {
  if (perfilId !== PERFIL_DO_REPRESENTANTE) {
    await garantirRepresentantes();
  }
  const pedido = await pedidoDaConcessao(beneficiario, perfilId, unidadeDaConcessao);
  if (await concessaoAtiva(pedido)) {
    return;
  }
  await pedirEAprovarConcessao(pedido);
}

/** O pedido que concede o perfil à persona: a unidade só vale no perfil de escopo de unidade. */
async function pedidoDaConcessao(
  beneficiario: string,
  perfilId: string,
  unidadeDaConcessao: string,
): Promise<PedidoDeConcessao> {
  const perfil = await acharNaListagem<{ id: string; escopo: string }>(
    SOLICITANTE_DE_PEDIDOS,
    '/api/autorizacao/perfis-para-pedido?limit=100',
    (p) => p.id === perfilId,
  );
  const unidadeId = perfil?.escopo === 'unidade' ? unidadeDaConcessao : null;
  const { sub, email } = identidadeDoToken(await tokenDaPersona(beneficiario));
  return { beneficiario, email, sub, perfilId, unidadeId };
}

/** Perfil de governança "Representante do controlador", que decide a segunda etapa. */
const PERFIL_DO_REPRESENTANTE = '019a0000-0000-7000-8000-000000000002';
/** Quem decide a segunda etapa dos pedidos em que o titular, `REPRESENTANTE_DO_CONTROLADOR`, é beneficiário. */
const SUBSTITUTO_DO_REPRESENTANTE = 'caroline.jesus';
let representantesGuardados: Promise<void> | undefined;

/**
 * Designa os dois Representantes (institucionais) pelo mesmo fluxo de pedido. O titular entra
 * pela dispensa de designação, que só vale enquanto não há Representante vigente, então só o
 * gestor aprova; o substituto passa pela segunda etapa, decidida pelo titular. Os decisores das
 * duas etapas nunca coincidem: o gestor é `GESTOR_DE_ACESSOS` ou o segundo, e o Representante é
 * o titular ou o substituto.
 */
function garantirRepresentantes(): Promise<void> {
  representantesGuardados ??= designarRepresentantes().catch((erro: unknown) => {
    // Falha não fica guardada: a spec seguinte tenta a designação de novo.
    representantesGuardados = undefined;
    throw erro;
  });
  return representantesGuardados;
}

async function designarRepresentantes(): Promise<void> {
  await conferirBaseDosRepresentantes();
  await garantirConcessao(REPRESENTANTE_DO_CONTROLADOR, PERFIL_DO_REPRESENTANTE, '');
  await garantirConcessao(SUBSTITUTO_DO_REPRESENTANTE, PERFIL_DO_REPRESENTANTE, '');
}

/**
 * A preparação só sabe decidir a segunda etapa como o titular ou o substituto. Se a base tem
 * outro Representante vigente e nenhum dos dois, a dispensa de designação não se aplica e ninguém
 * que a simulação conhece decide o pedido do titular: falha antes, dizendo qual base se espera.
 */
async function conferirBaseDosRepresentantes(): Promise<void> {
  const vigentes = await subsDosRepresentantesVigentes();
  const conhecidos = await Promise.all(
    [REPRESENTANTE_DO_CONTROLADOR, SUBSTITUTO_DO_REPRESENTANTE].map(
      async (persona) => identidadeDoToken(await tokenDaPersona(persona)).sub,
    ),
  );
  if (vigentes.length === 0 || vigentes.some((sub) => conhecidos.includes(sub))) return;
  throw new Error(
    `A base tem Representante do controlador vigente que não é ${REPRESENTANTE_DO_CONTROLADOR} nem ${SUBSTITUTO_DO_REPRESENTANTE}. ` +
      'A preparação espera uma base sem Representante vigente ou com um desses dois designado; recrie a base ou designe um deles.',
  );
}

async function subsDosRepresentantesVigentes(): Promise<string[]> {
  const ativas = await chamarApi<ConcessaoExistente[]>(
    SEGUNDO_GESTOR_DE_ACESSOS,
    'GET',
    `/api/autorizacao/concessoes?perfil=${PERFIL_DO_REPRESENTANTE}&situacao=ativa&limit=100`,
  );
  return ativas.corpo.filter((concessao) => concessao.ativa).map((c) => c.beneficiario.sub);
}

async function concessaoAtiva(pedido: PedidoDeConcessao): Promise<boolean> {
  const ativas = await chamarApi<ConcessaoExistente[]>(
    SEGUNDO_GESTOR_DE_ACESSOS,
    'GET',
    `/api/autorizacao/concessoes?perfil=${pedido.perfilId}&situacao=ativa&limit=100`,
  );
  return ativas.corpo.some((concessao) => concedeOPedido(concessao, pedido));
}

/** A concessão ativa da mesma pessoa, no mesmo escopo, já atende o pedido. */
function concedeOPedido(concessao: ConcessaoExistente, pedido: PedidoDeConcessao): boolean {
  return (
    concessao.ativa &&
    concessao.beneficiario.sub === pedido.sub &&
    (concessao.escopo.unidadeId ?? null) === pedido.unidadeId
  );
}

interface PedidoDeConcessao {
  readonly beneficiario: string;
  readonly email: string;
  readonly sub: string;
  readonly perfilId: string;
  readonly unidadeId: string | null;
}

interface PedidoListado {
  readonly id: string;
  readonly situacao: string;
  readonly beneficiario: { readonly email: string };
  readonly perfil: { readonly id: string };
  readonly escopo: { readonly unidadeId: string | null };
}

interface EtapaDoPedido {
  readonly nome: string;
  readonly executar: (pedido: PedidoDeConcessao, base: string) => Promise<RespostaDaApi>;
}

interface PedidoLido {
  readonly situacao: string;
  readonly solicitante: { readonly sub: string };
}

interface AnexoParaEnvio {
  readonly id: string;
  readonly urlDeEnvio: string;
  readonly tipoDeMidia: string;
}

const POR_QUEM_APROVA_COMO_GESTOR = (p: PedidoDeConcessao): string =>
  p.beneficiario === GESTOR_DE_ACESSOS ? SEGUNDO_GESTOR_DE_ACESSOS : GESTOR_DE_ACESSOS;
const POR_QUEM_APROVA_COMO_PROTECAO = (p: PedidoDeConcessao): string =>
  p.beneficiario === REPRESENTANTE_DO_CONTROLADOR
    ? SUBSTITUTO_DO_REPRESENTANTE
    : REPRESENTANTE_DO_CONTROLADOR;

const postar = (quem: string, caminho: string, corpo?: unknown): Promise<RespostaDaApi> =>
  chamarApi(quem, 'POST', caminho, { corpo });

/**
 * Cada situação em andamento tem a etapa que a resolve; qualquer outra encerra o pedido. O
 * documento de designação (perfil de governança) é anexado por quem solicitou, em PDF, pela URL
 * assinada; o pedido só segue depois que a API verifica o arquivo.
 */
const ETAPAS_POR_SITUACAO: Readonly<Record<string, EtapaDoPedido>> = {
  aguardando_documento: { nome: 'anexo do documento de designação', executar: anexarDocumento },
  aguardando_beneficiario: {
    nome: 'aceite da pessoa beneficiária',
    executar: (p, base) => postar(p.beneficiario, `${base}/aceite`),
  },
  aguardando_gestor: {
    nome: 'aprovação funcional',
    executar: (p, base) => postar(POR_QUEM_APROVA_COMO_GESTOR(p), `${base}/aprovacoes`, {}),
  },
  aguardando_protecao_de_dados: {
    nome: 'aprovação da proteção de dados',
    executar: (p, base) => postar(POR_QUEM_APROVA_COMO_PROTECAO(p), `${base}/aprovacoes`, {}),
  },
};

const ROTA_DOS_PEDIDOS = '/api/autorizacao/pedidos-de-concessao';
const ESPERA_DA_VERIFICACAO_MS = 60_000;
const JUSTIFICATIVA = 'Acesso para a simulação ponta a ponta da projeção por proteção.';

async function pedirEAprovarConcessao(pedido: PedidoDeConcessao): Promise<void> {
  const emAndamento = await pedidoEmAndamento(pedido);
  const alvo = emAndamento ?? (await solicitarConcessao(pedido));
  await conduzirPedido(pedido, alvo.id, alvo.situacao);
}

/** O pedido ativo igual (mesma pessoa, perfil e escopo) que uma execução interrompida deixou. */
async function pedidoEmAndamento(pedido: PedidoDeConcessao): Promise<PedidoListado | undefined> {
  return acharNaListagem<PedidoListado>(
    POR_QUEM_APROVA_COMO_GESTOR(pedido),
    `${ROTA_DOS_PEDIDOS}?fila=todos&limit=100`,
    (p) =>
      p.situacao in ETAPAS_POR_SITUACAO &&
      p.beneficiario.email.toLowerCase() === pedido.email.toLowerCase() &&
      p.perfil.id === pedido.perfilId &&
      (p.escopo.unidadeId ?? null) === pedido.unidadeId,
  );
}

/** Executa só as etapas que faltam, a partir da situação em que o pedido está. */
async function conduzirPedido(
  pedido: PedidoDeConcessao,
  pedidoId: string,
  situacaoInicial: string,
): Promise<void> {
  const base = `${ROTA_DOS_PEDIDOS}/${pedidoId}`;
  let situacao = situacaoInicial;
  let etapa = ETAPAS_POR_SITUACAO[situacao];
  while (etapa !== undefined) {
    situacao = await avancar(etapa, situacao, pedido, base);
    etapa = ETAPAS_POR_SITUACAO[situacao];
  }
}

/** Executa a etapa e espera o pedido sair da situação que ela resolve; devolve a seguinte. */
async function avancar(
  etapa: EtapaDoPedido,
  situacao: string,
  pedido: PedidoDeConcessao,
  base: string,
): Promise<string> {
  const resposta = await etapa.executar(pedido, base);
  const contexto = `${etapa.nome} do pedido ${base} de ${pedido.beneficiario}`;
  expect(resposta.status, `${contexto}: ${JSON.stringify(resposta.corpo)}`).toBe(200);
  const seguinte = await aguardarSairDe(situacao, pedido, base);
  if (seguinte === null) throw new Error(`O pedido seguiu em "${situacao}" após ${contexto}.`);
  return seguinte;
}

async function lerPedido(pedido: PedidoDeConcessao, base: string): Promise<PedidoLido> {
  const lido = await chamarApi<PedidoLido>(POR_QUEM_APROVA_COMO_GESTOR(pedido), 'GET', base);
  expect(
    lido.status,
    `ler o pedido ${base} de ${pedido.beneficiario}: ${JSON.stringify(lido.corpo)}`,
  ).toBe(200);
  return lido.corpo;
}

/**
 * A situação seguinte ao passo, ou `null` se o pedido não sair dela no prazo; espera a verificação
 * do anexo, que é assíncrona.
 */
async function aguardarSairDe(
  situacao: string,
  pedido: PedidoDeConcessao,
  base: string,
): Promise<string | null> {
  const limite = Date.now() + ESPERA_DA_VERIFICACAO_MS;
  for (;;) {
    const atual = (await lerPedido(pedido, base)).situacao;
    if (atual !== situacao) return atual;
    if (Date.now() > limite) return null;
    await new Promise((resolver) => setTimeout(resolver, 1_000));
  }
}

/** Quem solicitou o pedido é quem anexa: a tela só oferece o anexo ao solicitante. */
async function solicitanteDoPedido(pedido: PedidoDeConcessao, base: string): Promise<string> {
  const { solicitante } = await lerPedido(pedido, base);
  for (const candidato of [SOLICITANTE_DE_PEDIDOS, 'isabella.figueiredo']) {
    if (identidadeDoToken(await tokenDaPersona(candidato)).sub === solicitante.sub)
      return candidato;
  }
  throw new Error(
    `O solicitante do pedido ${base} (${solicitante.sub}) não é uma persona conhecida.`,
  );
}

/** Registra o anexo, envia o PDF pela URL assinada e confirma com o ETag; devolve a resposta da confirmação. */
async function anexarDocumento(pedido: PedidoDeConcessao, base: string): Promise<RespostaDaApi> {
  const solicitante = await solicitanteDoPedido(pedido, base);
  const registro = await postar(solicitante, `${base}/anexos`, { tamanhoDoPdf: PDF_MINIMO.length });
  expect(
    registro.status,
    `registrar o anexo do pedido ${base}: ${JSON.stringify(registro.corpo)}`,
  ).toBe(201);
  const { id, urlDeEnvio, tipoDeMidia } = registro.corpo as AnexoParaEnvio;
  const etag = await enviarPelaUrlAssinada(urlDeEnvio, tipoDeMidia, PDF_MINIMO);
  return postar(solicitante, `${base}/anexos/${id}/confirmacao`, { etag });
}

/** Quem solicita é sempre um terceiro: a persona de pedidos, ou a outra quando ela é a beneficiária. */
function solicitantePara(beneficiario: string): string {
  return (
    [SOLICITANTE_DE_PEDIDOS, 'isabella.figueiredo'].find((u) => u !== beneficiario) ??
    SOLICITANTE_DE_PEDIDOS
  );
}

/** Um terceiro solicita a concessão; devolve o pedido criado. */
async function solicitarConcessao(pedido: PedidoDeConcessao): Promise<PedidoCriado> {
  const { beneficiario, email, perfilId, unidadeId } = pedido;
  const corpo = { beneficiarioEmail: email, perfilId, unidadeId, justificativa: JUSTIFICATIVA };
  const criado = await chamarApi<PedidoCriado>(
    solicitantePara(beneficiario),
    'POST',
    ROTA_DOS_PEDIDOS,
    { corpo },
  );
  expect(
    criado.status,
    `solicitação do pedido de ${beneficiario}: ${JSON.stringify(criado.corpo)}`,
  ).toBe(201);
  return criado.corpo;
}
