import {
  OperadorDaCondicao,
  TipoDaObrigatoriedadeDoFormulario as Tipo,
  type DocumentoDaConfiguracaoFormulario as Formulario,
  type DocumentoDaConfiguracaoPredicado as Predicado,
} from '@uniplus/shared-data/selecao';
import type {
  CaminhoDoCampo as Caminho,
  ExibicaoEObrigatoriedade,
  Obrigatoriedade as ObrigatoriedadeEditada,
  PredicadoNoWire,
} from '@uniplus/shared-ui/components';
import type { ContextoDaConversao as Contexto } from './contexto-da-conversao';

type Obrigatoriedade = NonNullable<NonNullable<Formulario['itens']>[number]['obrigatoriedade']>;
type Condicao = NonNullable<PredicadoNoWire>[number][number];

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

export function lerObrigatoriedade(valor: Obrigatoriedade | undefined): ObrigatoriedadeEditada {
  return { tipo: valor?.tipo ?? 'SEMPRE', predicado: valor?.predicado ?? null };
}

export function lerExibicaoEObrigatoriedade(
  exibicao: PredicadoNoWire | undefined,
  obrigatoriedade: Obrigatoriedade | undefined,
): ExibicaoEObrigatoriedade {
  return { exibicao: exibicao ?? null, obrigatoriedade: lerObrigatoriedade(obrigatoriedade) };
}

export function regrasDoDocumento(
  regras: ExibicaoEObrigatoriedade,
  contexto: Contexto,
  caminho: Caminho,
) {
  return {
    exibicao: predicadoDoDocumento(regras.exibicao, contexto, [...caminho, 'exibicao']),
    obrigatoriedade: obrigatoriedadeDoDocumento(regras.obrigatoriedade, contexto, [
      ...caminho,
      'obrigatoriedade',
    ]),
  };
}

export function obrigatoriedadeDoDocumento(
  obrigatoriedade: ObrigatoriedadeEditada,
  contexto: Contexto,
  caminho: Caminho,
): Obrigatoriedade | undefined {
  if (obrigatoriedade.tipo === null) return undefined;
  const tipo = contexto.escolha(Tipo, obrigatoriedade.tipo, [...caminho, 'tipo']);
  if (tipo === undefined) return undefined;
  const local = [...caminho, 'predicado'];
  const predicado =
    tipo === Tipo.QUANDO
      ? predicadoDoDocumento(obrigatoriedade.predicado, contexto, local)
      : undefined;
  return tipo === Tipo.QUANDO ? { tipo, predicado } : { tipo };
}
