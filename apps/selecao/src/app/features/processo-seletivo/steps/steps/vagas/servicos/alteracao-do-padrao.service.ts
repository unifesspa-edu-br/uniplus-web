import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { ModalidadeDto } from '@uniplus/shared-data/configuracao';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { regraPorChave } from '../../../shared/regra-por-chave';
import { CatalogosDeDistribuicaoService } from '../catalogos-de-distribuicao.service';
import { ehRamoFederal } from '../composicao-de-vagas';
import { modalidadesDoRol } from '../modalidades-da-distribuicao';
import { PadraoDoEdital } from '../padrao-do-edital';
import { PadraoDoEditalService } from './padrao-do-edital.service';
import { QuadroDeVagasService } from './quadro-de-vagas.service';

type ModalidadeSelecionada = { readonly id: string; readonly codigo: string };

/**
 * As escolhas do operador sobre o padrão do edital. Trocar a regra e recompor o rol podem
 * descartar quantidades já preenchidas, então as duas passam por uma confirmação pendente.
 */
@Injectable()
export class AlteracaoDoPadraoService {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly catalogos = inject(CatalogosDeDistribuicaoService);
  private readonly padrao = inject(PadraoDoEditalService);
  private readonly quadro = inject(QuadroDeVagasService);

  /**
   * Troca pendente de regra de distribuição, aguardando confirmação.
   *
   * A regra determina o rol: trocá-la substitui as modalidades pelo rol da nova regra (ou preserva
   * a seleção livre, se o rol for aberto) e descarta do quadro as quantidades das que saírem.
   * Silencioso, com dez ofertas já preenchidas, seria surpresa grande demais para um clique de `<select>`.
   */
  readonly trocaDeRegraPendente = signal<{ codigo: string; versao: string } | null>(null);

  /**
   * Reaplicar o rol da regra ATUAL (sem trocar de regra) também pode descartar quantidade do
   * quadro: a mesma perda silenciosa que a troca de regra evita com confirmação.
   */
  readonly reaplicarRolPendente = signal(false);

  readonly avisoDoReaplicarRol =
    'Recompor pelo rol da regra atual pode remover do quadro quantidades já preenchidas — de modalidade que sai da seleção, ou de modalidade que fica mas cuja quantidade a regra atual não aceita mais como declarada. O processo só muda quando o passo for gravado.';

  readonly avisoDaTrocaDeRegra =
    'Trocar a regra de distribuição substitui as modalidades desta oferta pelas que a nova regra admite, e pode remover do quadro quantidades já preenchidas — de modalidade que sai da seleção, ou de modalidade que fica mas cuja quantidade a nova regra não aceita mais como declarada. O processo só muda quando o passo for gravado.';

  /**
   * O valor que o `<select>` de regra exibe: a escolha pendente enquanto ela aguarda confirmação,
   * o padrão vigente fora disso.
   *
   * `NgModel` só reescreve o `<select>` nativo quando o valor do binding MUDA de um ciclo de
   * detecção de mudanças para o outro. Ligar `[ngModel]` direto a `padrao()` faz cancelar a troca
   * não voltar a tela: o `<select>` nativo já mudou pela interação do operador, `padrao()` nunca
   * muda ao cancelar, e o `<select>` fica preso mostrando a regra rejeitada. Este computed muda em
   * cada transição (escolher, confirmar, cancelar), então sempre há uma mudança para o `NgModel` reagir.
   */
  readonly valorDoSelectDeRegra = computed(() => {
    const pendente = this.trocaDeRegraPendente();
    const padrao = this.padrao.padrao();
    return pendente !== null
      ? `${pendente.codigo}|${pendente.versao}`
      : `${padrao.regraDistribuicaoCodigo}|${padrao.regraDistribuicaoVersao}`;
  });

  readonly todasAsModalidadesSelecionadas = computed(() => {
    const oferecidas = this.padrao.modalidadesOferecidas();
    return (
      oferecidas.length > 0 && oferecidas.every((m) => this.padrao.modalidadeSelecionada(m.id))
    );
  });

  /**
   * Reaplicar o rol tem efeito além de quando a seleção diverge dele: uma modalidade pode continuar
   * corretamente selecionada e ainda assim ter, no quadro, uma quantidade que a regra atual não
   * aceita mais como declarada. `selecaoBateComORol` não enxerga essa divergência, porque ela é do
   * conteúdo do quadro, e não do conjunto de ids.
   */
  readonly reaplicarRolTemEfeito = computed(() => {
    if (this.padrao.rolDaRegraEscolhida() === null) return false;
    if (!this.padrao.selecaoBateComORol()) return true;

    return this.perderiaQuantidadeDoQuadro(this.modalidadesDoRolAtual());
  });

  constructor() {
    effect(() => {
      this.store.geracao();
      untracked(() => {
        this.trocaDeRegraPendente.set(null);
        this.reaplicarRolPendente.set(false);
      });
    });
  }

  escolherRegraDistribuicao(valor: string): void {
    const [codigo = '', versao = ''] = valor.split('|');
    const padrao = this.padrao.padrao();
    if (codigo === padrao.regraDistribuicaoCodigo && versao === padrao.regraDistribuicaoVersao) {
      return;
    }

    // `padrao.modalidades` cobre a seleção mesmo antes da primeira oferta existir (fica pendente,
    // sem linha alguma para o `.some()` iterar): checar só as ofertas deixaria passar sem aviso a
    // troca que descarta modalidades já escolhidas.
    const haDadoAPerder =
      padrao.modalidades.length > 0 ||
      this.padrao.distribuicoes().some((item) => item.quadro.length > 0);
    if (haDadoAPerder) {
      this.trocaDeRegraPendente.set({ codigo, versao });
      return;
    }

    this.aplicarTrocaDeRegra(codigo, versao);
  }

  confirmarTrocaDeRegra(): void {
    const pendente = this.trocaDeRegraPendente();
    if (pendente === null) return;

    this.trocaDeRegraPendente.set(null);
    this.aplicarTrocaDeRegra(pendente.codigo, pendente.versao);
  }

  cancelarTrocaDeRegra(): void {
    this.trocaDeRegraPendente.set(null);
  }

  escolherRegraAjuste(valor: string): void {
    const [codigo, versao] = valor.split('|');
    this.quadro.alterarPadrao({
      regraAjusteCodigo: codigo === undefined || codigo === '' ? null : codigo,
      regraAjusteVersao: versao === undefined || versao === '' ? null : versao,
    });
  }

  escolherReferencia(valor: string): void {
    this.quadro.alterarPadrao({ referenciaReservaDemograficaId: valor === '' ? null : valor });
  }

  alterarPr(pr: string): void {
    this.quadro.alterarPadrao({ pr });
  }

  /** Rol fechado não é escolha do operador: a regra já a fez. */
  alternarModalidade(modalidade: ModalidadeDto): void {
    if (this.padrao.rolDaRegraEscolhida() !== null) return;

    const atuais = this.padrao.padrao().modalidades;
    this.quadro.alterarPadrao({
      modalidades: this.padrao.modalidadeSelecionada(modalidade.id)
        ? atuais.filter((item) => item.id !== modalidade.id)
        : [...atuais, { id: modalidade.id, codigo: modalidade.codigo }],
    });
  }

  /** Só faz sentido com rol aberto: rol fechado já marca tudo, sem escolha. */
  marcarTodasAsModalidades(marcar: boolean): void {
    this.quadro.alterarPadrao({
      modalidades: marcar
        ? this.padrao.modalidadesOferecidas().map((m) => ({ id: m.id, codigo: m.codigo }))
        : [],
    });
  }

  /**
   * Recompõe a seleção pelo rol fechado da regra atual. Resolve excesso e falta juntos, a única
   * saída da tela quando um processo chega com uma seleção que não bate mais com o rol: rol
   * fechado não tem checkbox para modalidade fora dele, então não há como corrigir um item de cada vez.
   */
  reaplicarRolDaRegra(): void {
    if (this.padrao.rolDaRegraEscolhida() === null) return;

    const modalidades = this.modalidadesDoRolAtual();

    if (this.perderiaQuantidadeDoQuadro(modalidades)) {
      this.reaplicarRolPendente.set(true);
      return;
    }

    this.quadro.alterarPadrao({ modalidades });
  }

  confirmarReaplicarRol(): void {
    if (!this.reaplicarRolPendente()) return;

    this.reaplicarRolPendente.set(false);
    this.quadro.alterarPadrao({ modalidades: this.modalidadesDoRolAtual() });
  }

  cancelarReaplicarRol(): void {
    this.reaplicarRolPendente.set(false);
  }

  private aplicarTrocaDeRegra(codigo: string, versao: string): void {
    const rol =
      regraPorChave(this.catalogos.regrasDistribuicao(), codigo, versao)?.modalidadesAdmitidas ??
      null;

    // Rol aberto preserva a seleção livre; rol fechado é a oferta inteira: a regra determina o
    // conjunto, não filtra uma escolha dentro dele.
    const modalidades =
      rol === null
        ? this.padrao.padrao().modalidades
        : modalidadesDoRol(this.catalogos.modalidades(), rol).map((m) => ({
            id: m.id,
            codigo: m.codigo,
          }));

    const patch: Partial<PadraoDoEdital> = ehRamoFederal(codigo)
      ? { regraDistribuicaoCodigo: codigo, regraDistribuicaoVersao: versao, modalidades }
      : {
          regraDistribuicaoCodigo: codigo,
          regraDistribuicaoVersao: versao,
          // Fora do ramo federal o servidor recusa estes dois.
          regraAjusteCodigo: null,
          regraAjusteVersao: null,
          referenciaReservaDemograficaId: null,
          modalidades,
        };
    this.quadro.alterarPadrao(patch);
  }

  private modalidadesDoRolAtual(): ModalidadeSelecionada[] {
    const rol = this.padrao.rolDaRegraEscolhida();
    if (rol === null) return [];

    return modalidadesDoRol(this.catalogos.modalidades(), rol).map((m) => ({
      id: m.id,
      codigo: m.codigo,
    }));
  }

  /**
   * Se aplicar `modalidades` faria `quadroCoerente` descartar alguma quantidade já preenchida: não
   * só a de modalidade que sai da seleção, também a de modalidade que fica mas passa a ter
   * composição calculada pela regra. Delega para o método real em vez de reimplementar o filtro.
   */
  private perderiaQuantidadeDoQuadro(modalidades: readonly ModalidadeSelecionada[]): boolean {
    const proximoPadrao = { ...this.padrao.padrao(), modalidades };
    return this.padrao
      .distribuicoes()
      .some(
        (item) =>
          this.quadro.quadroCoerente(item.quadro, proximoPadrao).length < item.quadro.length,
      );
  }
}
