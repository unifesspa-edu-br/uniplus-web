import type { FormularioAvaliado } from './pre-visualizacao-de-formularios';

/**
 * O resumo da avaliação, anunciado ao leitor de tela: os campos exibidos e obrigatórios, os grupos
 * exibidos, as respostas que impediriam a inscrição e os grupos cujas ocorrências não valem como
 * resposta — a quantidade fora do que o grupo pede, ou a ocorrência do candidato faltando ou repetida.
 */
export function resumoDaPreVisualizacao(avaliados: readonly FormularioAvaliado[]): string {
  const itens = avaliados.flatMap((avaliado) => avaliado.itens);
  const grupos = avaliados.flatMap((avaliado) => avaliado.grupos);
  const exibidos = itens.filter((item) => item.visivel === 'VERDADEIRO').length;
  const obrigatorios = itens.filter((item) => item.obrigatorio === 'VERDADEIRO').length;
  const impedimentos = itens.filter((item) => item.impedido === 'VERDADEIRO').length;
  const gruposExibidos = grupos.filter((grupo) => grupo.visivel === 'VERDADEIRO').length;
  const foraDoQuePedem = grupos.filter((grupo) => !grupo.contagemValida || !grupo.ocorrenciaDoCandidatoValida).length;

  const frases = [`Pré-visualização pronta: ${exibidos} de ${itens.length} campos exibidos, ${obrigatorios} obrigatórios.`];
  if (grupos.length > 0) frases.push(`${gruposExibidos} de ${grupos.length} grupos repetíveis exibidos.`);
  if (impedimentos > 0) frases.push(`A inscrição seria impedida por ${impedimentos} resposta(s).`);
  if (foraDoQuePedem > 0) frases.push(`Em ${foraDoQuePedem} grupo(s), as ocorrências simuladas não valem como resposta.`);
  return frases.join(' ');
}
