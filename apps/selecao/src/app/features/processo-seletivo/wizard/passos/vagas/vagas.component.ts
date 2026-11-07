import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { ModalidadeDto } from '@uniplus/shared-data/configuracao';
import { FormsModule } from '@angular/forms';
import {
  ConfirmDialogComponent,
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  ValorEmConsultaComponent,
  ValorLegivelDirective,
} from '@uniplus/shared-ui/components';

import type { ConfirmacaoDeGravacao, ItemDeConfirmacao } from '../../passo-do-wizard';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { ValidacaoDoPasso } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { RegrasDasModalidadesComponent } from '../../shared/regras-das-modalidades.component';
import { CascataRemanejamentoComponent } from './cascata-remanejamento.component';
import { CatalogosDeDistribuicao } from './catalogos-de-distribuicao.service';
import { confirmacaoDasVagas } from './confirmacao-das-vagas';
import { modalidadesDoRolAtual, perderiaQuantidadeDoQuadro } from './edicao-do-padrao';
import { rotuloDasOpcoes } from './opcoes-de-curso';
import { EstouroDaReservaComponent } from './secoes/estouro-da-reserva.component';
import { OfertaParaAdicionarComponent } from './secoes/oferta-para-adicionar.component';
import { OfertasForaDoPadraoComponent } from './secoes/ofertas-fora-do-padrao.component';
import { OpcoesDeCursoComponent } from './secoes/opcoes-de-curso.component';
import {
  AVISO_DA_TROCA_DE_REGRA,
  RegraDaDistribuicaoComponent,
} from './secoes/regra-da-distribuicao.component';
import { RegraDeAjusteComponent } from './secoes/regra-de-ajuste.component';
import { TabelaDoQuadroComponent } from './secoes/tabela-do-quadro.component';
import { ConferenciaDoQuadro } from './servicos/conferencia-do-quadro.service';
import { EstadoDoPassoDeVagas } from './servicos/estado-do-passo-de-vagas';
import { GravacaoDasVagas } from './servicos/gravacao-das-vagas.service';
import { SimulacaoDoQuadro } from './servicos/simulacao-do-quadro.service';
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
    FalhaDeLeituraComponent,
    IndicadorDaLeituraDirective,
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
    CatalogosDeDistribuicao,
    EstadoDoPassoDeVagas,
    SimulacaoDoQuadro,
    ConferenciaDoQuadro,
    GravacaoDasVagas,
    provePassoDoWizard(VagasPassoComponent),
  ],
})
export class VagasPassoComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDeDistribuicao);
  protected readonly estado = inject(EstadoDoPassoDeVagas);
  protected readonly simulacao = inject(SimulacaoDoQuadro);
  protected readonly conferencia = inject(ConferenciaDoQuadro);
  private readonly gravacao = inject(GravacaoDasVagas);

  /**
   * A cascata é seção deste passo, não passo próprio: lida por `viewChild` para
   * `validar()`/`persistir()` consultarem o mesmo estado derivado que a seção já computa, sem
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

  protected readonly avisoDaTrocaDeRegra = AVISO_DA_TROCA_DE_REGRA;
  protected readonly avisoDoReaplicarRol =
    'Recompor pelo rol da regra atual pode remover do quadro quantidades já preenchidas — de modalidade que sai da seleção, ou de modalidade que fica mas cuja quantidade a regra atual não aceita mais como declarada. O processo só muda quando o passo for gravado.';

  protected readonly avisoDaRemocao = computed(() => {
    const ofertaCursoId = this.estado.remocaoPendente();
    if (ofertaCursoId === null) return '';

    return `${this.catalogos.rotuloDaOfertaOuSemNome(ofertaCursoId)} sai do quadro com a distribuição configurada para ela. O processo só deixa de tê-la quando o passo for gravado.`;
  });

  protected readonly todasAsModalidadesSelecionadas = computed(() => {
    const oferecidas = this.estado.modalidadesOferecidas();
    return (
      oferecidas.length > 0 && oferecidas.every((m) => this.estado.modalidadeSelecionada(m.id))
    );
  });

  /**
   * Reaplicar o rol tem efeito além de quando a seleção diverge dele: uma modalidade pode continuar
   * selecionada e ainda ter, no quadro, uma quantidade que a regra atual não aceita mais como
   * declarada. `selecaoBateComORol` não enxerga isso, porque é do conteúdo do quadro.
   */
  protected readonly reaplicarRolTemEfeito = computed(() => {
    if (this.estado.rolDaRegraEscolhida() === null) return false;
    return !this.estado.selecaoBateComORol() || this.perderiaQuantidade(this.modalidadesDoRol());
  });

  constructor() {
    this.catalogos.carregar();
  }

  validar(): ValidacaoDoPasso {
    const mensagens = [
      ...this.conferencia.pendenciasQueImpedemGravar(),
      ...(this.cascataSecao()?.pendenciasParaGravar() ?? []),
    ];

    // A tentativa de avançar é o que faz o erro aparecer no campo.
    this.estado.opcoesConferidas.set(true);

    return mensagens.length > 0 ? { valid: false, messages: mensagens } : { valid: true };
  }

  async persistir(): Promise<ValidacaoDoPasso> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null) {
      return {
        valid: false,
        messages: ['O cadastro do processo precisa estar concluído antes de configurar as vagas.'],
      };
    }

    // O comando não sai de um passo que a validação recusaria: os campos são texto até a conversão,
    // e o que não é número vira zero no envio — o servidor recusaria com mensagem que não aponta a célula.
    const conferencia = this.validar();
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
    if (!this.validar().valid) return null;

    const padrao = this.estado.padrao();
    return confirmacaoDasVagas({
      numeroDeOpcoes: rotuloDasOpcoes(this.estado.numeroDeOpcoes()) ?? '',
      ofertas: this.estado.distribuicoes().length,
      vagasInformadas: totalDeVagasInformadas(this.estado.distribuicoes()),
      totalPublicado: this.simulacao.totalGeralPublicado(),
      totaisPorModalidade: this.totaisPorModalidade(),
      regraDeDistribuicao: `${padrao.regraDistribuicaoCodigo} (versão ${padrao.regraDistribuicaoVersao})`,
      regraDeRemanejamento: this.resumoDaCascata(),
    });
  }

  protected alterarPr(pr: string): void {
    this.estado.alterarPadrao({ pr });
  }

  protected escolherReferencia(valor: string): void {
    this.estado.alterarPadrao({ referenciaReservaDemograficaId: valor === '' ? null : valor });
  }

  /** Rol fechado não é escolha do operador: a regra já a fez. */
  protected alternarModalidade(modalidade: ModalidadeDto): void {
    if (this.estado.rolDaRegraEscolhida() !== null) return;

    const atuais = this.estado.padrao().modalidades;
    this.estado.alterarPadrao({
      modalidades: this.estado.modalidadeSelecionada(modalidade.id)
        ? atuais.filter((item) => item.id !== modalidade.id)
        : [...atuais, { id: modalidade.id, codigo: modalidade.codigo }],
    });
  }

  /** Só faz sentido com rol aberto: rol fechado já marca tudo, sem escolha. */
  protected marcarTodasAsModalidades(marcar: boolean): void {
    this.estado.alterarPadrao({
      modalidades: marcar
        ? this.estado.modalidadesOferecidas().map((m) => ({ id: m.id, codigo: m.codigo }))
        : [],
    });
  }

  /**
   * Recompõe a seleção pelo rol fechado da regra atual, resolvendo excesso e falta juntos: rol
   * fechado não tem checkbox para modalidade fora dele, então não há como corrigir um item por vez.
   */
  protected reaplicarRolDaRegra(): void {
    if (this.estado.rolDaRegraEscolhida() === null) return;

    const modalidades = this.modalidadesDoRol();
    if (this.perderiaQuantidade(modalidades)) {
      this.estado.reaplicarRolPendente.set(true);
      return;
    }
    this.estado.alterarPadrao({ modalidades });
  }

  protected confirmarReaplicarRol(): void {
    if (!this.estado.reaplicarRolPendente()) return;

    this.estado.reaplicarRolPendente.set(false);
    this.estado.alterarPadrao({ modalidades: this.modalidadesDoRol() });
  }

  protected confirmarRemocao(): void {
    const ofertaCursoId = this.estado.remocaoPendente();
    if (ofertaCursoId === null) return;

    this.estado.remocaoPendente.set(null);
    this.estado.removerOferta(ofertaCursoId);
  }

  protected confirmarTrocaDeRegra(): void {
    this.regraDaDistribuicao()?.confirmarTroca();
  }

  /** Devolve o `<select>` de regra ao valor vigente quando a troca é recusada. */
  protected cancelarTrocaDeRegra(): void {
    this.regraDaDistribuicao()?.cancelarTroca();
  }

  /**
   * Uma linha por modalidade, declarada ou calculada.
   *
   * O rótulo leva o CÓDIGO da modalidade na frente, e não só a descrição: o diálogo distingue as
   * linhas por rótulo, e duas modalidades de descrição parecida colidiriam. O código é o
   * identificador de domínio e não se repete dentro de um quadro.
   */
  private totaisPorModalidade(): readonly ItemDeConfirmacao[] {
    const declaradas = this.estado.colunasDeQuantidade().map((modalidade) => ({
      rotulo: `${modalidade.codigo} — vagas declaradas`,
      valor: String(this.simulacao.totalDeclaradoDe(modalidade.id)),
    }));
    const calculadas = this.estado.modalidadesCalculadas().map((modalidade) => ({
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

  private modalidadesDoRol() {
    return modalidadesDoRolAtual(this.estado.rolDaRegraEscolhida(), this.catalogos.modalidades());
  }

  private perderiaQuantidade(modalidades: ReturnType<typeof modalidadesDoRolAtual>): boolean {
    return perderiaQuantidadeDoQuadro(this.estado.padrao(), modalidades, {
      modalidadesPorId: this.catalogos.modalidadePorId(),
      ofertas: this.estado.distribuicoes(),
    });
  }
}
