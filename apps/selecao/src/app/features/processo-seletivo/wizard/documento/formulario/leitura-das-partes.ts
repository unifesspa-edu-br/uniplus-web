import type { CaminhoDoCampo as Caminho } from '@uniplus/shared-ui/components';
import type { DocumentoDaConfiguracaoFormulario } from '@uniplus/shared-data/selecao';
import type {
  EtapaDoFormulario,
  ItemDoFormulario,
  GrupoDoFormulario,
} from '@uniplus/shared-ui/components';
import { lerExibicaoEObrigatoriedade } from './obrigatoriedade';
import { lerRestricao } from './restricoes';
import type { ContextoDaConversao as Contexto } from './contexto-da-conversao';

type Formulario = DocumentoDaConfiguracaoFormulario;
type Item = NonNullable<Formulario['itens']>[number];
type Grupo = NonNullable<Formulario['grupos']>[number];
type Etapa = NonNullable<Formulario['etapas']>[number];

export function lerEtapa(etapa: Etapa): EtapaDoFormulario {
  return {
    codigo: etapa.codigo,
    ordem: etapa.ordem ?? 0,
    tipo: etapa.tipo,
    bloco: etapa.bloco ?? null,
    apresentacao: {
      titulo: etapa.titulo ?? '',
      descricao: etapa.descricao ?? null,
      aviso: etapa.aviso ?? null,
    },
    exibicao: etapa.exibicao ?? null,
  };
}

function apresentacaoDoItem(
  item: Item,
  tipoRenderizacao: string,
): ItemDoFormulario['apresentacao'] {
  return {
    rotulo: item.rotulo ?? '',
    tipoRenderizacao,
    ajuda: item.ajuda,
    pedirConfirmacao: item.pedirConfirmacao ?? false,
  };
}

function regrasDoItem(item: Item): ItemDoFormulario['regras'] {
  return {
    ...lerExibicaoEObrigatoriedade(item.precondicao, item.obrigatoriedade),
    restricoes: item.restricoes?.map(lerRestricao),
    impedimento: item.impedimento,
  };
}

function ocorrenciasDoGrupo(grupo: Grupo): GrupoDoFormulario['ocorrencias'] {
  return {
    minimo: grupo.minimo ?? 0,
    maximo: grupo.maximo ?? null,
    incluiCandidato: grupo.incluiCandidato ?? false,
  };
}

export function lerItem(item: Item, contexto: Contexto, caminho: Caminho): ItemDoFormulario {
  const tipoRenderizacao = contexto.tipoDoCampo(item.fatoCodigo, [...caminho, 'fatoCodigo']) ?? '';
  return {
    fatoCodigo: item.fatoCodigo,
    ordem: item.ordem ?? 0,
    etapaCodigo: item.etapaCodigo,
    apresentacao: apresentacaoDoItem(item, tipoRenderizacao),
    regras: regrasDoItem(item),
  };
}

export function lerGrupo(grupo: Grupo, contexto: Contexto, caminho: Caminho): GrupoDoFormulario {
  return {
    codigo: grupo.codigo,
    ordem: grupo.ordem ?? 0,
    rotulo: grupo.rotulo ?? '',
    etapaCodigo: grupo.etapaCodigo ?? null,
    ocorrencias: ocorrenciasDoGrupo(grupo),
    regras: lerExibicaoEObrigatoriedade(grupo.exibicao, grupo.obrigatoriedade),
    subitens: grupo.subitens.map((item, indice) =>
      lerItem(item, contexto, [...caminho, 'subitens', String(indice)]),
    ),
  };
}
