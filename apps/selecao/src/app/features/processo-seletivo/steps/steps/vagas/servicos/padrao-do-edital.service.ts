import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { ModalidadeDto } from '@uniplus/shared-data/configuracao';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { regraPorChave } from '../../../shared/regra-por-chave';
import { CatalogosDeDistribuicaoService } from '../catalogos-de-distribuicao.service';
import { ehRamoFederal, quantidadeEhDeclarada } from '../composicao-de-vagas';
import { modalidadesDoRol, modalidadesGravadasPorId } from '../modalidades-da-distribuicao';
import { PadraoDoEdital } from '../padrao-do-edital';

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
 * O padrão do edital, lido do rascunho: o que ele declara uma vez e vale para todas as ofertas do
 * quadro, e o que a regra escolhida faz com as modalidades e com as colunas do quadro.
 */
@Injectable()
export class PadraoDoEditalService {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly catalogos = inject(CatalogosDeDistribuicaoService);

  readonly distribuicoes = computed(() => this.store.draft().vagas.ofertas);

  /** Enquanto não há oferta, o padrão declarado fica aqui. */
  private readonly padraoPendente = signal<PadraoDoEdital>(PADRAO_VAZIO);

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

  /** A entrada do catálogo para a regra de distribuição escolhida no padrão. */
  readonly regraDistribuicaoEscolhida = computed(() =>
    regraPorChave(
      this.catalogos.regrasDistribuicao(),
      this.padrao().regraDistribuicaoCodigo,
      this.padrao().regraDistribuicaoVersao,
    ),
  );

  /**
   * O rol que a regra escolhida admite. `null` é rol aberto: nenhuma regra ainda escolhida cai
   * aqui também, e a seção de modalidades mostra o catálogo inteiro até a escolha acontecer.
   */
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
   * O padrão da distribuição como o processo o gravou, em texto: o que a consulta lê no lugar dos
   * seletores. Regra sem código é regra não declarada, e o campo diz isso.
   */
  readonly padraoLido = computed(() => {
    const padrao = this.padrao();
    const situacao = this.catalogos.situacao();
    const motivo = this.catalogos.motivoDaAusencia();
    const regra = (codigo: string | null, versao: string | null): string | null =>
      codigo ? `${codigo} · versão ${versao ?? ''}` : null;
    const referencia = this.catalogos
      .referencias()
      .find((item) => item.id === padrao.referenciaReservaDemograficaId);

    return {
      regraDeDistribuicao: regra(padrao.regraDistribuicaoCodigo, padrao.regraDistribuicaoVersao),
      percentualDeReserva: padrao.pr,
      regraDeAjuste: regra(padrao.regraAjusteCodigo, padrao.regraAjusteVersao),
      referenciaDemografica: referencia
        ? `Censo ${referencia.censoReferencia} — PPI ${referencia.ppiPercentual}% · quilombola ${referencia.quilombolaPercentual}% · PcD ${referencia.pcdPercentual}%`
        : !padrao.referenciaReservaDemograficaId
          ? null
          : situacao === 'lido'
            ? 'Referência gravada fora do catálogo'
            : `Referência gravada, mas o catálogo ${motivo}`,
      modalidades: this.modalidadesDoPadrao().map((modalidade) =>
        modalidade.descricao !== ''
          ? `${modalidade.codigo} — ${modalidade.descricao}`
          : situacao === 'lido'
            ? modalidade.codigo
            : `${modalidade.codigo} — descrição: o catálogo ${motivo}`,
      ),
    };
  });

  /**
   * Em consulta, as do snapshot gravado, com o catálogo só a complementar o que ele não traz;
   * fora dela, as do catálogo que o padrão seleciona.
   */
  readonly modalidadesDoPadrao = computed<readonly ModalidadeDoPadrao[]>(() => {
    if (this.store.emConsulta()) {
      const vigentes = new Map(
        this.catalogos.modalidades().map((modalidade) => [modalidade.id, modalidade]),
      );
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
    }

    const selecionadas = new Set(this.padrao().modalidades.map((modalidade) => modalidade.id));
    return this.catalogos.modalidades().filter((modalidade) => selecionadas.has(modalidade.id));
  });

  readonly colunasDeQuantidade = computed(() =>
    this.modalidadesDoPadrao().filter((modalidade) => this.ehDeclarada(modalidade)),
  );

  /**
   * Em consulta, as colunas saem do que o processo gravou, com ou sem catálogo: as modalidades do
   * padrão cuja quantidade o edital fixa, na ordem do padrão. Só quando a composição é
   * desconhecida (nem o snapshot nem o catálogo a dizem) vale ter quantidade gravada em alguma oferta.
   */
  readonly colunasDoQuadro = computed<
    readonly Pick<ModalidadeDto, 'id' | 'codigo' | 'descricao'>[]
  >(() => {
    if (!this.store.emConsulta()) return this.colunasDeQuantidade();
    // O processo gravado sem a composição da modalidade (e sem catálogo que a complete) não diz
    // se a regra a calcula: coluna só para quem tem quantidade gravada, senão o rodapé leria "0" vagas.
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

  constructor() {
    // A rota é reusada entre processos e `store.reset()` não alcança signal de serviço. Sem
    // descartar o padrão pendente, o processo seguinte abriria com o padrão do anterior.
    effect(() => {
      this.store.geracao();
      untracked(() => this.padraoPendente.set(PADRAO_VAZIO));
    });
  }

  guardarComoPendente(padrao: PadraoDoEdital): void {
    this.padraoPendente.set(padrao);
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
}
