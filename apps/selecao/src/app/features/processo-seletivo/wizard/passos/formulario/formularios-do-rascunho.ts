import { ConsequenciaDoDescumprimentoCodigo } from '@uniplus/shared-data/selecao';
import {
  conteudoInicial,
  fatosQueExigemResposta,
  type ConteudoDoFormulario,
} from '@uniplus/shared-inscricao/formulario';

import type {
  FormularioDeInscricao,
  FormularioDoProcessoNoRascunho,
} from '../../processo-seletivo.models';
import {
  fatosColetadosPor,
  formularioDoServidor,
  type ProcessoComFormularios,
} from './formulario-do-processo';

/**
 * Os formulários do processo no rascunho (UNI-REQ-0144), identificados pelo código. Cada um é
 * respondido numa fase do cronograma, é obrigatório ou facultativo, e um fato tem um único
 * formulário que o coleta. O que o formulário é — inscrição, pedido de isenção — sai das marcas da
 * fase em que é respondido, nunca do código.
 */

/** O limite de caracteres do código do formulário. */
export const LIMITE_DO_CODIGO_DO_FORMULARIO = 60;

const PADRAO_DO_CODIGO = /^[A-Z][A-Z0-9_]*$/;

/** Se o código serve: até 60 caracteres, começa com letra maiúscula, só maiúsculas, números e _. */
export function codigoDeFormularioValido(codigo: string): boolean {
  return codigo.length <= LIMITE_DO_CODIGO_DO_FORMULARIO && PADRAO_DO_CODIGO.test(codigo);
}

/**
 * A fase do formulário: a escolhida, enquanto estiver entre as que servem a ele, ou a única que
 * serve — preenchida sozinha. Sem nenhuma das duas, vazia, e o passo pede a escolha.
 */
export function faseEfetiva(
  escolhida: string,
  opcoes: readonly { readonly codigo: string }[],
): string {
  if (opcoes.some((opcao) => opcao.codigo === escolhida)) return escolhida;
  return opcoes.length === 1 ? opcoes[0].codigo : '';
}

/** Põe o formulário na fase que ele já tem, com o que ela impõe, dados os outros formulários. */
export type PoeNaFase = (
  formulario: FormularioDoProcessoNoRascunho,
  outros: readonly FormularioDoProcessoNoRascunho[],
) => FormularioDoProcessoNoRascunho;

/**
 * O rascunho com a fase efetiva em cada formulário cuja fase guardada deixou de servir e que tem
 * uma só opção, já com o que a nova fase impõe; nulo quando nenhum precisa mudar.
 */
export function comAFaseEfetiva(
  rascunho: FormularioDeInscricao,
  fases: ReadonlyMap<string, { readonly escolhida: string }>,
  poeNaFase: PoeNaFase,
): FormularioDeInscricao | null {
  const trocas = rascunho.formularios
    .map((formulario) => ({ formulario, escolhida: fases.get(formulario.codigo)?.escolhida ?? '' }))
    .filter(({ formulario, escolhida }) => escolhida !== '' && escolhida !== formulario.faseCodigo);
  if (trocas.length === 0) return null;
  return trocas.reduce((atual, { formulario, escolhida }) => {
    const outros = atual.formularios.filter((outro) => outro.codigo !== formulario.codigo);
    return comFormulario(atual, poeNaFase({ ...formulario, faseCodigo: escolhida }, outros));
  }, rascunho);
}

/** A consequência do vocabulário do servidor com o código dado; nula quando o código não é dele. */
export function consequenciaDoCodigo(codigo: string): ConsequenciaDoDescumprimentoCodigo | null {
  return (
    Object.values(ConsequenciaDoDescumprimentoCodigo).find((valor) => valor === codigo) ?? null
  );
}

/** O formulário do código, ou nulo quando o rascunho não o tem. */
export function formularioDoCodigo(
  formulario: FormularioDeInscricao,
  codigo: string,
): FormularioDoProcessoNoRascunho | null {
  return formulario.formularios.find((item) => item.codigo === codigo) ?? null;
}

/**
 * O rascunho com o formulário trocado: no lugar do `codigoAnterior`, ou ao fim quando o rascunho
 * não o tem. O código só muda antes de gravar.
 */
export function comFormulario(
  formulario: FormularioDeInscricao,
  novo: FormularioDoProcessoNoRascunho,
  codigoAnterior: string = novo.codigo,
): FormularioDeInscricao {
  const existe = formulario.formularios.some((item) => item.codigo === codigoAnterior);
  return {
    ...formulario,
    formularios: existe
      ? formulario.formularios.map((item) => (item.codigo === codigoAnterior ? novo : item))
      : [...formulario.formularios, novo],
  };
}

/** O rascunho sem o formulário do código. */
export function semFormulario(
  formulario: FormularioDeInscricao,
  codigo: string,
): FormularioDeInscricao {
  return {
    ...formulario,
    formularios: formulario.formularios.filter((item) => item.codigo !== codigo),
  };
}

/**
 * Os formulários na ordem do cronograma e, dentro da fase, o obrigatório primeiro. O formulário
 * sem fase, ainda não escolhida, vai ao fim.
 */
export function emOrdemDoCronograma<
  T extends Pick<FormularioDoProcessoNoRascunho, 'faseCodigo' | 'obrigatorio'>,
>(formularios: readonly T[], fasesEmOrdem: readonly string[]): readonly T[] {
  const posicao = (faseCodigo: string): number => {
    const indice = fasesEmOrdem.indexOf(faseCodigo);
    return indice === -1 ? fasesEmOrdem.length : indice;
  };
  return [...formularios].sort(
    (um, outro) =>
      posicao(um.faseCodigo) - posicao(outro.faseCodigo) ||
      Number(outro.obrigatorio) - Number(um.obrigatorio),
  );
}

/** O formulário que o candidato responde ao se inscrever: o obrigatório de fase que coleta inscrição. */
export function formularioDaInscricao(
  formulario: FormularioDeInscricao,
  fasesDaInscricao: ReadonlySet<string>,
): FormularioDoProcessoNoRascunho | null {
  return (
    formulario.formularios.find(
      (item) => item.obrigatorio && fasesDaInscricao.has(item.faseCodigo),
    ) ?? null
  );
}

/** O conteúdo do formulário de inscrição; o inicial quando o rascunho ainda não o tem. */
export function conteudoDaInscricao(
  formulario: FormularioDeInscricao,
  fasesDaInscricao: ReadonlySet<string>,
): ConteudoDoFormulario {
  return formularioDaInscricao(formulario, fasesDaInscricao)?.conteudo ?? conteudoInicial();
}

/** Os formulários que o servidor tem, na forma do rascunho. */
export function formulariosDoServidor(
  dto: ProcessoComFormularios,
): Pick<FormularioDeInscricao, 'formularios'> {
  return {
    formularios: dto.formularios.map((formulario) => formularioDoServidor(dto, formulario)),
  };
}

/** O formulário do código que o servidor tem, na forma do rascunho; nulo quando não tem. */
export function formularioDoServidorNoCodigo(
  dto: ProcessoComFormularios,
  codigo: string,
): FormularioDoProcessoNoRascunho | null {
  const formulario = dto.formularios.find((item) => item.codigo === codigo);
  return formulario === undefined ? null : formularioDoServidor(dto, formulario);
}

/** Os fatos que os OUTROS formulários do rascunho coletam — o que este não pode coletar. */
export function fatosColetadosPelasOutras(
  formularios: readonly Pick<FormularioDoProcessoNoRascunho, 'codigo' | 'conteudo'>[],
  codigo: string,
): readonly string[] {
  return [
    ...new Set(
      formularios
        .filter((formulario) => formulario.codigo !== codigo)
        .flatMap((formulario) => fatosColetadosPor(formulario.conteudo)),
    ),
  ];
}

/**
 * Os fatos da inscrição que uma regra de outro formulário cita por negação ou com impedimento: a
 * inscrição precisa torná-los obrigatórios, e o editor dela não vê aquelas regras (UNI-REQ-0074).
 */
export function fatosDaInscricaoQueOutrosExigem(
  inscricao: ConteudoDoFormulario,
  outros: readonly Pick<FormularioDoProcessoNoRascunho, 'conteudo'>[],
): readonly string[] {
  const daInscricao = new Set(fatosColetadosPor(inscricao));
  return [
    ...new Set(outros.flatMap((outro) => [...fatosQueExigemResposta(outro.conteudo)])),
  ].filter((fato) => daInscricao.has(fato));
}

/** Como a aba e as mensagens nomeiam o formulário: o título, ou a fase e a obrigatoriedade. */
export function rotuloDoFormulario(
  formulario: Pick<FormularioDoProcessoNoRascunho, 'codigo' | 'obrigatorio' | 'conteudo'>,
  nomeDaFase: string | null,
): string {
  const titulo = formulario.conteudo.titulo?.trim() ?? '';
  if (titulo !== '') return titulo;
  if (nomeDaFase === null) return formulario.codigo;
  return `${nomeDaFase} — ${formulario.obrigatorio ? 'obrigatório' : 'facultativo'}`;
}
