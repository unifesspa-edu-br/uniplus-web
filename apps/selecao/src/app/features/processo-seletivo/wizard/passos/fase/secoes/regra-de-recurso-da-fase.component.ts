import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ControlContainer, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ValorEmConsultaComponent, ValorLegivelDirective } from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CatalogoDeAtos } from '../../cronograma/catalogos/catalogo-de-atos.service';
import { CatalogoDeRegras } from '../../cronograma/catalogos/catalogo-de-regras.service';
import {
  prazoEmTexto,
  UNIDADES_DA_INTERPOSICAO,
  UNIDADES_DA_SUSPENSIVIDADE,
  type UnidadeDePrazoDoRecurso,
} from '../../../shared/unidades-de-prazo-do-recurso';
import { ProcedimentosDoRecursoComponent } from '../../cronograma/procedimentos-do-recurso/procedimentos-do-recurso.component';
import { RecusasDoCampoComponent } from '../../../shared/recusas/recusas-do-campo.component';
import type { CampoDaRecusaDaFase } from '../campo-da-fase';
import { FaseEmEdicao } from '../fase-em-edicao';
import {
  BLOCO_DAS_RECUSAS_DO_RECURSO,
  CAMPOS_DO_RECURSO_COM_CONTROLE,
  sufixoDaRecusaDoRecurso,
} from '../ids-da-fase';

/** Os controles de um par prazo e unidade, como o ng-template compartilhado os desenha. */
interface ParComUnidade {
  readonly sufixo: string;
  readonly rotuloDoValor: string;
  readonly rotuloDaUnidade: string;
  readonly controleDoValor: string;
  readonly controleDaUnidade: string;
  readonly opcaoVazia: string;
  readonly unidades: readonly UnidadeDePrazoDoRecurso[];
  readonly invalidoNoValor: 'true' | null;
  readonly invalidoNaUnidade: 'true' | null;
  readonly descritoPor: string;
}

/** O que o seletor de unidade oferece: a opção em branco e as unidades que o contrato admite. */
type OpcoesDeUnidade = Pick<ParComUnidade, 'opcaoVazia' | 'unidades'>;

const OPCOES_DA_INTERPOSICAO: OpcoesDeUnidade = {
  opcaoVazia: 'Selecione…',
  unidades: UNIDADES_DA_INTERPOSICAO,
};

const OPCOES_DA_SUSPENSIVIDADE: OpcoesDeUnidade = {
  opcaoVazia: 'Sem suspensividade',
  unidades: UNIDADES_DA_SUSPENSIVIDADE,
};

type Instancia = 'PrimeiraInstancia' | 'SegundaInstancia';

const INSTANCIAS = {
  PrimeiraInstancia: { rotulo: '1ª', sufixo: 'susp1' },
  SegundaInstancia: { rotulo: '2ª', sufixo: 'susp2' },
} as const;

type RecursoDaFase = NonNullable<
  ReturnType<FaseEmEdicao['espelho']['formulario']>
>['controls']['recurso']['controls'];

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

  protected readonly formulario = this.espelho.formulario;
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

  protected readonly prazo = computed<ParComUnidade>(() => {
    return {
      sufixo: 'prazo',
      rotuloDoValor: 'Prazo de interposição',
      rotuloDaUnidade: 'Unidade do prazo',
      controleDoValor: 'prazoValor',
      controleDaUnidade: 'prazoUnidade',
      ...OPCOES_DA_INTERPOSICAO,
      ...this.estadoDoPar('recurso.prazo', 'prazo', 'prazo-ajuda'),
    };
  });

  protected readonly suspensividadeDaPrimeiraInstancia = computed(() =>
    this.suspensividade('PrimeiraInstancia'),
  );

  protected readonly suspensividadeDaSegundaInstancia = computed(() =>
    this.suspensividade('SegundaInstancia'),
  );

  /**
   * A regra é identificada por código **e** versão: publicar versão nova do
   * catálogo não pode mudar a regra que um processo já aplicou. Escolher pelo
   * código e deduzir a versão do que está carregado é o que mantém o par
   * coerente — gravar código novo com versão velha é recusado.
   */
  protected escolherRegra(codigo: string): void {
    const grupo = this.espelho.formulario();
    if (grupo === null) return;

    const versao = this.regrasDeRecurso().find((regra) => regra.codigo === codigo)?.versao ?? '';
    grupo.controls.recurso.controls.regraCodigo.setValue(codigo);
    grupo.controls.recurso.controls.regraVersao.setValue(versao);
  }

  /** A leitura da consulta: a regra de recurso em texto, sem os controles que a editam. */
  protected faseLida() {
    const form = this.espelho.formulario();
    if (form === null) return null;
    this.espelho.versao();

    const recurso = form.controls.recurso.controls;

    return {
      admiteRecurso: form.controls.admiteRecurso.value,
      regraDeRecurso: regraDeRecursoLida(recurso),
      prazo: prazoEmTexto(recurso.prazoValor.value, recurso.prazoUnidade.value) || null,
      publicacaoDoPrazo: this.publicacaoDoPrazoLida(recurso.atoAncoraCodigo.value),
      ...suspensividadesLidas(recurso),
    };
  }

  private publicacaoDoPrazoLida(codigo: string): string | null {
    return codigo ? (this.catalogoDeAtos.rotuloDoAto().get(codigo) ?? codigo) : null;
  }

  /** O que descreve o campo além da ajuda: o problema local, quando há, e as recusas do servidor a ele. */
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
    const recurso = this.espelho.formulario()?.controls;
    if (!CAMPOS_DO_RECURSO_COM_CONTROLE.has(campo) || recurso === undefined) return false;
    if (!recurso.admiteRecurso.value) return false;
    return (
      campo !== 'recurso.suspensividadeSegundaInstancia' ||
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
    return [...this.idsDoErro(campo, idDoProblema), this.idDaFase(idDaAjuda)].join(' ');
  }

  private suspensividade(instancia: Instancia): ParComUnidade {
    const { rotulo, sufixo } = INSTANCIAS[instancia];
    const campo = `recurso.suspensividade${instancia}` as const;
    return {
      sufixo,
      rotuloDoValor: `Suspensividade da ${rotulo} instância — prazo`,
      rotuloDaUnidade: `Suspensividade da ${rotulo} instância — unidade`,
      controleDoValor: `suspensividade${instancia}Valor`,
      controleDaUnidade: `suspensividade${instancia}Unidade`,
      ...OPCOES_DA_SUSPENSIVIDADE,
      ...this.estadoDoPar(campo, sufixo, 'susp-ajuda'),
    };
  }

  /** O que marca o par como inválido e o que o descreve, conforme o problema local e as recusas do campo. */
  private estadoDoPar(campo: CampoDaRecusaDaFase, par: string, idDaAjuda: string) {
    const erro = this.erroDoCampo(campo) ? ('true' as const) : null;
    const descritoPor = this.descritoPor(campo, `${par}-erro`, idDaAjuda);
    return { invalidoNoValor: erro, invalidoNaUnidade: erro, descritoPor };
  }
}
