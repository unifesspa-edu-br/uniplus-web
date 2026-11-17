import {
  OperadorDaCondicao,
  TipoDaObrigatoriedadeDoFormulario as Tipo,
  type DocumentoDaConfiguracaoFormulario as Formulario,
  type DocumentoDaConfiguracaoPredicado as Predicado,
} from '@uniplus/shared-data/selecao';
import type {
  CaminhoDoCampo as Caminho,
  ItemDoFormulario,
  PredicadoNoWire,
} from '@uniplus/shared-ui/components';
import type { ContextoDaConversao as Contexto } from './contexto-da-conversao';

type Obrigatoriedade = NonNullable<NonNullable<Formulario['itens']>[number]['obrigatoriedade']>;
type Condicao = NonNullable<PredicadoNoWire>[number][number];
type Exigencia = Pick<ItemDoFormulario, 'obrigatoriedade' | 'predicadoObrigatoriedade'>;

function converterCondicao(condicao: Condicao, contexto: Contexto, caminho: Caminho) {
  const operador = contexto.escolha(OperadorDaCondicao, condicao.operador, [
    ...caminho,
    'operador',
  ]);
  return operador === undefined ? [] : [{ ...condicao, operador }];
}

export function predicadoDoDocumento(
  valor: PredicadoNoWire | undefined,
  contexto: Contexto,
  caminho: Caminho,
): Predicado | null | undefined {
  if (valor == null) return valor;
  return valor.map((clausula, indice) =>
    clausula.flatMap((condicao, posicao) =>
      converterCondicao(condicao, contexto, [...caminho, String(indice), String(posicao)]),
    ),
  );
}

export function lerObrigatoriedade(valor: Obrigatoriedade | undefined) {
  return {
    obrigatoriedade: valor?.tipo ?? 'SEMPRE',
    predicadoObrigatoriedade: valor?.predicado ?? null,
  };
}

export function obrigatoriedadeDoDocumento(
  exigencia: Exigencia,
  contexto: Contexto,
  caminho: Caminho,
): Obrigatoriedade | undefined {
  if (exigencia.obrigatoriedade === null) return undefined;
  const tipo = contexto.escolha(Tipo, exigencia.obrigatoriedade, [...caminho, 'tipo']);
  if (tipo === undefined) return undefined;
  const local = [...caminho, 'predicado'];
  const predicado =
    tipo === Tipo.QUANDO
      ? predicadoDoDocumento(exigencia.predicadoObrigatoriedade, contexto, local)
      : undefined;
  return tipo === Tipo.QUANDO ? { tipo, predicado } : { tipo };
}
