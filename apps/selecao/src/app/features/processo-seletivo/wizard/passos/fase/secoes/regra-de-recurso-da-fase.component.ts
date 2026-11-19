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
import { FaseEmEdicao } from '../fase-em-edicao';

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

const ROTULO_DA_INSTANCIA: Readonly<Record<Instancia, string>> = {
  PrimeiraInstancia: '1ª',
  SegundaInstancia: '2ª',
};

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
    FormsModule,
    NgTemplateOutlet,
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
  protected readonly erroDoCampo = this.faseEmEdicao.erroDoCampo;
  protected readonly ancorasPossiveis = this.faseEmEdicao.ancorasPossiveis;

  /** Regras de prazo de recurso publicadas no catálogo versionado. */
  protected readonly regrasDeRecurso = computed(() =>
    this.catalogoDeRegras
      .regrasRecurso()
      .map((regra) => ({ codigo: regra.codigo, versao: regra.versao, baseLegal: regra.baseLegal })),
  );

  protected readonly prazo = computed<ParComUnidade>(() => {
    const erro = this.erroDoCampo('recurso.prazo') ? ('true' as const) : null;
    return {
      sufixo: 'prazo',
      rotuloDoValor: 'Prazo de interposição',
      rotuloDaUnidade: 'Unidade do prazo',
      controleDoValor: 'prazoValor',
      controleDaUnidade: 'prazoUnidade',
      ...OPCOES_DA_INTERPOSICAO,
      invalidoNoValor: erro,
      invalidoNaUnidade: erro,
      descritoPor: this.descritoPeloPrazo(erro),
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

  private descritoPeloPrazo(erro: 'true' | null): string {
    const ajuda = this.idDaFase('prazo-ajuda');
    return erro === null ? ajuda : `${this.idDaFase('prazo-erro')} ${ajuda}`;
  }

  private suspensividade(instancia: Instancia): ParComUnidade {
    const rotulo = ROTULO_DA_INSTANCIA[instancia];
    const campo = `recurso.suspensividade${instancia}` as const;
    return {
      sufixo: instancia === 'PrimeiraInstancia' ? 'susp1' : 'susp2',
      rotuloDoValor: `Suspensividade da ${rotulo} instância — prazo`,
      rotuloDaUnidade: `Suspensividade da ${rotulo} instância — unidade`,
      controleDoValor: `suspensividade${instancia}Valor`,
      controleDaUnidade: `suspensividade${instancia}Unidade`,
      ...OPCOES_DA_SUSPENSIVIDADE,
      invalidoNoValor: this.erroDoCampo(campo) ? 'true' : null,
      invalidoNaUnidade: null,
      descritoPor: this.idDaFase('susp-ajuda'),
    };
  }
}
