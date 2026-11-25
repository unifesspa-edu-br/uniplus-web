import type { CaminhoDoCampo as Caminho } from '@uniplus/shared-inscricao/formulario';
import type { DocumentoDaConfiguracaoFormulario } from '@uniplus/shared-data/selecao';
import type {
  PaginaDoFormulario,
  ItemDoFormulario,
  GrupoDoFormulario,
} from '@uniplus/shared-inscricao/formulario';
import { lerExibicaoEObrigatoriedade, lerPredicado } from './obrigatoriedade';
import { lerRestricao } from './restricoes';
import type { ContextoDaConversao as Contexto } from './contexto-da-conversao';

type Formulario = DocumentoDaConfiguracaoFormulario;
type Item = NonNullable<Formulario['itens']>[number];
type Grupo = NonNullable<Formulario['grupos']>[number];
type Pagina = NonNullable<Formulario['paginas']>[number];

export function lerPagina(pagina: Pagina): PaginaDoFormulario {
  return {
    codigo: pagina.codigo,
    ordem: pagina.ordem ?? 0,
    tipo: pagina.tipo,
    bloco: pagina.bloco ?? null,
    apresentacao: {
      titulo: pagina.titulo ?? '',
      descricao: pagina.descricao ?? null,
      aviso: pagina.aviso ?? null,
    },
    exibicao: lerPredicado(pagina.exibicao),
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
    paginaCodigo: item.paginaCodigo ?? null,
    apresentacao: apresentacaoDoItem(item, tipoDeCampo),
    regras: regrasDoItem(item),
  };
}

export function lerGrupo(grupo: Grupo, contexto: Contexto, caminho: Caminho): GrupoDoFormulario {
  return {
    codigo: grupo.codigo,
    ordem: grupo.ordem ?? 0,
    rotulo: grupo.rotulo ?? '',
    paginaCodigo: grupo.paginaCodigo ?? null,
    ocorrencias: ocorrenciasDoGrupo(grupo),
    regras: lerExibicaoEObrigatoriedade(grupo.exibicao, grupo.obrigatoriedade),
    subitens: grupo.subitens.map((item, indice) =>
      lerItem(item, contexto, [...caminho, 'subitens', String(indice)]),
    ),
  };
}
