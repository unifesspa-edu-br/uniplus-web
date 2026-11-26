import { TestBed } from '@angular/core/testing';
import {
  ClassificacaoDeProtecaoCodigo,
  EscopoFatoCodigo,
  HipoteseLegalTratamentoCodigo,
  OperadorCodigo,
  type FatoCandidatoComOperadores,
} from '@uniplus/shared-data/configuracao';
import {
  SituacaoDoProcessoSeletivoCodigo,
  type ProcessoSeletivoDto,
  type MotivoDeDecisaoDoProcessoDto,
  type MotivoDeDecisaoDto,
} from '@uniplus/shared-data/selecao';
import { codigoComRotulo } from '@uniplus/shared-testing/contrato';

import type { RegraDeHomologacao } from '../../../modelos/homologacao.models';
import type { FaseDoCronograma } from '../../../processo-seletivo.models';
import {
  DADO_OPCAO,
  ORIGEM_DECLARADA,
  VALOR_UNICO,
} from '../../../shared/valores-do-catalogo.testing';
import { CatalogoDeFatos } from '../../cronograma/catalogos/catalogo-de-fatos.service';
import { fase, ID_AVALIACAO, PROCESSO_ID } from '../fase.testing';
import type { ContextoDaFase } from '../fase-passo.testing';
import {
  escolhidoPeloProcesso,
  esperar,
  ROTA_DA_ESCOLHA_DO_PROCESSO,
  ROTA_DO_CADASTRO,
  SEM_RESULTADO_NO_CADASTRO,
} from '../motivos/motivos-da-fase.testing';

/** O identificador de um elemento da fase que os cenários abrem. */
export const idDe = (sufixo: string): string => `fase-AVALIACAO-${sufixo}`;

export const EDICOES_DO_PROCESSO = ['2024', '2025', '2026'];

/** O fato cujas opções são as edições do exame que o processo declara. */
const FATO_DA_EDICAO: FatoCandidatoComOperadores = {
  id: '01960000-0000-7000-0000-0000000000e2',
  codigo: 'EDICAO_ENEM',
  nome: 'Edição do ENEM',
  descricao: 'Edição do exame que a inscrição usa.',
  dominio: DADO_OPCAO,
  origem: ORIGEM_DECLARADA,
  cardinalidade: VALOR_UNICO,
  valoresDominio: null,
  pontoResolucao: 'INSCRICAO',
  binding: 'CAMPO_INSCRICAO:edicaoDoEnem',
  valoresDominioDeclarados: null,
  fonteValores: null,
  formato: null,
  ativo: true,
  escopo: codigoComRotulo(EscopoFatoCodigo.CANDIDATO, 'Candidato'),
  classificacaoProtecao: codigoComRotulo(ClassificacaoDeProtecaoCodigo.PESSOAL, 'Pessoal'),
  hipoteseLegal: codigoComRotulo(
    HipoteseLegalTratamentoCodigo.EXECUCAO_POLITICAS_PUBLICAS,
    'Execução de políticas públicas',
  ),
  finalidadeTratamento: 'Conferir a edição do exame escolhida na inscrição.',
  protecaoAprovada: true,
  operadoresAdmitidos: [{ codigo: OperadorCodigo.IGUAL, rotulo: 'é' }],
};

/** Uma fase que declara a decisão de homologar e publica o resultado preliminar e o definitivo. */
export function umaFaseQueHomologa(parcial: Partial<FaseDoCronograma> = {}): FaseDoCronograma {
  return fase({
    tiposDeDecisao: ['HOMOLOGACAO_DAS_INSCRICOES'],
    produtos: [
      { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' },
      { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' },
      { atoCodigo: 'COMUNICADO', papel: null },
    ],
    ...parcial,
  });
}

/** A condição do retorno do INEP de uma edição, com o enquadramento da edição, como a Medicina a monta. */
export function aAlternativaDaEdicao(ano: number, motivo: string | null = null) {
  return {
    condicoes: [
      {
        tipo: 'RESULTADO_NO_RETORNO_DO_INEP',
        edicaoDoExame: ano,
        motivoDesfavoravelCodigo: motivo,
        enquadramento: [{ clausula: 1, fato: 'EDICAO_ENEM', operador: 'IGUAL', valor: `"${ano}"` }],
      },
    ],
  };
}

export function umaRegra(parcial: Partial<RegraDeHomologacao> = {}): RegraDeHomologacao {
  return { resultadoAtoCodigo: 'RESULTADO_PRELIMINAR', alternativas: [], ...parcial };
}

export interface OpcoesDaTela {
  readonly edicoes?: readonly string[];
  readonly cadastro?: readonly MotivoDeDecisaoDto[];
  readonly escolhidos?: readonly MotivoDeDecisaoDoProcessoDto[];
  readonly emConsulta?: boolean;
}

/**
 * Abre a fase com o que o servidor tem: as edições declaradas na Fórmula, o cadastro de motivos, os
 * motivos que a fase escolheu e o catálogo de fatos com a edição do exame.
 */
export async function abrirAFase(
  tela: ContextoDaFase,
  daFase: FaseDoCronograma,
  opcoes: OpcoesDaTela = {},
): Promise<void> {
  declararOProcesso(tela.store, opcoes);
  tela.comCronograma(daFase);
  responderAosMotivos(tela.controller, opcoes);
  await esperar();
  if (opcoes.emConsulta === true) tornarEmConsulta(tela.store);
  tela.detectar();
}

/** O processo com as edições do ENEM que a Fórmula declara e o fato da edição no catálogo. */
function declararOProcesso(store: ContextoDaFase['store'], opcoes: OpcoesDaTela): void {
  store.processoSeletivoId.set(PROCESSO_ID);
  store.patchObjectSection('classificacao', {
    edicoesEnem: [...(opcoes.edicoes ?? EDICOES_DO_PROCESSO)],
  });
  TestBed.inject(CatalogoDeFatos).fatos.set([FATO_DA_EDICAO]);
}

/** O cadastro de motivos e a escolha do processo, que a seção de motivos lê ao abrir a fase. */
function responderAosMotivos(controller: ContextoDaFase['controller'], opcoes: OpcoesDaTela): void {
  controller
    .expectOne((pedido) => pedido.url === ROTA_DO_CADASTRO)
    .flush(opcoes.cadastro ?? [SEM_RESULTADO_NO_CADASTRO]);
  controller
    .expectOne(ROTA_DA_ESCOLHA_DO_PROCESSO)
    .flush(opcoes.escolhidos ?? [escolhidoPeloProcesso(SEM_RESULTADO_NO_CADASTRO, ID_AVALIACAO)]);
}

function tornarEmConsulta(store: ContextoDaFase['store']): void {
  store.remoteSnapshot.set({
    situacao: {
      codigo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
      rotulo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
    },
  } as unknown as ProcessoSeletivoDto);
}

/** O elemento da seção, pelo sufixo do identificador. */
export function elementoDe<T extends HTMLElement = HTMLElement>(
  nativo: HTMLElement,
  sufixo: string,
): T {
  const elemento = nativo.querySelector<T>(`#${idDe(sufixo)}`);
  if (elemento === null) throw new Error(`O elemento ${sufixo} não está na tela.`);
  return elemento;
}

export function selecionar(elemento: HTMLSelectElement, valor: string): void {
  elemento.value = valor;
  elemento.dispatchEvent(new Event('change'));
}
