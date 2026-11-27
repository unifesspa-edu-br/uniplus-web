import { NOME_DO_PASSO_DA_FORMULA } from '../../../processo-seletivo.data';
import type {
  AlternativaDeHomologacao,
  CondicaoDeHomologacao,
} from '../../../modelos/homologacao.models';
import type { FaseDoCronograma } from '../../../processo-seletivo.models';
import { rotuloDaEdicao } from '../../classificacao/edicoes-do-enem';
import type { ProblemaDaFase } from '../configuracao-da-fase';

/** A condição aponta uma edição do exame que o processo não declara. */
export function edicaoNaoDeclarada(
  condicao: CondicaoDeHomologacao,
  declaradas: readonly string[],
): boolean {
  return (
    condicao.edicaoDoExame !== null &&
    !declaradas.some((ano) => Number(ano) === condicao.edicaoDoExame)
  );
}

/** O que a tela diz da edição que deixou de estar declarada, junto ao campo da edição. */
export function mensagemDaEdicaoNaoDeclarada(condicao: CondicaoDeHomologacao): string {
  const edicao = rotuloDaEdicao(String(condicao.edicaoDoExame));
  return `A edição ${edicao} não está entre as que o processo declara. Escolha uma edição declarada ou declare esta no passo ${NOME_DO_PASSO_DA_FORMULA}.`;
}

function problemasDaAlternativa(
  alternativa: AlternativaDeHomologacao,
  posicao: number,
  declaradas: readonly string[],
): readonly ProblemaDaFase[] {
  return alternativa.condicoes
    .map((condicao, daCondicao) => ({ condicao, daCondicao }))
    .filter(({ condicao }) => edicaoNaoDeclarada(condicao, declaradas))
    .map(({ condicao, daCondicao }) => ({
      campo: `homologacao.alternativas.${posicao}.condicoes.${daCondicao}.edicaoDoExame` as const,
      mensagem: mensagemDaEdicaoNaoDeclarada(condicao),
    }));
}

/**
 * O que impede gravar a regra de homologação: a edição que uma condição aponta e o processo deixou
 * de declarar. A API só confere que o ano está entre 1998 e 2100, e por isso a edição que saiu da
 * lista do processo passaria sem aviso; a conferência sai daqui quando a API passar a recusá-la.
 */
export function problemasDaHomologacao(
  fase: FaseDoCronograma,
  declaradas: readonly string[],
): readonly ProblemaDaFase[] {
  const alternativas = fase.regraDeHomologacao?.alternativas ?? [];
  return alternativas.flatMap((alternativa, posicao) =>
    problemasDaAlternativa(alternativa, posicao, declaradas),
  );
}
