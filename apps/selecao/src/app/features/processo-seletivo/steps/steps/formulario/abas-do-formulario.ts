import {
  BLOCO_COMPROVACAO_DOCUMENTAL,
  FINALIDADE_INSCRICAO,
  FINALIDADES,
  etapasEmOrdem,
  type RecusasDoConteudo,
} from '@uniplus/shared-ui/components';

import type { FormularioDaFinalidade, WizardDraft } from '../../processo-seletivo.models';
import {
  documentosDoFormulario,
  type fatosParaLerOGatilho,
} from '../../shared/documentos-exigidos';
import { fatosForaDaColetaDaInscricao } from './fatos-coletados-da-inscricao';
import {
  fatosColetadosPelasOutras,
  type FaseQueRespondeFormulario,
  fatosDaInscricaoQueOutrasExigem,
  finalidadesQueAtende,
  nomeDaFinalidade,
  sufixoDaFinalidade,
} from './formularios-por-finalidade';
import { leituraDe } from './leitura-do-formulario';
import type { ModeloOferecido } from './modelo-de-formulario';

/** Uma fase do cronograma, com o nome que o seletor mostra e o que decide a finalidade que ela atende. */
export type FaseDoCronograma = FaseQueRespondeFormulario & { readonly nome: string };

/** O que cada aba mostra além do próprio formulário: as recusas, os modelos e o resumo da aplicação. */
export interface TextosDasAbas {
  readonly recusasDaGravacao: ReadonlyMap<string, RecusasDoConteudo>;
  readonly recusasDaRemocao: ReadonlyMap<string, string>;
  readonly recusasDaAplicacao: ReadonlyMap<string, string>;
  readonly resumosDaAplicacao: ReadonlyMap<string, readonly string[]>;
  readonly modelos: ReadonlyMap<string, readonly ModeloOferecido[]>;
  readonly modeloEscolhido: ReadonlyMap<string, string>;
}

/** Como a lista de documentos do formulário nomeia o tipo de documento e lê o público de cada um. */
export interface VocabularioDosDocumentos {
  readonly fatoPorCodigo: ReturnType<typeof fatosParaLerOGatilho>;
  readonly nomeDoTipo: (id: string, nomeGuardado: string | undefined) => string;
}

/** O que o modelo de exibição das abas precisa saber do passo. */
export interface EntradaDasAbas {
  readonly formularios: readonly FormularioDaFinalidade[];
  readonly outrasFinalidades: readonly FormularioDaFinalidade[];
  /** A fase de cada formulário: as que servem à finalidade dele e a escolhida. */
  readonly fases: ReadonlyMap<
    string,
    { readonly opcoes: readonly FaseDoCronograma[]; readonly escolhida: string }
  >;
  readonly fasesDoCronograma: readonly FaseDoCronograma[];
  readonly documentos: WizardDraft['documentos'];
  readonly vocabulario: VocabularioDosDocumentos;
  /** Os fatos que a inscrição coleta: as outras finalidades os citam. */
  readonly fatosDaInscricao: readonly string[];
  readonly textos: TextosDasAbas;
}

/**
 * Uma aba por formulário, com o que o editor dela recebe. Na inscrição, o combo deixa de fora o
 * que as outras finalidades coletam, e os fatos que elas citam por negação são obrigatórios. Nas
 * outras, os fatos da inscrição são citáveis — o candidato já os respondeu — e nunca coletados de
 * novo.
 */
export function abasDoFormulario(entrada: EntradaDasAbas) {
  const { formularios, fases, vocabulario, textos } = entrada;
  const outras = entrada.outrasFinalidades;
  const finalidadesDaFase = new Map(
    entrada.fasesDoCronograma.map((fase) => [fase.codigo, finalidadesQueAtende(fase)]),
  );
  return formularios.map((formulario) => {
    const ehInscricao = formulario.finalidade === FINALIDADE_INSCRICAO;
    const sufixo = sufixoDaFinalidade(formulario.finalidade);
    const fase = fases.get(formulario.finalidade) ?? { opcoes: [], escolhida: '' };
    const recusaDaRemocao = textos.recusasDaRemocao.get(formulario.finalidade) ?? null;
    const recusaDaAplicacao = textos.recusasDaAplicacao.get(formulario.finalidade) ?? null;
    return {
      finalidade: formulario.finalidade,
      rotulo:
        FINALIDADES.find((opcao) => opcao.valor === formulario.finalidade)?.rotulo ??
        formulario.finalidade,
      nome: nomeDaFinalidade(formulario.finalidade),
      ehInscricao,
      aba: `form-aba-${sufixo}`,
      painel: `form-painel-${sufixo}`,
      idBase: `form-${sufixo}`,
      campoDaFase: `form-fase-${sufixo}`,
      conteudo: formulario.conteudo,
      fases: fase.opcoes,
      fase: fase.escolhida,
      nomeDaFase: fase.opcoes.find((opcao) => opcao.codigo === fase.escolhida)?.nome ?? null,
      recusas: textos.recusasDaGravacao.get(formulario.finalidade) ?? null,
      recusaDaRemocao,
      recusada:
        textos.recusasDaGravacao.has(formulario.finalidade) ||
        recusaDaRemocao !== null ||
        recusaDaAplicacao !== null,
      modelos: textos.modelos.get(formulario.finalidade) ?? [],
      modeloEscolhido: textos.modeloEscolhido.get(formulario.finalidade) ?? '',
      modeloOrigemCodigo: formulario.modeloOrigemCodigo ?? null,
      recusaDaAplicacao,
      resumoDaAplicacao: textos.resumosDaAplicacao.get(formulario.finalidade) ?? null,
      fatosDaInscricao: ehInscricao ? null : entrada.fatosDaInscricao,
      fatosIndisponiveis: ehInscricao
        ? fatosForaDaColetaDaInscricao(
            formulario.conteudo,
            fatosColetadosPelasOutras(formularios, FINALIDADE_INSCRICAO),
          )
        : fatosColetadosPelasOutras(formularios, formulario.finalidade),
      fatosQueExigemRespostaPorFora: ehInscricao
        ? fatosDaInscricaoQueOutrasExigem(formulario.conteudo, outras)
        : [],
      leitura: leituraDe(formulario.conteudo),
      temBlocoDocumental: etapasEmOrdem(formulario.conteudo).some(
        (etapa) => etapa.bloco === BLOCO_COMPROVACAO_DOCUMENTAL,
      ),
      documentos: documentosDoFormulario(
        entrada.documentos,
        fase.escolhida,
        formulario.finalidade,
        finalidadesDaFase.get(fase.escolhida) ?? [],
        vocabulario,
        entrada.fasesDoCronograma.map((faseDoCronograma) => faseDoCronograma.codigo),
      ),
      semFaseParaDocumentos: fase.escolhida === '',
    };
  });
}

/** Uma aba do passo, como o modelo de exibição a monta. */
export type AbaDoFormulario = ReturnType<typeof abasDoFormulario>[number];
