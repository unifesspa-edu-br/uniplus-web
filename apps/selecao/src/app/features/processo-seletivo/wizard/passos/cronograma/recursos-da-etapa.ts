import type { FormGroup } from '@angular/forms';
import { UnidadePrazoCodigo } from '@uniplus/shared-data/selecao';

import {
  PAPEL_PRELIMINAR,
  type ProdutoDaFase,
  type RecursoDaEtapa,
} from '../../processo-seletivo.models';
import type { RegraCatalogoDto } from '@uniplus/shared-data/selecao';
import {
  LEITURA_EM_BRANCO,
  PARAMETROS_EM_BRANCO,
  parametrosAlterados,
  prazoDaSegundaInstanciaRetirado,
  type AlteracaoDosParametros,
} from '../../shared/configuracao-do-recurso/parametros-do-recurso';
import type { EtapaForm } from './cronograma-form';

/**
 * A regra de prazo que o catálogo oferece para cada âncora. São duas regras distintas
 * porque são dois relógios: um conta da publicação do ato, o outro da ciência de cada
 * candidato.
 */
export function regraDoCatalogo(
  regras: readonly RegraCatalogoDto[],
  ancora: RecursoDaEtapa['ancora'],
): RegraCatalogoDto | undefined {
  const alvo = ancora === 'PUBLICACAO_DO_ATO' ? 'PUBLICACAO_DO_ATO' : 'CIENCIA';
  return regras.find((regra) => regra.codigo.includes(alvo)) ?? regras[0];
}

/** Os produtos preliminares da etapa — os únicos em que um recurso pode ancorar. */
export function preliminaresDaEtapa(grupo: FormGroup<EtapaForm>): readonly ProdutoDaFase[] {
  return grupo.controls.produtos.value.filter((p) => p.papel === PAPEL_PRELIMINAR);
}

/**
 * O recurso nasce ancorado no primeiro produto preliminar da etapa, quando existe: é o
 * caso comum, e deixar o campo vazio obrigaria o operador a escolher de novo o que a
 * própria etapa já declarou publicar.
 */
export function acrescentarRecurso(
  grupo: FormGroup<EtapaForm>,
  regras: readonly RegraCatalogoDto[],
): void {
  const preliminar = grupo.controls.produtos.value.find((p) => p.papel === PAPEL_PRELIMINAR);
  const regra = regraDoCatalogo(regras, 'PUBLICACAO_DO_ATO');
  escreverRecursos(grupo, [
    ...grupo.controls.recursos.value,
    recursoNovo(regra, preliminar?.atoCodigo ?? ''),
  ]);
}

/**
 * Nasce com o prazo em dias úteis e o resto por responder: a instância superior, o efeito
 * suspensivo e a guarda da vaga são escolhas de quem configura, e o recurso só é gravado depois
 * que a instância superior é respondida.
 */
function recursoNovo(regra: RegraCatalogoDto | undefined, atoAncoraCodigo: string): RecursoDaEtapa {
  return {
    ...PARAMETROS_EM_BRANCO,
    prazoUnidade: UnidadePrazoCodigo.DIAS_UTEIS,
    leitura: LEITURA_EM_BRANCO,
    ancora: 'PUBLICACAO_DO_ATO',
    regraCodigo: regra?.codigo ?? '',
    regraVersao: regra?.versao ?? '',
    atoAncoraCodigo,
    procedimentos: [],
  };
}

export function removerRecurso(grupo: FormGroup<EtapaForm>, posicao: number): void {
  escreverRecursos(
    grupo,
    grupo.controls.recursos.value.filter((_, i) => i !== posicao),
  );
}

/** O que o recurso tem além dos parâmetros: de onde o prazo corre, a regra de contagem e a publicação. */
export type AlteracaoDoRecursoSemParametros = {
  readonly campo: 'ancora' | 'regraCodigo' | 'atoAncoraCodigo';
  readonly valor: string;
};

/** O que a pessoa mexeu no recurso, com o valor novo. */
export type AlteracaoDeRecurso = AlteracaoDosParametros | AlteracaoDoRecursoSemParametros;

export function alterarRecurso(
  grupo: FormGroup<EtapaForm>,
  posicao: number,
  alteracao: AlteracaoDeRecurso,
  regras: readonly RegraCatalogoDto[],
): void {
  escreverRecursos(
    grupo,
    grupo.controls.recursos.value.map((recurso, i) =>
      i === posicao ? recursoAlterado(recurso, alteracao, regras) : recurso,
    ),
  );
}

/** Tira o prazo da 2ª instância do recurso, o botão "Retirar o prazo da 2ª instância". */
export function retirarPrazoDaSegundaInstancia(grupo: FormGroup<EtapaForm>, posicao: number): void {
  escreverRecursos(
    grupo,
    grupo.controls.recursos.value.map((recurso, i) =>
      i === posicao
        ? comParametros(recurso, prazoDaSegundaInstanciaRetirado(recurso, recurso.leitura))
        : recurso,
    ),
  );
}

function ehAlteracaoDosParametros(
  alteracao: AlteracaoDeRecurso,
): alteracao is AlteracaoDosParametros {
  return !['ancora', 'regraCodigo', 'atoAncoraCodigo'].includes(alteracao.campo);
}

function recursoAlterado(
  recurso: RecursoDaEtapa,
  alteracao: AlteracaoDeRecurso,
  regras: readonly RegraCatalogoDto[],
): RecursoDaEtapa {
  return ehAlteracaoDosParametros(alteracao)
    ? comParametros(recurso, parametrosAlterados(recurso, recurso.leitura, alteracao))
    : recursoComContagemAlterada(recurso, alteracao, regras);
}

function recursoComContagemAlterada(
  recurso: RecursoDaEtapa,
  { campo, valor }: AlteracaoDoRecursoSemParametros,
  regras: readonly RegraCatalogoDto[],
): RecursoDaEtapa {
  if (campo === 'ancora')
    return recursoComAncora(recurso, valor as RecursoDaEtapa['ancora'], regras);
  if (campo === 'regraCodigo') return recursoComRegra(recurso, valor, regras);
  return { ...recurso, atoAncoraCodigo: valor };
}

function comParametros(
  recurso: RecursoDaEtapa,
  { parametros, leitura }: Pick<ReturnType<typeof parametrosAlterados>, 'parametros' | 'leitura'>,
): RecursoDaEtapa {
  return { ...recurso, ...parametros, leitura };
}

function recursoComRegra(
  recurso: RecursoDaEtapa,
  codigo: string,
  regras: readonly RegraCatalogoDto[],
): RecursoDaEtapa {
  const regra = regras.find((r) => r.codigo === codigo);
  return { ...recurso, regraCodigo: codigo, regraVersao: regra?.versao ?? '' };
}

/**
 * A ciência não tem publicação a referenciar: o ato âncora sai junto, e a regra de prazo muda,
 * porque o relógio é outro.
 */
function recursoComAncora(
  recurso: RecursoDaEtapa,
  ancora: RecursoDaEtapa['ancora'],
  regras: readonly RegraCatalogoDto[],
): RecursoDaEtapa {
  const regra = regraDoCatalogo(regras, ancora);
  return {
    ...recurso,
    ancora,
    regraCodigo: regra?.codigo ?? recurso.regraCodigo,
    regraVersao: regra?.versao ?? recurso.regraVersao,
    atoAncoraCodigo: ancora === 'PUBLICACAO_DO_ATO' ? recurso.atoAncoraCodigo : '',
  };
}

function escreverRecursos(grupo: FormGroup<EtapaForm>, recursos: readonly RecursoDaEtapa[]): void {
  grupo.controls.recursos.setValue(recursos);
  grupo.controls.recursos.markAsDirty();
}
