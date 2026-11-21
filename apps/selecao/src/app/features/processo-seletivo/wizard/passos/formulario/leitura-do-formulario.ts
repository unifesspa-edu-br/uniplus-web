import {
  OBRIGATORIEDADES,
  entradasDaSecao,
  etapasEmOrdem,
  type ConteudoDoFormulario,
  type EntradaDaSecao,
  type GrupoDoFormulario,
  type ItemDoFormulario,
} from '@uniplus/shared-ui/components';

function obrigatoriedadeDe(tipo: string | null): string {
  return (
    OBRIGATORIEDADES.find((opcao) => opcao.valor === tipo)?.rotulo ?? 'Opcional'
  ).toLocaleLowerCase('pt-BR');
}

function linhaDoItem(item: ItemDoFormulario) {
  return {
    chave: item.fatoCodigo,
    rotulo: item.apresentacao.rotulo,
    obrigatoriedade: obrigatoriedadeDe(item.regras.obrigatoriedade.tipo),
  };
}

function linhaDoGrupo(grupo: GrupoDoFormulario) {
  return {
    chave: grupo.codigo,
    rotulo: grupo.rotulo,
    obrigatoriedade: `repetível, ${obrigatoriedadeDe(grupo.regras.obrigatoriedade.tipo)}`,
  };
}

const linhaDaEntrada = (entrada: EntradaDaSecao) =>
  entrada.tipo === 'item' ? linhaDoItem(entrada.item) : linhaDoGrupo(entrada.grupo);

/** O formulário como texto, para o processo em consulta: cada etapa com os campos e os grupos dela, e se a resposta é obrigatória. */
export function leituraDe(conteudo: ConteudoDoFormulario) {
  return etapasEmOrdem(conteudo).map((etapa) => ({
    codigo: etapa.codigo,
    bloco: etapa.bloco,
    titulo: etapa.apresentacao.titulo,
    entradas: entradasDaSecao(conteudo, etapa.codigo).map(linhaDaEntrada),
  }));
}
