import * as path from 'node:path';
import {
  aprovarCatalogoInicial,
  chamarApi,
  OPERADOR_DO_ROTEIRO,
  prepararAcessosDaSimulacao,
  SENHA_DAS_PERSONAS,
} from '@uniplus/shared-e2e';
import { inscricoesDoProcesso, listarProcessos, processosPublicadosComNome } from './processos-da-api';
import { rodarRoteiroDeProcesso } from './roteiro-da-api';
import { inscreverPersona, type InscricaoCriada } from './inscricoes-reais';

/**
 * O cenário que as specs da projeção por proteção compartilham, montado pela API e pelo caminho
 * do candidato, e reaproveitado quando já existe: o catálogo aprovado, os perfis e as concessões
 * das personas, dois processos publicados de Medicina 2027 (um com prova, que pede laudo, e outro
 * sem inscrição) e as inscrições enviadas de Fernanda (com laudo) e Erick.
 *
 * O processo nasce do roteiro `roteiro-processo-teste-inscricao.sh` da uniplus-api, que a spec
 * localiza em `E2E_ROTEIRO_DO_PROCESSO` (padrão: o checkout irmão `uniplus-api`).
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

const ROTEIRO =
  process.env['E2E_ROTEIRO_DO_PROCESSO'] ??
  path.resolve(__dirname, '../../../../../uniplus-api/scripts/roteiro-processo-teste-inscricao.sh');

export interface CenarioDaProjecao {
  readonly processoId: string;
  readonly nomeDoProcesso: string;
  readonly processoSemInscricaoId: string;
  readonly fernanda: InscricaoCriada;
  readonly erick: InscricaoCriada;
}

async function acharProcesso(nome: string): Promise<string | undefined> {
  return (await listarProcessos()).find((processo) => processo.nome === nome && processo.status === 'publicado')?.id;
}

async function garantirProcesso(nome: string, identificador: string, modelo: string): Promise<string> {
  const existente = await acharProcesso(nome);
  if (existente !== undefined) {
    return existente;
  }
  return await rodarRoteiroDeProcesso(
    ROTEIRO,
    [],
    {
      ...process.env,
      ADMIN_PASS: SENHA_DAS_PERSONAS,
      IDENTIFICADOR_PROCESSO: identificador,
      NOME_PROCESSO: nome,
      MODELO_INSCRICAO_ID: modelo,
    },
    600_000,
  );
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
  return garantirProcesso(`${NOME_SEM_INSCRICAO} ${identificador}`, identificador, MODELO_SEM_PROVA);
}

let guardado: Promise<CenarioDaProjecao> | undefined;

export function cenarioDaProjecao(): Promise<CenarioDaProjecao> {
  guardado ??= (async () => {
    await prepararAcessosDaSimulacao();
    await aprovarCatalogoInicial();
    const processoId = await garantirProcesso(NOME_COM_PROVA, `psm-2027-projecao-prova-${GERACAO}`, MODELO_COM_PROVA);
    const processoSemInscricaoId = await processoSemInscricao();
    const fernanda = await inscreverPersona(processoId, 'fernanda.drumond', true);
    const erick = await inscreverPersona(processoId, 'erick.ramos', false);
    return { processoId, nomeDoProcesso: NOME_COM_PROVA, processoSemInscricaoId, fernanda, erick };
  })();
  return guardado;
}

const NOME_DO_RASCUNHO = 'Processo Seletivo Medicina 2027 (projeção, rascunho)';

/** Cria, com as funções do roteiro, um processo em rascunho só com o cronograma de fases. */
const SNIPPET_DO_RASCUNHO = `set -euo pipefail
export ADMIN_PASS="$4" IDENTIFICADOR_PROCESSO="$1" NOME_PROCESSO="$2"
source "$3"
obter_token; setup_publicacoes; setup_organizacao; setup_configuracao
criar_processo; definir_cronograma_fases
echo "PROCESSO_ID=$PROCESSO_ID"`;

/** O processo em rascunho onde a configuração das exigências é testada, reaproveitado se já existe. */
export async function rascunhoParaConfiguracao(): Promise<{ readonly processoId: string; readonly faseHabilitacaoId: string }> {
  const id =
    (await listarProcessos()).find((p) => p.nome === NOME_DO_RASCUNHO && p.status === 'rascunho')?.id ??
    (await rodarRoteiroDeProcesso(
      'bash',
      ['-c', SNIPPET_DO_RASCUNHO, 'bash', `psm-2027-projecao-rascunho-${Date.now()}`, NOME_DO_RASCUNHO, ROTEIRO, SENHA_DAS_PERSONAS],
      process.env,
      600_000,
    ));
  const processo = await chamarApi<{ cronogramaFases?: { id: string; codigo: string }[] }>(
    OPERADOR_DO_ROTEIRO,
    'GET',
    `/api/selecao/processos-seletivos/${id}`,
  );
  if (processo.status !== 200 || processo.corpo.cronogramaFases === undefined) {
    throw new Error(
      `Ler o processo ${id} como ${OPERADOR_DO_ROTEIRO} respondeu ${processo.status} sem cronogramaFases: ${JSON.stringify(processo.corpo).slice(0, 300)}`,
    );
  }
  const fase = processo.corpo.cronogramaFases.find((f) => f.codigo === 'HABILITACAO');
  if (fase === undefined) {
    throw new Error('O rascunho não tem a fase de habilitação.');
  }
  return { processoId: id, faseHabilitacaoId: fase.id };
}
