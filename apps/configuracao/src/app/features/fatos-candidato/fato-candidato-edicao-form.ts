import { Signal, WritableSignal, computed, effect, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { map } from 'rxjs';
import type {
  CorrecaoDeValorDominioInput,
  DescritivoDoFatoInput,
  FatoCandidatoDto,
  ValorDominioInput,
  TipoDoDado,
  ItemDeVocabulario,
} from '@uniplus/shared-data/configuracao';
import { opcoesDoVocabulario } from '@uniplus/shared-data/configuracao';
import { componenteEscolhido, controleDaQuantidade } from './codigos-do-fato';
import { nullIfBlank } from '../../shared/formulario';
import { validadoresDoCodigo } from '../../shared/codigo-de-cadastro';
import { esvaziarSeForaDas, protecaoMudou } from '../../shared/protecao-do-catalogo';
import { LIMITES_DO_FATO } from './fato-candidato-form';
import {
  hipotesesDoFato,
  tiposDoDadoDoDerivado,
  classificacoesDoDominio,
  eixosDoTipo,
  eixosEditaveis,
  exigirSe,
  protecaoDoFato,
  obrigatorioNaoEmBranco,
  type DefinicaoEmEdicao,
  type TipoDoFato,
} from './fato-candidato.regras';

export type DescritivoForm = ReturnType<typeof criarFormularioDoDescritivo>;
export type DefinicaoForm = ReturnType<typeof criarFormularioDaDefinicao>;
export type CorrecaoForm = ReturnType<typeof criarFormularioDaCorrecao>;
export type NovoValorForm = ReturnType<typeof criarFormularioDoNovoValor>;

export function criarFormularioDoDescritivo() {
  return new FormGroup({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(LIMITES_DO_FATO.nome)],
    }),
    descricao: new FormControl('', {
      nonNullable: true,
      validators: [obrigatorioNaoEmBranco, Validators.maxLength(LIMITES_DO_FATO.descricao)],
    }),
    componenteExibicao: new FormControl('', { nonNullable: true }),
  });
}

export function valoresDoDescritivo(fato: FatoCandidatoDto) {
  return {
    nome: fato.descritivo.nome,
    descricao: fato.descritivo.descricao,
    componenteExibicao: fato.descritivo.componenteExibicao?.codigo ?? '',
  };
}

/** A edição é integral: o componente vai sempre, e o vazio o limpa. */
export function comandoDoDescritivo(form: DescritivoForm): DescritivoDoFatoInput {
  const { nome, descricao, componenteExibicao } = form.getRawValue();
  return {
    nome: nome.trim(),
    descricao: descricao.trim(),
    componenteExibicao: componenteEscolhido(componenteExibicao),
  };
}

function controleDaFinalidade() {
  return new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(LIMITES_DO_FATO.finalidadeTratamento)],
  });
}

export function criarFormularioDaDefinicao() {
  const obrigatorio = { nonNullable: true as const, validators: [Validators.required] };
  return new FormGroup({
    dominio: new FormControl('', { nonNullable: true }),
    cardinalidade: controleDaQuantidade(),
    fonteValores: new FormControl('', { nonNullable: true }),
    formato: new FormControl('', { nonNullable: true }),
    escopo: new FormControl('CANDIDATO', { nonNullable: true }),
    pontoResolucao: new FormControl('', obrigatorio),
    classificacaoProtecao: new FormControl('', obrigatorio),
    finalidadeTratamento: controleDaFinalidade(),
    hipoteseLegal: new FormControl('', obrigatorio),
  });
}

export function valoresDaDefinicao(fato: FatoCandidatoDto): DefinicaoEmEdicao {
  const { definicao } = fato;
  return {
    ...protecaoDoFato(fato),
    dominio: definicao.dominio.codigo,
    cardinalidade: definicao.cardinalidade.codigo,
    fonteValores: definicao.valores.fonte?.codigo ?? '',
    formato: definicao.formato?.codigo ?? '',
    escopo: definicao.escopo.codigo,
    pontoResolucao: definicao.resolucao.pontoResolucao,
  };
}

/** Finalidade só com espaços não é finalidade: a API a recusaria depois de aparar. */
export function exigirTextoNaFinalidade(form: DefinicaoForm): void {
  const controle = form.controls.finalidadeTratamento;
  if (obrigatorioNaoEmBranco(controle) !== null) {
    controle.setErrors({ required: true });
    controle.markAsTouched();
  }
}

function controleDoTextoDoValor() {
  return new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(LIMITES_DO_FATO.textoDoValor)],
  });
}

export function criarFormularioDaCorrecao() {
  return new FormGroup({
    descricao: controleDoTextoDoValor(),
    orientacao: controleDoTextoDoValor(),
  });
}

export function criarFormularioDoNovoValor() {
  return new FormGroup({
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, ...validadoresDoCodigo(LIMITES_DO_FATO.codigoDoValor)],
    }),
    descricao: controleDoTextoDoValor(),
    orientacao: controleDoTextoDoValor(),
  });
}

export function comandoDoNovoValor(form: NovoValorForm, ordem: number): ValorDominioInput {
  const { codigo, descricao, orientacao } = form.getRawValue();
  return {
    codigo,
    descricao: nullIfBlank(descricao),
    ordem,
    orientacao: nullIfBlank(orientacao),
  };
}

export function comandoDaCorrecao(form: CorrecaoForm): CorrecaoDeValorDominioInput {
  const { descricao, orientacao } = form.getRawValue();
  return { descricao: nullIfBlank(descricao), orientacao: nullIfBlank(orientacao) };
}

/** O que a definição deriva do que está digitada e do tipo do fato. */
export interface DependenciasDaDefinicao {
  readonly valores: Signal<DefinicaoEmEdicao>;
  readonly eixos: Signal<ReturnType<typeof eixosEditaveis>>;
  readonly dominios: Signal<readonly ItemDeVocabulario[]>;
  readonly classificacoes: Signal<ReturnType<typeof classificacoesDoDominio>>;
  readonly hipoteses: Signal<ReturnType<typeof hipotesesDoFato>>;
  readonly vocabularioDasHipoteses: WritableSignal<readonly ItemDeVocabulario[] | null>;
  readonly avisaNovaAprovacao: Signal<boolean>;
}

/**
 * Liga os campos da definição. A escolha que deixou de caber se esvazia, e fonte e formato só são
 * exigidos nos tipos que os têm. A proteção que veio do servidor fica como está ao abrir: só se
 * esvazia o que a pessoa tornou incompatível ao trocar o tipo de dado ou a classificação.
 * Chamar em contexto de injeção.
 */
export function ligarDependenciasDaDefinicao(
  form: DefinicaoForm,
  fato: Signal<FatoCandidatoDto | null>,
  tipo: Signal<TipoDoFato>,
  tiposDoDado: Signal<readonly TipoDoDado[]>,
): DependenciasDaDefinicao {
  const valores = valoresDoFormulario(form);
  const resultado = {
    valores,
    ...derivadosDosValores(valores, tipo),
    ...derivadosDoFato(valores, fato, tipo, tiposDoDado),
  };
  ajustarOsCamposAoQueMudou(form, fato, tipo, resultado);
  return resultado;
}

function derivadosDosValores(valores: Signal<DefinicaoEmEdicao>, tipo: Signal<TipoDoFato>) {
  const vocabularioDasHipoteses = signal<readonly ItemDeVocabulario[] | null>(null);
  return {
    vocabularioDasHipoteses,
    eixos: computed(() => eixosEditaveis(tipo(), valores().dominio)),
    classificacoes: computed(() => classificacoesDoDominio(valores().dominio)),
    hipoteses: computed(() =>
      hipotesesDoFato(valores().classificacaoProtecao, vocabularioDasHipoteses() ?? []),
    ),
  };
}

function derivadosDoFato(
  valores: Signal<DefinicaoEmEdicao>,
  fato: Signal<FatoCandidatoDto | null>,
  tipo: Signal<TipoDoFato>,
  tiposDoDado: Signal<readonly TipoDoDado[]>,
) {
  return {
    dominios: opcoesDeDominio(fato, tipo, tiposDoDado),
    avisaNovaAprovacao: computed(() => exigeNovaAprovacao(fato(), valores())),
  };
}

function opcoesDeDominio(
  fato: Signal<FatoCandidatoDto | null>,
  tipo: Signal<TipoDoFato>,
  tipos: Signal<readonly TipoDoDado[]>,
): Signal<readonly ItemDeVocabulario[]> {
  return computed(() => {
    const oferecidos = tipo() === 'DECLARADO' ? tipos() : tiposDoDadoDoDerivado(tipos());
    const atual = fato()?.definicao.dominio;
    return opcoesDoVocabulario(oferecidos, atual ? [atual] : []);
  });
}

function valoresDoFormulario(form: DefinicaoForm): Signal<DefinicaoEmEdicao> {
  return toSignal(form.valueChanges.pipe(map(() => form.getRawValue())), {
    initialValue: form.getRawValue(),
  });
}

function exigeNovaAprovacao(atual: FatoCandidatoDto | null, digitado: DefinicaoEmEdicao): boolean {
  return (
    atual !== null &&
    atual.definicao.protecao.aprovacao.situacao !== 'PENDENTE' &&
    protecaoMudou(valoresDaDefinicao(atual), digitado)
  );
}

type Derivados = Pick<
  DependenciasDaDefinicao,
  'eixos' | 'classificacoes' | 'hipoteses' | 'vocabularioDasHipoteses'
>;

/** Lê os derivados dentro do efeito, para que ele acompanhe cada um. */
function lerDerivados(derivados: Derivados, tipo: Signal<TipoDoFato>) {
  return {
    hipoteses: derivados.vocabularioDasHipoteses() ? derivados.hipoteses() : null,
    classificacoes: derivados.classificacoes(),
    eixos: derivados.eixos(),
    doTipo: eixosDoTipo(tipo()),
  };
}

function ajustarOsCamposAoQueMudou(
  form: DefinicaoForm,
  fato: Signal<FatoCandidatoDto | null>,
  tipo: Signal<TipoDoFato>,
  derivados: Derivados,
): void {
  effect(() => {
    const lido = lerDerivados(derivados, tipo);
    untracked(() => {
      esvaziarProtecaoIncompativel(form, fato(), lido.classificacoes, lido.hipoteses);
      exigirOsEixosDoTipo(form, lido.eixos, lido.doTipo);
    });
  });
}

/** Eixo que o tipo do fato não edita guarda o valor do servidor: nem se exige, nem se esvazia. */
function exigirOsEixosDoTipo(
  form: DefinicaoForm,
  exigidos: ReturnType<typeof eixosEditaveis>,
  doTipo: ReturnType<typeof eixosDoTipo>,
): void {
  exigirSe(form.controls.dominio, exigidos.dominio, doTipo.dominio);
  exigirSe(form.controls.fonteValores, exigidos.fonteValores, doTipo.fonteValores);
  exigirSe(form.controls.formato, exigidos.formato, doTipo.formato);
}

/** O que a pessoa mexeu em relação ao servidor; sem fato carregado, tudo conta como mexido. */
function mexidoDesdeOServidor(form: DefinicaoForm, servidor: FatoCandidatoDto | null) {
  const original = servidor === null ? null : valoresDaDefinicao(servidor);
  const mexido = (campo: keyof DefinicaoEmEdicao): boolean =>
    original === null || form.controls[campo].value !== original[campo];
  return {
    dominio: mexido('dominio'),
    classificacao: mexido('classificacaoProtecao'),
    hipotese: mexido('hipoteseLegal'),
  };
}

function esvaziarProtecaoIncompativel(
  form: DefinicaoForm,
  servidor: FatoCandidatoDto | null,
  classificacoes: ReturnType<typeof classificacoesDoDominio>,
  hipoteses: ReturnType<typeof hipotesesDoFato> | null,
): void {
  const mexido = mexidoDesdeOServidor(form, servidor);
  if (mexido.dominio || mexido.classificacao) {
    esvaziarSeForaDas(form.controls.classificacaoProtecao, classificacoes);
  }
  if (hipoteses !== null && (mexido.classificacao || mexido.hipotese)) {
    esvaziarSeForaDas(form.controls.hipoteseLegal, hipoteses);
  }
}
