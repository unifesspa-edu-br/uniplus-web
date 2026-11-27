import type {
  AlternativaDeCondicoesDto,
  AlternativaDeCondicoesInput,
  CondicaoDeHomologacaoDto,
  CondicaoDeHomologacaoInput,
  RegraDeHomologacaoDto,
  RegraDeHomologacaoInput,
} from '@uniplus/shared-data/selecao';
import {
  deClausulasDoWire,
  paraClausulasDoWire,
  type CondicaoEmClausula,
} from '@uniplus/shared-inscricao/formulario';

import type {
  AlternativaDeHomologacao,
  CondicaoDeHomologacao,
  RegraDeHomologacao,
} from '../../modelos/homologacao.models';

type EnquadramentoDoInput = CondicaoDeHomologacaoInput['enquadramento'];

function condicaoDoDto(dto: CondicaoDeHomologacaoDto): CondicaoDeHomologacao {
  return {
    tipo: dto.tipo,
    edicaoDoExame: dto.edicaoDoExame,
    motivoDesfavoravelCodigo: dto.motivoDesfavoravelCodigo,
    enquadramento: deClausulasDoWire(dto.enquadramento),
  };
}

function alternativaDoDto(dto: AlternativaDeCondicoesDto): AlternativaDeHomologacao {
  return { condicoes: dto.condicoes.map(condicaoDoDto) };
}

/** A regra que a API devolveu, no formato do rascunho; fase sem a regra volta `null`. */
export function regraDoDto(
  dto: RegraDeHomologacaoDto | null | undefined,
): RegraDeHomologacao | null {
  if (dto === null || dto === undefined) return null;
  return {
    resultadoAtoCodigo: dto.resultadoAtoCodigo,
    alternativas: dto.alternativas.map(alternativaDoDto),
  };
}

/** Sem condição de enquadramento, a condição vale para toda inscrição e viaja sem a lista. */
function enquadramentoComoInput(
  enquadramento: readonly CondicaoEmClausula[],
): EnquadramentoDoInput {
  if (enquadramento.length === 0) return null;
  return paraClausulasDoWire(enquadramento) as EnquadramentoDoInput;
}

function condicaoComoInput(condicao: CondicaoDeHomologacao): CondicaoDeHomologacaoInput {
  return {
    tipo: condicao.tipo as CondicaoDeHomologacaoInput['tipo'],
    edicaoDoExame: condicao.edicaoDoExame,
    motivoDesfavoravelCodigo: condicao.motivoDesfavoravelCodigo,
    enquadramento: enquadramentoComoInput(condicao.enquadramento),
  };
}

function alternativaComoInput(alternativa: AlternativaDeHomologacao): AlternativaDeCondicoesInput {
  return { condicoes: alternativa.condicoes.map(condicaoComoInput) };
}

/**
 * A regra no comando, como foi lida: a gravação do cronograma substitui a fase inteira, e a regra
 * que não viajasse seria apagada. O que a regra ainda não tem (edição do exame, motivo) segue
 * nulo, para o servidor recusar pelo campo.
 */
export function regraComoInput(regra: RegraDeHomologacao | null): RegraDeHomologacaoInput | null {
  if (regra === null) return null;
  return {
    resultadoAtoCodigo: regra.resultadoAtoCodigo,
    alternativas: regra.alternativas.map(alternativaComoInput),
  };
}
