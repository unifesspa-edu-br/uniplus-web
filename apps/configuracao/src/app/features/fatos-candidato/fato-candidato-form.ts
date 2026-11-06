import { Signal, computed, effect, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import type { HttpContext } from '@angular/common/http';
import type { ApiResult } from '@uniplus/shared-core/http';
import type { FatosCandidatoApi } from '@uniplus/shared-data/configuracao';
import { CODIGO_CADASTRO_FORMATO, CODIGO_CADASTRO_TAMANHO_MAXIMO } from '@uniplus/shared-utils';
import { mensagemDeErroDoCampoComFormato } from '../../shared/formulario';
import { esvaziarSeForaDas, hipotesesDaClassificacao } from '../../shared/protecao-do-catalogo';
import { Observable, map } from 'rxjs';
import {
  DOMINIOS,
  DOMINIOS_DO_DERIVADO,
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

function controlesDeIdentificacao() {
  return {
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(CODIGO_CADASTRO_TAMANHO_MAXIMO),
        Validators.pattern(CODIGO_CADASTRO_FORMATO),
      ],
    }),
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(LIMITES_DO_FATO.nome)],
    }),
    descricao: new FormControl('', {
      nonNullable: true,
      validators: [obrigatorioNaoEmBranco, Validators.maxLength(LIMITES_DO_FATO.descricao)],
    }),
    componenteExibicao: new FormControl('', { nonNullable: true }),
  };
}

function controlesDeDefinicao() {
  return {
    dominio: new FormControl('', OBRIGATORIO),
    fatoDeMembro: new FormControl('', { nonNullable: true }),
    cardinalidade: new FormControl('ESCALAR', { nonNullable: true }),
    fonteValores: new FormControl('', { nonNullable: true }),
    formato: new FormControl('', { nonNullable: true }),
    escopo: new FormControl('CANDIDATO', { nonNullable: true }),
    pontoResolucao: new FormControl('', OBRIGATORIO),
  };
}

function controlesDeProtecao() {
  return {
    classificacaoProtecao: new FormControl('', OBRIGATORIO),
    finalidadeTratamento: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(LIMITES_DO_FATO.finalidadeTratamento)],
    }),
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
  const identificacao = {
    codigo: v.codigo.trim(),
    nome: v.nome.trim(),
    descricao: v.descricao.trim(),
    componenteExibicao: v.componenteExibicao || null,
    pontoResolucao: v.pontoResolucao,
    classificacaoProtecao: v.classificacaoProtecao,
    finalidadeTratamento: v.finalidadeTratamento.trim(),
    hipoteseLegal: v.hipoteseLegal,
  };
  if (v.tipo === 'AGREGADO') {
    return api.criarAgregado({ ...identificacao, fatoDeMembro: v.fatoDeMembro }, contexto);
  }
  const comum = { ...identificacao, dominio: v.dominio, escopo: v.escopo };
  if (v.tipo === 'DERIVADO') return api.criarDerivado(comum, contexto);
  return api.criar(
    {
      ...comum,
      cardinalidade: v.cardinalidade,
      fonteValores: temFonteDeValores(v.dominio) ? v.fonteValores : null,
      formato: temFormato(v.dominio) ? v.formato : null,
    },
    contexto,
  );
}

/** O que o formulário de criação deriva dos valores digitados: quais campos existem e que opções cabem. */
export interface DependenciasDaCriacao {
  readonly valores: Signal<ValoresDaCriacao>;
  readonly declarado: Signal<boolean>;
  readonly agregado: Signal<boolean>;
  readonly temFonte: Signal<boolean>;
  readonly temFormatoDeTexto: Signal<boolean>;
  readonly dominios: Signal<typeof DOMINIOS>;
  readonly classificacoes: Signal<ReturnType<typeof classificacoesDoDominio>>;
  readonly hipoteses: Signal<ReturnType<typeof hipotesesDaClassificacao>>;
}

/**
 * Liga os campos que dependem uns dos outros. A escolha que deixou de estar entre as opções (o tipo
 * de dado depois de trocar para derivado, a classificação depois de trocar o tipo de dado, a hipótese
 * depois de trocar a classificação) se esvazia, e fonte, formato e fato de membro só são exigidos
 * onde existem. Chamar em contexto de injeção.
 */
export function ligarDependenciasDaCriacao(form: FormGroup<CriacaoForm>): DependenciasDaCriacao {
  const valores = toSignal(form.valueChanges.pipe(map(() => form.getRawValue())), {
    initialValue: form.getRawValue(),
  });
  const declarado = computed(() => valores().tipo === 'DECLARADO');
  const agregado = computed(() => valores().tipo === 'AGREGADO');
  const temFonte = computed(() => temFonteDeValores(valores().dominio));
  const temFormatoDeTexto = computed(() => temFormato(valores().dominio));
  const dominios = computed(() => (declarado() ? DOMINIOS : DOMINIOS_DO_DERIVADO));
  const classificacoes = computed(() => classificacoesDoDominio(valores().dominio));
  const hipoteses = computed(() => hipotesesDaClassificacao(valores().classificacaoProtecao));

  const dependencias = {
    valores,
    declarado,
    agregado,
    temFonte,
    temFormatoDeTexto,
    dominios,
    classificacoes,
    hipoteses,
  };
  manterEscolhasCompativeis(form, dependencias);
  exigirCamposDoTipo(form, dependencias);
  return dependencias;
}

/** A escolha que deixou de estar entre as opções se esvazia: ficaria no controle, invisível. */
function manterEscolhasCompativeis(form: FormGroup<CriacaoForm>, dep: DependenciasDaCriacao): void {
  effect(() => {
    const [d, c, h] = [dep.dominios(), dep.classificacoes(), dep.hipoteses()];
    untracked(() => {
      esvaziarSeForaDas(form.controls.dominio, d);
      esvaziarSeForaDas(form.controls.classificacaoProtecao, c);
      esvaziarSeForaDas(form.controls.hipoteseLegal, h);
    });
  });
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
