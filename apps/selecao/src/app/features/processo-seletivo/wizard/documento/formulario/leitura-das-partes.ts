import type { CaminhoDoCampo as Caminho } from '@uniplus/shared-ui/components';
import type { DocumentoDaConfiguracaoFormulario } from '@uniplus/shared-data/selecao';
import type {
  EtapaDoFormulario,
  ItemDoFormulario,
  GrupoDoFormulario,
} from '@uniplus/shared-ui/components';
import { lerExibicaoEObrigatoriedade, lerPredicado } from './obrigatoriedade';
import { lerRestricao } from './restricoes';
import type { ContextoDaConversao as Contexto } from './contexto-da-conversao';

type Formulario = DocumentoDaConfiguracaoFormulario;
type Item = NonNullable<Formulario['itens']>[number];
type Grupo = NonNullable<Formulario['grupos']>[number];
type Etapa = NonNullable<Formulario['paginas']>[number];

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
    exibicao: lerPredicado(etapa.exibicao),
  };
}

function apresentacaoDoItem(item: Item, tipoDeCampo: string): ItemDoFormulario['apresentacao'] {
  return {
    rotulo: item.rotulo ?? '',
    tipoDeCampo,
    ajuda: item.ajuda,
    pedirConfirmacao: item.pedirConfirmacao ?? false,
  };
}

function regrasDoItem(item: Item): ItemDoFormulario['regras'] {
  return {
    ...lerExibicaoEObrigatoriedade(item.exibicao, item.obrigatoriedade),
    restricoes: item.restricoes?.map(lerRestricao),
    impedimento:
      item.impedimento == null
        ? item.impedimento
        : {
            ...item.impedimento,
            quando: lerPredicado(item.impedimento.quando),
          },
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
  const tipoDeCampo = contexto.tipoDoCampo(item.codigoDoDado, [...caminho, 'fatoCodigo']) ?? '';
  return {
    fatoCodigo: item.codigoDoDado,
    ordem: item.ordem ?? 0,
    etapaCodigo: item.paginaCodigo,
    apresentacao: apresentacaoDoItem(item, tipoDeCampo),
    regras: regrasDoItem(item),
  };
}

export function lerGrupo(grupo: Grupo, contexto: Contexto, caminho: Caminho): GrupoDoFormulario {
  return {
    codigo: grupo.codigo,
    ordem: grupo.ordem ?? 0,
    rotulo: grupo.rotulo ?? '',
    etapaCodigo: grupo.paginaCodigo ?? null,
    ocorrencias: ocorrenciasDoGrupo(grupo),
    regras: lerExibicaoEObrigatoriedade(grupo.exibicao, grupo.obrigatoriedade),
    subitens: grupo.subitens.map((item, indice) =>
      lerItem(item, contexto, [...caminho, 'subitens', String(indice)]),
    ),
  };
}
