import { computed, inject, Injectable, Injector } from '@angular/core';
import { TipoMotivoDeDecisaoCodigo } from '@uniplus/shared-data/selecao';
import type { CondicaoEmClausula } from '@uniplus/shared-inscricao/formulario';

import type { RegraDeHomologacao } from '../../../modelos/homologacao.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { focarAposRenderizar } from '../../../shared/foco-apos-renderizar';
import {
  comAlternativaIncluida,
  comCondicaoIncluida,
  comEdicaoDaCondicao,
  comEnquadramentoDaCondicao,
  comMotivoDaCondicao,
  comResultado,
  comTipoDaCondicao,
  regraNova,
  semAlternativa,
  semCondicao,
  semRegra,
  type PosicaoDaCondicao,
} from '../../../shared/homologacao/regra-de-homologacao';
import { TIPOS_DE_CONDICAO_DE_HOMOLOGACAO } from '../../../shared/homologacao/tipos-de-condicao-de-homologacao';
import { FormularioDoCronograma } from '../../cronograma/servicos/formulario-do-cronograma.service';
import { FaseEmEdicao } from '../fase-em-edicao';
import {
  SUFIXO_DO_BOTAO_DE_DECLARAR,
  SUFIXO_DO_BOTAO_DE_INCLUIR_ALTERNATIVA,
  SUFIXO_DO_RESULTADO,
  sufixoDaCondicao,
  sufixoDoBotaoDeIncluirCondicao,
} from './ids-da-homologacao';
import { recusasDoAltoDaRegra, recusasDoCampoDaHomologacao } from './recusas-da-homologacao';

/** O tipo de decisão cuja declaração abre a regra de homologação das inscrições. */
export const TIPO_DE_DECISAO_DA_HOMOLOGACAO = TipoMotivoDeDecisaoCodigo.HOMOLOGACAO_DAS_INSCRICOES;

/** O sufixo da caixa que declara a decisão, na seção de decisões da fase. */
export const SUFIXO_DA_CAIXA_DA_DECISAO = `tipos-de-decisao-${TIPO_DE_DECISAO_DA_HOMOLOGACAO}`;

/** O tipo com que a condição nasce: o primeiro que a API oferece. */
const TIPO_INICIAL = TIPOS_DE_CONDICAO_DE_HOMOLOGACAO[0]?.valor ?? '';

/**
 * A regra de homologação das inscrições da fase aberta, como o formulário da fase a guarda: lê o
 * que há, grava cada edição de volta nele e leva o foco ao que a pessoa vai usar a seguir. É o
 * formulário que atualiza o rascunho, e o servidor só recebe a regra na gravação do cronograma.
 */
@Injectable()
export class RegraDeHomologacaoDaFase {
  private readonly faseEmEdicao = inject(FaseEmEdicao);
  private readonly cronograma = inject(FormularioDoCronograma);
  private readonly injetor = inject(Injector);
  private readonly espelho = this.faseEmEdicao.espelho;

  private readonly processo = inject(ProcessoSeletivoStore);

  readonly idDaFase = this.faseEmEdicao.idDaFase;
  readonly problemaLocal = this.faseEmEdicao.problemaLocal;
  readonly erroDoCampo = this.faseEmEdicao.erroDoCampo;
  readonly emConsulta = this.processo.emConsulta;
  readonly edicaoLiberada = this.cronograma.edicaoLiberada;

  /** A regra da fase; `null` é a fase sem a capacidade de homologar. */
  readonly regra = computed<RegraDeHomologacao | null>(() => {
    this.espelho.versao();
    return this.espelho.formulario()?.controls.regraDeHomologacao.value ?? null;
  });

  /** A fase declara a decisão "Homologação das inscrições". */
  readonly tipoDeclarado = computed(() => {
    this.espelho.versao();
    const declarados = this.espelho.formulario()?.controls.tiposDeDecisao.value ?? [];
    return declarados.includes(TIPO_DE_DECISAO_DA_HOMOLOGACAO);
  });

  /** As recusas do alto da regra: as que não cabem num campo ou que serão conferidas de novo. */
  readonly recusasDoAlto = computed(() => {
    const regra = this.regra();
    return regra === null
      ? []
      : recusasDoAltoDaRegra(this.faseEmEdicao.recusasDaHomologacao(), regra);
  });

  readonly recusasDoCampo = (campo: string) =>
    recusasDoCampoDaHomologacao(this.faseEmEdicao.recusasDaHomologacao(), campo);

  declarar(): void {
    this.escrever(regraNova());
    this.focar(SUFIXO_DO_RESULTADO);
  }

  /**
   * Sem a decisão declarada, a seção só existia por causa da regra e sai com ela: o foco vai então
   * à caixa que declara a decisão, que continua na fase.
   */
  retirar(): void {
    this.escrever(semRegra());
    this.focar(SUFIXO_DO_BOTAO_DE_DECLARAR, SUFIXO_DA_CAIXA_DA_DECISAO);
  }

  apontarResultado(codigo: string): void {
    this.alterar((regra) => comResultado(regra, codigo === '' ? null : codigo));
  }

  incluirAlternativa(): void {
    const nova = this.regra()?.alternativas.length ?? 0;
    this.alterar((regra) => comAlternativaIncluida(regra, TIPO_INICIAL));
    this.focarNaCondicaoNova(nova, 0);
  }

  removerAlternativa(alternativa: number): void {
    this.alterar((regra) => semAlternativa(regra, alternativa));
    this.focar(SUFIXO_DO_BOTAO_DE_INCLUIR_ALTERNATIVA);
  }

  incluirCondicao(alternativa: number): void {
    const nova = this.regra()?.alternativas[alternativa]?.condicoes.length ?? 0;
    this.alterar((regra) => comCondicaoIncluida(regra, alternativa, TIPO_INICIAL));
    this.focarNaCondicaoNova(alternativa, nova);
  }

  removerCondicao(posicao: PosicaoDaCondicao): void {
    this.alterar((regra) => semCondicao(regra, posicao));
    this.focar(
      sufixoDoBotaoDeIncluirCondicao(posicao.alternativa),
      SUFIXO_DO_BOTAO_DE_INCLUIR_ALTERNATIVA,
    );
  }

  trocarTipo(posicao: PosicaoDaCondicao, tipo: string): void {
    this.alterar((regra) => comTipoDaCondicao(regra, posicao, tipo));
  }

  /** O texto vazio é a edição ainda não escolhida. */
  trocarEdicao(posicao: PosicaoDaCondicao, ano: string): void {
    this.alterar((regra) => comEdicaoDaCondicao(regra, posicao, ano === '' ? null : Number(ano)));
  }

  trocarMotivo(posicao: PosicaoDaCondicao, codigo: string): void {
    this.alterar((regra) => comMotivoDaCondicao(regra, posicao, codigo === '' ? null : codigo));
  }

  trocarEnquadramento(
    posicao: PosicaoDaCondicao,
    enquadramento: readonly CondicaoEmClausula[],
  ): void {
    this.alterar((regra) => comEnquadramentoDaCondicao(regra, posicao, enquadramento));
  }

  private alterar(troca: (regra: RegraDeHomologacao) => RegraDeHomologacao): void {
    const atual = this.regra();
    if (atual !== null) this.escrever(troca(atual));
  }

  private escrever(regra: RegraDeHomologacao | null): void {
    this.espelho.formulario()?.controls.regraDeHomologacao.setValue(regra);
  }

  /** O campo da edição é o primeiro que a condição nova pede; sem edição declarada, o do tipo. */
  private focarNaCondicaoNova(alternativa: number, condicao: number): void {
    this.focar(
      sufixoDaCondicao(alternativa, condicao, 'edicaoDoExame'),
      sufixoDaCondicao(alternativa, condicao, 'tipo'),
    );
  }

  private focar(...sufixos: readonly string[]): void {
    focarAposRenderizar(this.injetor, ...sufixos.map((sufixo) => this.idDaFase(sufixo)));
  }
}
