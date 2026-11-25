import type { DocumentoDaConfiguracaoFormulario } from '@uniplus/shared-data/selecao';
import type {
  ConteudoDoFormulario,
  EdicaoDoFormulario,
} from '@uniplus/shared-inscricao/formulario';
import { CamposEmEdicao, camposAlterados } from './campos-em-edicao';
import { ContextoDaConversao as Contexto } from './contexto-da-conversao';
import { gravarPagina } from './paginas';
import { gravarGrupo } from './grupos';
import { gravarItem } from './itens';
import { lerPagina, lerGrupo, lerItem } from './leitura-das-partes';
import { gravarTermo, lerTermo } from './termos';
import type {
  CatalogosDaConversaoDoFormulario,
  ResultadoDaConversaoDoFormulario,
} from './resultado-da-conversao';

type Formulario = DocumentoDaConfiguracaoFormulario;

const CAMPOS: readonly (keyof Formulario)[] = ['titulo', 'paginas', 'itens', 'grupos', 'termos'];
const PRESSUPOSTOS_INDEVIDOS =
  'Os fatos anteriores são informados pela inscrição. Retire os pressupostos declarados.';
const DOCUMENTOS_EM_OUTRA_SECAO = 'Edite os documentos exigidos na seção própria do processo.';

function lerTermos(formulario: Formulario, contexto: Contexto) {
  return (
    formulario.termos?.map((termo, indice) =>
      lerTermo(termo, contexto, ['termos', String(indice)]),
    ) ?? null
  );
}

function lerConteudo(formulario: Formulario, contexto: Contexto): ConteudoDoFormulario {
  return {
    titulo: formulario.titulo ?? null,
    pressupostos: [],
    paginas: formulario.paginas?.map(lerPagina) ?? null,
    itens:
      formulario.itens?.map((item, indice) => lerItem(item, contexto, ['itens', String(indice)])) ??
      null,
    grupos: formulario.grupos?.map((grupo, indice) =>
      lerGrupo(grupo, contexto, ['grupos', String(indice)]),
    ),
    termos: lerTermos(formulario, contexto),
  };
}

function resultado(
  formulario: Formulario,
  conteudo: ConteudoDoFormulario,
  contexto: Contexto,
): ResultadoDaConversaoDoFormulario {
  return contexto.impedimentos.length === 0
    ? { ok: true, formulario, conteudo, camposEditados: contexto.edicao.campos }
    : { ok: false, impedimentos: contexto.impedimentos };
}

/** Catálogos ausentes só recusam as partes que dependem deles; não há conversão parcial aceita. */
export function conteudoDoDocumento(
  formulario: Formulario,
  catalogos: CatalogosDaConversaoDoFormulario,
): ResultadoDaConversaoDoFormulario {
  const contexto = new Contexto(catalogos, new CamposEmEdicao([]));
  const conteudo = lerConteudo(formulario, contexto);
  return resultado(formulario, conteudo, contexto);
}

function paginasDoConteudo(
  conteudo: ConteudoDoFormulario,
  original: Formulario,
  contexto: Contexto,
): Formulario['paginas'] {
  return conteudo.paginas?.flatMap((pagina) => {
    const convertida = gravarPagina(
      pagina,
      original.paginas?.find((atual) => atual.codigo === pagina.codigo),
      contexto,
      ['paginas', pagina.codigo],
    );
    return convertida === undefined ? [] : [convertida];
  });
}

function termosDoConteudo(
  conteudo: ConteudoDoFormulario,
  original: Formulario,
  contexto: Contexto,
): Formulario['termos'] {
  return conteudo.termos?.flatMap((termo) => {
    const convertido = gravarTermo(
      termo,
      original.termos?.find((atual) => atual.codigo === termo.codigo),
      contexto,
      ['termos', termo.codigo],
    );
    return convertido === undefined ? [] : [convertido];
  });
}

function itensDoConteudo(conteudo: ConteudoDoFormulario, original: Formulario, contexto: Contexto) {
  return conteudo.itens?.map((item) => {
    const anterior = original.itens?.find((atual) => atual.codigoDoDado === item.fatoCodigo);
    return gravarItem(item, anterior, contexto, ['itens', item.fatoCodigo]);
  });
}

function gruposDoConteudo(
  conteudo: ConteudoDoFormulario,
  original: Formulario,
  contexto: Contexto,
) {
  return conteudo.grupos?.map((grupo) => {
    const anterior = original.grupos?.find((atual) => atual.codigo === grupo.codigo);
    return gravarGrupo(grupo, anterior, contexto, ['grupos', grupo.codigo]);
  });
}

function converterPartes(
  conteudo: ConteudoDoFormulario,
  original: Formulario,
  contexto: Contexto,
): Formulario {
  return {
    ...original,
    titulo: conteudo.titulo ?? undefined,
    paginas: paginasDoConteudo(conteudo, original, contexto),
    itens: itensDoConteudo(conteudo, original, contexto),
    grupos: gruposDoConteudo(conteudo, original, contexto),
    termos: termosDoConteudo(conteudo, original, contexto),
  };
}

function conferirPartesExternas(conteudo: ConteudoDoFormulario, contexto: Contexto): void {
  if ((conteudo.pressupostos?.length ?? 0) > 0)
    contexto.recusar('pressupostos', ['pressupostos'], PRESSUPOSTOS_INDEVIDOS);
  if ((conteudo.documentosExigidos?.length ?? 0) > 0)
    contexto.recusar('campo', ['documentosExigidos'], DOCUMENTOS_EM_OUTRA_SECAO);
}

function acompanharEdicao(
  atual: Extract<ResultadoDaConversaoDoFormulario, { ok: true }>,
  edicao: EdicaoDoFormulario,
) {
  const campos = [
    ...atual.camposEditados,
    ...edicao.camposEditados,
    ...camposAlterados(atual.conteudo, edicao.conteudo),
  ];
  return [...new Map(campos.map((campo) => [JSON.stringify(campo), campo])).values()];
}

/** O acompanhamento fica no resultado; nenhuma propriedade de edição é gravada no documento. */
export function documentoDoConteudo(
  atual: Extract<ResultadoDaConversaoDoFormulario, { ok: true }>,
  edicao: EdicaoDoFormulario,
  catalogos: CatalogosDaConversaoDoFormulario,
): ResultadoDaConversaoDoFormulario {
  const campos = acompanharEdicao(atual, edicao);
  const contexto = new Contexto(catalogos, new CamposEmEdicao(campos), edicao.conteudo);
  const convertido = converterPartes(edicao.conteudo, atual.formulario, contexto);
  conferirPartesExternas(edicao.conteudo, contexto);
  const formulario = contexto.edicao.preservar(atual.formulario, convertido, CAMPOS, []);
  return resultado(formulario, edicao.conteudo, contexto);
}
