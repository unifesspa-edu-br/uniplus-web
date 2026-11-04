import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ControlContainer, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ValorEmConsultaComponent, ValorLegivelDirective } from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CatalogosDoCronograma } from '../../cronograma/catalogos-do-cronograma.service';
import { FaseEmEdicao } from '../fase-em-edicao';

/**
 * Unidades de prazo que o domínio aceita, com o rótulo que o operador lê. Dia
 * corrido fica de fora de propósito: o domínio o recusa na interposição, e
 * oferecê-lo seria convidar a uma gravação que volta recusada.
 */
const UNIDADES = [
  { valor: 'diasUteis', rotulo: 'dias úteis' },
  { valor: 'horas', rotulo: 'horas' },
] as const;

/** Os controles de um par prazo e unidade, como o ng-template compartilhado os desenha. */
interface ParComUnidade {
  readonly sufixo: string;
  readonly rotuloDoValor: string;
  readonly rotuloDaUnidade: string;
  readonly controleDoValor: string;
  readonly controleDaUnidade: string;
  readonly opcaoVazia: string;
  readonly invalidoNoValor: 'true' | null;
  readonly invalidoNaUnidade: 'true' | null;
  readonly descritoPor: string;
}

type Instancia = 'PrimeiraInstancia' | 'SegundaInstancia';

const ROTULO_DA_INSTANCIA: Readonly<Record<Instancia, string>> = {
  PrimeiraInstancia: '1ª',
  SegundaInstancia: '2ª',
};

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
  private readonly catalogos = inject(CatalogosDoCronograma);
  private readonly faseEmEdicao = inject(FaseEmEdicao);
  private readonly espelho = this.faseEmEdicao.espelho;

  protected readonly formulario = this.espelho.formulario;
  protected readonly idDaFase = this.faseEmEdicao.idDaFase;
  protected readonly erroDoCampo = this.faseEmEdicao.erroDoCampo;
  protected readonly ancorasPossiveis = this.faseEmEdicao.ancorasPossiveis;
  protected readonly unidades = UNIDADES;

  /** Regras de prazo de recurso publicadas no catálogo versionado. */
  protected readonly regrasDeRecurso = computed(() =>
    this.catalogos
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
      opcaoVazia: 'Selecione…',
      invalidoNoValor: erro,
      invalidoNaUnidade: erro,
      descritoPor:
        erro === null
          ? this.idDaFase('prazo-ajuda')
          : this.idDaFase('prazo-erro') + ' ' + this.idDaFase('prazo-ajuda'),
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

    const rotulosDosAtos = this.catalogos.rotuloDoAto();
    const nomeDoAto = (codigo: string): string => rotulosDosAtos.get(codigo) ?? codigo;
    const par = (valor: string, unidade: string): string =>
      valor === ''
        ? ''
        : `${valor} ${UNIDADES.find((u) => u.valor === unidade)?.rotulo ?? unidade}`;
    const recurso = form.controls.recurso.controls;

    return {
      admiteRecurso: form.controls.admiteRecurso.value,
      regraDeRecurso: recurso.regraCodigo.value
        ? `${recurso.regraCodigo.value} · versão ${recurso.regraVersao.value}`
        : null,
      prazo: par(recurso.prazoValor.value, recurso.prazoUnidade.value) || null,
      publicacaoDoPrazo: recurso.atoAncoraCodigo.value
        ? nomeDoAto(recurso.atoAncoraCodigo.value)
        : null,
      suspensividadePrimeiraInstancia:
        par(
          recurso.suspensividadePrimeiraInstanciaValor.value,
          recurso.suspensividadePrimeiraInstanciaUnidade.value,
        ) || null,
      admiteInstanciaSuperior: recurso.admiteInstanciaSuperior.value,
      suspensividadeSegundaInstancia:
        recurso.admiteInstanciaSuperior.value === true
          ? par(
              recurso.suspensividadeSegundaInstanciaValor.value,
              recurso.suspensividadeSegundaInstanciaUnidade.value,
            ) || null
          : null,
    };
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
      opcaoVazia: 'Sem suspensividade',
      invalidoNoValor: this.erroDoCampo(campo) ? 'true' : null,
      invalidoNaUnidade: null,
      descritoPor: this.idDaFase('susp-ajuda'),
    };
  }
}
