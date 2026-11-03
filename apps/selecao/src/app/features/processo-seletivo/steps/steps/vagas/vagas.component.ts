import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ConfirmDialogComponent,
  ValorEmConsultaComponent,
  ValorLegivelDirective,
} from '@uniplus/shared-ui/components';

import type { ConfirmacaoDeGravacao, ItemDeConfirmacao } from '../../passo-do-wizard';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { StepValidation } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { RegrasDasModalidadesComponent } from '../../shared/regras-das-modalidades.component';
import { CascataRemanejamentoComponent } from './cascata-remanejamento.component';
import { CatalogosDeDistribuicaoService } from './catalogos-de-distribuicao.service';
import { pendenciasQueImpedemGravar } from './conferencia-das-vagas';
import { confirmacaoDasVagas } from './confirmacao-das-vagas';
import { rotuloDasOpcoes } from './opcoes-de-curso';
import { EstouroDaReservaComponent } from './secoes/estouro-da-reserva.component';
import { OfertaParaAdicionarComponent } from './secoes/oferta-para-adicionar.component';
import { OfertasForaDoPadraoComponent } from './secoes/ofertas-fora-do-padrao.component';
import { OpcoesDeCursoComponent } from './secoes/opcoes-de-curso.component';
import { RegraDaDistribuicaoComponent } from './secoes/regra-da-distribuicao.component';
import { RegraDeAjusteComponent } from './secoes/regra-de-ajuste.component';
import { TabelaDoQuadroComponent } from './secoes/tabela-do-quadro.component';
import { AlteracaoDoPadraoService } from './servicos/alteracao-do-padrao.service';
import { GravacaoDasVagasService } from './servicos/gravacao-das-vagas.service';
import { OpcoesDeCursoService } from './servicos/opcoes-de-curso.service';
import { PadraoDoEditalService } from './servicos/padrao-do-edital.service';
import { QuadroDeVagasService } from './servicos/quadro-de-vagas.service';
import { SimulacaoDoQuadroService } from './servicos/simulacao-do-quadro.service';
import { ofertasRepetidas } from './validacao-da-distribuicao';
import { totalDeVagasInformadas } from './totais-do-quadro';

/**
 * Distribuição de vagas por oferta de curso (UNI-REQ-0134).
 *
 * O contrato guarda regra, percentual e modalidades em cada oferta, mas o
 * edital declara isso uma vez e repete para todos os cursos. A tela segue o
 * edital: o padrão fica no topo e vale para a coleção, e o quadro pede só o
 * que varia — o VO de cada oferta e as quantidades que a regra não calcula.
 *
 * Com vinte cursos, repetir regra, percentual e dez modalidades em cada bloco
 * transformaria o passo numa sucessão de formulários idênticos.
 *
 * A oferta vem do catálogo de Configuração e projeta curso, local, unidade,
 * regime e turnos. Nada disso é editável: turno é atributo da oferta, e o
 * cadastro dele é outro (UNI-REQ-0137).
 */
@Component({
  selector: 'sel-step-vagas',
  imports: [
    ValorLegivelDirective,
    ValorEmConsultaComponent,
    FormsModule,
    ConfirmDialogComponent,
    CascataRemanejamentoComponent,
    RegrasDasModalidadesComponent,
    OpcoesDeCursoComponent,
    RegraDaDistribuicaoComponent,
    RegraDeAjusteComponent,
    OfertaParaAdicionarComponent,
    TabelaDoQuadroComponent,
    EstouroDaReservaComponent,
    OfertasForaDoPadraoComponent,
  ],
  templateUrl: './vagas.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    CatalogosDeDistribuicaoService,
    PadraoDoEditalService,
    SimulacaoDoQuadroService,
    QuadroDeVagasService,
    AlteracaoDoPadraoService,
    OpcoesDeCursoService,
    GravacaoDasVagasService,
    provePassoDoWizard(VagasStepComponent),
  ],
})
export class VagasStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDeDistribuicaoService);
  protected readonly padraoDoEdital = inject(PadraoDoEditalService);
  protected readonly simulacao = inject(SimulacaoDoQuadroService);
  protected readonly quadro = inject(QuadroDeVagasService);
  protected readonly alteracao = inject(AlteracaoDoPadraoService);
  protected readonly opcoes = inject(OpcoesDeCursoService);
  private readonly gravacao = inject(GravacaoDasVagasService);

  /**
   * A cascata é seção deste passo, não passo próprio: lida por `viewChild` para
   * `validate()`/`persistir()` consultarem o mesmo estado derivado que a seção já computa, sem
   * duplicar a lógica de encaixe por oferta aqui.
   */
  private readonly cascataSecao = viewChild(CascataRemanejamentoComponent);
  private readonly regraDaDistribuicao = viewChild(RegraDaDistribuicaoComponent);

  /** Quem concorre em cada modalidade ofertada, pela regra que o processo congelou. */
  protected readonly regrasDasModalidades = this.store.regrasDasModalidades;

  /** Carregando e erro só servem a quem edita: a consulta lê o gravado e diz o que não leu. */
  protected readonly carregandoParaEditar = computed(
    () => !this.store.emConsulta() && this.catalogos.carregando(),
  );
  protected readonly erroParaEditar = computed(() =>
    this.store.emConsulta() ? null : this.catalogos.erro(),
  );

  /**
   * Em consulta o passo lê o que o processo gravou e não espera pelos catálogos; o que só o
   * catálogo sabe dizer (nome da oferta, referência demográfica, regras) é lido como não lido, e
   * nunca como ausente. Carregando e falhou são estados distintos: o primeiro passa, o segundo fica.
   */
  protected readonly catalogoCarregandoEmConsulta = computed(
    () => this.store.emConsulta() && this.catalogos.situacao() === 'carregando',
  );
  protected readonly catalogoFalhouEmConsulta = computed(
    () => this.store.emConsulta() && this.catalogos.situacao() === 'falhou',
  );

  private readonly pendencias = computed(() =>
    pendenciasQueImpedemGravar({
      numeroDeOpcoes: this.opcoes.numero(),
      distribuicoes: this.padraoDoEdital.distribuicoes(),
      ofertasForaDoPadrao: this.quadro.ofertasForaDoPadrao().length,
      simulacaoCobreOQuadro: this.simulacao.simulacaoCobreOQuadro(),
      problemasDoPadrao: this.quadro.problemasDoPadrao(),
      pendenciasDoQuadro: this.quadro.pendenciasDoQuadro(),
      problemasEspecificos: this.quadro.problemasEspecificos(),
      ofertasRepetidas: ofertasRepetidas(this.padraoDoEdital.distribuicoes()),
      rotuloDaOferta: (ofertaCursoId) => this.quadro.rotuloDaOferta(ofertaCursoId),
    }),
  );

  constructor() {
    this.catalogos.carregar();
  }

  validate(): StepValidation {
    const mensagens = [
      ...this.pendencias(),
      ...(this.cascataSecao()?.pendenciasParaGravar() ?? []),
    ];

    // A tentativa de avançar é o que faz o erro aparecer no campo.
    this.opcoes.marcarComoConferidas();

    return mensagens.length > 0 ? { valid: false, messages: mensagens } : { valid: true };
  }

  async persistir(): Promise<StepValidation> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null) {
      return {
        valid: false,
        messages: ['O cadastro do processo precisa estar concluído antes de configurar as vagas.'],
      };
    }

    // O comando não sai de um passo que a validação recusaria: os campos são texto até a conversão,
    // e o que não é número vira zero no envio — o servidor recusaria com mensagem que não aponta a célula.
    const conferencia = this.validate();
    if (!conferencia.valid) return conferencia;

    return this.gravacao.gravar(processoId, this.cascataSecao());
  }

  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }

  /**
   * O que a página confirma antes de gravar o quadro — o mesmo contrato que Identificação, Bônus,
   * Desempate, Eliminação e Revisão já usam. `null` quando há pendência: ninguém confirma um quadro
   * que o passo não vai gravar.
   */
  confirmacaoDeGravacao(): ConfirmacaoDeGravacao | null {
    if (!this.validate().valid) return null;

    const padrao = this.padraoDoEdital.padrao();
    return confirmacaoDasVagas({
      numeroDeOpcoes: rotuloDasOpcoes(this.opcoes.numero()) ?? '',
      ofertas: this.padraoDoEdital.distribuicoes().length,
      vagasInformadas: totalDeVagasInformadas(this.padraoDoEdital.distribuicoes()),
      totalPublicado: this.simulacao.totalGeralPublicado(),
      totaisPorModalidade: this.totaisPorModalidade(),
      regraDeDistribuicao: `${padrao.regraDistribuicaoCodigo} (versão ${padrao.regraDistribuicaoVersao})`,
      regraDeRemanejamento: this.resumoDaCascata(),
    });
  }

  /** Devolve o `<select>` de regra ao valor vigente quando a troca é recusada. */
  cancelarTrocaDeRegra(): void {
    this.alteracao.cancelarTrocaDeRegra();
    this.regraDaDistribuicao()?.restaurarSelect();
  }

  /**
   * Uma linha por modalidade, declarada ou calculada.
   *
   * O rótulo leva o CÓDIGO da modalidade na frente, e não só a descrição: o diálogo distingue as
   * linhas por rótulo, e duas modalidades de descrição parecida colidiriam. O código é o
   * identificador de domínio e não se repete dentro de um quadro.
   */
  private totaisPorModalidade(): readonly ItemDeConfirmacao[] {
    const declaradas = this.padraoDoEdital.colunasDeQuantidade().map((modalidade) => ({
      rotulo: `${modalidade.codigo} — vagas declaradas`,
      valor: String(this.simulacao.totalDeclaradoDe(modalidade.id)),
    }));
    const calculadas = this.padraoDoEdital.modalidadesCalculadas().map((modalidade) => ({
      rotulo: `${modalidade.codigo} — vagas calculadas pela regra`,
      valor: String(this.simulacao.totalCalculadoDe(modalidade.id)),
    }));

    return [...declaradas, ...calculadas];
  }

  /**
   * A regra de remanejamento, quando a seção se aplica — código e versão, nunca a matriz: uma
   * tabela de destinos não cabe num par rótulo/valor, e o que o operador precisa reconhecer
   * aqui é qual regra vai reger o remanejamento.
   */
  private resumoDaCascata(): string | null {
    const secao = this.cascataSecao();
    if (secao === undefined || !secao.precisaExibir()) return null;

    const cascata = this.store.draft().vagas.cascata;
    return cascata === null ? null : `${cascata.regraCodigo} (versão ${cascata.regraVersao})`;
  }
}
