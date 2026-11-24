import type { CaminhoDoCampo as Caminho } from '@uniplus/shared-ui/components';
import type { DocumentoDaConfiguracaoFormulario } from '@uniplus/shared-data/selecao';
import type { GrupoDoFormulario } from '@uniplus/shared-ui/components';
import type { ContextoDaConversao as Contexto } from './contexto-da-conversao';
import { gravarItem } from './itens';
import { regrasDoDocumento } from './obrigatoriedade';

type Grupo = NonNullable<DocumentoDaConfiguracaoFormulario['grupos']>[number];

const CAMPOS: readonly (keyof Grupo)[] = [
  'codigo',
  'ordem',
  'rotulo',
  'paginaCodigo',
  'incluiCandidato',
  'minimo',
  'maximo',
  'exibicao',
  'obrigatoriedade',
];

function apresentacaoDoGrupo(grupo: GrupoDoFormulario) {
  return {
    codigo: grupo.codigo,
    ordem: grupo.ordem,
    rotulo: grupo.rotulo,
    paginaCodigo: grupo.etapaCodigo ?? undefined,
    incluiCandidato: grupo.ocorrencias.incluiCandidato,
  };
}

function maximoDoGrupo(grupo: GrupoDoFormulario, contexto: Contexto, caminho: Caminho) {
  const { maximo } = grupo.ocorrencias;
  return maximo === null ? null : contexto.numero(maximo, [...caminho, 'maximo'], true);
}

function camposDoGrupo(
  grupo: GrupoDoFormulario,
  contexto: Contexto,
  caminho: Caminho,
): Omit<Grupo, 'subitens'> {
  return {
    ...apresentacaoDoGrupo(grupo),
    minimo: contexto.numero(grupo.ocorrencias.minimo, [...caminho, 'minimo'], true),
    maximo: maximoDoGrupo(grupo, contexto, caminho),
    ...regrasDoDocumento(grupo.regras, contexto, caminho),
  };
}

function subitensDoGrupo(
  grupo: GrupoDoFormulario,
  original: Grupo | undefined,
  contexto: Contexto,
  caminho: Caminho,
) {
  return grupo.subitens.map((item) => {
    const anterior = original?.subitens.find((atual) => atual.codigoDoDado === item.fatoCodigo);
    return gravarItem(item, anterior, contexto, [...caminho, 'subitens', item.fatoCodigo]);
  });
}

export function gravarGrupo(
  grupo: GrupoDoFormulario,
  original: Grupo | undefined,
  contexto: Contexto,
  caminho: Caminho,
): Grupo {
  const campos = camposDoGrupo(grupo, contexto, caminho);
  const subitens = subitensDoGrupo(grupo, original, contexto, caminho);
  const convertido: Grupo = { ...campos, subitens };
  const preservado = contexto.edicao.preservar(original, convertido, CAMPOS, caminho);
  return { ...preservado, subitens };
}
