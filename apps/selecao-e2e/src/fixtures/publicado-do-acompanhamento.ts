import * as path from 'node:path';
import {
  aprovarCatalogoInicial,
  prepararAcessosDaSimulacao,
  SENHA_DAS_PERSONAS,
} from '@uniplus/shared-e2e';
import { listarProcessos, type ProcessoListado } from './processos-da-api';
import { rodarRoteiroDeProcesso } from './roteiro-da-api';

const NOME = 'E2E Acompanhamento — processo publicado';
const IDENTIFICADOR = 'e2e-acompanhamento-publicado';
const ROTEIRO =
  process.env['E2E_ROTEIRO_DO_PROCESSO'] ??
  path.resolve(__dirname, '../../../../../uniplus-api/scripts/roteiro-processo-teste-inscricao.sh');

export async function publicadoDoAcompanhamento(): Promise<ProcessoListado> {
  const publicados = (await listarProcessos())
    .filter((processo) => processo.status === 'publicado')
    .sort(compararProcessos);
  const existente = publicados.find((processo) => processo.nome === NOME) ?? publicados[0];
  if (existente !== undefined) return existente;
  await prepararAcessosDaSimulacao();
  await aprovarCatalogoInicial();
  return { id: await criarProcesso(), nome: NOME, status: 'publicado' };
}

function compararProcessos(primeiro: ProcessoListado, segundo: ProcessoListado): number {
  return (
    primeiro.nome.localeCompare(segundo.nome, 'pt-BR') ||
    (primeiro.id < segundo.id ? -1 : primeiro.id > segundo.id ? 1 : 0)
  );
}

function criarProcesso(): Promise<string> {
  return rodarRoteiroDeProcesso(
    ROTEIRO,
    [],
    {
      ...process.env,
      ADMIN_PASS: SENHA_DAS_PERSONAS,
      IDENTIFICADOR_PROCESSO: IDENTIFICADOR,
      NOME_PROCESSO: NOME,
      MODELO_INSCRICAO_ID: '5e3d0006-0000-7000-8000-000000000004',
    },
    600_000,
  );
}
