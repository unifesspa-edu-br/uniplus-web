import type { CaminhoDoCampo as Caminho } from '@uniplus/shared-ui/components';
import type { DocumentoDaConfiguracaoFormulario } from '@uniplus/shared-data/selecao';
import type { ItemDoFormulario } from '@uniplus/shared-ui/components';
import type { ContextoDaConversao as Contexto } from './contexto-da-conversao';
import { obrigatoriedadeDoDocumento, predicadoDoDocumento } from './obrigatoriedade';
import { gravarRestricao } from './restricoes';

type Item = NonNullable<DocumentoDaConfiguracaoFormulario['itens']>[number];

const CAMPOS: readonly (keyof Item)[] = [
  'fatoCodigo',
  'ordem',
  'etapaCodigo',
  'rotulo',
  'ajuda',
  'pedirConfirmacao',
  'precondicao',
  'obrigatoriedade',
  'impedimento',
  'restricoes',
];

function restricoesDoItem(
  item: ItemDoFormulario,
  original: Item | undefined,
  contexto: Contexto,
  caminho: Caminho,
): Item['restricoes'] {
  const { restricoes } = item.regras;
  if (restricoes === null) return [];
  return restricoes?.flatMap((restricao, indice) => {
    const local = [...caminho, 'restricoes', String(indice)];
    const convertida = gravarRestricao(restricao, original?.restricoes?.[indice], contexto, local);
    return convertida === undefined ? [] : [convertida];
  });
}

const IMPEDIMENTO_INCOMPLETO = 'Informe a condição e a mensagem do impedimento.';

function impedimentoDoItem(
  item: ItemDoFormulario,
  contexto: Contexto,
  caminho: Caminho,
): Item['impedimento'] {
  const { impedimento } = item.regras;
  if (impedimento == null) return impedimento;
  const local = [...caminho, 'impedimento'];
  const quando = predicadoDoDocumento(impedimento.quando, contexto, [...local, 'quando']);
  const mensagem = impedimento.mensagem;
  if (quando == null || mensagem === null)
    return contexto.recusar('campo', local, IMPEDIMENTO_INCOMPLETO);
  return { quando, mensagem };
}

function apresentacaoDoItem(item: ItemDoFormulario) {
  return {
    fatoCodigo: item.fatoCodigo,
    ordem: item.ordem,
    etapaCodigo: item.etapaCodigo,
    rotulo: item.apresentacao.rotulo,
    ajuda: item.apresentacao.ajuda ?? undefined,
    pedirConfirmacao: item.apresentacao.pedirConfirmacao,
  };
}

function camposDoItem(item: ItemDoFormulario, contexto: Contexto, caminho: Caminho): Item {
  contexto.tipoDoCampo(item.fatoCodigo, [...caminho, 'fatoCodigo']);
  return {
    ...apresentacaoDoItem(item),
    precondicao: predicadoDoDocumento(item.regras.exibicao, contexto, [...caminho, 'precondicao']),
    obrigatoriedade: obrigatoriedadeDoDocumento(item.regras.obrigatoriedade, contexto, [
      ...caminho,
      'obrigatoriedade',
    ]),
    impedimento: impedimentoDoItem(item, contexto, caminho),
  };
}

export function gravarItem(
  item: ItemDoFormulario,
  original: Item | undefined,
  contexto: Contexto,
  caminho: Caminho,
): Item {
  const convertido: Item = {
    ...camposDoItem(item, contexto, caminho),
    restricoes: restricoesDoItem(item, original, contexto, caminho),
  };
  return contexto.edicao.preservar(original, convertido, CAMPOS, caminho);
}
