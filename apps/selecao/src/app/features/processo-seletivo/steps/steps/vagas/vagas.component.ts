import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogComponent } from '@uniplus/shared-ui/components';
import { ModalidadeDto } from '@uniplus/shared-data/configuracao';

import {
  DistribuicaoDeVagas,
  ModalidadeDaOferta,
  StepValidation,
} from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { isApiOk, ProblemI18nService } from '@uniplus/shared-core/http';
import {
  ConfiguracaoDistribuicaoVagasDto,
  ProcessosSeletivosApi,
} from '@uniplus/shared-data/selecao';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { DestroyRef } from '@angular/core';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { CatalogosDeDistribuicaoService } from './catalogos-de-distribuicao.service';
import {
  EscopoDoProblema,
  modalidadesExigidasPelaLei,
  ofertasRepetidas,
  ProblemaDaDistribuicao,
  problemaDeVagasAutorizadas,
  problemasDaDistribuicao,
  quantidadeEhDeclarada,
  seguemOMesmoPadrao,
  REGRA_LEI_12711,
} from './distribuicao-de-vagas';
import { comoComando } from './distribuicao-para-comando';
import { explicarRegra } from './regra-em-linguagem-clara';

/** O que o edital declara uma vez e vale para todas as ofertas. */
interface PadraoDaDistribuicao {
  readonly regraDistribuicaoCodigo: string;
  readonly regraDistribuicaoVersao: string;
  readonly regraAjusteCodigo: string | null;
  readonly regraAjusteVersao: string | null;
  readonly referenciaReservaDemograficaId: string | null;
  readonly modalidades: readonly ModalidadeDaOferta[];
  readonly pr: string;
}

const PADRAO_VAZIO: PadraoDaDistribuicao = {
  regraDistribuicaoCodigo: '',
  regraDistribuicaoVersao: '',
  regraAjusteCodigo: null,
  regraAjusteVersao: null,
  referenciaReservaDemograficaId: null,
  modalidades: [],
  pr: '',
};

function frase(quantas: number): string {
  return quantas === 1 ? '1 oferta' : `${quantas} ofertas`;
}

/**
 * O que não é inteiro positivo não entra na soma: célula vazia ou malformada
 * já é apontada pela validação, e somá-la como `NaN` apagaria o total inteiro.
 */
function inteiroOuZero(valor: string): number {
  const limpo = valor.trim();
  return /^\d+$/.test(limpo) ? Number(limpo) : 0;
}

/** Enumeração em português: vírgulas até o último, que entra com "e". */
function lista(itens: readonly string[]): string {
  if (itens.length <= 1) return itens[0] ?? '';
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

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
  imports: [FormsModule, ConfirmDialogComponent],
  templateUrl: './vagas.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CatalogosDeDistribuicaoService, provePassoDoWizard(VagasStepComponent)],
})
export class VagasStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDeDistribuicaoService);

  readonly distribuicoes = computed(() => this.store.draft().vagas.ofertas);

  /**
   * O padrão vem da primeira oferta: é o rascunho que persiste, e guardá-lo
   * num estado próprio criaria duas fontes para o mesmo dado.
   */
  readonly padrao = computed<PadraoDaDistribuicao>(() => {
    const primeira = this.distribuicoes()[0];
    if (primeira === undefined) return this.padraoPendente();

    return {
      regraDistribuicaoCodigo: primeira.regraDistribuicaoCodigo,
      regraDistribuicaoVersao: primeira.regraDistribuicaoVersao,
      regraAjusteCodigo: primeira.regraAjusteCodigo,
      regraAjusteVersao: primeira.regraAjusteVersao,
      referenciaReservaDemograficaId: primeira.referenciaReservaDemograficaId,
      modalidades: primeira.modalidades,
      pr: primeira.pr,
    };
  });

  /** Enquanto não há oferta, o padrão declarado fica aqui. */
  private readonly padraoPendente = signal<PadraoDaDistribuicao>(PADRAO_VAZIO);

  readonly ehFederal = computed(() => this.padrao().regraDistribuicaoCodigo === REGRA_LEI_12711);

  /**
   * O que a regra escolhida estabelece. Sem isto, o operador escolhe entre dois
   * códigos sem saber o que cada um faz com as vagas do processo.
   */
  readonly regraExplicada = computed(() =>
    explicarRegra(
      this.catalogos
        .regrasDistribuicao()
        .find(
          (regra) =>
            regra.codigo === this.padrao().regraDistribuicaoCodigo &&
            regra.versao === this.padrao().regraDistribuicaoVersao,
        ),
    ),
  );

  readonly ajusteExplicado = computed(() =>
    explicarRegra(
      this.catalogos
        .regrasAjuste()
        .find(
          (regra) =>
            regra.codigo === this.padrao().regraAjusteCodigo &&
            regra.versao === this.padrao().regraAjusteVersao,
        ),
    ),
  );

  /** O que a regra escolhida passa a exigir do resto do formulário. */
  readonly exigenciasDaRegra = computed<readonly string[]>(() =>
    this.ehFederal()
      ? [
          'referência de reserva demográfica',
          'regra de ajuste (art. 11, § único)',
          'as oito modalidades federais e a ampla concorrência',
        ]
      : ['a quantidade de vagas de cada modalidade, fixada pelo edital'],
  );

  /** Só as modalidades cuja quantidade o edital fixa viram coluna do quadro. */
  readonly colunasDeQuantidade = computed(() =>
    this.modalidadesDoPadrao().filter((modalidade) => this.ehDeclarada(modalidade)),
  );

  /** O que a regra calcula, e por isso o edital não preenche. */
  readonly resumoDasCalculadas = computed(() => {
    const quantas = this.modalidadesCalculadas().length;
    const sujeito = quantas === 1 ? '1 modalidade tem' : `${quantas} modalidades têm`;

    return `${sujeito} a quantidade calculada pela regra, a partir do total de vagas e do percentual de reserva. O edital não fixa esse valor: ele aparece no quadro depois da simulação.`;
  });

  readonly modalidadesCalculadas = computed(() =>
    this.modalidadesDoPadrao().filter((modalidade) => !this.ehDeclarada(modalidade)),
  );

  readonly ofertasDisponiveis = computed(() => {
    const usadas = new Set(this.distribuicoes().map((item) => item.ofertaCursoId));
    return this.catalogos.ofertas().filter((oferta) => !usadas.has(oferta.id));
  });

  /** Ofertas marcadas para entrar no quadro. */
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);

  /** Quadro como a regra o calcula, por oferta. Vazio até simular. */
  readonly simulacao = signal<ReadonlyMap<string, ConfiguracaoDistribuicaoVagasDto>>(new Map());
  /**
   * Requisição de simulação em curso, para poder abandoná-la.
   *
   * O indicador deriva daqui em vez de ser ligado e desligado à mão: uma
   * resposta que já não vale desligaria o indicador de outra que acabou de
   * começar, e uma que nunca chega deixaria o botão preso para sempre.
   */
  private readonly simulacaoEmVoo = signal<Subscription | null>(null);

  readonly simulando = computed(() => this.simulacaoEmVoo() !== null);
  readonly erroDaSimulacao = signal<string | null>(null);

  readonly ofertasMarcadas = signal<ReadonlySet<string>>(new Set());
  readonly filtroDeOferta = signal('');

  readonly ofertasParaEscolher = computed(() => {
    const termo = this.filtroDeOferta().trim().toLowerCase();
    const disponiveis = this.ofertasDisponiveis();
    if (termo === '') return disponiveis;

    return disponiveis.filter((oferta) =>
      this.rotuloDaOferta(oferta.id).toLowerCase().includes(termo),
    );
  });

  /**
   * Problemas que vêm do padrão, e não de uma oferta em particular. Repetidos
   * linha a linha, três ofertas mostrariam três vezes o mesmo percentual em
   * falta — o operador corrige num lugar só.
   */
  readonly problemasDoPadrao = computed<readonly string[]>(() => {
    const primeira = this.distribuicoes()[0];
    if (primeira === undefined) return [];

    return this.problemasComEscopo(primeira, 'padrao');
  });

  /**
   * O que falta no quadro, contado por tipo em vez de repetido por linha.
   *
   * Vinte ofertas sem a mesma quantidade produziriam vinte frases idênticas, e
   * o operador leria vinte vezes o que precisa saber uma. A célula em falta
   * fica marcada; aqui vai só quantas são.
   */
  readonly pendenciasDoQuadro = computed<readonly string[]>(() => {
    const semVo = this.distribuicoes().filter((item) => this.voBaseInvalido(item)).length;

    // Agrupado por quantas ofertas: com dez modalidades declaradas e nenhuma
    // preenchida, dizer "3 ofertas sem a quantidade de X" dez vezes esconde a
    // informação — que é uma só, sobre as mesmas três ofertas.
    const porQuantidadeDeOfertas = new Map<number, string[]>();
    for (const modalidade of this.colunasDeQuantidade()) {
      const quantas = this.distribuicoes().filter((item) =>
        this.quantidadeInvalida(item, modalidade.id),
      ).length;
      if (quantas === 0) continue;

      porQuantidadeDeOfertas.set(quantas, [
        ...(porQuantidadeDeOfertas.get(quantas) ?? []),
        modalidade.codigo,
      ]);
    }

    const pendencias = [...porQuantidadeDeOfertas].map(
      ([quantas, codigos]) => `${frase(quantas)} sem a quantidade de ${lista(codigos)}`,
    );

    return semVo > 0 ? [`${frase(semVo)} sem o total de vagas`, ...pendencias] : pendencias;
  });

  constructor() {
    this.catalogos.carregar();

    // A rota é reusada entre processos e `store.reset()` não alcança signal de
    // componente. Sem descartar o que é local, o processo seguinte abriria com
    // a simulação, a conferência e o padrão do anterior — e a simulação antiga
    // valeria como cobertura, porque a checagem é por id de oferta e dois
    // processos do mesmo catálogo compartilham as ofertas.
    effect(() => {
      this.store.geracao();
      untracked(() => this.descartarEstadoLocal());
    });
  }

  /** Tudo o que descreve o processo aberto e não vive no rascunho. */
  private descartarEstadoLocal(): void {
    this.descartarSimulacao();
    this.padraoPendente.set(PADRAO_VAZIO);
    this.erroDaSimulacao.set(null);
    this.ofertasMarcadas.set(new Set());
    this.filtroDeOferta.set('');
    this.remocaoPendente.set(null);
  }

  /**
   * Oferta que o processo referencia mas que a listagem não traz — excluída do
   * cadastro depois de configurada. A linha continua no quadro com a
   * distribuição gravada, e o rótulo diz por que o nome do curso não aparece:
   * some da lista de escolha, mas não do que já foi configurado.
   */
  rotuloDaOferta(ofertaCursoId: string): string {
    return this.catalogos.rotuloDaOferta().get(ofertaCursoId) ?? 'Oferta fora do catálogo';
  }

  /** Curso e unidade — o que a linha destaca. */
  nomeDaOferta(ofertaCursoId: string): string {
    return this.catalogos.nomeDaOferta().get(ofertaCursoId) ?? 'Oferta fora do catálogo';
  }

  /** Regime, turnos e o que mais distinga esta oferta das outras do curso. */
  detalheDaOferta(ofertaCursoId: string): string {
    return this.catalogos.detalheDaOferta().get(ofertaCursoId) ?? '';
  }

  // ── padrão do edital ────────────────────────────────────────────────────

  escolherRegraDistribuicao(valor: string): void {
    const [codigo = '', versao = ''] = valor.split('|');

    this.alterarPadrao(
      codigo === REGRA_LEI_12711
        ? { regraDistribuicaoCodigo: codigo, regraDistribuicaoVersao: versao }
        : {
            regraDistribuicaoCodigo: codigo,
            regraDistribuicaoVersao: versao,
            // Fora do ramo federal o servidor recusa estes dois.
            regraAjusteCodigo: null,
            regraAjusteVersao: null,
            referenciaReservaDemograficaId: null,
          },
    );
  }

  escolherRegraAjuste(valor: string): void {
    const [codigo, versao] = valor.split('|');
    this.alterarPadrao({
      regraAjusteCodigo: codigo === undefined || codigo === '' ? null : codigo,
      regraAjusteVersao: versao === undefined || versao === '' ? null : versao,
    });
  }

  escolherReferencia(valor: string): void {
    this.alterarPadrao({ referenciaReservaDemograficaId: valor === '' ? null : valor });
  }

  alterarPr(pr: string): void {
    this.alterarPadrao({ pr });
  }

  alternarModalidade(modalidade: ModalidadeDto): void {
    const atuais = this.padrao().modalidades;
    this.alterarPadrao({
      modalidades: this.modalidadeSelecionada(modalidade.id)
        ? atuais.filter((item) => item.id !== modalidade.id)
        : [...atuais, { id: modalidade.id, codigo: modalidade.codigo }],
    });
  }

  modalidadeSelecionada(modalidadeId: string): boolean {
    return this.padrao().modalidades.some((modalidade) => modalidade.id === modalidadeId);
  }

  readonly todasAsModalidadesSelecionadas = computed(() => {
    const catalogo = this.catalogos.modalidades();
    return catalogo.length > 0 && catalogo.every((m) => this.modalidadeSelecionada(m.id));
  });

  readonly exigidasPelaLei = computed(() =>
    modalidadesExigidasPelaLei(this.catalogos.modalidades()),
  );

  readonly exigidasPelaLeiSelecionadas = computed(() =>
    this.exigidasPelaLei().every((m) => this.modalidadeSelecionada(m.id)),
  );

  marcarTodasAsModalidades(marcar: boolean): void {
    this.alterarPadrao({
      modalidades: marcar
        ? this.catalogos.modalidades().map((m) => ({ id: m.id, codigo: m.codigo }))
        : [],
    });
  }

  /** Satisfaz `ModalidadesFederaisIncompletas` sem tentativa e erro. */
  marcarAsExigidasPelaLei(): void {
    const jaSelecionadas = this.padrao().modalidades;
    const exigidas = this.exigidasPelaLei()
      .filter((m) => !this.modalidadeSelecionada(m.id))
      .map((m) => ({ id: m.id, codigo: m.codigo }));

    this.alterarPadrao({ modalidades: [...jaSelecionadas, ...exigidas] });
  }

  // ── quadro de vagas ─────────────────────────────────────────────────────

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
      ...this.distribuicoes(),
      ...this.ofertasDisponiveis()
        .filter((oferta) => marcadas.has(oferta.id))
        .map((oferta) => ({ ...this.padrao(), ofertaCursoId: oferta.id, voBase: '', quadro: [] })),
    ]);
    this.ofertasMarcadas.set(new Set());
    this.filtroDeOferta.set('');
  }

  /**
   * O campo em falta é apontado nele mesmo, não numa frase abaixo da linha.
   *
   * A checagem aqui é de preenchimento, para marcar a célula; a validação de
   * verdade continua em `problemasDaDistribuicao`, que é quem conhece as
   * invariantes do agregado.
   */
  voBaseInvalido(distribuicao: DistribuicaoDeVagas): boolean {
    return !/^[1-9]\d*$/.test(distribuicao.voBase.trim());
  }

  quantidadeInvalida(distribuicao: DistribuicaoDeVagas, modalidadeId: string): boolean {
    return !/^\d+$/.test(this.quantidade(distribuicao, modalidadeId).trim());
  }

  /**
   * Oferta que o operador pediu para remover, aguardando confirmação.
   *
   * A remoção leva junto a distribuição já preenchida daquela linha, e o botão
   * fica ao lado dos campos que o operador acabou de editar — perto demais para
   * um clique errado não custar nada.
   */
  readonly remocaoPendente = signal<string | null>(null);

  readonly avisoDaRemocao = computed(() => {
    const ofertaCursoId = this.remocaoPendente();
    if (ofertaCursoId === null) return '';

    return `${this.rotuloDaOferta(ofertaCursoId)} sai do quadro com a distribuição configurada para ela. O processo só deixa de tê-la quando o passo for gravado.`;
  });

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

  private removerOferta(ofertaCursoId: string): void {
    const restantes = this.distribuicoes().filter((item) => item.ofertaCursoId !== ofertaCursoId);

    // O padrão é lido da primeira oferta; sem nenhuma, ele não tem de onde vir.
    // Num processo retomado, quem nunca mexeu nesses campos os perderia ao tirar
    // a última linha, e a oferta seguinte nasceria sem regra nem percentual.
    if (restantes.length === 0) this.padraoPendente.set(this.padrao());

    this.substituir(restantes);
  }

  alterarVoBase(ofertaCursoId: string, voBase: string): void {
    this.substituir(
      this.distribuicoes().map((item) =>
        item.ofertaCursoId === ofertaCursoId ? { ...item, voBase } : item,
      ),
    );
  }

  quantidade(distribuicao: DistribuicaoDeVagas, modalidadeId: string): string {
    return distribuicao.quadro.find((item) => item.modalidadeId === modalidadeId)?.quantidade ?? '';
  }

  alterarQuantidade(ofertaCursoId: string, modalidadeId: string, valor: string): void {
    this.substituir(
      this.distribuicoes().map((distribuicao) => {
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

  /**
   * Pede ao servidor o quadro calculado. É ele quem aplica a Lei — arredondar
   * as sub-reservas e descontar as retiradas da ampla concorrência aqui seria
   * manter duas implementações da mesma norma.
   */
  simular(): void {
    const processoId = this.store.processoSeletivoId();
    const distribuicoes = this.distribuicoes();
    if (processoId === null || distribuicoes.length === 0) return;

    const quadroPedido = this.versaoDoQuadro;
    const geracao = this.store.geracao();
    this.abandonarSimulacaoEmVoo();
    this.erroDaSimulacao.set(null);

    const inscricao = this.api
      .simularDistribuicaoVagas(processoId, distribuicoes.map(comoComando))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          if (this.respostaVencida(quadroPedido, geracao)) return;
          this.simulacaoEmVoo.set(null);

          if (!isApiOk(resultado)) {
            this.erroDaSimulacao.set(this.problemI18n.resolve(resultado.problem).title);
            return;
          }
          this.simulacao.set(
            new Map(resultado.data.map((item) => [item.ofertaCursoOrigemId, item])),
          );
        },
        error: () => {
          if (this.respostaVencida(quadroPedido, geracao)) return;
          this.simulacaoEmVoo.set(null);

          this.erroDaSimulacao.set('Não foi possível simular o quadro. Tente novamente.');
        },
      });

    this.simulacaoEmVoo.set(inscricao);
  }

  private abandonarSimulacaoEmVoo(): void {
    this.simulacaoEmVoo()?.unsubscribe();
    this.simulacaoEmVoo.set(null);
  }

  /**
   * A resposta descreve um quadro que já não está em tela — o operador editou
   * enquanto ela vinha, ou passou a outro processo.
   *
   * Instalá-la seria pior do que perdê-la: a conferência olha só se cada oferta
   * tem resultado, então o cálculo antigo passaria por atual e o operador
   * gravaria números que nunca viu.
   */
  private respostaVencida(quadroPedido: number, geracao: number): boolean {
    return quadroPedido !== this.versaoDoQuadro || geracao !== this.store.geracao();
  }

  /**
   * Ofertas em que a reserva final ficou acima do percentual declarado.
   *
   * O art. 10 §2º garante ao menos uma vaga a cada sub-reserva que ficaria
   * zerada, e isso eleva a reserva além de `VO × PR`. Sem dizer isso, a soma
   * das cotas parece não bater com o percentual que o operador informou.
   */
  /** O que o resumo do alerta diz enquanto ele está retraído. */
  readonly resumoDoEstouro = computed(() => {
    const quantas = this.ofertasComEstouro().length;
    const verbo = quantas === 1 ? 'ficou' : 'ficaram';
    return `${frase(quantas)} ${verbo} com a reserva acima do percentual declarado`;
  });

  readonly ofertasComEstouro = computed(() =>
    this.distribuicoes()
      .map((distribuicao) => ({ distribuicao, calculado: this.calculado(distribuicao) }))
      .filter(({ calculado }) => Number(calculado?.estouro ?? 0) > 0),
  );

  // ── totais do quadro ────────────────────────────────────────────────────
  //
  // O rodapé responde o que a linha a linha não responde: quantas vagas o
  // processo publica ao todo, e quantas cada modalidade recebe somando as
  // ofertas. É a leitura que o edital precisa declarar.

  /** Soma dos totais informados pelas ofertas, antes das suplementares. */
  readonly totalGeralDeVagas = computed(() =>
    this.distribuicoes().reduce((soma, item) => soma + inteiroOuZero(item.voBase), 0),
  );

  /**
   * Vagas que o processo publica somando as ofertas.
   *
   * Pode passar do total informado: a modalidade suplementar acresce vagas ao
   * total da oferta em vez de dividi-lo, e é aqui que essa diferença aparece.
   */
  readonly totalGeralPublicado = computed(() =>
    this.distribuicoes().reduce(
      (soma, item) => soma + inteiroOuZero(String(this.calculado(item)?.totalPublicado ?? '')),
      0,
    ),
  );

  /**
   * A simulação cobre todas as ofertas do quadro.
   *
   * O que a regra calcula só existe depois dela, e é a maior parte do que será
   * publicado: gravar sem simular é declarar um quadro que ninguém viu. Uma
   * edição descarta o resultado, então a conferência é sempre sobre o que está
   * em tela.
   */
  /**
   * O operador declara que conferiu o quadro.
   *
   * O que sai daqui é o número de vagas que o edital publica, e boa parte dele
   * vem do cálculo do servidor: a marca é o registro de que alguém leu o
   * resultado, e não de que clicou em avançar.
   *
   * Cai junto com a simulação a cada edição — confirmar um quadro e gravar
   * outro seria pior do que não confirmar nada.
   */
  readonly conferenciaConfirmada = signal(false);

  /**
   * Ofertas gravadas com regra, percentual ou modalidades diferentes do que a
   * tela apresenta como padrão do edital.
   *
   * Só aparecem em processo criado por outro caminho — esta tela sempre reescreve
   * o quadro inteiro ao alterar o padrão. Enquanto existirem, o que seria enviado
   * não é o que está em tela, e gravar assim seria confirmar uma coisa e
   * declarar outra.
   */
  readonly ofertasForaDoPadrao = computed(() => {
    const padrao = this.padrao();
    return this.distribuicoes().filter((item) => !seguemOMesmoPadrao(item, padrao));
  });

  /** Reescreve todas as ofertas com o padrão em tela. */
  aplicarPadraoATodas(): void {
    this.alterarPadrao({});
  }

  readonly simulacaoCobreOQuadro = computed(() => {
    const calculado = this.simulacao();
    return this.distribuicoes().every((item) => calculado.has(item.ofertaCursoId));
  });

  /** Soma da coluna de uma modalidade que o edital declara. */
  totalDeclaradoDe(modalidadeId: string): number {
    return this.distribuicoes().reduce(
      (soma, item) => soma + inteiroOuZero(this.quantidade(item, modalidadeId)),
      0,
    );
  }

  /** Soma da coluna de uma modalidade que a regra calcula. */
  totalCalculadoDe(modalidadeId: string): number {
    return this.distribuicoes().reduce(
      (soma, item) => soma + inteiroOuZero(this.quantidadeCalculada(item, modalidadeId)),
      0,
    );
  }

  calculado(distribuicao: DistribuicaoDeVagas): ConfiguracaoDistribuicaoVagasDto | undefined {
    return this.simulacao().get(distribuicao.ofertaCursoId);
  }

  /** Quantidade que a regra atribuiu a uma modalidade nesta oferta. */
  quantidadeCalculada(distribuicao: DistribuicaoDeVagas, modalidadeId: string): string {
    const vaga = this.calculado(distribuicao)?.quadro.find(
      (item) => item.modalidadeOrigemId === modalidadeId,
    );
    return vaga === undefined ? '—' : String(vaga.quantidade);
  }

  /** Uma edição depois da simulação torna o resultado obsoleto. */
  /** Avança a cada edição; identifica o quadro que originou uma simulação. */
  private versaoDoQuadro = 0;

  private descartarSimulacao(): void {
    this.versaoDoQuadro += 1;
    // O quadro mudou: a resposta a caminho descreve outro. Abandoná-la libera
    // o botão de simular em vez de esperar por um resultado que será ignorado.
    this.abandonarSimulacaoEmVoo();
    if (this.simulacao().size > 0) this.simulacao.set(new Map());
    this.conferenciaConfirmada.set(false);
  }

  problemasDe(distribuicao: DistribuicaoDeVagas): readonly ProblemaDaDistribuicao[] {
    const problemas = problemasDaDistribuicao(distribuicao, this.catalogos.modalidadePorId());
    const teto = this.problemaDeTeto(distribuicao);
    return teto === null ? problemas : [...problemas, { escopo: 'oferta', mensagem: teto }];
  }

  private problemasComEscopo(
    distribuicao: DistribuicaoDeVagas,
    escopo: EscopoDoProblema,
  ): readonly string[] {
    return this.problemasDe(distribuicao)
      .filter((problema) => problema.escopo === escopo)
      .map((problema) => problema.mensagem);
  }

  /** O total informado passou do que o ato de autorização concede à oferta. */
  voBaseExcedido(distribuicao: DistribuicaoDeVagas): boolean {
    return this.problemaDeTeto(distribuicao) !== null;
  }

  /** O que destaca o campo: forma errada ou total acima do autorizado. */
  voBaseComProblema(distribuicao: DistribuicaoDeVagas): boolean {
    return this.voBaseInvalido(distribuicao) || this.voBaseExcedido(distribuicao);
  }

  private problemaDeTeto(distribuicao: DistribuicaoDeVagas): string | null {
    return problemaDeVagasAutorizadas(
      distribuicao.voBase,
      this.catalogos.vagasAutorizadasPorOferta().get(distribuicao.ofertaCursoId) ?? null,
    );
  }

  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }

  /**
   * Grava a distribuição inteira ao concluir o passo.
   *
   * Até aqui o quadro vive no rascunho: com vinte ofertas, gravar célula a
   * célula transformaria o preenchimento numa sequência de idas ao servidor, e
   * é por isso que o passo acumula e envia uma vez só.
   */
  async persistir(): Promise<StepValidation> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null) {
      return {
        valid: false,
        messages: ['O cadastro do processo precisa estar concluído antes de configurar as vagas.'],
      };
    }

    // O comando não sai de um passo que a validação recusaria: os campos são
    // texto até a conversão, e o que não é número vira zero no envio — o
    // servidor recusaria com mensagem que não aponta a célula.
    const conferencia = this.validate();
    if (!conferencia.valid) return conferencia;

    const geracao = this.store.geracao();
    this.store.salvando.set(true);
    try {
      const resultado = await this.cadastro.definirDistribuicaoVagas(
        processoId,
        this.distribuicoes().map(comoComando),
      );

      // O editor pode ter passado a outro processo enquanto o comando corria.
      // A resposta descreve o processo anterior, e concluir o passo agora
      // avançaria o rascunho de outro cadastro.
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };

      if (!resultado.ok) {
        return { valid: false, messages: [this.problemI18n.resolve(resultado.problem).title] };
      }

      return { valid: true };
    } finally {
      // Quem destrava é a geração que travou: um editor novo pode ter comando
      // próprio em curso.
      if (geracao === this.store.geracao()) this.store.salvando.set(false);
    }
  }

  /**
   * O que impede de avançar, dito uma vez por causa.
   *
   * Um problema do padrão vale para todas as ofertas, e nomeá-las uma a uma
   * faria o operador ler três vezes que falta um único campo. O que é de cada
   * oferta vira contagem — a célula pendente já está marcada no quadro.
   */
  /**
   * O que impede de gravar, tirando a declaração de conferência.
   *
   * Separado dela para a tela saber quando a marca é a única coisa que falta —
   * e só então destacá-la, em vez de pedir atenção enquanto ainda há campo
   * vazio no quadro.
   */
  private readonly pendenciasAlemDaConferencia = computed<readonly string[]>(() => {
    const distribuicoes = this.distribuicoes();
    if (distribuicoes.length === 0) {
      return ['Configure a distribuição de vagas de ao menos uma oferta de curso.'];
    }

    const foraDoPadrao = this.ofertasForaDoPadrao().length;

    return [
      ...(foraDoPadrao === 0
        ? []
        : [
            `${frase(foraDoPadrao)} têm regra, percentual ou modalidades diferentes do padrão em tela. Aplique o padrão a todas antes de gravar.`,
          ]),
      ...(this.simulacaoCobreOQuadro()
        ? []
        : ['Simule o quadro: é a conferência de quantas vagas cada modalidade recebe.']),
      ...this.problemasDoPadrao(),
      ...this.pendenciasDoQuadro().map((pendencia) => `${pendencia}.`),
      ...this.problemasEspecificos(),
      ...ofertasRepetidas(distribuicoes).map(
        (ofertaCursoId) =>
          `${this.rotuloDaOferta(ofertaCursoId)} aparece em mais de uma distribuição.`,
      ),
    ];
  });

  /** O quadro está pronto e resta declarar que foi conferido. */
  readonly soFaltaConferir = computed(
    () => !this.conferenciaConfirmada() && this.pendenciasAlemDaConferencia().length === 0,
  );

  validate(): StepValidation {
    const mensagens = [
      ...this.pendenciasAlemDaConferencia(),
      ...(this.conferenciaConfirmada() || this.distribuicoes().length === 0
        ? []
        : ['Confirme que conferiu o quadro de vagas antes de gravar.']),
    ];

    return mensagens.length > 0 ? { valid: false, messages: mensagens } : { valid: true };
  }

  /**
   * O que sobra depois do padrão e das pendências de preenchimento: recusas
   * que valem para uma oferta específica, como quantidade fixada numa
   * modalidade que a regra calcula.
   */
  private problemasEspecificos(): readonly string[] {
    return this.distribuicoes().flatMap((distribuicao) =>
      this.problemasComEscopo(distribuicao, 'oferta').map(
        (problema) => `${this.rotuloDaOferta(distribuicao.ofertaCursoId)}: ${problema}`,
      ),
    );
  }

  private modalidadesDoPadrao(): readonly ModalidadeDto[] {
    const selecionadas = new Set(this.padrao().modalidades.map((modalidade) => modalidade.id));
    return this.catalogos.modalidades().filter((modalidade) => selecionadas.has(modalidade.id));
  }

  private ehDeclarada(modalidade: ModalidadeDto): boolean {
    return quantidadeEhDeclarada(modalidade.composicaoVagas, this.ehFederal());
  }

  private alterarPadrao(patch: Partial<PadraoDaDistribuicao>): void {
    const proximo = { ...this.padrao(), ...patch };
    this.padraoPendente.set(proximo);

    // O padrão é o da coleção: alterá-lo reescreve todas as ofertas, senão o
    // que a tela mostra deixaria de descrever o que será gravado.
    this.substituir(
      this.distribuicoes().map((distribuicao) => ({
        ...distribuicao,
        ...proximo,
        quadro: this.quadroCoerente(distribuicao.quadro, proximo),
      })),
    );
  }

  /**
   * Tira do quadro o que o novo padrão não admite: modalidade que saiu da
   * seleção, e quantidade de modalidade que a regra passou a calcular.
   */
  private quadroCoerente(
    quadro: DistribuicaoDeVagas['quadro'],
    padrao: PadraoDaDistribuicao,
  ): DistribuicaoDeVagas['quadro'] {
    const selecionadas = new Set(padrao.modalidades.map((modalidade) => modalidade.id));
    const federal = padrao.regraDistribuicaoCodigo === REGRA_LEI_12711;
    const catalogo = this.catalogos.modalidadePorId();

    return quadro.filter((item) => {
      if (!selecionadas.has(item.modalidadeId)) return false;
      if (!federal) return true;

      const composicao = catalogo.get(item.modalidadeId)?.composicaoVagas;
      return composicao !== undefined && quantidadeEhDeclarada(composicao, federal);
    });
  }

  private substituir(ofertas: readonly DistribuicaoDeVagas[]): void {
    this.descartarSimulacao();
    this.store.patchObjectSection('vagas', { ofertas: [...ofertas] });
  }
}
