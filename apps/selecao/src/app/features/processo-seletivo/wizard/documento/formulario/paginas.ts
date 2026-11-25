import type { CaminhoDoCampo as Caminho } from '@uniplus/shared-ui/components';
import {
  TipoDaPaginaDoFormulario,
  BlocoDoFormulario,
  type DocumentoDaConfiguracaoFormulario,
} from '@uniplus/shared-data/selecao';
import type { PaginaDoFormulario } from '@uniplus/shared-ui/components';
import type { ContextoDaConversao as Contexto } from './contexto-da-conversao';
import { predicadoDoDocumento } from './obrigatoriedade';

type Pagina = NonNullable<DocumentoDaConfiguracaoFormulario['paginas']>[number];

const CAMPOS: readonly (keyof Pagina)[] = [
  'codigo',
  'ordem',
  'tipo',
  'bloco',
  'titulo',
  'descricao',
  'aviso',
  'exibicao',
];

function apresentacaoDaPagina(pagina: PaginaDoFormulario) {
  return {
    codigo: pagina.codigo,
    ordem: pagina.ordem,
    titulo: pagina.apresentacao.titulo || undefined,
    descricao: pagina.apresentacao.descricao ?? undefined,
    aviso: pagina.apresentacao.aviso ?? undefined,
  };
}

function blocoDaPagina(pagina: PaginaDoFormulario, contexto: Contexto, caminho: Caminho) {
  return pagina.bloco === null
    ? undefined
    : contexto.escolha(BlocoDoFormulario, pagina.bloco, [...caminho, 'bloco']);
}

function converterPagina(
  pagina: PaginaDoFormulario,
  contexto: Contexto,
  caminho: Caminho,
): Pagina | undefined {
  const tipo = contexto.escolha(TipoDaPaginaDoFormulario, pagina.tipo, [...caminho, 'tipo']);
  if (tipo === undefined) return undefined;
  const convertida: Pagina = {
    ...apresentacaoDaPagina(pagina),
    tipo,
    bloco: blocoDaPagina(pagina, contexto, caminho),
    exibicao: predicadoDoDocumento(pagina.exibicao, contexto, [...caminho, 'exibicao']),
  };
  return convertida;
}

export function gravarPagina(
  pagina: PaginaDoFormulario,
  original: Pagina | undefined,
  contexto: Contexto,
  caminho: Caminho,
): Pagina | undefined {
  const convertida = converterPagina(pagina, contexto, caminho);
  return convertida === undefined
    ? undefined
    : contexto.edicao.preservar(original, convertida, CAMPOS, caminho);
}
