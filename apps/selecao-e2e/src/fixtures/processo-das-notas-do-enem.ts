import { readFile } from 'node:fs/promises';
import {
  API_URL,
  chamarApi,
  aprovarCatalogoInicial,
  prepararAcessosDaSimulacao,
  resetPasswords,
  SENHA_DAS_PERSONAS,
} from '@uniplus/shared-e2e';
import { ARQUIVO_DE_PESSOAS } from './inscricoes-reais';
import { inscricoesDoProcesso, processosPublicadosComNome } from './processos-da-api';
import { caminhoDoRoteiro, rodarRoteiroDeProcesso } from './roteiro-da-api';

/**
 * O processo das notas do ENEM da spec contra a API real: divulgado, com a etapa de nota do ENEM,
 * as edições declaradas e as inscrições enviadas das personas fictícias do portal. Quem o monta é
 * o roteiro `roteiro-processo-teste-notas-do-enem.sh` da uniplus-api, que a spec localiza em
 * `E2E_ROTEIRO_DAS_NOTAS_DO_ENEM`.
 *
 * O envio e a importação só existem depois do encerramento das inscrições, e a inscrição só
 * aceita envio com o período aberto. O roteiro abre o período por um mês; aqui ele encerra minutos
 * depois da publicação, e a fixture espera o encerramento. O roteiro não é alterado: a chamada que
 * grava o cronograma é interceptada e só o fim da fase de inscrição muda.
 *
 * O banco é compartilhado, então o processo tem nome próprio, com o prefixo `E2E`, e é reaproveitado
 * quando já existe publicado e com todas as inscrições: o roteiro inscreve dezenas de personas e leva minutos.
 */
const NOME_DO_PROCESSO = 'E2E Processo Seletivo Medicina 2027 (notas do ENEM)';

/** Quanto o período de inscrição dura a partir da gravação do cronograma: cabem a publicação e as 56 inscrições. */
const MINUTOS_DE_INSCRICAO_ABERTA = 8;

/**
 * Carrega as funções do roteiro, encurta o período de inscrição na gravação do cronograma e roda o
 * roteiro. O fuso é o da instituição, como o roteiro o escreve.
 */
const EXECUCAO_COM_INSCRICAO_CURTA = `set -euo pipefail
source "$1"
eval "$(declare -f api | sed '1s/^api /api_do_roteiro /')"
api() {
    if [ "$1" = PUT ] && [[ "$2" == */cronograma-fases ]]; then
        local fim_curto
        fim_curto=$(TZ=America/Belem date -d "+${MINUTOS_DE_INSCRICAO_ABERTA} minutes" +%Y-%m-%dT%H:%M:%S-03:00)
        set -- "$1" "$2" "$(jq -c --arg fim "$fim_curto" '.[0].fim = $fim' <<< "$3")"
    fi
    api_do_roteiro "$@"
}
main`;

interface Pessoa {
  readonly username: string;
  readonly perfil: string;
}

/** O roteiro entra como cada candidata pelo login de senha; a persona do portal nasce sem senha. */
async function definirSenhaDasCandidatas(): Promise<void> {
  const pessoas = JSON.parse(await readFile(ARQUIVO_DE_PESSOAS, 'utf-8')) as Pessoa[];
  await resetPasswords(
    pessoas
      .filter((pessoa) => pessoa.perfil === 'candidato')
      .map((pessoa) => ({ username: pessoa.username, password: SENHA_DAS_PERSONAS })),
  );
}

/** O roteiro inscreve as 56 candidatas do portal (todas menos uma); menos que isso é execução interrompida. */
const INSCRICOES_DO_ROTEIRO = 56;

async function acharCompleto(): Promise<string | undefined> {
  for (const processo of await processosPublicadosComNome(NOME_DO_PROCESSO)) {
    const feitoAqui =
      (await fimDasInscricoes(processo.id)) < Date.now() + 2 * MINUTOS_DE_INSCRICAO_ABERTA * 60_000;
    if (feitoAqui && (await inscricoesDoProcesso(processo.id)) >= INSCRICOES_DO_ROTEIRO) {
      return processo.id;
    }
  }
  return undefined;
}

async function fimDasInscricoes(processoId: string): Promise<number> {
  const resposta = await fetch(`${API_URL}/api/selecao/certames/${processoId}`);
  const certame = (await resposta.json()) as { periodo?: { fim?: string } };
  const fim = Date.parse(certame.periodo?.fim ?? '');
  if (Number.isNaN(fim)) {
    throw new Error(
      `O certame ${processoId} não publica o fim do período de inscrição (${resposta.status}).`,
    );
  }
  return fim;
}

/** Espera o fim do período de inscrição que o certame divulgado publica; sem espera se já passou. */
async function aguardarEncerramentoDasInscricoes(processoId: string): Promise<void> {
  const falta = (await fimDasInscricoes(processoId)) - Date.now() + 2_000;
  if (falta > 0) {
    await new Promise((resolver) => setTimeout(resolver, falta));
  }
}

function ambienteDoProcessoDasNotas(identificador: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ADMIN_PASS: SENHA_DAS_PERSONAS,
    IDENTIFICADOR_PROCESSO: identificador,
    NOME_PROCESSO: `${NOME_DO_PROCESSO} ${identificador}`,
    FAKE_PEOPLE: ARQUIVO_DE_PESSOAS,
  };
}

async function criarProcessoDasNotasDoEnem(): Promise<string> {
  await prepararAcessosDaSimulacao();
  await aprovarCatalogoInicial();
  await definirSenhaDasCandidatas();
  const identificador = `e2e-psm-2027-notas-do-enem-${Date.now()}`;
  return rodarRoteiroDeProcesso(
    'bash',
    ['-c', EXECUCAO_COM_INSCRICAO_CURTA, 'bash', caminhoDoRoteiro('E2E_ROTEIRO_DAS_NOTAS_DO_ENEM')],
    ambienteDoProcessoDasNotas(identificador),
    1_500_000,
  );
}

export async function processoDasNotasDoEnem(): Promise<string> {
  caminhoDoRoteiro('E2E_ROTEIRO_DAS_NOTAS_DO_ENEM');
  const processo = (await acharCompleto()) ?? (await criarProcessoDasNotasDoEnem());
  await aguardarEncerramentoDasInscricoes(processo);
  return processo;
}

export interface LoteDeNotas {
  readonly id: string;
  readonly arquivoHash: string;
  readonly importadoEm: string;
  readonly vigente: boolean;
  readonly totalDeLinhas: number;
}

async function etapaDeNotasDoEnem(processoId: string): Promise<string> {
  const processo = await chamarApi<{ etapas: { id: string }[] }>(
    'diogo.souza',
    'GET',
    `/api/selecao/processos-seletivos/${processoId}`,
  );
  const etapaId = processo.corpo.etapas[0]?.id;
  if (etapaId === undefined) {
    throw new Error(`O processo ${processoId} não tem etapa de nota do ENEM.`);
  }
  return etapaId;
}

function validarLotesDeNotas(
  processoId: string,
  lotes: { corpo: LoteDeNotas[]; status: number },
): void {
  if (!Array.isArray(lotes.corpo)) {
    throw new Error(`Listar os lotes de notas de ${processoId} respondeu ${lotes.status}.`);
  }
}

/** Os lotes de notas da edição, do mais recente para o mais antigo, como a API os lista. */
export async function lotesDeNotasDoEnem(
  processoId: string,
  edicao: string,
): Promise<readonly LoteDeNotas[]> {
  const etapaId = await etapaDeNotasDoEnem(processoId);
  const lotes = await chamarApi<LoteDeNotas[]>(
    'diogo.souza',
    'GET',
    `/api/selecao/processos-seletivos/${processoId}/etapas/${etapaId}/edicoes-do-enem/${edicao}/lotes-de-notas`,
    { cabecalhos: { accept: 'application/vnd.uniplus.lote-de-notas-do-enem.v1+json' } },
  );
  validarLotesDeNotas(processoId, lotes);
  return lotes.corpo;
}
