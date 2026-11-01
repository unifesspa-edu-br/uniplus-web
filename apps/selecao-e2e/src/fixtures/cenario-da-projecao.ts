import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import {
  aprovarCatalogoInicial,
  chamarApi,
  prepararAcessosDaSimulacao,
  SENHA_DAS_PERSONAS,
} from '@uniplus/shared-e2e';
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
const NOME_SEM_INSCRICAO = `Processo Seletivo Medicina 2027 (simulação da projeção, ${GERACAO})`;
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
  const lista = await chamarApi<{ id: string; nome: string; status: string }[]>(
    'manoel.aparicio',
    'GET',
    '/api/selecao/processos-seletivos?limit=100',
  );
  return lista.corpo.find((processo) => processo.nome === nome && processo.status === 'publicado')?.id;
}

async function garantirProcesso(nome: string, identificador: string, modelo: string): Promise<string> {
  const existente = await acharProcesso(nome);
  if (existente !== undefined) {
    return existente;
  }
  execFileSync(ROTEIRO, [], {
    env: {
      ...process.env,
      ADMIN_USER: 'manoel.aparicio',
      ADMIN_PASS: SENHA_DAS_PERSONAS,
      IDENTIFICADOR_PROCESSO: identificador,
      NOME_PROCESSO: nome,
      MODELO_INSCRICAO_ID: modelo,
    },
    stdio: 'ignore',
    timeout: 600_000,
  });
  const criado = await acharProcesso(nome);
  if (criado === undefined) {
    throw new Error(`O roteiro não criou o processo "${nome}".`);
  }
  return criado;
}

let guardado: Promise<CenarioDaProjecao> | undefined;

export function cenarioDaProjecao(): Promise<CenarioDaProjecao> {
  guardado ??= (async () => {
    await prepararAcessosDaSimulacao();
    await aprovarCatalogoInicial();
    const processoId = await garantirProcesso(NOME_COM_PROVA, `psm-2027-projecao-prova-${GERACAO}`, MODELO_COM_PROVA);
    const processoSemInscricaoId = await garantirProcesso(
      NOME_SEM_INSCRICAO,
      `psm-2027-projecao3-${GERACAO}`,
      MODELO_SEM_PROVA,
    );
    const fernanda = await inscreverPersona(processoId, 'fernanda.drumond', true);
    const erick = await inscreverPersona(processoId, 'erick.ramos', false);
    return { processoId, nomeDoProcesso: NOME_COM_PROVA, processoSemInscricaoId, fernanda, erick };
  })();
  return guardado;
}

const NOME_DO_RASCUNHO = 'Processo Seletivo Medicina 2027 (projeção, rascunho)';

/** Cria, com as funções do roteiro, um processo em rascunho só com o cronograma de fases. */
const SNIPPET_DO_RASCUNHO = `set -euo pipefail
export ADMIN_USER=manoel.aparicio ADMIN_PASS="$4" IDENTIFICADOR_PROCESSO="$1" NOME_PROCESSO="$2"
source "$3"
obter_token; setup_publicacoes; setup_organizacao; setup_configuracao
criar_processo; definir_cronograma_fases`;

/** O processo em rascunho onde a configuração das exigências é testada, reaproveitado se já existe. */
export async function rascunhoParaConfiguracao(): Promise<{ readonly processoId: string; readonly faseHabilitacaoId: string }> {
  const lista = await chamarApi<{ id: string; nome: string; status: string }[]>(
    'manoel.aparicio',
    'GET',
    '/api/selecao/processos-seletivos?limit=100',
  );
  let id = lista.corpo.find((p) => p.nome === NOME_DO_RASCUNHO && p.status === 'rascunho')?.id;
  if (id === undefined) {
    execFileSync('bash', ['-c', SNIPPET_DO_RASCUNHO, 'bash', `psm-2027-projecao-rascunho-${Date.now()}`, NOME_DO_RASCUNHO, ROTEIRO, SENHA_DAS_PERSONAS], {
      stdio: 'ignore',
      timeout: 600_000,
    });
    const nova = await chamarApi<{ id: string; nome: string; status: string }[]>(
      'manoel.aparicio',
      'GET',
      '/api/selecao/processos-seletivos?limit=100',
    );
    id = nova.corpo.find((p) => p.nome === NOME_DO_RASCUNHO && p.status === 'rascunho')?.id;
  }
  if (id === undefined) {
    throw new Error('Não consegui criar o processo em rascunho.');
  }
  const processo = await chamarApi<{ cronogramaFases: { id: string; codigo: string }[] }>(
    'manoel.aparicio',
    'GET',
    `/api/selecao/processos-seletivos/${id}`,
  );
  const fase = processo.corpo.cronogramaFases.find((f) => f.codigo === 'HABILITACAO');
  if (fase === undefined) {
    throw new Error('O rascunho não tem a fase de habilitação.');
  }
  return { processoId: id, faseHabilitacaoId: fase.id };
}
