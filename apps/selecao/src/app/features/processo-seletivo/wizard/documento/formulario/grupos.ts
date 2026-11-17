import type { CaminhoDoCampo as Caminho } from '@uniplus/shared-ui/components';
import type { DocumentoDaConfiguracaoFormulario } from '@uniplus/shared-data/selecao';
import type { GrupoDoFormulario } from '@uniplus/shared-ui/components';
import type { ContextoDaConversao as Contexto } from './contexto-da-conversao';
import { gravarItem } from './itens';
import { obrigatoriedadeDoDocumento, predicadoDoDocumento } from './obrigatoriedade';

type Grupo = NonNullable<DocumentoDaConfiguracaoFormulario['grupos']>[number];

const CAMPOS: readonly (keyof Grupo)[] = [
  'codigo',
  'ordem',
  'rotulo',
  'etapaCodigo',
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
    etapaCodigo: grupo.etapaCodigo ?? undefined,
    incluiCandidato: grupo.incluiCandidato,
  };
}

function camposDoGrupo(
  grupo: GrupoDoFormulario,
  contexto: Contexto,
  caminho: Caminho,
): Omit<Grupo, 'subitens'> {
  return {
    ...apresentacaoDoGrupo(grupo),
    minimo: contexto.numero(grupo.minimo, [...caminho, 'minimo'], true),
    maximo:
      grupo.maximo === null ? null : contexto.numero(grupo.maximo, [...caminho, 'maximo'], true),
    exibicao: predicadoDoDocumento(grupo.exibicao, contexto, [...caminho, 'exibicao']),
    obrigatoriedade: obrigatoriedadeDoDocumento(grupo, contexto, [...caminho, 'obrigatoriedade']),
  };
}

function subitensDoGrupo(
  grupo: GrupoDoFormulario,
  original: Grupo | undefined,
  contexto: Contexto,
  caminho: Caminho,
) {
  return grupo.subitens.map((item) => {
    const anterior = original?.subitens.find((atual) => atual.fatoCodigo === item.fatoCodigo);
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
