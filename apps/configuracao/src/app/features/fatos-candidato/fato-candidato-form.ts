import {
  controleDaQuantidade,
  fonteEscolhida,
  quantidadeEscolhida,
  tipoDoDadoEscolhido,
} from './codigos-do-fato';
import { Signal, computed, effect, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators, type ValidatorFn } from '@angular/forms';
import type { HttpContext } from '@angular/common/http';
import type { ApiResult } from '@uniplus/shared-core/http';
import type { FatosCandidatoApi, TipoDoDado } from '@uniplus/shared-data/configuracao';
import { CODIGO_CADASTRO_FORMATO, CODIGO_CADASTRO_TAMANHO_MAXIMO } from '@uniplus/shared-utils';
import { mensagemDeErroDoCampoComFormato } from '../../shared/formulario';
import { esvaziarSeForaDas, hipotesesDaClassificacao } from '../../shared/protecao-do-catalogo';
import { Observable, map } from 'rxjs';
import {
  aceitoNoDerivado,
  tiposDoDadoDoDerivado,
  campoDaRecusa,
  classificacoesDoDominio,
  exigirSe,
  obrigatorioNaoEmBranco,
  temFonteDeValores,
  temFormato,
} from './fato-candidato.regras';

/**
 * O que o administrador cria: um fato perguntado ao candidato, um derivado por regra, ou um agregado
 * que resume o que os membros de um grupo repetível responderam.
 */
export type TipoDeCriacao = 'DECLARADO' | 'DERIVADO' | 'AGREGADO';

export interface CriacaoForm {
  tipo: FormControl<TipoDeCriacao>;
  codigo: FormControl<string>;
  nome: FormControl<string>;
  descricao: FormControl<string>;
  componenteExibicao: FormControl<string>;
  dominio: FormControl<string>;
  fatoDeMembro: FormControl<string>;
  cardinalidade: FormControl<string>;
  fonteValores: FormControl<string>;
  formato: FormControl<string>;
  escopo: FormControl<string>;
  pontoResolucao: FormControl<string>;
  classificacaoProtecao: FormControl<string>;
  finalidadeTratamento: FormControl<string>;
  hipoteseLegal: FormControl<string>;
}

export type CampoDaCriacao = Exclude<keyof CriacaoForm, 'tipo'>;
export type ValoresDaCriacao = ReturnType<FormGroup<CriacaoForm>['getRawValue']>;

/** Limites de tamanho dos campos (Domain `FatoCandidato`, uniplus-api). */
export const LIMITES_DO_FATO = {
  nome: 200,
  descricao: 1000,
  finalidadeTratamento: 500,
  codigoDoValor: 50,
  textoDoValor: 500,
} as const;

const MENSAGEM_DE_FORMATO =
  'Use caixa alta, começando por letra, com letras, números e sublinhado.';

const CAMPOS_DA_CRIACAO: ReadonlySet<string> = new Set<CampoDaCriacao>([
  'codigo',
  'nome',
  'descricao',
  'componenteExibicao',
  'dominio',
  'fatoDeMembro',
  'cardinalidade',
  'fonteValores',
  'formato',
  'escopo',
  'pontoResolucao',
  'classificacaoProtecao',
  'finalidadeTratamento',
  'hipoteseLegal',
]);

export function criarFormularioDeFato(): FormGroup<CriacaoForm> {
  return new FormGroup<CriacaoForm>({
    tipo: new FormControl<TipoDeCriacao>('DECLARADO', { nonNullable: true }),
    ...controlesDeIdentificacao(),
    ...controlesDeDefinicao(),
    ...controlesDeProtecao(),
  });
}

const OBRIGATORIO = { nonNullable: true as const, validators: [Validators.required] };

const textoComLimite = (limite: number, ...validadores: ValidatorFn[]) =>
  new FormControl('', {
    nonNullable: true,
    validators: [...validadores, Validators.maxLength(limite)],
  });

function controlesDeIdentificacao() {
  return {
    codigo: textoComLimite(
      CODIGO_CADASTRO_TAMANHO_MAXIMO,
      Validators.required,
      Validators.pattern(CODIGO_CADASTRO_FORMATO),
    ),
    nome: textoComLimite(LIMITES_DO_FATO.nome, Validators.required),
    descricao: textoComLimite(LIMITES_DO_FATO.descricao, obrigatorioNaoEmBranco),
    componenteExibicao: new FormControl('', { nonNullable: true }),
  };
}

function controlesDeDefinicao() {
  return {
    dominio: new FormControl('', OBRIGATORIO),
    fatoDeMembro: new FormControl('', { nonNullable: true }),
    cardinalidade: controleDaQuantidade(),
    fonteValores: new FormControl('', { nonNullable: true }),
    formato: new FormControl('', { nonNullable: true }),
    escopo: new FormControl('CANDIDATO', { nonNullable: true }),
    pontoResolucao: new FormControl('', OBRIGATORIO),
  };
}

function controlesDeProtecao() {
  return {
    classificacaoProtecao: new FormControl('', OBRIGATORIO),
    finalidadeTratamento: textoComLimite(LIMITES_DO_FATO.finalidadeTratamento, Validators.required),
    hipoteseLegal: new FormControl('', OBRIGATORIO),
  };
}

export function controleDoCampoDoServidor(field: string): CampoDaCriacao | null {
  const campo = campoDaRecusa(field);
  return CAMPOS_DA_CRIACAO.has(campo) ? (campo as CampoDaCriacao) : null;
}

/** A mensagem do campo: a do servidor ou a obrigatoriedade; no mais, a regra de tamanho ou formato violada. */
export function mensagemDoCampo(controle: FormControl<string>): string | null {
  return mensagemDeErroDoCampoComFormato(controle, MENSAGEM_DE_FORMATO);
}

/** Envia a criação do tipo escolhido; o agregado não manda tipo de dado nem escopo, que a API tira do fato de membro. */
export function criarNaApi(
  api: FatosCandidatoApi,
  v: ValoresDaCriacao,
  contexto: HttpContext,
): Observable<ApiResult<string>> {
  const identificacao = identificacaoDoFato(v);
  if (v.tipo === 'AGREGADO') {
    return api.criarAgregado({ ...identificacao, fatoDeMembro: v.fatoDeMembro }, contexto);
  }
  const comum = { ...identificacao, dominio: tipoDoDadoEscolhido(v.dominio), escopo: v.escopo };
  if (v.tipo === 'DERIVADO') return api.criarDerivado(comum, contexto);
  return api.criar({ ...comum, ...eixosDoDeclarado(v) }, contexto);
}

function identificacaoDoFato(v: ValoresDaCriacao) {
  return {
    codigo: v.codigo.trim(),
    nome: v.nome.trim(),
    descricao: v.descricao.trim(),
    componenteExibicao: v.componenteExibicao || null,
    pontoResolucao: v.pontoResolucao,
    classificacaoProtecao: v.classificacaoProtecao,
    finalidadeTratamento: v.finalidadeTratamento.trim(),
    hipoteseLegal: v.hipoteseLegal,
  };
}

function eixosDoDeclarado(v: ValoresDaCriacao) {
  return {
    cardinalidade: quantidadeEscolhida(v.cardinalidade),
    fonteValores: temFonteDeValores(v.dominio) ? fonteEscolhida(v.fonteValores) : null,
    formato: temFormato(v.dominio) ? v.formato : null,
  };
}

/** O que o formulário de criação deriva dos valores digitados: quais campos existem e que opções cabem. */
export interface DependenciasDaCriacao {
  readonly valores: Signal<ValoresDaCriacao>;
  readonly declarado: Signal<boolean>;
  readonly agregado: Signal<boolean>;
  readonly temFonte: Signal<boolean>;
  readonly temFormatoDeTexto: Signal<boolean>;
  readonly dominios: Signal<readonly TipoDoDado[]>;
  readonly classificacoes: Signal<ReturnType<typeof classificacoesDoDominio>>;
  readonly hipoteses: Signal<ReturnType<typeof hipotesesDaClassificacao>>;
}

/**
 * Liga os campos que dependem uns dos outros. A escolha que deixou de estar entre as opções (o tipo
 * de dado depois de trocar para derivado, a classificação depois de trocar o tipo de dado, a hipótese
 * depois de trocar a classificação) se esvazia, e fonte, formato e fato de membro só são exigidos
 * onde existem. Chamar em contexto de injeção.
 */
export function ligarDependenciasDaCriacao(
  form: FormGroup<CriacaoForm>,
  tiposDoDado: Signal<readonly TipoDoDado[]>,
): DependenciasDaCriacao {
  const valores = valoresDaCriacao(form);
  const tipos = tiposDaCriacao(valores);
  const dependencias = {
    valores,
    ...tipos,
    ...opcoesDaCriacao(valores, tipos.declarado, tiposDoDado),
  };
  manterEscolhasCompativeis(form, dependencias);
  exigirCamposDoTipo(form, dependencias);
  return dependencias;
}

function valoresDaCriacao(form: FormGroup<CriacaoForm>): Signal<ValoresDaCriacao> {
  return toSignal(form.valueChanges.pipe(map(() => form.getRawValue())), {
    initialValue: form.getRawValue(),
  });
}

function tiposDaCriacao(valores: Signal<ValoresDaCriacao>) {
  return {
    declarado: computed(() => valores().tipo === 'DECLARADO'),
    agregado: computed(() => valores().tipo === 'AGREGADO'),
    temFonte: computed(() => temFonteDeValores(valores().dominio)),
    temFormatoDeTexto: computed(() => temFormato(valores().dominio)),
  };
}

function opcoesDaCriacao(
  valores: Signal<ValoresDaCriacao>,
  declarado: Signal<boolean>,
  tiposDoDado: Signal<readonly TipoDoDado[]>,
) {
  return {
    dominios: computed(() => (declarado() ? tiposDoDado() : tiposDoDadoDoDerivado(tiposDoDado()))),
    classificacoes: computed(() => classificacoesDoDominio(valores().dominio)),
    hipoteses: computed(() => hipotesesDaClassificacao(valores().classificacaoProtecao)),
  };
}

function manterEscolhasCompativeis(form: FormGroup<CriacaoForm>, dep: DependenciasDaCriacao): void {
  effect(() => {
    const [declarado, dominio, c, h] = [
      dep.declarado(),
      dep.valores().dominio,
      dep.classificacoes(),
      dep.hipoteses(),
    ];
    untracked(() => {
      esvaziarDominioIncompativel(form, declarado, dominio);
      esvaziarSeForaDas(form.controls.classificacaoProtecao, c);
      esvaziarSeForaDas(form.controls.hipoteseLegal, h);
    });
  });
}

function esvaziarDominioIncompativel(
  form: FormGroup<CriacaoForm>,
  declarado: boolean,
  dominio: string,
): void {
  if (!declarado && dominio !== '' && !aceitoNoDerivado(dominio))
    form.controls.dominio.setValue('');
}

/** Fonte e formato só são exigidos onde existem, e o agregado exige o fato de membro no lugar do tipo de dado. */
function exigirCamposDoTipo(form: FormGroup<CriacaoForm>, dep: DependenciasDaCriacao): void {
  effect(() => {
    const exigeFonte = dep.declarado() && dep.temFonte();
    const exigeFormato = dep.declarado() && dep.temFormatoDeTexto();
    const ehAgregado = dep.agregado();
    untracked(() => {
      exigirSe(form.controls.fonteValores, exigeFonte);
      exigirSe(form.controls.formato, exigeFormato);
      exigirSe(form.controls.dominio, !ehAgregado);
      exigirSe(form.controls.fatoDeMembro, ehAgregado);
    });
  });
}
