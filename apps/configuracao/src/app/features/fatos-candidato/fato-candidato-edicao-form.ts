import { Signal, computed, effect, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { map } from 'rxjs';
import type {
  CorrecaoDeValorDominioInput,
  DescritivoDoFatoInput,
  FatoCandidatoDto,
  ValorDominioInput,
} from '@uniplus/shared-data/configuracao';
import { nullIfBlank } from '../../shared/formulario';
import {
  esvaziarSeForaDas,
  hipotesesDaClassificacao,
  protecaoMudou,
} from '../../shared/protecao-do-catalogo';
import { LIMITES_DO_FATO } from './fato-candidato-form';
import {
  DOMINIOS,
  DOMINIOS_DO_DERIVADO,
  classificacoesDoDominio,
  eixosDoTipo,
  eixosEditaveis,
  exigirSe,
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
    nome: fato.nome,
    descricao: fato.descricao ?? '',
    componenteExibicao: fato.componenteExibicao ?? '',
  };
}

/** A edição é integral: o componente vai sempre, e o vazio o limpa. */
export function comandoDoDescritivo(form: DescritivoForm): DescritivoDoFatoInput {
  const { nome, descricao, componenteExibicao } = form.getRawValue();
  return {
    nome: nome.trim(),
    descricao: descricao.trim(),
    componenteExibicao: componenteExibicao || null,
  };
}

export function criarFormularioDaDefinicao() {
  const obrigatorio = { nonNullable: true as const, validators: [Validators.required] };
  return new FormGroup({
    dominio: new FormControl('', { nonNullable: true }),
    cardinalidade: new FormControl('ESCALAR', { nonNullable: true }),
    fonteValores: new FormControl('', { nonNullable: true }),
    formato: new FormControl('', { nonNullable: true }),
    escopo: new FormControl('CANDIDATO', { nonNullable: true }),
    pontoResolucao: new FormControl('', obrigatorio),
    classificacaoProtecao: new FormControl('', obrigatorio),
    finalidadeTratamento: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(LIMITES_DO_FATO.finalidadeTratamento)],
    }),
    hipoteseLegal: new FormControl('', obrigatorio),
  });
}

export function valoresDaDefinicao(fato: FatoCandidatoDto): DefinicaoEmEdicao {
  return {
    dominio: fato.dominio,
    cardinalidade: fato.cardinalidade,
    fonteValores: fato.fonteValores ?? '',
    formato: fato.formato ?? '',
    escopo: fato.escopo,
    pontoResolucao: fato.pontoResolucao,
    classificacaoProtecao: fato.classificacaoProtecao,
    finalidadeTratamento: fato.finalidadeTratamento,
    hipoteseLegal: fato.hipoteseLegal,
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

export function criarFormularioDaCorrecao() {
  return new FormGroup({
    descricao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(LIMITES_DO_FATO.textoDoValor)],
    }),
    orientacao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(LIMITES_DO_FATO.textoDoValor)],
    }),
  });
}

export function criarFormularioDoNovoValor() {
  return new FormGroup({
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(LIMITES_DO_FATO.codigoDoValor)],
    }),
    descricao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(LIMITES_DO_FATO.textoDoValor)],
    }),
    orientacao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(LIMITES_DO_FATO.textoDoValor)],
    }),
  });
}

export function comandoDoNovoValor(form: NovoValorForm, ordem: number): ValorDominioInput {
  const { codigo, descricao, orientacao } = form.getRawValue();
  return {
    codigo: codigo.trim().toLocaleUpperCase('pt-BR'),
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
  readonly dominios: Signal<typeof DOMINIOS>;
  readonly classificacoes: Signal<ReturnType<typeof classificacoesDoDominio>>;
  readonly hipoteses: Signal<ReturnType<typeof hipotesesDaClassificacao>>;
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
): DependenciasDaDefinicao {
  const valores = toSignal(form.valueChanges.pipe(map(() => form.getRawValue())), {
    initialValue: form.getRawValue(),
  });
  const eixos = computed(() => eixosEditaveis(tipo(), valores().dominio));
  const classificacoes = computed(() => classificacoesDoDominio(valores().dominio));
  const hipoteses = computed(() => hipotesesDaClassificacao(valores().classificacaoProtecao));
  const dominios = computed(() => (tipo() === 'DECLARADO' ? DOMINIOS : DOMINIOS_DO_DERIVADO));
  const avisaNovaAprovacao = computed(() => {
    const atual = fato();
    return (
      atual !== null && atual.aprovacao.situacao !== 'PENDENTE' && protecaoMudou(atual, valores())
    );
  });

  effect(() => {
    const [c, h, e, doTipo] = [classificacoes(), hipoteses(), eixos(), eixosDoTipo(tipo())];
    untracked(() => {
      esvaziarProtecaoIncompativel(form, fato(), c, h);
      // Eixo que o tipo do fato não edita guarda o valor do servidor: nem se exige, nem se esvazia.
      exigirSe(form.controls.dominio, e.dominio, doTipo.dominio);
      exigirSe(form.controls.fonteValores, e.fonteValores, doTipo.fonteValores);
      exigirSe(form.controls.formato, e.formato, doTipo.formato);
    });
  });

  return { valores, eixos, dominios, classificacoes, hipoteses, avisaNovaAprovacao };
}

function esvaziarProtecaoIncompativel(
  form: DefinicaoForm,
  servidor: FatoCandidatoDto | null,
  classificacoes: ReturnType<typeof classificacoesDoDominio>,
  hipoteses: ReturnType<typeof hipotesesDaClassificacao>,
): void {
  const { dominio, classificacaoProtecao, hipoteseLegal } = form.controls;
  const dominioMudou = servidor !== null && dominio.value !== servidor.dominio;
  const classificacaoMudou =
    servidor !== null && classificacaoProtecao.value !== servidor.classificacaoProtecao;
  if (dominioMudou || classificacaoMudou || servidor === null) {
    esvaziarSeForaDas(classificacaoProtecao, classificacoes);
  }
  if (classificacaoMudou || servidor === null || hipoteseLegal.value !== servidor.hipoteseLegal) {
    esvaziarSeForaDas(hipoteseLegal, hipoteses);
  }
}
