import type { DadoRevelavel } from '@uniplus/shared-utils';

import type { RegrasDoFormulario, ValorJson } from './interpretador/regras-do-formulario';

/**
 * O formulário que o candidato vê, como a API o publica no formulário renderizável: a apresentação de
 * cada seção, campo, grupo e termo, mais as regras que o interpretador avalia. Espelha o contrato; quem
 * hospeda passa o tipo gerado do OpenAPI.
 */
export interface ValorSelecionavel {
  readonly codigo: string;
  /** O nome da opção. */
  readonly descricao?: string | null;
  readonly ordem: number;
  /** O que o candidato precisa saber sobre a opção, mostrado abaixo dela. */
  readonly orientacao?: string | null;
}

export interface CampoRenderizavel {
  readonly fatoCodigo: string;
  readonly ordem: number;
  readonly rotulo: string;
  readonly tipoRenderizacao: string;
  readonly valoresSelecionaveis?: readonly ValorSelecionavel[] | null;
  readonly formato?: string | null;
  readonly ajuda?: string | null;
  readonly pedirConfirmacao?: boolean;
}

export interface GrupoRenderizavel {
  readonly codigo: string;
  readonly ordem: number;
  readonly rotulo: string;
  readonly minimo: number;
  readonly maximo?: number | null;
  readonly incluiCandidato: boolean;
  readonly subitens: readonly CampoRenderizavel[];
}

export interface SecaoRenderizavel {
  readonly codigo: string;
  /** O código com que a seção aparece nas regras; nulo nos blocos do sistema, que não têm regra. */
  readonly codigoNasRegras?: string | null;
  readonly ordem: number;
  /** `SECAO` ou `BLOCO`. */
  readonly tipo: string;
  readonly bloco?: string | null;
  readonly titulo: string;
  readonly descricao?: string | null;
  readonly aviso?: string | null;
}

export interface TermoRenderizavel {
  readonly codigo: string;
  readonly codigoNasRegras: string;
  readonly ordem: number;
  readonly nome: string;
  readonly texto: string;
  readonly baseLegal: string;
}

/**
 * Um fato que o formulário cita sem perguntar: respondido em outro formulário — com a apresentação de
 * lá —, ou calculado pelo sistema a partir de outros fatos, que `calculadoDe` lista.
 */
export interface PressupostoDoFormulario {
  readonly fatoCodigo: string;
  readonly rotulo?: string | null;
  readonly tipoRenderizacao?: string | null;
  readonly formato?: string | null;
  readonly valoresSelecionaveis?: readonly ValorSelecionavel[] | null;
  readonly calculadoDe?: readonly string[] | null;
}

export interface FormularioDoCandidato {
  readonly finalidade: string;
  /** A fase do cronograma que o formulário responde; nula fora de um processo, como no simulador. */
  readonly faseId?: string | null;
  readonly titulo?: string | null;
  readonly etapas: readonly SecaoRenderizavel[];
  readonly termos: readonly TermoRenderizavel[];
  readonly fatosColetados: readonly CampoRenderizavel[];
  readonly grupos: readonly GrupoRenderizavel[];
  readonly regras: RegrasDoFormulario;
  /** Os fatos citados que o formulário não pergunta; a simulação os informa à parte. */
  readonly pressupostos?: readonly PressupostoDoFormulario[] | null;
  /**
   * As respostas de que a avaliação da API depende, só pelos códigos (ADR-0143): os fatos — o subitem
   * de grupo como `GRUPO.FATO` — e os grupos cujas ocorrências contam.
   */
  readonly dependenciasDaAvaliacao?: DependenciasDaAvaliacao | null;
  /**
   * As respostas do Fator de Atenuação, só pelos códigos, com a mesma forma das dependências da
   * avaliação: o fato do pedido e os campos que o completam. Nulo fora da finalidade que o tem; vazio
   * quando o processo não tem Fator.
   */
  readonly dependenciasDoFator?: DependenciasDaAvaliacao | null;
}

export interface DependenciasDaAvaliacao {
  readonly fatos: readonly string[];
  readonly grupos: readonly string[];
}

/** Uma resposta que o candidato não altera, como o CPF da conta: o valor e como ele aparece. */
export interface RespostaFixa {
  readonly valor: ValorJson;
  readonly exibicao: string;
  /** O dado sensível que o titular revela para conferir; presente, aparece no lugar da exibição. */
  readonly revelavel?: DadoRevelavel;
}

/**
 * Um passo que quem hospeda o formulário preenche antes das seções, como a escolha do curso na
 * inscrição. O formulário o mostra no indicador de passos e no título; o conteúdo é de quem hospeda.
 */
export interface PassoPrefixado {
  readonly chave: string;
  readonly titulo: string;
  readonly descricao?: string | null;
  readonly concluido?: boolean;
  readonly comErro?: boolean;
  /** O que a Revisão mostra do passo, com a volta a ele; sem linhas, a Revisão não o cita. */
  readonly resumo?: readonly { readonly rotulo: string; readonly valor: string }[];
}

/**
 * Uma recusa do servidor ligada a uma parte do formulário. O campo é o código do fato, do grupo ou do
 * termo; dentro de um grupo, `grupo.ocorrência` ou `grupo.ocorrência.fato`.
 */
export interface ErroDoServidor {
  readonly campo: string;
  readonly mensagem: string;
}

/** O campo pertence à parte de código dado: é ela, ou está dentro dela, como `grupo.ocorrência.fato`. */
export function campoEm(campo: string, codigo: string): boolean {
  return campo === codigo || campo.startsWith(`${codigo}.`);
}

/** O campo do erro pertence à parte de código dado: é ela, ou está dentro dela. */
export function erroEm(erro: ErroDoServidor, codigo: string): boolean {
  return campoEm(erro.campo, codigo);
}

/** As mensagens dos erros cujo campo é exatamente este, numa frase só; nula quando não há. */
export function mensagemDosErros(erros: readonly ErroDoServidor[], campo: string): string | null {
  const mensagens = erros.filter((e) => e.campo === campo).map((e) => e.mensagem);
  return mensagens.length === 0 ? null : mensagens.join(' ');
}

export const BLOCO_MODALIDADES_CALCULADAS = 'MODALIDADES_CALCULADAS';
export const BLOCO_COMPROVACAO_DOCUMENTAL = 'COMPROVACAO_DOCUMENTAL';
export const BLOCO_REVISAO_E_ACEITE = 'REVISAO_E_ACEITE';
