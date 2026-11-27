import {
  aprovarCatalogoInicial,
  chamarApi,
  OPERADOR_DO_ROTEIRO,
  prepararAcessosDaSimulacao,
  SENHA_DAS_PERSONAS,
} from '@uniplus/shared-e2e';
import {
  inscricoesDoProcesso,
  listarProcessos,
  processosPublicadosComNome,
} from './processos-da-api';
import { caminhoDoRoteiro, rodarRoteiroDeProcesso } from './roteiro-da-api';
import { inscreverPersona, type InscricaoCriada } from './inscricoes-reais';

/**
 * O cenário que as specs da projeção por proteção compartilham, montado pela API e pelo caminho
 * do candidato, e reaproveitado quando já existe: o catálogo aprovado, os perfis e as concessões
 * das personas, dois processos publicados de Medicina 2027 (um com prova, que pede laudo, e outro
 * sem inscrição) e as inscrições enviadas de Fernanda (com laudo) e Erick.
 *
 * O processo nasce do roteiro `roteiro-processo-teste-inscricao.sh` da uniplus-api, que a spec
 * localiza em `E2E_ROTEIRO_DO_PROCESSO`.
 */

/**
 * O processo congela a classificação de proteção de cada fato ao ser publicado. A geração no nome
 * garante que o cenário nasça com o catálogo vigente: reaproveitar um processo publicado antes de
 * uma reclassificação devolveria respostas de outra classe que a do catálogo que as specs leem.
 */
const GERACAO = 'v2';
const NOME_COM_PROVA = `Processo Seletivo Medicina 2027 (simulação da projeção, com prova, ${GERACAO})`;
const NOME_SEM_INSCRICAO = 'E2E Processo Seletivo Medicina 2027 (sem inscrição)';
const MODELO_COM_PROVA = '5e3d0006-0000-7000-8000-000000000003';
const MODELO_SEM_PROVA = '5e3d0006-0000-7000-8000-000000000004';

export interface CenarioDaProjecao {
  readonly processoId: string;
  readonly nomeDoProcesso: string;
  readonly processoSemInscricaoId: string;
  readonly fernanda: InscricaoCriada;
  readonly erick: InscricaoCriada;
}

async function acharProcesso(nome: string): Promise<string | undefined> {
  return (await listarProcessos()).find(
    (processo) => processo.nome === nome && processo.situacao.codigo === 'PUBLICADO',
  )?.id;
}

async function garantirProcesso(
  nome: string,
  identificador: string,
  modelo: string,
): Promise<string> {
  const existente = await acharProcesso(nome);
  if (existente !== undefined) return existente;
  return rodarRoteiroDeProcesso(
    caminhoDoRoteiro('E2E_ROTEIRO_DO_PROCESSO'),
    [],
    ambienteDoProcesso(nome, identificador, modelo),
    600_000,
  );
}

function ambienteDoProcesso(
  nome: string,
  identificador: string,
  modelo: string,
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ADMIN_PASS: SENHA_DAS_PERSONAS,
    IDENTIFICADOR_PROCESSO: identificador,
    NOME_PROCESSO: nome,
    MODELO_INSCRICAO_ID: modelo,
  };
}

/**
 * Um processo publicado que nenhuma inscrição alcançou. O banco é compartilhado, então o estado
 * "sem inscrição" não se herda: o processo de uma execução anterior só é reaproveitado se a API
 * confirma que continua vazio; senão nasce outro, com identificador único.
 */
async function processoSemInscricao(): Promise<string> {
  const candidatos = await processosPublicadosComNome(NOME_SEM_INSCRICAO);
  for (const candidato of candidatos) {
    if ((await inscricoesDoProcesso(candidato.id)) === 0) {
      return candidato.id;
    }
  }
  const identificador = `e2e-sem-inscricao-${Date.now()}`;
  return garantirProcesso(
    `${NOME_SEM_INSCRICAO} ${identificador}`,
    identificador,
    MODELO_SEM_PROVA,
  );
}

let guardado: Promise<CenarioDaProjecao> | undefined;

export function cenarioDaProjecao(): Promise<CenarioDaProjecao> {
  caminhoDoRoteiro('E2E_ROTEIRO_DO_PROCESSO');
  guardado ??= prepararCenarioDaProjecao();
  return guardado;
}

async function prepararCenarioDaProjecao(): Promise<CenarioDaProjecao> {
  await prepararAcessosDaSimulacao();
  await aprovarCatalogoInicial();
  const processoId = await garantirProcesso(
    NOME_COM_PROVA,
    `psm-2027-projecao-prova-${GERACAO}`,
    MODELO_COM_PROVA,
  );
  const processoSemInscricaoId = await processoSemInscricao();
  const fernanda = await inscreverPersona(processoId, 'fernanda.drumond', true);
  const erick = await inscreverPersona(processoId, 'erick.ramos', false);
  return { processoId, nomeDoProcesso: NOME_COM_PROVA, processoSemInscricaoId, fernanda, erick };
}

const NOME_DO_RASCUNHO = 'Processo Seletivo Medicina 2027 (projeção, rascunho)';

/** Cria, com as funções do roteiro, um processo em rascunho só com o cronograma de fases. */
const SNIPPET_DO_RASCUNHO = `set -euo pipefail
export ADMIN_PASS="$4" IDENTIFICADOR_PROCESSO="$1" NOME_PROCESSO="$2"
source "$3"
obter_token; setup_publicacoes; setup_organizacao; setup_configuracao
criar_processo; definir_cronograma_fases
echo "PROCESSO_ID=$PROCESSO_ID"`;

/**
 * O cadastro até o cronograma, sem os formulários nem os documentos exigidos: com vagas, opções de
 * curso, edições do ENEM e motivos da homologação, o assistente deixa gravar o Cronograma pela tela.
 */
const SNIPPET_DO_RASCUNHO_PARA_A_TELA = `set -euo pipefail
export ADMIN_PASS="$4" IDENTIFICADOR_PROCESSO="$1" NOME_PROCESSO="$2"
source "$3"
obter_token; setup_publicacoes; setup_organizacao; setup_configuracao
criar_processo; conferir_periodo_da_inscricao
definir_algoritmo_contagem_prazo; definir_atendimento_especializado
definir_distribuicao_vagas; definir_opcoes_de_curso; definir_cascata_remanejamento
definir_fada; definir_criterios_desempate; definir_classificacao
definir_edicoes_enem; definir_taxa_inscricao
definir_cronograma_fases; escolher_motivo_da_homologacao
echo "PROCESSO_ID=$PROCESSO_ID"`;

/** O processo em rascunho onde a configuração das exigências é testada, reaproveitado se já existe. */
export async function rascunhoParaConfiguracao(): Promise<{
  readonly processoId: string;
  readonly faseHabilitacaoId: string;
}> {
  caminhoDoRoteiro('E2E_ROTEIRO_DO_PROCESSO');
  const id = await garantirRascunho();
  const faseHabilitacaoId = await buscarFaseDeHabilitacao(id);
  return { processoId: id, faseHabilitacaoId };
}

async function garantirRascunho(): Promise<string> {
  const existente = (await listarProcessos()).find(
    (p) => p.nome === NOME_DO_RASCUNHO && p.situacao.codigo === 'RASCUNHO',
  );
  return existente?.id ?? criarRascunho();
}

function criarRascunho(
  nome: string = NOME_DO_RASCUNHO,
  snippet: string = SNIPPET_DO_RASCUNHO,
): Promise<string> {
  const argumentos = [
    '-c',
    snippet,
    'bash',
    `psm-2027-projecao-rascunho-${Date.now()}`,
    nome,
    caminhoDoRoteiro('E2E_ROTEIRO_DO_PROCESSO'),
    SENHA_DAS_PERSONAS,
  ];
  return rodarRoteiroDeProcesso('bash', argumentos, process.env, 600_000);
}

/**
 * Um processo em rascunho que nasce agora, só com o cronograma de fases e nenhum formulário nem
 * documento exigido. Serve às specs que gravam esses dois conjuntos e não podem herdar o estado
 * de outra execução.
 */
export async function novoRascunhoComAFaseDeInscricao(nome: string): Promise<{
  readonly processoId: string;
  readonly faseDeInscricaoId: string;
}> {
  caminhoDoRoteiro('E2E_ROTEIRO_DO_PROCESSO');
  const processoId = await criarRascunho(nome);
  return { processoId, faseDeInscricaoId: await buscarFase(processoId, 'INSCRICAO') };
}

/** Como `novoRascunhoComAFaseDeInscricao`, mas com o cadastro que deixa o Cronograma gravar pela tela. */
export async function novoRascunhoParaATela(nome: string): Promise<{
  readonly processoId: string;
  readonly faseDeInscricaoId: string;
}> {
  caminhoDoRoteiro('E2E_ROTEIRO_DO_PROCESSO');
  const processoId = await criarRascunho(nome, SNIPPET_DO_RASCUNHO_PARA_A_TELA);
  return { processoId, faseDeInscricaoId: await buscarFase(processoId, 'INSCRICAO') };
}

function buscarFaseDeHabilitacao(id: string): Promise<string> {
  return buscarFase(id, 'HABILITACAO');
}

async function buscarFase(id: string, codigoDaFase: string): Promise<string> {
  const processo = await chamarApi<{ cronogramaFases?: { id: string; codigo: string }[] }>(
    OPERADOR_DO_ROTEIRO,
    'GET',
    `/api/selecao/processos-seletivos/${id}`,
  );
  if (processo.status !== 200 || processo.corpo.cronogramaFases === undefined) {
    throw erroAoLerCronograma(id, processo.status, processo.corpo);
  }
  const fase = processo.corpo.cronogramaFases.find((f) => f.codigo === codigoDaFase);
  if (fase === undefined) {
    throw new Error(`O rascunho não tem a fase ${codigoDaFase}.`);
  }
  return fase.id;
}

function erroAoLerCronograma(id: string, status: number, corpo: unknown): Error {
  return new Error(
    `Ler o processo ${id} como ${OPERADOR_DO_ROTEIRO} respondeu ${status} sem cronogramaFases: ${JSON.stringify(corpo).slice(0, 300)}`,
  );
}
