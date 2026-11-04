import {
  OBRIGATORIEDADES,
  entradasDaSecao,
  etapasEmOrdem,
  type ConteudoDoFormulario,
} from '@uniplus/shared-ui/components';

/** O formulário como texto, para o processo em consulta: cada etapa com os campos e os grupos dela, e se a resposta é obrigatória. */
export function leituraDe(conteudo: ConteudoDoFormulario) {
  const obrigatoriedadeDe = (obrigatoriedade: string | null): string =>
    (
      OBRIGATORIEDADES.find((opcao) => opcao.valor === obrigatoriedade)?.rotulo ?? 'Opcional'
    ).toLocaleLowerCase('pt-BR');
  return etapasEmOrdem(conteudo).map((etapa) => ({
    codigo: etapa.codigo,
    bloco: etapa.bloco,
    titulo: etapa.titulo,
    entradas: entradasDaSecao(conteudo, etapa.codigo).map((entrada) =>
      entrada.tipo === 'item'
        ? {
            chave: entrada.item.fatoCodigo,
            rotulo: entrada.item.rotulo,
            obrigatoriedade: obrigatoriedadeDe(entrada.item.obrigatoriedade),
          }
        : {
            chave: entrada.grupo.codigo,
            rotulo: entrada.grupo.rotulo,
            obrigatoriedade: `repetível, ${obrigatoriedadeDe(entrada.grupo.obrigatoriedade)}`,
          },
    ),
  }));
}
