import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';

import { DistribuicaoDeVagas } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { regraPorChave } from '../../../shared/regra-por-chave';
import { CatalogosDeDistribuicaoService } from '../catalogos-de-distribuicao.service';
import { ehRamoFederal, quantidadeEhDeclarada } from '../composicao-de-vagas';
import { seguemOMesmoPadrao, PadraoDoEdital } from '../padrao-do-edital';
import { EscopoDoProblema, ProblemaDaDistribuicao } from '../problema-da-distribuicao';
import { problemaDeVagasAutorizadas } from '../teto-e-soma-do-quadro';
import { problemasDaDistribuicao } from '../validacao-da-distribuicao';
import { pendenciasDoQuadro, voBaseInvalido } from '../conferencia-das-vagas';
import { PadraoDoEditalService } from './padrao-do-edital.service';
import { SimulacaoDoQuadroService } from './simulacao-do-quadro.service';

/**
 * O quadro de ofertas do passo: o que se acrescenta, remove e edita, e o que a conferência diz dele.
 * Toda edição descarta a simulação, que passa a descrever outro quadro.
 */
@Injectable()
export class QuadroDeVagasService {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly catalogos = inject(CatalogosDeDistribuicaoService);
  private readonly padrao = inject(PadraoDoEditalService);
  private readonly simulacao = inject(SimulacaoDoQuadroService);

  readonly ofertasMarcadas = signal<ReadonlySet<string>>(new Set());
  readonly filtroDeOferta = signal('');

  readonly ofertasDisponiveis = computed(() => {
    const usadas = new Set(this.padrao.distribuicoes().map((item) => item.ofertaCursoId));
    return this.catalogos.ofertas().filter((oferta) => !usadas.has(oferta.id));
  });

  readonly ofertasParaEscolher = computed(() => {
    const termo = this.filtroDeOferta().trim().toLowerCase();
    const disponiveis = this.ofertasDisponiveis();
    if (termo === '') return disponiveis;

    return disponiveis.filter((oferta) =>
      this.rotuloDaOferta(oferta.id).toLowerCase().includes(termo),
    );
  });

  /**
   * Oferta que o operador pediu para remover, aguardando confirmação.
   *
   * A remoção leva junto a distribuição já preenchida daquela linha, e o botão fica ao lado dos
   * campos que o operador acabou de editar: perto demais para um clique errado não custar nada.
   */
  readonly remocaoPendente = signal<string | null>(null);

  readonly avisoDaRemocao = computed(() => {
    const ofertaCursoId = this.remocaoPendente();
    if (ofertaCursoId === null) return '';

    return `${this.rotuloDaOferta(ofertaCursoId)} sai do quadro com a distribuição configurada para ela. O processo só deixa de tê-la quando o passo for gravado.`;
  });

  /**
   * Ofertas gravadas com regra, percentual ou modalidades diferentes do que a tela apresenta como
   * padrão do edital. Só aparecem em processo criado por outro caminho: esta tela sempre reescreve
   * o quadro inteiro ao alterar o padrão. Enquanto existirem, o que seria enviado não é o que está
   * em tela, e gravar assim seria confirmar uma coisa e declarar outra.
   */
  readonly ofertasForaDoPadrao = computed(() => {
    const padrao = this.padrao.padrao();
    return this.padrao.distribuicoes().filter((item) => !seguemOMesmoPadrao(item, padrao));
  });

  /**
   * Problemas que vêm do padrão, e não de uma oferta em particular. Repetidos linha a linha, três
   * ofertas mostrariam três vezes o mesmo percentual em falta: o operador corrige num lugar só.
   */
  readonly problemasDoPadrao = computed<readonly string[]>(() => {
    const primeira = this.padrao.distribuicoes()[0];
    if (primeira === undefined) return [];

    return this.problemasComEscopo(primeira, 'padrao');
  });

  readonly pendenciasDoQuadro = computed(() =>
    pendenciasDoQuadro(this.padrao.distribuicoes(), this.padrao.colunasDeQuantidade()),
  );

  constructor() {
    effect(() => {
      this.store.geracao();
      untracked(() => {
        this.ofertasMarcadas.set(new Set());
        this.filtroDeOferta.set('');
        this.remocaoPendente.set(null);
      });
    });
  }

  /**
   * Oferta que o processo referencia mas que a listagem não traz: excluída do cadastro depois de
   * configurada. A linha continua no quadro com a distribuição gravada, e o rótulo diz por que o
   * nome do curso não aparece: some da lista de escolha, mas não do que já foi configurado.
   */
  rotuloDaOferta(ofertaCursoId: string): string {
    return this.catalogos.rotuloDaOfertaOuSemNome(ofertaCursoId);
  }

  /** Curso e unidade: o que a linha destaca. */
  nomeDaOferta(ofertaCursoId: string): string {
    return (
      this.catalogos.nomeDaOferta().get(ofertaCursoId) ?? this.catalogos.textoDaOfertaSemNome()
    );
  }

  /** Regime, turnos e o que mais distinga esta oferta das outras do curso. */
  detalheDaOferta(ofertaCursoId: string): string {
    return this.catalogos.detalheDaOferta().get(ofertaCursoId) ?? '';
  }

  ofertaMarcada(ofertaCursoId: string): boolean {
    return this.ofertasMarcadas().has(ofertaCursoId);
  }

  alternarOfertaMarcada(ofertaCursoId: string): void {
    const marcadas = new Set(this.ofertasMarcadas());
    if (!marcadas.delete(ofertaCursoId)) marcadas.add(ofertaCursoId);
    this.ofertasMarcadas.set(marcadas);
  }

  marcarTodasAsOfertas(marcar: boolean): void {
    this.ofertasMarcadas.set(
      marcar ? new Set(this.ofertasParaEscolher().map((oferta) => oferta.id)) : new Set(),
    );
  }

  adicionarOfertasMarcadas(): void {
    const marcadas = this.ofertasMarcadas();
    if (marcadas.size === 0) return;

    this.substituir([
      ...this.padrao.distribuicoes(),
      ...this.ofertasDisponiveis()
        .filter((oferta) => marcadas.has(oferta.id))
        .map((oferta) => ({
          ...this.padrao.padrao(),
          ofertaCursoId: oferta.id,
          voBase: '',
          quadro: [],
        })),
    ]);
    this.ofertasMarcadas.set(new Set());
    this.filtroDeOferta.set('');
  }

  pedirRemocao(ofertaCursoId: string): void {
    if (!this.store.aceitaEdicao()) return;
    this.remocaoPendente.set(ofertaCursoId);
  }

  cancelarRemocao(): void {
    this.remocaoPendente.set(null);
  }

  confirmarRemocao(): void {
    const ofertaCursoId = this.remocaoPendente();
    if (ofertaCursoId === null) return;

    this.remocaoPendente.set(null);
    this.removerOferta(ofertaCursoId);
  }

  alterarVoBase(ofertaCursoId: string, voBase: string): void {
    this.substituir(
      this.padrao
        .distribuicoes()
        .map((item) => (item.ofertaCursoId === ofertaCursoId ? { ...item, voBase } : item)),
    );
  }

  alterarQuantidade(ofertaCursoId: string, modalidadeId: string, valor: string): void {
    this.substituir(
      this.padrao.distribuicoes().map((distribuicao) => {
        if (distribuicao.ofertaCursoId !== ofertaCursoId) return distribuicao;

        const restante = distribuicao.quadro.filter((item) => item.modalidadeId !== modalidadeId);
        return {
          ...distribuicao,
          quadro:
            valor.trim() === '' ? restante : [...restante, { modalidadeId, quantidade: valor }],
        };
      }),
    );
  }

  /** Reescreve todas as ofertas com o padrão em tela. */
  aplicarPadraoATodas(): void {
    this.alterarPadrao({});
  }

  alterarPadrao(patch: Partial<PadraoDoEdital>): void {
    const proximo = { ...this.padrao.padrao(), ...patch };
    this.padrao.guardarComoPendente(proximo);

    // O padrão é o da coleção: alterá-lo reescreve todas as ofertas, senão o que a tela mostra
    // deixaria de descrever o que será gravado.
    this.substituir(
      this.padrao.distribuicoes().map((distribuicao) => ({
        ...distribuicao,
        ...proximo,
        quadro: this.quadroCoerente(distribuicao.quadro, proximo),
      })),
    );
  }

  /**
   * Tira do quadro o que o novo padrão não admite: modalidade que saiu da seleção, e quantidade de
   * modalidade que a regra passou a calcular.
   */
  quadroCoerente(
    quadro: DistribuicaoDeVagas['quadro'],
    padrao: PadraoDoEdital,
  ): DistribuicaoDeVagas['quadro'] {
    const selecionadas = new Set(padrao.modalidades.map((modalidade) => modalidade.id));
    const federal = ehRamoFederal(padrao.regraDistribuicaoCodigo);
    const catalogo = this.catalogos.modalidadePorId();

    return quadro.filter((item) => {
      if (!selecionadas.has(item.modalidadeId)) return false;
      if (!federal) return true;

      const composicao = catalogo.get(item.modalidadeId)?.composicaoVagas;
      return composicao !== undefined && quantidadeEhDeclarada(composicao, federal);
    });
  }

  problemasDe(distribuicao: DistribuicaoDeVagas): readonly ProblemaDaDistribuicao[] {
    const rol = this.rolDaDistribuicao(distribuicao);
    const problemas = problemasDaDistribuicao(distribuicao, this.catalogos.modalidadePorId(), rol);
    const teto = this.problemaDeTeto(distribuicao);
    return teto === null ? problemas : [...problemas, { escopo: 'oferta', mensagem: teto }];
  }

  /**
   * O que sobra depois do padrão e das pendências de preenchimento: recusas que valem para uma
   * oferta específica, como quantidade fixada numa modalidade que a regra calcula.
   */
  problemasEspecificos(): readonly string[] {
    return this.padrao
      .distribuicoes()
      .flatMap((distribuicao) =>
        this.problemasComEscopo(distribuicao, 'oferta').map(
          (problema) => `${this.rotuloDaOferta(distribuicao.ofertaCursoId)}: ${problema}`,
        ),
      );
  }

  /** O total informado passou do que o ato de autorização concede à oferta. */
  voBaseExcedido(distribuicao: DistribuicaoDeVagas): boolean {
    return this.problemaDeTeto(distribuicao) !== null;
  }

  /** O que destaca o campo: forma errada ou total acima do autorizado. */
  voBaseComProblema(distribuicao: DistribuicaoDeVagas): boolean {
    return voBaseInvalido(distribuicao) || this.voBaseExcedido(distribuicao);
  }

  private removerOferta(ofertaCursoId: string): void {
    const restantes = this.padrao
      .distribuicoes()
      .filter((item) => item.ofertaCursoId !== ofertaCursoId);

    // O padrão é lido da primeira oferta; sem nenhuma, ele não tem de onde vir. Num processo
    // retomado, quem nunca mexeu nesses campos os perderia ao tirar a última linha, e a oferta
    // seguinte nasceria sem regra nem percentual.
    if (restantes.length === 0) this.padrao.guardarComoPendente(this.padrao.padrao());

    this.substituir(restantes);
  }

  private substituir(ofertas: readonly DistribuicaoDeVagas[]): void {
    this.simulacao.descartar();
    this.store.patchObjectSection('vagas', { ofertas: [...ofertas] });
  }

  /**
   * O rol da regra que ESTA oferta referencia, não necessariamente a do padrão. Um processo
   * hidratado de fora do fluxo normal pode trazer uma oferta cuja regra já divergiu do padrão que
   * as demais seguem.
   */
  private rolDaDistribuicao(distribuicao: DistribuicaoDeVagas): readonly string[] | null {
    return (
      regraPorChave(
        this.catalogos.regrasDistribuicao(),
        distribuicao.regraDistribuicaoCodigo,
        distribuicao.regraDistribuicaoVersao,
      )?.modalidadesAdmitidas ?? null
    );
  }

  private problemasComEscopo(
    distribuicao: DistribuicaoDeVagas,
    escopo: EscopoDoProblema,
  ): readonly string[] {
    return this.problemasDe(distribuicao)
      .filter((problema) => problema.escopo === escopo)
      .map((problema) => problema.mensagem);
  }

  private problemaDeTeto(distribuicao: DistribuicaoDeVagas): string | null {
    return problemaDeVagasAutorizadas(
      distribuicao.voBase,
      this.catalogos.vagasAutorizadasPorOferta().get(distribuicao.ofertaCursoId) ?? null,
    );
  }
}
