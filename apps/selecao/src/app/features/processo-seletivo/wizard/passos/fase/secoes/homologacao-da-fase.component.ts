import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ValorEmConsultaComponent } from '@uniplus/shared-ui/components';

import { descricaoDaRegraDeHomologacao } from '../../../shared/homologacao/descricao-da-regra-de-homologacao';
import { RecusasDoCampoComponent } from '../../../shared/recusas/recusas-do-campo.component';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { passoPeloRotulo } from '../../revisao/destino-das-pendencias';
import type { RotuloDePasso } from '../../../processo-seletivo.data';
import { rotuloDaEdicao } from '../../classificacao/edicoes-do-enem';
import { FaseEmEdicao } from '../fase-em-edicao';
import { AlternativaDeHomologacaoComponent } from '../homologacao/alternativa-de-homologacao.component';
import { PREFIXO_DA_HOMOLOGACAO } from '../homologacao/campo-da-homologacao';
import {
  sufixoDaRecusaDaHomologacao,
  SUFIXO_DO_BOTAO_DE_DECLARAR,
  SUFIXO_DO_BOTAO_DE_INCLUIR_ALTERNATIVA,
  SUFIXO_DO_RESULTADO,
  SUFIXO_DOS_AVISOS_DAS_EDICOES,
} from '../homologacao/ids-da-homologacao';
import { linhasDaRegraDeHomologacao } from '../homologacao/leitura-da-homologacao';
import { OfertasDaHomologacao } from '../homologacao/ofertas-da-homologacao';
import { opcoesDoResultado } from '../homologacao/opcoes-da-homologacao';
import {
  RegraDeHomologacaoDaFase,
  SUFIXO_DA_CAIXA_DA_DECISAO,
} from '../homologacao/regra-de-homologacao-da-fase';

const ROTULO_DO_PASSO_DA_FORMULA: RotuloDePasso = 'Fórmula e precisão';

/**
 * A regra com que a fase decide a homologação das inscrições: o resultado que publica a lista e as
 * alternativas (OU) de condições (E). Só aparece na fase que declara essa decisão ou que já tem a
 * regra, e nunca pelo código da fase. Em consulta, só se lê.
 */
@Component({
  selector: 'sel-homologacao-da-fase',
  imports: [AlternativaDeHomologacaoComponent, RecusasDoCampoComponent, ValorEmConsultaComponent],
  templateUrl: './homologacao-da-fase.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    .acoes {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .acoes > .btn {
      max-width: 100%;
      white-space: normal;
      text-align: start;
    }
  `,
})
export class HomologacaoDaFaseComponent {
  protected readonly regra = inject(RegraDeHomologacaoDaFase);
  private readonly ofertas = inject(OfertasDaHomologacao);
  private readonly processo = inject(ProcessoSeletivoStore);
  private readonly faseEmEdicao = inject(FaseEmEdicao);

  protected readonly nomeDoPassoDaFormula = ROTULO_DO_PASSO_DA_FORMULA;
  protected readonly sufixos = {
    resultado: SUFIXO_DO_RESULTADO,
    declarar: SUFIXO_DO_BOTAO_DE_DECLARAR,
    incluirAlternativa: SUFIXO_DO_BOTAO_DE_INCLUIR_ALTERNATIVA,
    semEdicoes: SUFIXO_DOS_AVISOS_DAS_EDICOES,
    recusasDoAlto: sufixoDaRecusaDaHomologacao(PREFIXO_DA_HOMOLOGACAO),
  } as const;
  protected readonly semEdicoesDeclaradas = computed(
    () => this.ofertas.edicoesDeclaradas().length === 0,
  );

  protected readonly resultados = computed(() =>
    opcoesDoResultado(
      this.faseEmEdicao.faseDoRascunho()?.produtos ?? [],
      this.regra.regra()?.resultadoAtoCodigo ?? null,
      this.ofertas.nomeDoAto(),
    ),
  );

  /** O resultado que a regra aponta, pelo nome do ato; `null` enquanto não apontado. */
  protected readonly resultadoLido = computed(() => {
    const codigo = this.regra.regra()?.resultadoAtoCodigo ?? null;
    return codigo === null ? null : this.ofertas.nomeDoAto()(codigo);
  });

  /** A regra em prosa, para quem confere sem abrir os campos. */
  protected readonly descricao = computed(() => {
    const regra = this.regra.regra();
    if (regra === null) return '';
    return descricaoDaRegraDeHomologacao(regra, this.ofertas.fatosParaLeitura(), rotuloDaEdicao);
  });

  protected readonly linhasDaConsulta = computed(() => {
    const regra = this.regra.regra();
    if (regra === null) return [];
    const motivos = this.ofertas.motivosDesfavoraveis();
    return linhasDaRegraDeHomologacao(regra, {
      fatos: this.ofertas.fatosParaLeitura(),
      edicao: rotuloDaEdicao,
      motivo: (codigo) => motivos.find((motivo) => motivo.codigo === codigo)?.descricao ?? codigo,
    });
  });

  protected id(sufixo: string): string {
    return this.regra.idDaFase(sufixo);
  }

  /** O que descreve o resultado: a recusa a ele e a ajuda que diz de onde vêm as opções. */
  protected idsDoResultado(): string {
    const recusa = this.regra.recusasDoCampo('homologacao.resultado').length > 0;
    const ids = [
      ...(recusa ? [this.id(sufixoDaRecusaDaHomologacao('homologacao.resultado'))] : []),
      this.id('homologacao-resultado-ajuda'),
    ];
    return ids.join(' ');
  }

  protected irParaAFormula(): void {
    this.processo.goTo(passoPeloRotulo(ROTULO_DO_PASSO_DA_FORMULA).indice);
  }

  /** Leva o foco à caixa que declara a decisão, na seção de decisões da própria fase. */
  protected irParaAsDecisoes(): void {
    document.getElementById(this.id(SUFIXO_DA_CAIXA_DA_DECISAO))?.focus();
  }
}
