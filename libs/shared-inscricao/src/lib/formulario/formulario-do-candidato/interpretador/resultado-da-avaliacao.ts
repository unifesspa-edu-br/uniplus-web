import type {
  AvaliacaoInterna,
  ItemAvaliado,
  OcorrenciaAvaliadaInterna,
} from './avaliacao-interna';
import { type Fatos, INDETERMINADO } from './logica';
import type {
  AvaliacaoDoFormulario,
  CampoAvaliado,
  GrupoAvaliado,
  OcorrenciaAvaliada,
} from './regras-do-formulario';
import type { GrupoAvaliadoInterno } from './avaliacao-interna';

/** O resultado da avaliação na forma aninhada da avaliação sem cadastro da API. */
export function comoAvaliacaoDoFormulario(avaliacao: AvaliacaoInterna): AvaliacaoDoFormulario {
  return {
    paginas: avaliacao.paginas.map((e) => ({ codigo: e.codigo, visivel: e.visivel })),
    campos: avaliacao.itens.map((i) => campo(i, avaliacao.fatos)),
    grupos: avaliacao.grupos.map(grupo),
    termos: avaliacao.termos.map((t) => ({
      codigo: t.codigo,
      visivel: t.visivel,
      obrigatorio: t.obrigatorio,
    })),
  };
}

function grupo(grupoInterno: GrupoAvaliadoInterno): GrupoAvaliado {
  return {
    codigo: grupoInterno.codigo,
    paginaCodigo: grupoInterno.paginaCodigo,
    estado: grupoInterno.estado,
    regras: { visivel: grupoInterno.visivel, obrigatorio: grupoInterno.obrigatorio },
    ocorrencias: {
      contagemValida: grupoInterno.contagemValida,
      ocorrenciaDoCandidatoValida: grupoInterno.ocorrenciaDoCandidatoValida,
      lista: grupoInterno.ocorrencias.map(ocorrencia),
    },
  };
}

function ocorrencia(interna: OcorrenciaAvaliadaInterna): OcorrenciaAvaliada {
  return {
    id: interna.id,
    estado: interna.estado,
    campos: interna.itens.map((i) => campo(i, interna.fatos)),
  };
}

function campo(item: ItemAvaliado, fatos: Fatos): CampoAvaliado {
  return {
    fatoCodigo: item.fatoCodigo,
    paginaCodigo: item.paginaCodigo,
    estado: fatos.get(item.fatoCodigo)?.estado ?? INDETERMINADO,
    regras: {
      visivel: item.visivel,
      obrigatorio: item.obrigatorio,
      restricoesVioladas: item.restricoesVioladas,
      impedido: item.impedido,
    },
    opcoes: item.opcoes,
  };
}
