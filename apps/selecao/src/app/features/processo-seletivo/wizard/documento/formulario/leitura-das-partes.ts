import type { CaminhoDoCampo as Caminho } from '@uniplus/shared-ui/components';
import type { DocumentoDaConfiguracaoFormulario } from '@uniplus/shared-data/selecao';
import type {
  EtapaDoFormulario,
  ItemDoFormulario,
  GrupoDoFormulario,
} from '@uniplus/shared-ui/components';
import { lerObrigatoriedade } from './obrigatoriedade';
import { lerRestricao } from './restricoes';
import type { ContextoDaConversao as Contexto } from './contexto-da-conversao';

type Formulario = DocumentoDaConfiguracaoFormulario;
type Item = NonNullable<Formulario['itens']>[number];
type Grupo = NonNullable<Formulario['grupos']>[number];
type Etapa = NonNullable<Formulario['etapas']>[number];

export function lerEtapa(etapa: Etapa): EtapaDoFormulario {
  return {
    ...etapa,
    ordem: etapa.ordem ?? 0,
    bloco: etapa.bloco ?? null,
    titulo: etapa.titulo ?? '',
    descricao: etapa.descricao ?? null,
    aviso: etapa.aviso ?? null,
  };
}

function apresentacaoDoItem(item: Item) {
  return {
    ordem: item.ordem ?? 0,
    rotulo: item.rotulo ?? '',
    pedirConfirmacao: item.pedirConfirmacao ?? false,
  };
}

function ocorrenciasDoGrupo(grupo: Grupo) {
  return {
    minimo: grupo.minimo ?? 0,
    maximo: grupo.maximo ?? null,
    incluiCandidato: grupo.incluiCandidato ?? false,
  };
}

export function lerItem(item: Item, contexto: Contexto, caminho: Caminho): ItemDoFormulario {
  return {
    ...item,
    ...apresentacaoDoItem(item),
    restricoes: item.restricoes?.map(lerRestricao),
    tipoRenderizacao: contexto.tipoDoCampo(item.fatoCodigo, [...caminho, 'fatoCodigo']) ?? '',
    ...lerObrigatoriedade(item.obrigatoriedade),
    precondicao: item.precondicao ?? null,
    impedimento: item.impedimento,
  };
}

export function lerGrupo(grupo: Grupo, contexto: Contexto, caminho: Caminho): GrupoDoFormulario {
  return {
    ...grupo,
    ordem: grupo.ordem ?? 0,
    rotulo: grupo.rotulo ?? '',
    etapaCodigo: grupo.etapaCodigo ?? null,
    ...ocorrenciasDoGrupo(grupo),
    exibicao: grupo.exibicao ?? null,
    ...lerObrigatoriedade(grupo.obrigatoriedade),
    subitens: grupo.subitens.map((item, indice) =>
      lerItem(item, contexto, [...caminho, 'subitens', String(indice)]),
    ),
  };
}
