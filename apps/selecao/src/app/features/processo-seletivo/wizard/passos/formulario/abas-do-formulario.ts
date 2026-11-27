import {
  BLOCO_COMPROVACAO_DOCUMENTAL,
  FINALIDADE_INSCRICAO,
  paginasEmOrdem,
  type RecusasDoConteudo,
} from '@uniplus/shared-inscricao/formulario';

import type { FormularioDoProcessoNoRascunho, WizardDraft } from '../../processo-seletivo.models';
import {
  documentosDoFormulario,
  type VocabularioDosDocumentos,
} from '../../shared/documentos-exigidos';
import { fatosForaDaColetaDaInscricao } from './fatos-coletados-da-inscricao';
import {
  emOrdemDoCronograma,
  fatosColetadosPelasOutras,
  fatosDaInscricaoQueOutrosExigem,
  rotuloDoFormulario,
} from './formularios-do-rascunho';
import { leituraDe } from './leitura-do-formulario';
import { modelosQueServem, type ModeloOferecido } from './modelo-de-formulario';
import {
  consequenciaCabe,
  ehDaInscricao,
  obrigatoriedadeNaFase,
  type FaseQueRespondeFormulario,
} from './obrigatoriedade-na-fase';

/** O que o editor compartilhado recebe como finalidade de um formulário que não é a inscrição. */
const OUTRO_FORMULARIO = 'OUTRO_FORMULARIO';

/** Uma fase do cronograma, com o nome que o seletor mostra e as marcas que dizem o que ela é. */
export type FaseDoCronograma = FaseQueRespondeFormulario & { readonly nome: string };

/** O que cada aba mostra além do próprio formulário: as recusas, os modelos e o resumo da aplicação. */
export interface TextosDasAbas {
  readonly recusasDaGravacao: ReadonlyMap<string, RecusasDoConteudo>;
  readonly recusasDaRemocao: ReadonlyMap<string, string>;
  readonly recusasDaAplicacao: ReadonlyMap<string, string>;
  readonly resumosDaAplicacao: ReadonlyMap<string, readonly string[]>;
  readonly modelos: readonly ModeloOferecido[];
  readonly modeloEscolhido: ReadonlyMap<string, string>;
}

/** As fases em que um formulário pode ser respondido e a escolhida. */
export interface FasesDoFormulario {
  readonly opcoes: readonly FaseDoCronograma[];
  readonly escolhida: string;
}

/** O que o modelo de exibição das abas precisa saber do passo. */
export interface EntradaDasAbas {
  /** Os formulários do rascunho, na ordem em que o rascunho os guarda. */
  readonly formularios: readonly FormularioDoProcessoNoRascunho[];
  /** A fase de cada formulário, pelo código dele. */
  readonly fases: ReadonlyMap<string, FasesDoFormulario>;
  readonly fasesDoCronograma: readonly FaseDoCronograma[];
  readonly documentos: WizardDraft['documentos'];
  readonly vocabulario: VocabularioDosDocumentos;
  /** Os fatos que a inscrição coleta: os outros formulários os citam. */
  readonly fatosDaInscricao: readonly string[];
  readonly textos: TextosDasAbas;
}

/** O formulário com o lugar que ele ocupa no rascunho, que dá o trecho estável dos ids da aba. */
type FormularioNoRascunho = FormularioDoProcessoNoRascunho & { readonly posicao: number };

/**
 * Uma aba por formulário, na ordem do cronograma e, na fase, o obrigatório primeiro. Na inscrição,
 * o combo deixa de fora o que os outros formulários coletam, e os fatos que eles citam por negação
 * são obrigatórios. Nos outros, os fatos da inscrição são citáveis — o candidato já os respondeu —
 * e nunca coletados de novo.
 */
export function abasDoFormulario(entrada: EntradaDasAbas) {
  const fasesEmOrdem = entrada.fasesDoCronograma.map((fase) => fase.codigo);
  const noRascunho = entrada.formularios.map((formulario, posicao) => ({ ...formulario, posicao }));
  return emOrdemDoCronograma(noRascunho, fasesEmOrdem).map((formulario) =>
    abaDo(formulario, entrada),
  );
}

function abaDo(formulario: FormularioNoRascunho, entrada: EntradaDasAbas) {
  const faseDaAba = faseDaAbaDo(entrada, formulario);
  const decisao = obrigatoriedadeDaAba(entrada, formulario);
  const declarado = comoDeclarado(formulario, faseDaAba.fase, decisao);
  const ehInscricao = ehDaInscricao(declarado, faseDaAba.faseEscolhida);
  return {
    ...identificacaoDaAba(declarado, faseDaAba.nomeDaFase, ehInscricao),
    ...faseDaAba,
    ...decisao,
    ...textosDaAba(entrada.textos, formulario, faseDaAba.faseEscolhida, decisao.obrigatorio),
    formulario: declarado,
    ...fatosDaAba(entrada, formulario, ehInscricao),
    ...conteudoDaAba(entrada, formulario),
  };
}

/** Os ids da aba: o lugar do formulário no rascunho dá o trecho estável, que não muda com o código. */
function idsDaAba(posicao: number) {
  return {
    aba: `form-aba-${posicao}`,
    painel: `form-painel-${posicao}`,
    idBase: `form-${posicao}`,
    campoDaFase: `form-fase-${posicao}`,
  };
}

/** Os nomes da aba: o título, ou a fase e a obrigatoriedade, e o código entre aspas nas mensagens. */
function nomesDaAba(formulario: FormularioNoRascunho, nomeDaFase: string | null) {
  const rotulo = rotuloDoFormulario(formulario, nomeDaFase);
  return { rotulo, nome: `"${rotulo}"` };
}

/** O que a aba diz do formulário sem mudar. */
function dadosDoFormulario({ codigo, gravado, posicao, modeloOrigemCodigo }: FormularioNoRascunho) {
  return { codigo, gravado, posicao, modeloOrigemCodigo };
}

/** O que identifica a aba: o código identifica o formulário, e o lugar dele dá os ids. */
function identificacaoDaAba(
  formulario: FormularioNoRascunho,
  nomeDaFase: string | null,
  ehInscricao: boolean,
) {
  return {
    ...idsDaAba(formulario.posicao),
    ...nomesDaAba(formulario, nomeDaFase),
    ...dadosDoFormulario(formulario),
    finalidadeDoEditor: ehInscricao ? FINALIDADE_INSCRICAO : OUTRO_FORMULARIO,
    ehInscricao,
  };
}

/** A fase em que o formulário é respondido: as que cabem a ele e a escolhida. */
function faseDaAbaDo(entrada: EntradaDasAbas, formulario: FormularioDoProcessoNoRascunho) {
  const fase = entrada.fases.get(formulario.codigo) ?? { opcoes: [], escolhida: '' };
  const escolhida = entrada.fasesDoCronograma.find((opcao) => opcao.codigo === fase.escolhida);
  return {
    fases: fase.opcoes,
    fase: fase.escolhida,
    faseEscolhida: escolhida,
    nomeDaFase: escolhida?.nome ?? null,
    semFaseParaDocumentos: fase.escolhida === '',
  };
}

/** O que a fase decide da obrigatoriedade e se a consequência da falta de envio cabe. */
function obrigatoriedadeDaAba(entrada: EntradaDasAbas, formulario: FormularioDoProcessoNoRascunho) {
  const escolhida = entrada.fases.get(formulario.codigo)?.escolhida;
  const fase = entrada.fasesDoCronograma.find((opcao) => opcao.codigo === escolhida);
  const ocupantes = entrada.formularios.filter(
    (outro) => outro.codigo !== formulario.codigo && outro.faseCodigo === escolhida,
  );
  const obrigatoriedade = obrigatoriedadeNaFase(fase, { atual: formulario.obrigatorio, ocupantes });
  return {
    obrigatorio: obrigatoriedade.obrigatorio,
    obrigatoriedade,
    consequenciaCabe: consequenciaCabe(fase, obrigatoriedade.obrigatorio),
    consequenciaDaFaltaDeEnvio: formulario.consequenciaDaFaltaDeEnvio,
  };
}

type DecisaoDaAba = ReturnType<typeof obrigatoriedadeDaAba>;

/** O formulário como a aba o declara: a fase efetiva e a obrigatoriedade que a fase permite. */
function comoDeclarado<T extends FormularioDoProcessoNoRascunho>(
  formulario: T,
  faseCodigo: string,
  decisao: DecisaoDaAba,
): T {
  const { obrigatorio, consequenciaCabe: cabe, consequenciaDaFaltaDeEnvio } = decisao;
  const consequencia = cabe ? consequenciaDaFaltaDeEnvio : null;
  return { ...formulario, faseCodigo, obrigatorio, consequenciaDaFaltaDeEnvio: consequencia };
}

/** As recusas, o modelo escolhido e o resumo da aplicação que a aba mostra. */
function textosDaAba(
  textos: TextosDasAbas,
  formulario: FormularioDoProcessoNoRascunho,
  fase: FaseDoCronograma | undefined,
  obrigatorio: boolean,
) {
  const { codigo } = formulario;
  return {
    recusas: textos.recusasDaGravacao.get(codigo) ?? null,
    ...recusasDaAba(textos, codigo),
    ...modelosDaAba(textos, codigo, fase, obrigatorio),
    resumoDaAplicacao: textos.resumosDaAplicacao.get(codigo) ?? null,
  };
}

function recusasDaAba(textos: TextosDasAbas, codigo: string) {
  const recusaDaRemocao = textos.recusasDaRemocao.get(codigo) ?? null;
  const recusaDaAplicacao = textos.recusasDaAplicacao.get(codigo) ?? null;
  const recusada = [recusaDaRemocao, recusaDaAplicacao].some((recusa) => recusa !== null);
  return {
    recusaDaRemocao,
    recusaDaAplicacao,
    recusada: textos.recusasDaGravacao.has(codigo) || recusada,
  };
}

/** Os modelos que servem à fase da aba e o escolhido, se ainda servir. */
function modelosDaAba(
  textos: TextosDasAbas,
  codigo: string,
  fase: FaseDoCronograma | undefined,
  obrigatorio: boolean,
) {
  const modelos = modelosQueServem(textos.modelos, fase, obrigatorio);
  const escolhido = textos.modeloEscolhido.get(codigo) ?? '';
  return {
    modelos,
    modeloEscolhido: modelos.some((modelo) => modelo.id === escolhido) ? escolhido : '',
  };
}

/** Os fatos que o editor da aba pode citar, os que não pode coletar e os que a inscrição deve manter. */
function fatosDaAba(
  entrada: EntradaDasAbas,
  formulario: FormularioDoProcessoNoRascunho,
  ehInscricao: boolean,
) {
  const indisponiveis = fatosColetadosPelasOutras(entrada.formularios, formulario.codigo);
  return {
    fatosDaInscricao: ehInscricao ? null : entrada.fatosDaInscricao,
    fatosIndisponiveis: ehInscricao
      ? fatosForaDaColetaDaInscricao(formulario.conteudo, indisponiveis)
      : indisponiveis,
    fatosQueExigemRespostaPorFora: ehInscricao ? fatosQueOutrosExigem(entrada, formulario) : [],
  };
}

function fatosQueOutrosExigem(entrada: EntradaDasAbas, formulario: FormularioDoProcessoNoRascunho) {
  const outros = entrada.formularios.filter((outro) => outro.codigo !== formulario.codigo);
  return fatosDaInscricaoQueOutrosExigem(formulario.conteudo, outros);
}

/** O conteúdo do formulário, como o editor o recebe e como a consulta o lê, e os documentos dele. */
function conteudoDaAba(entrada: EntradaDasAbas, formulario: FormularioDoProcessoNoRascunho) {
  return {
    conteudo: formulario.conteudo,
    leitura: leituraDe(formulario.conteudo),
    temBlocoDocumental: paginasEmOrdem(formulario.conteudo).some(
      (pagina) => pagina.bloco === BLOCO_COMPROVACAO_DOCUMENTAL,
    ),
    documentos: documentosDaAba(entrada, formulario),
  };
}

function documentosDaAba(entrada: EntradaDasAbas, formulario: FormularioDoProcessoNoRascunho) {
  const faseCodigo = entrada.fases.get(formulario.codigo)?.escolhida ?? '';
  const formularioNaFase = {
    faseCodigo,
    codigo: formulario.codigo,
    codigosDaFase: entrada.formularios
      .filter((outro) => outro.faseCodigo === faseCodigo)
      .map((outro) => outro.codigo),
    fasesVivas: entrada.fasesDoCronograma.map((fase) => fase.codigo),
  };
  return documentosDoFormulario(entrada.documentos, formularioNaFase, entrada.vocabulario);
}

/** Uma aba do passo, como o modelo de exibição a monta. */
export type AbaDoFormulario = ReturnType<typeof abasDoFormulario>[number];

/** A aba que a tecla escolhe: setas andam em círculo, Home e End vão às pontas; outra tecla, nenhuma. */
export function abaPelaTecla(tecla: string, atual: number, total: number): number | null {
  switch (tecla) {
    case 'ArrowRight':
      return (atual + 1) % total;
    case 'ArrowLeft':
      return (atual - 1 + total) % total;
    case 'Home':
      return 0;
    case 'End':
      return total - 1;
    default:
      return null;
  }
}
