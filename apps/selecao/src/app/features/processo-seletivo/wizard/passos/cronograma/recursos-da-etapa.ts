import type { FormGroup } from '@angular/forms';

import {
  PAPEL_PRELIMINAR,
  type ProdutoDaFase,
  type RecursoDaEtapa,
} from '../../processo-seletivo.models';
import type { RegraCatalogoDto } from '@uniplus/shared-data/selecao';
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
  const alvo = ancora === 'atoPublicado' ? 'ANCORADO-EM-ATO' : 'ANCORADO-EM-CIENCIA';
  return regras.find((regra) => regra.codigo.includes(alvo)) ?? regras[0];
}

/** Os produtos preliminares da etapa — os únicos em que uma janela pode ancorar. */
export function preliminaresDaEtapa(grupo: FormGroup<EtapaForm>): readonly ProdutoDaFase[] {
  return grupo.controls.produtos.value.filter((p) => p.papel === PAPEL_PRELIMINAR);
}

/**
 * A janela nasce ancorada no primeiro produto preliminar da etapa, quando existe: é o
 * caso comum, e deixar o campo vazio obrigaria o operador a escolher de novo o que a
 * própria etapa já declarou publicar.
 *
 * A etapa de nota do ENEM não publica ato: o único relógio é a ciência do candidato.
 */
export function acrescentarRecurso(
  grupo: FormGroup<EtapaForm>,
  regras: readonly RegraCatalogoDto[],
  etapaDeNotaDoEnem: boolean,
): void {
  const preliminar = grupo.controls.produtos.value.find((p) => p.papel === PAPEL_PRELIMINAR);
  const ancora: RecursoDaEtapa['ancora'] = etapaDeNotaDoEnem ? 'cienciaIndividual' : 'atoPublicado';
  const regra = regraDoCatalogo(regras, ancora);
  escreverRecursos(grupo, [
    ...grupo.controls.recursos.value,
    {
      ancora,
      regraCodigo: regra?.codigo ?? '',
      regraVersao: regra?.versao ?? '',
      prazoValor: '',
      prazoUnidade: 'diasUteis',
      atoAncoraCodigo: preliminar?.atoCodigo ?? '',
      // Nasce sem suspensividade — declarar o par é escolha do operador, e os dois em
      // branco são a desativação prevista daquela instância.
      suspensividadePrimeiraInstanciaValor: '',
      suspensividadePrimeiraInstanciaUnidade: '',
      // Sem valor padrão: a janela só é gravada depois de o operador responder se cabe
      // instância superior.
      admiteInstanciaSuperior: null,
      suspensividadeSegundaInstanciaValor: '',
      suspensividadeSegundaInstanciaUnidade: '',
    },
  ]);
}

export function removerRecurso(grupo: FormGroup<EtapaForm>, posicao: number): void {
  escreverRecursos(
    grupo,
    grupo.controls.recursos.value.filter((_, i) => i !== posicao),
  );
}

/** O campo da janela recursal que o operador mexeu, com o valor que digitou. */
export interface AlteracaoDeRecurso {
  readonly campo: keyof RecursoDaEtapa;
  readonly valor: string;
}

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

function recursoAlterado(
  recurso: RecursoDaEtapa,
  { campo, valor }: AlteracaoDeRecurso,
  regras: readonly RegraCatalogoDto[],
): RecursoDaEtapa {
  if (campo === 'ancora')
    return recursoComAncora(recurso, valor as RecursoDaEtapa['ancora'], regras);

  if (campo === 'regraCodigo') {
    const regra = regras.find((r) => r.codigo === valor);
    return { ...recurso, regraCodigo: valor, regraVersao: regra?.versao ?? '' };
  }

  return { ...recurso, [campo]: valor };
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
    atoAncoraCodigo: ancora === 'atoPublicado' ? recurso.atoAncoraCodigo : '',
  };
}

/** Registra a resposta da pergunta que o contrato não deixa sem decisão. */
export function declararInstanciaSuperior(
  grupo: FormGroup<EtapaForm>,
  posicao: number,
  admite: boolean,
): void {
  escreverRecursos(
    grupo,
    grupo.controls.recursos.value.map((recurso, i) =>
      i === posicao ? { ...recurso, admiteInstanciaSuperior: admite } : recurso,
    ),
  );
}

function escreverRecursos(grupo: FormGroup<EtapaForm>, recursos: readonly RecursoDaEtapa[]): void {
  grupo.controls.recursos.setValue(recursos);
  grupo.controls.recursos.markAsDirty();
}
