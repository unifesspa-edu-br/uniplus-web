import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { EditorDeCondicoesComponent } from '@uniplus/shared-inscricao/formulario';

import type { CondicaoDeHomologacao } from '../../../modelos/homologacao.models';
import type { PosicaoDaCondicao } from '../../../shared/homologacao/regra-de-homologacao';
import { opcoesDaEdicao } from '../../../shared/homologacao/edicoes-da-condicao';
import {
  rotuloDoTipoDeCondicao,
  TIPOS_DE_CONDICAO_DE_HOMOLOGACAO,
} from '../../../shared/homologacao/tipos-de-condicao-de-homologacao';
import { RecusasDoCampoComponent } from '../../../shared/recusas/recusas-do-campo.component';
import { rotuloDaEdicao } from '../../classificacao/edicoes-do-enem';
import type { CampoDaHomologacaoDaFase, ControleDaCondicao } from './campo-da-homologacao';
import {
  sufixoDaCondicao,
  sufixoDaRecusaDaHomologacao,
  sufixoDoProblemaDaHomologacao,
  SUFIXO_DOS_AVISOS_DAS_EDICOES,
} from './ids-da-homologacao';
import { OfertasDaHomologacao } from './ofertas-da-homologacao';
import { opcoesDoMotivo } from './opcoes-da-homologacao';
import { RegraDeHomologacaoDaFase } from './regra-de-homologacao-da-fase';

/**
 * Uma condição da regra de homologação das inscrições: o tipo, a edição do exame escolhida entre as
 * que o processo declara, o motivo desfavorável entre os que a fase escolheu e o enquadramento.
 * Cada mudança vai para a regra da fase pela posição da condição.
 */
@Component({
  selector: 'sel-condicao-de-homologacao',
  imports: [EditorDeCondicoesComponent, NgTemplateOutlet, RecusasDoCampoComponent],
  templateUrl: './condicao-de-homologacao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class CondicaoDeHomologacaoComponent {
  readonly alternativa = input.required<number>();
  readonly posicao = input.required<number>();
  readonly condicao = input.required<CondicaoDeHomologacao>();

  protected readonly regra = inject(RegraDeHomologacaoDaFase);
  private readonly ofertas = inject(OfertasDaHomologacao);

  protected readonly tipos = TIPOS_DE_CONDICAO_DE_HOMOLOGACAO;
  protected readonly fatos = this.ofertas.fatosDoEnquadramento;
  protected readonly avisoDasEdicoes = SUFIXO_DOS_AVISOS_DAS_EDICOES;

  protected readonly lugar = computed<PosicaoDaCondicao>(() => ({
    alternativa: this.alternativa(),
    condicao: this.posicao(),
  }));
  protected readonly tipoConhecido = computed(() =>
    this.tipos.some((tipo) => tipo.valor === this.condicao().tipo),
  );
  protected readonly rotuloDoTipo = computed(() => rotuloDoTipoDeCondicao(this.condicao().tipo));
  protected readonly edicoes = computed(() =>
    opcoesDaEdicao(this.ofertas.edicoesDeclaradas(), this.condicao().edicaoDoExame, rotuloDaEdicao),
  );
  protected readonly motivos = computed(() =>
    opcoesDoMotivo(this.ofertas.motivosDesfavoraveis(), this.condicao().motivoDesfavoravelCodigo),
  );
  protected readonly semMotivoEscolhido = computed(
    () => this.ofertas.motivosDesfavoraveis().length === 0,
  );

  /** O campo da regra que a recusa e a conferência local nomeiam para este controle da condição. */
  protected campo(controle: ControleDaCondicao): CampoDaHomologacaoDaFase {
    return `homologacao.alternativas.${this.alternativa()}.condicoes.${this.posicao()}.${controle}`;
  }

  protected idDoControle(controle: ControleDaCondicao): string {
    return this.regra.idDaFase(sufixoDaCondicao(this.alternativa(), this.posicao(), controle));
  }

  protected idDaRecusa(controle: ControleDaCondicao): string {
    return this.regra.idDaFase(sufixoDaRecusaDaHomologacao(this.campo(controle)));
  }

  protected idDoProblema(controle: ControleDaCondicao): string {
    return this.regra.idDaFase(sufixoDoProblemaDaHomologacao(this.campo(controle)));
  }

  protected idDoAviso(sufixo: string): string {
    return this.regra.idDaFase(sufixo);
  }

  protected recusasDoControle(controle: ControleDaCondicao) {
    return this.regra.recusasDoCampo(this.campo(controle));
  }

  protected problemaDoControle(controle: ControleDaCondicao): string | null {
    return this.regra.problemaLocal(this.campo(controle));
  }

  /** O que descreve o controle: o problema local, as recusas do servidor e o aviso que o acompanha. */
  protected descritoPor(controle: ControleDaCondicao, aviso: string | null): string | null {
    const ids = [
      ...(this.problemaDoControle(controle) === null ? [] : [this.idDoProblema(controle)]),
      ...(this.recusasDoControle(controle).length === 0 ? [] : [this.idDaRecusa(controle)]),
      ...(aviso === null ? [] : [aviso]),
    ];
    return ids.length === 0 ? null : ids.join(' ');
  }

  protected invalido(controle: ControleDaCondicao): 'true' | null {
    return this.regra.erroDoCampo(this.campo(controle)) === null ? null : 'true';
  }
}
