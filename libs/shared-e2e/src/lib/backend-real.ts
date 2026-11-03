import { execFileSync } from 'node:child_process';
import { expect, type Browser, type Page } from '@playwright/test';

import { keycloakLogin } from './keycloak-login';

/**
 * Apoio das specs `*.backend.spec.ts`, que rodam contra a API, o Keycloak e o Kafka de verdade
 * (`E2E_BACKEND_REAL=1`). Concentra o que todas repetem: o token de uma persona fictícia do
 * portal, a chamada autenticada à API, a montagem de perfis e concessões pelo fluxo de pedido
 * (solicitação, aceite, aprovação funcional e da proteção de dados) e o login pela interface.
 *
 * Só persona do portal entra aqui: o login é o do realm `unifesspa` local, sem CPF, nome ou
 * e-mail inventado.
 */

const KEYCLOAK_URL = process.env['KEYCLOAK_URL'] ?? 'http://localhost:8080';
const REALM = 'unifesspa';

/** Endereço direto do monólito; as specs de interface usam o gateway pelo `runtime-config` do app. */
export const API_URL = process.env['E2E_API_URL'] ?? 'http://localhost:5200';

/** Senha das personas no realm local, definida por `setup-keycloak-dev.sh`. */
export const SENHA_DAS_PERSONAS = process.env['E2E_SENHA_DAS_PERSONAS'] ?? 'Uni+Teste26';

/** Unidade administradora do certame de Medicina nas bases locais (CEPS). */
export const GESTOR_DE_ACESSOS = 'leandro.viana';
export const SEGUNDO_GESTOR_DE_ACESSOS = 'diogo.souza';
export const PROTECAO_DE_DADOS = 'betina.neves';
export const SOLICITANTE_DE_PEDIDOS = 'manoel.aparicio';

export interface RespostaDaApi<T = unknown> {
  readonly status: number;
  readonly corpo: T;
  readonly cabecalhos: Headers;
}

interface IdentidadeDoToken {
  readonly sub: string;
  readonly email: string;
}

/** Folga antes do vencimento em que o token deixa de ser reaproveitado. */
const FOLGA_DO_TOKEN_MS = 30_000;

const tokens = new Map<string, { readonly token: string; readonly venceEm: number }>();

/** Token da persona pelo `admin-cli` (senha), reaproveitado até perto do vencimento: uma spec pode esperar minutos. */
export async function tokenDaPersona(username: string): Promise<string> {
  const guardado = tokens.get(username);
  if (guardado !== undefined && guardado.venceEm - FOLGA_DO_TOKEN_MS > Date.now()) {
    return guardado.token;
  }
  const resposta = await fetch(`${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username,
      password: SENHA_DAS_PERSONAS,
    }),
  });
  const json = (await resposta.json()) as { access_token?: string };
  if (json.access_token === undefined) {
    throw new Error(`Sem token para a persona ${username}: ${resposta.status}`);
  }
  tokens.set(username, { token: json.access_token, venceEm: validadeDoToken(json.access_token) });
  return json.access_token;
}

function validadeDoToken(token: string): number {
  const [, carga] = token.split('.');
  const { exp } = JSON.parse(Buffer.from(carga ?? '', 'base64url').toString('utf-8')) as { exp: number };
  return exp * 1000;
}

export function identidadeDoToken(token: string): IdentidadeDoToken {
  const [, carga] = token.split('.');
  return JSON.parse(Buffer.from(carga ?? '', 'base64url').toString('utf-8')) as IdentidadeDoToken;
}

export async function chamarApi<T = unknown>(
  username: string,
  metodo: string,
  caminho: string,
  opcoes: {
    readonly corpo?: unknown;
    readonly cabecalhos?: Record<string, string>;
  } = {},
): Promise<RespostaDaApi<T>> {
  const token = await tokenDaPersona(username);
  const cabecalhos: Record<string, string> = {
    authorization: `Bearer ${token}`,
    ...(metodo === 'GET' ? {} : { 'idempotency-key': crypto.randomUUID() }),
    ...(opcoes.corpo === undefined ? {} : { 'content-type': 'application/json' }),
    ...opcoes.cabecalhos,
  };
  const resposta = await fetch(`${API_URL}${caminho}`, {
    method: metodo,
    headers: cabecalhos,
    body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
  });
  const texto = await resposta.text();
  let corpo: unknown = texto;
  try {
    corpo = texto === '' ? null : JSON.parse(texto);
  } catch {
    // O corpo não é JSON (arquivo ou erro de proxy): segue como texto.
  }
  return { status: resposta.status, corpo: corpo as T, cabecalhos: resposta.headers };
}

interface PerfilExistente {
  readonly id: string;
  readonly nome: string;
  readonly ativo: boolean;
  readonly permissoes: readonly { readonly codigo: string }[];
}

/**
 * Garante um perfil com exatamente estas permissões: cria quando não existe e atualiza quando
 * a lista difere, para a spec poder rodar de novo sobre a mesma base.
 */
export async function garantirPerfil(
  nome: string,
  descricao: string,
  permissoes: readonly string[],
): Promise<string> {
  const existente = await acharNaListagem<PerfilExistente>(
    SEGUNDO_GESTOR_DE_ACESSOS,
    '/api/autorizacao/perfis?limit=100',
    (perfil) => perfil.nome === nome,
  );
  if (existente === undefined) {
    const criado = await chamarApi<string>(SEGUNDO_GESTOR_DE_ACESSOS, 'POST', '/api/autorizacao/perfis', {
      corpo: { nome, descricao, permissoes },
    });
    expect(criado.status, `criar o perfil "${nome}"`).toBe(201);
    return criado.corpo;
  }
  const atuais = existente.permissoes.map((p) => p.codigo).sort();
  if (JSON.stringify(atuais) !== JSON.stringify([...permissoes].sort())) {
    const atualizado = await chamarApi(SEGUNDO_GESTOR_DE_ACESSOS, 'PUT', `/api/autorizacao/perfis/${existente.id}`, {
      corpo: { id: existente.id, nome, descricao, permissoes },
    });
    expect(atualizado.status, `atualizar o perfil "${nome}"`).toBeLessThan(300);
  }
  return existente.id;
}

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
 * sensível, a proteção de dados aprova a segunda etapa. Idempotente: concessão ativa igual
 * não é pedida de novo.
 */
export async function garantirConcessao(
  beneficiario: string,
  perfilId: string,
  unidadeDoCertame: string,
): Promise<void> {
  const perfil = await acharNaListagem<{ id: string; escopo: string }>(
    SOLICITANTE_DE_PEDIDOS,
    '/api/autorizacao/perfis-para-pedido?limit=100',
    (p) => p.id === perfilId,
  );
  const unidadeId = perfil?.escopo === 'unidade' ? unidadeDoCertame : null;
  const tokenDoBeneficiario = await tokenDaPersona(beneficiario);
  const { sub, email } = identidadeDoToken(tokenDoBeneficiario);

  const ativas = await chamarApi<ConcessaoExistente[]>(
    SEGUNDO_GESTOR_DE_ACESSOS,
    'GET',
    `/api/autorizacao/concessoes?perfil=${perfilId}&situacao=ativa&limit=100`,
  );
  const jaTem = ativas.corpo.some(
    (c) => c.ativa && c.beneficiario.sub === sub && (c.escopo.unidadeId ?? null) === unidadeId,
  );
  if (jaTem) {
    return;
  }

  const solicitante = [SOLICITANTE_DE_PEDIDOS, 'isabella.figueiredo'].find((u) => u !== beneficiario) ?? SOLICITANTE_DE_PEDIDOS;
  const gestor = beneficiario === GESTOR_DE_ACESSOS ? SEGUNDO_GESTOR_DE_ACESSOS : GESTOR_DE_ACESSOS;
  const protecao = beneficiario === PROTECAO_DE_DADOS ? 'caroline.jesus' : PROTECAO_DE_DADOS;

  const pedido = await chamarApi<PedidoCriado>(solicitante, 'POST', '/api/autorizacao/pedidos-de-concessao', {
    corpo: {
      beneficiarioEmail: email,
      perfilId,
      unidadeId,
      justificativa: 'Acesso para a simulação ponta a ponta da projeção por proteção.',
    },
  });
  expect(pedido.status, `pedido de ${beneficiario}: ${JSON.stringify(pedido.corpo)}`).toBe(201);
  const base = `/api/autorizacao/pedidos-de-concessao/${pedido.corpo.id}`;
  expect((await chamarApi(beneficiario, 'POST', `${base}/aceite`)).status).toBe(200);
  const funcional = await chamarApi<PedidoCriado>(gestor, 'POST', `${base}/aprovacoes`, { corpo: {} });
  expect(funcional.status, 'aprovação funcional').toBe(200);
  if (funcional.corpo.situacao === 'aguardando_protecao_de_dados') {
    const dados = await chamarApi<PedidoCriado>(protecao, 'POST', `${base}/aprovacoes`, { corpo: {} });
    expect(dados.status, 'aprovação da proteção de dados').toBe(200);
  }
}

/**
 * Entra no app pela interface, com o login real do Keycloak, e devolve a página já autenticada.
 * O contexto é novo a cada chamada: cada persona vê só a própria sessão.
 */
export async function entrarComoPersona(
  browser: Browser,
  appBaseUrl: string,
  username: string,
  rotaProtegida = '/dashboard',
): Promise<Page> {
  // Sessão vazia: o project pode declarar o storageState do admin, e a persona precisa da própria.
  const contexto = await browser.newContext({ baseURL: appBaseUrl, storageState: { cookies: [], origins: [] } });
  const pagina = await contexto.newPage();
  await pagina.goto(rotaProtegida);
  await keycloakLogin(pagina, username, SENHA_DAS_PERSONAS, {
    expectRedirectTo: new RegExp(appBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  });
  return pagina;
}

/**
 * Mensagens do tópico lidas com o consumidor do próprio container do Kafka, do início até
 * esgotar o tempo sem mensagem nova.
 */
export function lerTopicoDoKafka(topico: string, esperaMs = 10_000): string[] {
  const saida = execFileSync(
    'docker',
    [
      'exec',
      process.env['E2E_KAFKA_CONTAINER'] ?? 'uniplus-inscricao-kafka-1',
      process.env['E2E_KAFKA_CONSUMER'] ?? '/opt/kafka/bin/kafka-console-consumer.sh',
      '--bootstrap-server',
      process.env['E2E_KAFKA_BOOTSTRAP'] ?? 'kafka:29092',
      '--topic',
      topico,
      '--from-beginning',
      '--timeout-ms',
      String(esperaMs),
    ],
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 },
  );
  return saida.split('\n').filter((linha) => linha.trim() !== '');
}

/** Unidade que administra o certame de Medicina nas bases locais (a mesma das concessões já feitas). */
export const UNIDADE_DO_CERTAME = process.env['E2E_UNIDADE_ID'] ?? '01a188d4-ac51-7d2e-b29e-4e39c693c2f1';

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
  for (const acesso of ACESSOS_DA_SIMULACAO) {
    const perfilId = await garantirPerfil(acesso.nome, `Perfil da simulação ponta a ponta: ${acesso.persona}.`, acesso.permissoes);
    await garantirConcessao(acesso.persona, perfilId, UNIDADE_DO_CERTAME);
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

/** Percorre uma listagem paginada por cursor, pelo `Link rel="next"`, até achar o item. */
export async function acharNaListagem<T>(
  username: string,
  caminho: string,
  procurado: (item: T) => boolean,
): Promise<T | undefined> {
  let proximo: string | null = caminho;
  while (proximo !== null) {
    const pagina: RespostaDaApi<T[]> = await chamarApi<T[]>(username, 'GET', proximo);
    if (!Array.isArray(pagina.corpo)) {
      throw new Error(`Listagem ${proximo} respondeu ${pagina.status}: ${JSON.stringify(pagina.corpo).slice(0, 300)}`);
    }
    const achado = pagina.corpo.find(procurado);
    if (achado !== undefined) return achado;
    const link = /<([^>]+)>;\s*rel="next"/.exec(pagina.cabecalhos.get('link') ?? '');
    proximo = link === null ? null : (link[1] ?? '').replace(/^https?:\/\/[^/]+/, '');
  }
  return undefined;
}
