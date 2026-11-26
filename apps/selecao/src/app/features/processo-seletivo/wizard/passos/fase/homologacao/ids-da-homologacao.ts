import {
  lugarNaHomologacao,
  PREFIXO_DA_HOMOLOGACAO,
  type ControleDaCondicao,
} from './campo-da-homologacao';

/** O sufixo do elemento que o campo nomeia: o próprio campo, com os pontos trocados por hífens. */
export function sufixoDoCampoDaHomologacao(campo: string): string {
  return campo.replaceAll('.', '-');
}

/** O sufixo do bloco que reúne as recusas do servidor ao campo, ligado só a ele. */
export function sufixoDaRecusaDaHomologacao(campo: string): string {
  return `${sufixoDoCampoDaHomologacao(campo)}-recusa`;
}

/** O sufixo da mensagem que a conferência local dá ao campo. */
export function sufixoDoProblemaDaHomologacao(campo: string): string {
  return `${sufixoDoCampoDaHomologacao(campo)}-erro`;
}

/** O sufixo do campo de uma condição, pela posição dela na regra. */
export function sufixoDaCondicao(
  alternativa: number,
  condicao: number,
  controle: ControleDaCondicao,
): string {
  return `${PREFIXO_DA_HOMOLOGACAO}-alternativas-${alternativa}-condicoes-${condicao}-${controle}`;
}

export const SUFIXO_DO_RESULTADO = 'homologacao-resultado';
export const SUFIXO_DO_BOTAO_DE_DECLARAR = 'homologacao-declarar';
/** O aviso, único na regra, de que o processo não declarou edições do exame. */
export const SUFIXO_DOS_AVISOS_DAS_EDICOES = 'homologacao-sem-edicoes';
export const SUFIXO_DO_BOTAO_DE_INCLUIR_ALTERNATIVA = 'homologacao-incluir-alternativa';

/** O botão que inclui condição na alternativa. */
export function sufixoDoBotaoDeIncluirCondicao(alternativa: number): string {
  return `${PREFIXO_DA_HOMOLOGACAO}-alternativas-${alternativa}-incluir-condicao`;
}

const CONTROLES_COM_FOCO: ReadonlySet<ControleDaCondicao> = new Set([
  'tipo',
  'edicaoDoExame',
  'motivoDesfavoravelCodigo',
]);

/** O campo tem um elemento que recebe foco: a regra inteira e o enquadramento só têm o bloco das recusas. */
function temControleComFoco(campo: string): boolean {
  const { controle } = lugarNaHomologacao(campo);
  return controle === null ? campo !== PREFIXO_DA_HOMOLOGACAO : CONTROLES_COM_FOCO.has(controle);
}

/**
 * Os elementos que podem receber o foco quando a recusa é o primeiro problema do passo, do
 * preferido ao de reserva: o controle, quando ele existe, e o bloco das recusas do campo.
 */
export function alvosDaRecusaDaHomologacao(
  campo: string,
  id: (sufixo: string) => string,
): readonly string[] {
  const bloco = id(sufixoDaRecusaDaHomologacao(campo));
  return temControleComFoco(campo) ? [id(sufixoDoCampoDaHomologacao(campo)), bloco] : [bloco];
}
