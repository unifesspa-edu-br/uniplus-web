import { FormularioDoCronograma } from '../../cronograma/servicos/formulario-do-cronograma.service';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ControlContainer, type FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ValorEmConsultaComponent, ValorLegivelDirective } from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { ParametrosDoRecursoEmConsultaComponent } from '../../../shared/configuracao-do-recurso/parametros-do-recurso-em-consulta.component';
import { ParametrosDoRecursoComponent } from '../../../shared/configuracao-do-recurso/parametros-do-recurso.component';
import {
  parametrosAlterados,
  prazoDaSegundaInstanciaRetirado,
  type AlteracaoDosParametros,
  type LeituraDoRecurso,
  type ParametrosAlterados,
  type ParametrosDoRecurso,
} from '../../../shared/configuracao-do-recurso/parametros-do-recurso';
import type { RecusaOrdenada } from '../../../shared/recusas/ordem-das-recusas';
import { RecusasDaConfiguracaoDoRecursoComponent } from '../../../shared/configuracao-do-recurso/recusas-da-configuracao-do-recurso.component';
import { RecusasDoCampoComponent } from '../../../shared/recusas/recusas-do-campo.component';
import { CatalogoDeAtos } from '../../cronograma/catalogos/catalogo-de-atos.service';
import { CatalogoDeRegras } from '../../cronograma/catalogos/catalogo-de-regras.service';
import { ProcedimentosDoRecursoComponent } from '../../cronograma/procedimentos-do-recurso/procedimentos-do-recurso.component';
import { alvosDaRecusaDaFase } from '../alvo-da-recusa-da-fase';
import type { CampoDaRecusaDaFase } from '../campo-da-fase';
import type { FaseConfigForm } from '../fase-form';
import { FaseEmEdicao } from '../fase-em-edicao';
import {
  BLOCO_DAS_RECUSAS_DO_RECURSO,
  PARAMETRO_DO_RECURSO,
  prefixoDoRecursoDaFase,
  sufixoDaRecusaDoRecurso,
} from '../ids-da-fase';

type RecursoDaFase = FormGroup<FaseConfigForm>['controls']['recurso']['controls'];

function regraDeRecursoLida(recurso: RecursoDaFase): string | null {
  const { regraCodigo, regraVersao } = recurso;
  return regraCodigo.value ? `${regraCodigo.value} · versão ${regraVersao.value}` : null;
}

/** A regra de recurso da fase: a regra de contagem, a publicação de que o prazo corre e os parâmetros. */
@Component({
  selector: 'sel-regra-de-recurso-da-fase',
  imports: [
    FormsModule,
    NgTemplateOutlet,
    ParametrosDoRecursoComponent,
    ParametrosDoRecursoEmConsultaComponent,
    ProcedimentosDoRecursoComponent,
    ReactiveFormsModule,
    RecusasDaConfiguracaoDoRecursoComponent,
    RecusasDoCampoComponent,
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
  protected readonly cronograma = inject(FormularioDoCronograma);
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
  protected readonly recusasDoRecurso = this.faseEmEdicao.recusasDoRecurso;
  protected readonly ancorasPossiveis = this.faseEmEdicao.ancorasPossiveis;

  protected readonly prefixoDosParametros = computed(() =>
    prefixoDoRecursoDaFase(this.faseEmEdicao.faseAberta()),
  );

  /** O que o componente dos parâmetros mostra: o que está no formulário, a cada digitação. */
  protected readonly parametros = computed<ParametrosDoRecurso>(() => {
    this.espelho.versao();
    return this.formulario().controls.recurso.getRawValue();
  });
  protected readonly leituraDoRecurso = computed<LeituraDoRecurso>(() => {
    this.espelho.versao();
    return this.formulario().controls.recurso.controls.leitura.value;
  });

  /** As recusas aos parâmetros, cada uma no nome que o componente comum dá ao campo. */
  protected readonly recusasDosParametros = computed<readonly RecusaOrdenada[]>(() =>
    this.recusasDoRecurso().flatMap((recusa) => {
      const campo = PARAMETRO_DO_RECURSO.get(recusa.campo);
      return campo === undefined ? [] : [{ ...recusa, campo }];
    }),
  );

  /** Regras de prazo de recurso publicadas no catálogo versionado. */
  protected readonly regrasDeRecurso = computed(() =>
    this.catalogoDeRegras
      .regrasRecurso()
      .map((regra) => ({ codigo: regra.codigo, versao: regra.versao, baseLegal: regra.baseLegal })),
  );

  /** Onde o foco vai para o campo recusado da regra de recurso: o mesmo da gravação recusada. */
  protected readonly alvosDoCampo = (campo: string): readonly string[] => {
    const fase = this.faseEmEdicao.faseDoRascunho();
    return fase === null ? [] : alvosDaRecusaDaFase(campo, fase, 0);
  };

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

    return {
      admiteRecurso: form.admiteRecurso.value,
      regraDeRecurso: regraDeRecursoLida(form.recurso.controls),
      publicacaoDoPrazo: this.publicacaoDoPrazoLida(form.recurso.controls.atoAncoraCodigo.value),
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

  protected alterarParametro(alteracao: AlteracaoDosParametros): void {
    this.escrever(parametrosAlterados(this.parametros(), this.leituraDoRecurso(), alteracao));
  }

  protected retirarOPrazoDaSegundaInstancia(): void {
    this.escrever(prazoDaSegundaInstanciaRetirado(this.parametros(), this.leituraDoRecurso()));
  }

  /** Grava no formulário o que a mudança decidiu; a conferência e o rascunho seguem dele. */
  private escrever({ parametros, leitura }: ParametrosAlterados): void {
    const recurso = this.formulario().controls.recurso;
    recurso.patchValue({ ...parametros, leitura });
    recurso.markAsDirty();
  }
}
