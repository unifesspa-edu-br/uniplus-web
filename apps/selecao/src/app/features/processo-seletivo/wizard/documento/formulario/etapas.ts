import type { CaminhoDoCampo as Caminho } from '@uniplus/shared-ui/components';
import {
  TipoDaEtapaDoFormulario,
  BlocoDoFormulario,
  type DocumentoDaConfiguracaoFormulario,
} from '@uniplus/shared-data/selecao';
import type { EtapaDoFormulario } from '@uniplus/shared-ui/components';
import type { ContextoDaConversao as Contexto } from './contexto-da-conversao';
import { predicadoDoDocumento } from './obrigatoriedade';

type Etapa = NonNullable<DocumentoDaConfiguracaoFormulario['etapas']>[number];

const CAMPOS: readonly (keyof Etapa)[] = [
  'codigo',
  'ordem',
  'tipo',
  'bloco',
  'titulo',
  'descricao',
  'aviso',
  'exibicao',
];

function apresentacaoDaEtapa(etapa: EtapaDoFormulario) {
  return {
    codigo: etapa.codigo,
    ordem: etapa.ordem,
    titulo: etapa.titulo || undefined,
    descricao: etapa.descricao ?? undefined,
    aviso: etapa.aviso ?? undefined,
  };
}

function blocoDaEtapa(etapa: EtapaDoFormulario, contexto: Contexto, caminho: Caminho) {
  return etapa.bloco === null
    ? undefined
    : contexto.escolha(BlocoDoFormulario, etapa.bloco, [...caminho, 'bloco']);
}

function converterEtapa(
  etapa: EtapaDoFormulario,
  contexto: Contexto,
  caminho: Caminho,
): Etapa | undefined {
  const tipo = contexto.escolha(TipoDaEtapaDoFormulario, etapa.tipo, [...caminho, 'tipo']);
  if (tipo === undefined) return undefined;
  const convertida: Etapa = {
    ...apresentacaoDaEtapa(etapa),
    tipo,
    bloco: blocoDaEtapa(etapa, contexto, caminho),
    exibicao: predicadoDoDocumento(etapa.exibicao, contexto, [...caminho, 'exibicao']),
  };
  return convertida;
}

export function gravarEtapa(
  etapa: EtapaDoFormulario,
  original: Etapa | undefined,
  contexto: Contexto,
  caminho: Caminho,
): Etapa | undefined {
  const convertida = converterEtapa(etapa, contexto, caminho);
  return convertida === undefined
    ? undefined
    : contexto.edicao.preservar(original, convertida, CAMPOS, caminho);
}
