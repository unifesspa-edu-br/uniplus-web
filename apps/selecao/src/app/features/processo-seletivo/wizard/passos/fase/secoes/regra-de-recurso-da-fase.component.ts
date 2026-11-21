import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ControlContainer, type FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { UnidadePrazo } from '@uniplus/shared-data/selecao';
import { ValorEmConsultaComponent, ValorLegivelDirective } from '@uniplus/shared-ui/components';

import { ehDaSegundaInstancia } from '../../../shared/recusas/controle-do-recurso';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CatalogoDeAtos } from '../../cronograma/catalogos/catalogo-de-atos.service';
import { CatalogoDeRegras } from '../../cronograma/catalogos/catalogo-de-regras.service';
import {
  prazoEmTexto,
  UNIDADES_DA_INTERPOSICAO,
  UNIDADES_DA_SUSPENSIVIDADE,
} from '../../../shared/unidades-de-prazo-do-recurso';
import {
  PrazoDoRecursoComponent,
  type IdsDoPrazo,
} from '../../../shared/configuracao-do-recurso/prazo-do-recurso.component';
import { ProcedimentosDoRecursoComponent } from '../../cronograma/procedimentos-do-recurso/procedimentos-do-recurso.component';
import { RecusasDoCampoComponent } from '../../../shared/recusas/recusas-do-campo.component';
import type { CampoDaRecusaDaFase } from '../campo-da-fase';
import type { CampoDaFase } from '../configuracao-da-fase';
import type { FaseConfigForm, UnidadeEscolhida } from '../fase-form';
import { FaseEmEdicao } from '../fase-em-edicao';
import {
  BLOCO_DAS_RECUSAS_DO_RECURSO,
  CAMPOS_DO_RECURSO_COM_CONTROLE,
  sufixoDaRecusaDoRecurso,
} from '../ids-da-fase';

type Instancia = 'PrimeiraInstancia' | 'SegundaInstancia';

/** Os campos do problema local que valem para um par de valor e unidade. */
type CampoDoParDaFase = Extract<
  CampoDaFase,
  | 'recurso.prazo'
  | 'recurso.suspensividadePrimeiraInstancia'
  | 'recurso.suspensividadeSegundaInstancia'
>;

const PREFIXO_DO_RECURSO = 'recurso.';

type ControleDeValor = 'prazoValor' | `suspensividade${Instancia}Valor`;
type ControleDeUnidade = 'prazoUnidade' | `suspensividade${Instancia}Unidade`;

/** O que a tela liga a cada prazo da regra: o campo do problema local, os controles e a ajuda. */
interface PrazoDaRegra {
  readonly sufixo: string;
  readonly campo: CampoDoParDaFase;
  readonly controleDoValor: ControleDeValor;
  readonly controleDaUnidade: ControleDeUnidade;
  readonly ajuda: string;
}

const PRAZO_DE_INTERPOSICAO: PrazoDaRegra = {
  sufixo: 'prazo',
  campo: 'recurso.prazo',
  controleDoValor: 'prazoValor',
  controleDaUnidade: 'prazoUnidade',
  ajuda: 'prazo-ajuda',
};

const SUSPENSIVIDADE_DA_PRIMEIRA_INSTANCIA: PrazoDaRegra = {
  sufixo: 'susp1',
  campo: 'recurso.suspensividadePrimeiraInstancia',
  controleDoValor: 'suspensividadePrimeiraInstanciaValor',
  controleDaUnidade: 'suspensividadePrimeiraInstanciaUnidade',
  ajuda: 'susp-ajuda',
};

const SUSPENSIVIDADE_DA_SEGUNDA_INSTANCIA: PrazoDaRegra = {
  sufixo: 'susp2',
  campo: 'recurso.suspensividadeSegundaInstancia',
  controleDoValor: 'suspensividadeSegundaInstanciaValor',
  controleDaUnidade: 'suspensividadeSegundaInstanciaUnidade',
  ajuda: 'susp-ajuda',
};

/** A unidade que o seletor devolveu como a do controle; o que não é unidade é a em branco. */
function unidadeEscolhida(codigo: string): UnidadeEscolhida {
  return Object.values(UnidadePrazo).find((unidade) => unidade === codigo) ?? '';
}

type RecursoDaFase = FormGroup<FaseConfigForm>['controls']['recurso']['controls'];

function suspensividadeLida(recurso: RecursoDaFase, instancia: Instancia): string {
  return prazoEmTexto(
    recurso[`suspensividade${instancia}Valor`].value,
    recurso[`suspensividade${instancia}Unidade`].value,
  );
}

/** As suspensividades das instâncias em texto; a da segunda só existe se o recurso admite instância superior. */
function suspensividadesLidas(recurso: RecursoDaFase) {
  const admiteSuperior = recurso.admiteInstanciaSuperior.value;
  const segunda = suspensividadeLida(recurso, 'SegundaInstancia');
  return {
    suspensividadePrimeiraInstancia: suspensividadeLida(recurso, 'PrimeiraInstancia') || null,
    admiteInstanciaSuperior: admiteSuperior,
    suspensividadeSegundaInstancia: admiteSuperior === true ? segunda || null : null,
  };
}

function regraDeRecursoLida(recurso: RecursoDaFase): string | null {
  const { regraCodigo, regraVersao } = recurso;
  return regraCodigo.value ? `${regraCodigo.value} · versão ${regraVersao.value}` : null;
}

/** A regra de recurso da fase: a regra de contagem, o prazo, a âncora e as suspensividades. */
@Component({
  selector: 'sel-regra-de-recurso-da-fase',
  imports: [
    RecusasDoCampoComponent,
    FormsModule,
    NgTemplateOutlet,
    PrazoDoRecursoComponent,
    ProcedimentosDoRecursoComponent,
    ReactiveFormsModule,
    ValorEmConsultaComponent,
    ValorLegivelDirective,
  ],
  templateUrl: './regra-de-recurso-da-fase.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
  viewProviders: [
    { provide: ControlContainer, useFactory: () => inject(ControlContainer, { skipSelf: true }) },
  ],
})
export class RegraDeRecursoDaFaseComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  private readonly catalogoDeAtos = inject(CatalogoDeAtos);
  private readonly catalogoDeRegras = inject(CatalogoDeRegras);
  private readonly faseEmEdicao = inject(FaseEmEdicao);
  private readonly espelho = this.faseEmEdicao.espelho;

  /** O formulário da fase aberta; o passo da fase só mostra esta seção com uma fase aberta. */
  readonly formulario = input.required<FormGroup<FaseConfigForm>>();
  protected readonly idDaFase = this.faseEmEdicao.idDaFase;
  protected readonly blocoDasRecusas = BLOCO_DAS_RECUSAS_DO_RECURSO;
  protected readonly erroDoCampo = this.faseEmEdicao.erroDoCampo;
  protected readonly problemaLocal = this.faseEmEdicao.problemaLocal;
  protected readonly recusasDoCampo = this.faseEmEdicao.recusasDoCampo;

  /**
   * As recusas à regra de recurso que não têm controle onde aparecer: as que não apontam um
   * controle dela e as de um controle que a tela não mostra agora. As demais ficam junto do
   * controle, e só ele as tem como descrição.
   */
  protected readonly recusasSemControle = computed(() =>
    this.faseEmEdicao.recusasDoRecurso().filter((recusa) => !this.temControle(recusa.campo)),
  );
  protected readonly ancorasPossiveis = this.faseEmEdicao.ancorasPossiveis;

  /** Regras de prazo de recurso publicadas no catálogo versionado. */
  protected readonly regrasDeRecurso = computed(() =>
    this.catalogoDeRegras
      .regrasRecurso()
      .map((regra) => ({ codigo: regra.codigo, versao: regra.versao, baseLegal: regra.baseLegal })),
  );

  protected readonly unidadesDaInterposicao = UNIDADES_DA_INTERPOSICAO;
  protected readonly unidadesDaSuspensividade = UNIDADES_DA_SUSPENSIVIDADE;

  protected readonly prazo = computed(() => this.entradasDo(PRAZO_DE_INTERPOSICAO));
  protected readonly suspensividadeDaPrimeiraInstancia = computed(() =>
    this.entradasDo(SUSPENSIVIDADE_DA_PRIMEIRA_INSTANCIA),
  );
  protected readonly suspensividadeDaSegundaInstancia = computed(() =>
    this.entradasDo(SUSPENSIVIDADE_DA_SEGUNDA_INSTANCIA),
  );

  /**
   * A regra é identificada por código **e** versão: publicar versão nova do
   * catálogo não pode mudar a regra que um processo já aplicou. Escolher pelo
   * código e deduzir a versão do que está carregado é o que mantém o par
   * coerente — gravar código novo com versão velha é recusado.
   */
  protected escolherRegra(codigo: string): void {
    const { regraCodigo, regraVersao } = this.formulario().controls.recurso.controls;
    const versao = this.regrasDeRecurso().find((regra) => regra.codigo === codigo)?.versao ?? '';
    regraCodigo.setValue(codigo);
    regraVersao.setValue(versao);
  }

  /** A leitura da consulta: a regra de recurso em texto, sem os controles que a editam. */
  protected faseLida() {
    const form = this.formulario().controls;
    this.espelho.versao();

    const recurso = form.recurso.controls;

    return {
      admiteRecurso: form.admiteRecurso.value,
      regraDeRecurso: regraDeRecursoLida(recurso),
      prazo: prazoEmTexto(recurso.prazoValor.value, recurso.prazoUnidade.value) || null,
      publicacaoDoPrazo: this.publicacaoDoPrazoLida(recurso.atoAncoraCodigo.value),
      ...suspensividadesLidas(recurso),
    };
  }

  private publicacaoDoPrazoLida(codigo: string): string | null {
    return codigo ? (this.catalogoDeAtos.rotuloDoAto().get(codigo) ?? codigo) : null;
  }

  /** O que descreve o controle além da ajuda: o problema local do campo e as recusas do servidor a ele. */
  private idsDoErro(campo: CampoDaRecusaDaFase, idDoProblema: string): string[] {
    const problema = this.problemaLocal(campo) === null ? [] : [this.idDaFase(idDoProblema)];
    const recusas = this.recusasDoCampo(campo).length === 0 ? [] : [this.idDaRecusa(campo)];
    return [...problema, ...recusas];
  }

  protected idDaRecusa(campo: CampoDaRecusaDaFase): string {
    return this.idDaFase(sufixoDaRecusaDoRecurso(campo));
  }

  private temControle(campo: string): boolean {
    this.espelho.versao();
    const recurso = this.formulario().controls;
    if (!CAMPOS_DO_RECURSO_COM_CONTROLE.has(campo)) return false;
    if (!recurso.admiteRecurso.value) return false;
    return (
      !ehDaSegundaInstancia(campo.slice(PREFIXO_DO_RECURSO.length)) ||
      recurso.recurso.controls.admiteInstanciaSuperior.value === true
    );
  }

  protected descritoPorErro(campo: CampoDaRecusaDaFase, idDoProblema: string): string | null {
    const ids = this.idsDoErro(campo, idDoProblema);
    return ids.length === 0 ? null : ids.join(' ');
  }

  protected descritoPor(
    campo: CampoDaRecusaDaFase,
    idDoProblema: string,
    idDaAjuda: string,
  ): string {
    const ids = this.idsDoErro(campo, idDoProblema);
    return [...ids, this.idDaFase(idDaAjuda)].join(' ');
  }

  /** Grava no formulário o valor digitado num prazo; a conferência e o rascunho seguem dele. */
  protected alterarValor(controle: ControleDeValor, valor: string): void {
    const campo = this.formulario().controls.recurso.controls[controle];
    campo.setValue(valor);
    campo.markAsDirty();
  }

  /** Grava no formulário a unidade escolhida num prazo. */
  protected alterarUnidade(controle: ControleDeUnidade, codigo: string): void {
    const campo = this.formulario().controls.recurso.controls[controle];
    campo.setValue(unidadeEscolhida(codigo));
    campo.markAsDirty();
  }

  /**
   * O que o prazo precisa da fase: o que está no formulário, o problema local, que vale para o
   * valor e para a unidade, e as recusas do servidor, cada uma só ao campo a que se refere, para
   * que a do valor não marque a unidade nem o contrário.
   */
  private entradasDo(prazo: PrazoDaRegra) {
    this.espelho.versao();
    const recurso = this.formulario().controls.recurso.controls;
    const { campo, controleDoValor, controleDaUnidade } = prazo;
    return {
      valor: recurso[controleDoValor].value,
      unidade: recurso[controleDaUnidade].value,
      problema: this.problemaLocal(campo),
      recusasDoValor: this.recusasDoCampo(`${campo}Valor`),
      recusasDaUnidade: this.recusasDoCampo(`${campo}Unidade`),
      ids: this.idsDo(prazo),
    };
  }

  private idsDo({ sufixo, campo, ajuda }: PrazoDaRegra): IdsDoPrazo {
    return {
      valor: this.idDaFase(`${sufixo}-valor`),
      unidade: this.idDaFase(`${sufixo}-unidade`),
      recusasDoValor: this.idDaRecusa(`${campo}Valor`),
      recusasDaUnidade: this.idDaRecusa(`${campo}Unidade`),
      problema: this.idDaFase(`${sufixo}-erro`),
      ajuda: this.idDaFase(ajuda),
    };
  }
}
