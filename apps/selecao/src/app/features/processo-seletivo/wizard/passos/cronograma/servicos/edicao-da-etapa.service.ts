import { computed, inject, Injectable } from '@angular/core';
import type { FormGroup } from '@angular/forms';

import type { ProdutoDaFase, RecursoDaEtapa } from '../../../processo-seletivo.models';
import { FORMAS_DE_AVALIACAO } from '../../../shared/forma-de-avaliacao';
import { MENSAGEM_DA_INSTANCIA_SUPERIOR_EM_ABERTO } from '../../../shared/instancia-superior';
import { PAPEIS_ESCOLHIVEIS } from '../../fase/configuracao-da-fase';
import { CatalogoDeAtos } from '../catalogos/catalogo-de-atos.service';
import { CatalogoDeBancas } from '../catalogos/catalogo-de-bancas.service';
import { CatalogoDeRegras } from '../catalogos/catalogo-de-regras.service';
import { CatalogoDeTiposDeEtapa } from '../catalogos/catalogo-de-tipos-de-etapa.service';
import { textosDoCatalogo } from '../convencao-de-contagem';
import type { EtapaForm } from '../cronograma-form';
import {
  etapaDeclaraNotaMaxima,
  etapaDeNotaDoEnem,
  etapaEhDeAvaliacaoHumana,
  etapaUsaEscalaDeAtendimento,
} from '../declaracoes-da-etapa';
import {
  trocarCaraterDaEtapa,
  trocarFormaDeAvaliacao,
  trocarRegraDeConsolidacao,
  trocarTipoDaEtapa,
} from '../edicao-da-etapa';
import {
  dataHoraLida,
  etapaLida,
  nomeDaEtapa,
  type CatalogosDaLeitura,
} from '../leitura-da-etapa';
import {
  acrescentarProduto,
  escolherAtoDoProduto,
  escolherPapelDoProduto,
  removerProduto,
} from '../produtos-da-etapa';
import {
  acrescentarRecurso,
  alterarRecurso,
  declararInstanciaSuperior,
  preliminaresDaEtapa,
  removerRecurso,
} from '../recursos-da-etapa';
import { caracteresAdmitidos, eliminaPorCarater, pontuaPorCarater } from '../regras-da-etapa';
import { FormularioDoCronograma } from './formulario-do-cronograma.service';

/**
 * O que a tela sabe e faz com uma etapa do formulário: ler o que ela declara, escolher seus
 * campos e editar produtos, bancas e janelas de recurso. Cada seção da etapa o usa, e cada
 * leitura acompanha a versão do formulário, porque o valor de um controle não é signal.
 */
@Injectable()
export class EdicaoDaEtapa {
  private readonly catalogoDeAtos = inject(CatalogoDeAtos);
  private readonly catalogoDeBancas = inject(CatalogoDeBancas);
  private readonly catalogoDeRegras = inject(CatalogoDeRegras);
  private readonly catalogoDeTiposDeEtapa = inject(CatalogoDeTiposDeEtapa);
  private readonly catalogosDaLeitura: CatalogosDaLeitura = {
    rotuloDoAto: this.catalogoDeAtos.rotuloDoAto,
    rotuloDoTipoEtapa: this.catalogoDeTiposDeEtapa.rotuloDoTipoEtapa,
    tipoEtapaPorId: this.catalogoDeTiposDeEtapa.tipoEtapaPorId,
    bancas: this.catalogoDeBancas.bancas,
  };
  private readonly cronograma = inject(FormularioDoCronograma);
  private readonly versaoDoFormulario = this.cronograma.versao;

  /** Os papéis escolhíveis, no mesmo vocabulário que a configuração da fase usa. */
  readonly papeis = PAPEIS_ESCOLHIVEIS;

  readonly mensagemDaInstanciaSuperiorEmAberto = MENSAGEM_DA_INSTANCIA_SUPERIOR_EM_ABERTO;

  /**
   * Tipos que o seletor de uma etapa oferece: os ativos, mais o que ela já
   * referencia quando esse saiu de atividade.
   *
   * Um tipo inativo não volta a ser escolha nova, mas continua descrevendo a
   * etapa que o gravou. Sem ele na lista, nenhuma opção casa e o campo aparece
   * em branco — o operador não veria qual classificação está configurada, e
   * gravaria por cima dela sem perceber.
   */
  tiposEscolhiveisPara(grupo: FormGroup<EtapaForm>): readonly { id: string; nome: string }[] {
    const referenciado = grupo.controls.tipoEtapaOrigemId.value;
    const ativos = this.catalogoDeTiposDeEtapa
      .tiposEtapaAtivos()
      .map((tipo) => ({ id: tipo.id, nome: tipo.nome }));

    if (referenciado === '' || ativos.some((tipo) => tipo.id === referenciado)) {
      return ativos;
    }

    const rotulo = this.catalogoDeTiposDeEtapa.rotuloDoTipoEtapa().get(referenciado);
    return [
      ...ativos,
      {
        id: referenciado,
        nome: rotulo === undefined ? 'Tipo fora do catálogo atual' : `${rotulo} (inativo)`,
      },
    ];
  }

  /** O que o cabeçalho recolhido diz sobre as janelas recursais da etapa. */
  resumoDosRecursos(grupo: FormGroup<EtapaForm>): string {
    const total = this.recursosDaEtapa(grupo).length;
    if (total === 0) return 'nenhum recurso';
    return total === 1 ? '1 recurso' : `${total} recursos`;
  }

  /** O que o cabeçalho recolhido diz sobre o que a etapa publica. */
  resumoDasPublicacoes(grupo: FormGroup<EtapaForm>): string {
    const total = this.produtosDaEtapa(grupo).filter((p) => p.atoCodigo !== '').length;
    if (total === 0) return 'não publica nada';
    return total === 1 ? '1 publicação' : `${total} publicações`;
  }

  caracteresPara(grupo: FormGroup<EtapaForm>): readonly { valor: string; rotulo: string }[] {
    this.versaoDoFormulario();
    return caracteresAdmitidos(
      this.catalogoDeTiposDeEtapa.tipoEtapaPorId().get(grupo.controls.tipoEtapaOrigemId.value),
      this.etapaDeNotaDoEnem(grupo),
      grupo.controls.carater.value,
    );
  }

  escolherTipoEtapa(grupo: FormGroup<EtapaForm>, tipoEtapaOrigemId: string): void {
    trocarTipoDaEtapa(grupo, tipoEtapaOrigemId, this.catalogoDeTiposDeEtapa.tipoEtapaPorId());
    this.versaoDoFormulario.update((versao) => versao + 1);
  }

  etapaDeNotaDoEnem(grupo: FormGroup<EtapaForm>): boolean {
    this.versaoDoFormulario();
    return etapaDeNotaDoEnem(grupo, this.catalogoDeTiposDeEtapa.tipoEtapaPorId());
  }

  /**
   * A etapa entra no cálculo da nota final — e, por isso, o peso dela tem efeito.
   *
   * Quem decide é o caráter, não o tipo: `CalcularDivisorMedia` soma o peso das etapas
   * classificatórias e das que são ambas, e ignora as puramente eliminatórias. Peso numa
   * eliminatória é dado morto que o operador acredita estar declarando.
   */
  etapaComponeNota(grupo: FormGroup<EtapaForm>): boolean {
    this.versaoDoFormulario();
    return pontuaPorCarater(grupo.controls.carater.value);
  }

  etapaDeclaraNotaMaxima(grupo: FormGroup<EtapaForm>): boolean {
    this.versaoDoFormulario();
    return etapaDeclaraNotaMaxima(grupo, this.catalogoDeTiposDeEtapa.tipoEtapaPorId());
  }

  readonly formasDeAvaliacao = FORMAS_DE_AVALIACAO;

  etapaEhDeAvaliacaoHumana(grupo: FormGroup<EtapaForm>): boolean {
    this.versaoDoFormulario();
    return etapaEhDeAvaliacaoHumana(grupo, this.catalogoDeTiposDeEtapa.tipoEtapaPorId());
  }

  escolherFormaDeAvaliacao(grupo: FormGroup<EtapaForm>, forma: string): void {
    trocarFormaDeAvaliacao(grupo, forma);
    this.versaoDoFormulario.update((versao) => versao + 1);
  }

  /**
   * As regras de consolidação que o catálogo publica, com a prosa dos invariantes como
   * descrição. O DTO não tem `nome`: o código é o que identifica, e nenhuma lista é escrita aqui.
   */
  readonly regrasDeConsolidacao = computed(() =>
    this.catalogoDeRegras.regrasConsolidacao().map((regra) => ({
      codigo: regra.codigo,
      versao: regra.versao,
      descricao: textosDoCatalogo(regra.invariantes),
    })),
  );

  escolherRegraDeConsolidacao(grupo: FormGroup<EtapaForm>, codigo: string, versao: string): void {
    trocarRegraDeConsolidacao(grupo, codigo, versao);
    this.versaoDoFormulario.update((atual) => atual + 1);
  }

  etapaUsaEscalaDeAtendimento(grupo: FormGroup<EtapaForm>): boolean {
    this.versaoDoFormulario();
    return etapaUsaEscalaDeAtendimento(grupo, this.catalogoDeTiposDeEtapa.tipoEtapaPorId());
  }

  /** A etapa corta candidato — é onde a nota mínima tem o que fazer. */
  etapaElimina(grupo: FormGroup<EtapaForm>): boolean {
    this.versaoDoFormulario();
    return eliminaPorCarater(grupo.controls.carater.value);
  }

  escolherCarater(grupo: FormGroup<EtapaForm>, carater: string): void {
    trocarCaraterDaEtapa(grupo, carater, this.catalogoDeTiposDeEtapa.tipoEtapaPorId());
    this.versaoDoFormulario.update((versao) => versao + 1);
  }

  /**
   * O que a linha fechada diz sobre a etapa, para o operador não precisar abrir para saber.
   *
   * Só o que está declarado aparece: uma etapa recém-acrescentada mostra o tipo e nada mais,
   * e é assim que a lista distingue o que já foi configurado do que ainda não.
   */
  marcasDaEtapa(grupo: FormGroup<EtapaForm>): readonly string[] {
    const marcas: string[] = [];

    const tipo = this.catalogoDeTiposDeEtapa.rotuloDoTipoEtapa().get(grupo.controls.tipoEtapaOrigemId.value);
    if (tipo !== undefined) marcas.push(tipo);

    const publicacoes = this.produtosDaEtapa(grupo).filter((p) => p.atoCodigo !== '').length;
    if (publicacoes > 0) {
      marcas.push(publicacoes === 1 ? '1 publicação' : `${publicacoes} publicações`);
    }

    const bancas = this.bancasDaEtapa(grupo).length;
    if (bancas > 0) marcas.push(bancas === 1 ? '1 banca' : `${bancas} bancas`);

    const recursos = this.recursosDaEtapa(grupo).length;
    if (recursos > 0) marcas.push(recursos === 1 ? '1 recurso' : `${recursos} recursos`);

    if (grupo.controls.emiteParecerIndividual.value) marcas.push('parecer individual');

    return marcas;
  }

  readonly nomeDaEtapa = nomeDaEtapa;

  readonly dataHoraLida = dataHoraLida;

  etapaLida(grupo: FormGroup<EtapaForm>) {
    return etapaLida(grupo, this.catalogosDaLeitura);
  }

  produtosDaEtapa(grupo: FormGroup<EtapaForm>): readonly ProdutoDaFase[] {
    this.versaoDoFormulario();
    return grupo.controls.produtos.value;
  }

  readonly acrescentarProdutoNaEtapa = acrescentarProduto;

  readonly removerProdutoDaEtapa = removerProduto;

  readonly escolherAtoDaEtapa = escolherAtoDoProduto;

  readonly escolherPapelDaEtapa = escolherPapelDoProduto;

  /** Só ato que o catálogo marca como resultado admite papel no ciclo recursal. */
  atoEhResultado(atoCodigo: string): boolean {
    return this.catalogoDeAtos.atoPorCodigo().get(atoCodigo)?.ehResultado === true;
  }

  // ── Bancas e janelas recursais da etapa ────────────────────────────────────

  bancasDaEtapa(grupo: FormGroup<EtapaForm>): readonly string[] {
    this.versaoDoFormulario();
    return grupo.controls.bancas.value;
  }

  alternarBancaDaEtapa(grupo: FormGroup<EtapaForm>, tipoBancaId: string, marcada: boolean): void {
    const atuais = grupo.controls.bancas.value;
    const proximas = marcada
      ? [...new Set([...atuais, tipoBancaId])]
      : atuais.filter((id) => id !== tipoBancaId);
    grupo.controls.bancas.setValue(proximas);
    grupo.controls.bancas.markAsDirty();
  }

  recursosDaEtapa(grupo: FormGroup<EtapaForm>): readonly RecursoDaEtapa[] {
    this.versaoDoFormulario();
    return grupo.controls.recursos.value;
  }

  acrescentarRecursoNaEtapa(grupo: FormGroup<EtapaForm>): void {
    acrescentarRecurso(grupo, this.catalogoDeRegras.regrasRecurso(), this.etapaDeNotaDoEnem(grupo));
  }

  /** Sem regra de prazo no catálogo, não há janela recursal declarável. */
  temRegraDeRecurso(): boolean {
    return this.catalogoDeRegras.regrasRecurso().length > 0;
  }

  readonly removerRecursoDaEtapa = removerRecurso;

  alterarRecursoDaEtapa(
    grupo: FormGroup<EtapaForm>,
    posicao: number,
    campo: keyof RecursoDaEtapa,
    valor: string,
  ): void {
    alterarRecurso(grupo, posicao, campo, valor, this.catalogoDeRegras.regrasRecurso());
  }

  readonly declararInstanciaSuperiorDaEtapa = declararInstanciaSuperior;

  preliminaresDaEtapa(grupo: FormGroup<EtapaForm>): readonly ProdutoDaFase[] {
    this.versaoDoFormulario();
    return preliminaresDaEtapa(grupo);
  }
}
