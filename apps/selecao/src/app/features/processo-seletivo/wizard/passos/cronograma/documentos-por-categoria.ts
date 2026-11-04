import type { CategoriaDocumentoDto, TipoDocumentoDto } from '@uniplus/shared-data/configuracao';

import type { DocumentoDefinicao, DocumentoGrupo } from '../../processo-seletivo.models';

/**
 * Os tipos de documento agrupados pela categoria do cadastro — o que a tela de
 * exigência documental oferece. Derivado do cadastro vivo, e não de uma lista escrita
 * à mão: o catálogo cresce sem deploy, e uma cópia local envelheceria em silêncio.
 */
export function documentosPorCategoria(
  tiposDocumento: readonly TipoDocumentoDto[],
  categorias: readonly CategoriaDocumentoDto[],
): readonly DocumentoGrupo[] {
  const rotulo = new Map(categorias.map((c) => [c.codigo, c.nome]));
  const porCategoria = new Map<string, DocumentoDefinicao[]>();

  for (const tipo of tiposDocumento) {
    const chave = tipo.categoria ?? 'OUTROS';
    const lista = porCategoria.get(chave) ?? [];
    const descricao = tipo.descricao?.trim() || null;
    const formatos = formatosDe(tipo);
    lista.push({
      id: tipo.id,
      nome: tipo.nome,
      descricao: descricao,
      formatos: formatos,
      // Sem descrição, o que orienta quem edita é o formato aceito.
      orientacao: descricao ?? formatos,
      situacao: null,
    });
    porCategoria.set(chave, lista);
  }

  return [...porCategoria.entries()]
    .map(
      ([codigo, docs]): DocumentoGrupo => ({
        label: rotulo.get(codigo) ?? codigo,
        docs: [...docs].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      }),
    )
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

/** Os formatos e o tamanho que o cadastro declara, só com as partes presentes; `null` sem nenhuma. */
function formatosDe(tipo: TipoDocumentoDto): string | null {
  const formatos = tipo.formatosAceitos?.trim() ?? '';
  const tamanho = tipo.tamanhoMaximoMb;
  const partes = [
    formatos === '' ? null : `Formatos aceitos: ${formatos}.`,
    tamanho !== null && tamanho !== undefined && tamanho > 0
      ? `Até ${tamanho.toLocaleString('pt-BR')} MB.`
      : null,
  ].filter((parte) => parte !== null);
  return partes.length === 0 ? null : partes.join(' ');
}
