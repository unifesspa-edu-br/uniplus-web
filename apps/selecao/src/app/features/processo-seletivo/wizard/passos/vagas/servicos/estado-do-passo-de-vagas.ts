import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { ModalidadeDto } from '@uniplus/shared-data/configuracao';
import { ConfiguracaoDistribuicaoVagasDto } from '@uniplus/shared-data/selecao';
import { Subscription } from 'rxjs';

import { DistribuicaoDeVagas } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { regraPorChave } from '../../../shared/regra-por-chave';
import { CatalogosDeDistribuicao } from '../catalogos-de-distribuicao.service';
import { ehRamoFederal, quantidadeEhDeclarada } from '../composicao-de-vagas';
import { comPadraoAplicado } from '../edicao-do-quadro';
import { leituraDoPadrao } from '../leitura-do-padrao';
import { modalidadesDoRol, modalidadesGravadasPorId } from '../modalidades-da-distribuicao';
import { erroDasOpcoes, rotuloDasOpcoes, TEXTO_OPCOES_ACIMA_DAS_OFERTAS } from '../opcoes-de-curso';
import { PadraoDoEdital, seguemOMesmoPadrao } from '../padrao-do-edital';

const PADRAO_VAZIO: PadraoDoEdital = {
  regraDistribuicaoCodigo: '',
  regraDistribuicaoVersao: '',
  regraAjusteCodigo: null,
  regraAjusteVersao: null,
  referenciaReservaDemograficaId: null,
  modalidades: [],
  pr: '',
};

/** A modalidade do padrão como a tela a lê; sem `composicaoVagas`, nem o processo nem o catálogo a dizem. */
export type ModalidadeDoPadrao = Pick<ModalidadeDto, 'id' | 'codigo' | 'descricao'> &
  Partial<Pick<ModalidadeDto, 'composicaoVagas'>>;

/**
 * O estado local do passo de vagas: o que o operador está fazendo e não vive no rascunho, e o que
 * se deriva dele. É o único dono desse estado e do descarte dele na troca de processo.
 */
@Injectable()
export class EstadoDoPassoDeVagas {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly catalogos = inject(CatalogosDeDistribuicao);

  /** Enquanto não há oferta, o padrão declarado fica aqui. */
  private readonly padraoPendente = signal<PadraoDoEdital>(PADRAO_VAZIO);

  readonly ofertasMarcadas = signal<ReadonlySet<string>>(new Set());
  readonly filtroDeOferta = signal('');
  /** Oferta que o operador pediu para remover, aguardando confirmação. */
  readonly remocaoPendente = signal<string | null>(null);
  readonly trocaDeRegraPendente = signal<{ codigo: string; versao: string } | null>(null);
  readonly reaplicarRolPendente = signal(false);

  /** O erro do número de opções só aparece depois de uma tentativa de avançar. */
  readonly opcoesConferidas = signal(false);
  /** O estado em que a API recusou: o erro vale enquanto o número e o quadro continuam os mesmos. */
  readonly recusaDaApiNasOpcoes = signal<{ numero: string; ofertas: number } | null>(null);

  /** Quadro como a regra o calcula, por oferta. Vazio até simular. */
  readonly simulacao = signal<ReadonlyMap<string, ConfiguracaoDistribuicaoVagasDto>>(new Map());
  readonly simulacaoEmVoo = signal<Subscription | null>(null);
  readonly erroDaSimulacao = signal<string | null>(null);
  /** Avança a cada edição; identifica o quadro que originou uma simulação. */
  private versao = 0;

  readonly distribuicoes = computed(() => this.store.draft().vagas.ofertas);

  /**
   * O padrão vem da primeira oferta: é o rascunho que persiste, e guardá-lo num estado próprio
   * criaria duas fontes para o mesmo dado.
   */
  readonly padrao = computed<PadraoDoEdital>(() => {
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

  readonly ehFederal = computed(() => ehRamoFederal(this.padrao().regraDistribuicaoCodigo));

  readonly regraDistribuicaoEscolhida = computed(() =>
    regraPorChave(
      this.catalogos.regrasDistribuicao(),
      this.padrao().regraDistribuicaoCodigo,
      this.padrao().regraDistribuicaoVersao,
    ),
  );

  /** O rol que a regra escolhida admite. `null` é rol aberto, inclusive enquanto não há regra. */
  readonly rolDaRegraEscolhida = computed(
    () => this.regraDistribuicaoEscolhida()?.modalidadesAdmitidas ?? null,
  );

  /** As modalidades que a seção oferece: o rol da regra, ou o catálogo inteiro quando ele é aberto. */
  readonly modalidadesOferecidas = computed(() =>
    modalidadesDoRol(this.catalogos.modalidades(), this.rolDaRegraEscolhida()),
  );

  /** A seleção do padrão bate exatamente com o rol fechado da regra escolhida; rol aberto sempre bate. */
  readonly selecaoBateComORol = computed(() => {
    const rol = this.rolDaRegraEscolhida();
    if (rol === null) return true;

    const selecionados = new Set(this.padrao().modalidades.map((m) => m.codigo));
    return rol.length === selecionados.size && rol.every((codigo) => selecionados.has(codigo));
  });

  /**
   * Em consulta, as do snapshot gravado, com o catálogo só a complementar o que ele não traz;
   * fora dela, as do catálogo que o padrão seleciona.
   */
  readonly modalidadesDoPadrao = computed<readonly ModalidadeDoPadrao[]>(() => {
    if (!this.store.emConsulta()) {
      const selecionadas = new Set(this.padrao().modalidades.map((modalidade) => modalidade.id));
      return this.catalogos.modalidades().filter((modalidade) => selecionadas.has(modalidade.id));
    }

    const vigentes = new Map(this.catalogos.modalidades().map((m) => [m.id, m]));
    const gravadas = modalidadesGravadasPorId(
      this.distribuicoes(),
      this.catalogos.modalidadePorId(),
    );
    return this.padrao().modalidades.map((modalidade) => ({
      id: modalidade.id,
      codigo: modalidade.codigo,
      descricao: modalidade.gravada?.descricao ?? vigentes.get(modalidade.id)?.descricao ?? '',
      composicaoVagas: gravadas.get(modalidade.id)?.composicaoVagas || undefined,
    }));
  });

  readonly colunasDeQuantidade = computed(() =>
    this.modalidadesDoPadrao().filter((modalidade) => this.ehDeclarada(modalidade)),
  );

  /**
   * Em consulta, as colunas saem do que o processo gravou, com ou sem catálogo. Só quando a
   * composição é desconhecida (nem o snapshot nem o catálogo a dizem) vale ter quantidade gravada
   * em alguma oferta; senão o rodapé leria "0" vagas.
   */
  readonly colunasDoQuadro = computed(() => {
    if (!this.store.emConsulta()) return this.colunasDeQuantidade();

    const comQuantidade = new Set(
      this.distribuicoes().flatMap((item) => item.quadro.map((q) => q.modalidadeId)),
    );
    return this.modalidadesDoPadrao().filter((modalidade) =>
      modalidade.composicaoVagas === undefined
        ? comQuantidade.has(modalidade.id)
        : this.ehDeclarada(modalidade),
    );
  });

  /** O que a regra calcula, e por isso o edital não preenche. */
  readonly modalidadesCalculadas = computed(() =>
    this.modalidadesDoPadrao().filter(
      (modalidade) => modalidade.composicaoVagas !== undefined && !this.ehDeclarada(modalidade),
    ),
  );

  readonly resumoDasCalculadas = computed(() => {
    const quantas = this.modalidadesCalculadas().length;
    const sujeito = quantas === 1 ? '1 modalidade tem' : `${quantas} modalidades têm`;

    return `${sujeito} a quantidade calculada pela regra, a partir do total de vagas e do percentual de reserva. O edital não fixa esse valor: ele aparece no quadro depois da simulação.`;
  });

  readonly padraoLido = computed(() =>
    leituraDoPadrao({
      padrao: this.padrao(),
      modalidades: this.modalidadesDoPadrao(),
      referencias: this.catalogos.referencias(),
      catalogoLido: this.catalogos.situacao() === 'lido',
      motivoDaAusencia: this.catalogos.motivoDaAusencia(),
    }),
  );

  readonly ofertasDisponiveis = computed(() => {
    const usadas = new Set(this.distribuicoes().map((item) => item.ofertaCursoId));
    return this.catalogos.ofertas().filter((oferta) => !usadas.has(oferta.id));
  });

  readonly ofertasParaEscolher = computed(() => {
    const termo = this.filtroDeOferta().trim().toLowerCase();
    const disponiveis = this.ofertasDisponiveis();
    if (termo === '') return disponiveis;

    return disponiveis.filter((oferta) =>
      this.catalogos.rotuloDaOfertaOuSemNome(oferta.id).toLowerCase().includes(termo),
    );
  });

  /**
   * Ofertas gravadas com regra, percentual ou modalidades diferentes do que a tela apresenta como
   * padrão. Só aparecem em processo criado por outro caminho; enquanto existirem, o que seria
   * enviado não é o que está em tela.
   */
  readonly ofertasForaDoPadrao = computed(() =>
    this.distribuicoes().filter((item) => !seguemOMesmoPadrao(item, this.padrao())),
  );

  /** A simulação cobre todas as ofertas do quadro; uma edição descarta o resultado. */
  readonly simulacaoCobreOQuadro = computed(() =>
    this.distribuicoes().every((item) => this.simulacao().has(item.ofertaCursoId)),
  );

  readonly numeroDeOpcoes = computed(() => this.store.draft().opcoesDeCurso.numero);
  readonly opcoesLidas = computed(() => rotuloDasOpcoes(this.numeroDeOpcoes()));

  readonly erroDasOpcoes = computed<string | null>(() => {
    const recusa = this.recusaDaApiNasOpcoes();
    const numero = this.numeroDeOpcoes();
    const ofertas = this.distribuicoes().length;
    if (recusa !== null && recusa.numero === numero && recusa.ofertas === ofertas) {
      return TEXTO_OPCOES_ACIMA_DAS_OFERTAS;
    }
    return this.opcoesConferidas() ? erroDasOpcoes(numero, ofertas) : null;
  });

  constructor() {
    // A rota é reusada entre processos e `store.reset()` não alcança signal de serviço. Sem
    // descartar o que é local, o processo seguinte abriria com a simulação, o padrão e as
    // confirmações do anterior; e a simulação antiga valeria como cobertura, porque a checagem é
    // por id de oferta e dois processos do mesmo catálogo compartilham as ofertas.
    effect(() => {
      this.store.geracao();
      untracked(() => this.descartarEstadoLocal());
    });
  }

  versaoDoQuadro(): number {
    return this.versao;
  }

  /** Uma edição depois da simulação torna o resultado obsoleto e solta a requisição a caminho. */
  descartarSimulacao(): void {
    this.versao += 1;
    this.abandonarSimulacaoEmVoo();
    if (this.simulacao().size > 0) this.simulacao.set(new Map());
  }

  abandonarSimulacaoEmVoo(): void {
    this.simulacaoEmVoo()?.unsubscribe();
    this.simulacaoEmVoo.set(null);
  }

  /** Troca as ofertas do rascunho; o quadro mudou, então a simulação deixa de valer. */
  substituir(ofertas: readonly DistribuicaoDeVagas[]): void {
    this.descartarSimulacao();
    this.store.patchObjectSection('vagas', { ofertas: [...ofertas] });
  }

  alterarPadrao(patch: Partial<PadraoDoEdital>): void {
    const proximo = { ...this.padrao(), ...patch };
    this.padraoPendente.set(proximo);
    this.substituir(
      comPadraoAplicado(this.distribuicoes(), proximo, this.catalogos.modalidadePorId()),
    );
  }

  /** Tirar a última oferta não leva o padrão junto: ele é lido da primeira oferta. */
  removerOferta(ofertaCursoId: string): void {
    const restantes = this.distribuicoes().filter((item) => item.ofertaCursoId !== ofertaCursoId);
    if (restantes.length === 0) this.padraoPendente.set(this.padrao());

    this.substituir(restantes);
  }

  modalidadeSelecionada(modalidadeId: string): boolean {
    return this.padrao().modalidades.some((modalidade) => modalidade.id === modalidadeId);
  }

  private ehDeclarada(modalidade: ModalidadeDoPadrao): boolean {
    return (
      modalidade.composicaoVagas !== undefined &&
      quantidadeEhDeclarada(modalidade.composicaoVagas, this.ehFederal())
    );
  }

  private descartarEstadoLocal(): void {
    this.descartarSimulacao();
    this.erroDaSimulacao.set(null);
    this.padraoPendente.set(PADRAO_VAZIO);
    this.ofertasMarcadas.set(new Set());
    this.filtroDeOferta.set('');
    this.remocaoPendente.set(null);
    this.trocaDeRegraPendente.set(null);
    this.reaplicarRolPendente.set(false);
    this.opcoesConferidas.set(false);
    this.recusaDaApiNasOpcoes.set(null);
  }
}
