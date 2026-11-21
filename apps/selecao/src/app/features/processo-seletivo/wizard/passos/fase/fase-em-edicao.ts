import { Injectable, computed, inject, signal } from '@angular/core';

import type { FaseDoCronograma } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { descreverFase, finalidadesDaFase } from '../../shared/descricao-da-fase';
import { emOrdem, type RecusaOrdenada } from '../../shared/recusas/ordem-das-recusas';
import { CatalogoDeAtos } from '../cronograma/catalogos/catalogo-de-atos.service';
import { CatalogoDeBancas } from '../cronograma/catalogos/catalogo-de-bancas.service';
import { CatalogoDeFases } from '../cronograma/catalogos/catalogo-de-fases.service';
import { RecusasDoServidorNasFases } from '../cronograma/servicos/recusas-do-servidor-nas-fases.service';
import { NO_TOPO_DA_FASE, posicaoDaPublicacao, type CampoDaRecusaDaFase } from './campo-da-fase';
import { problemasDaFase, type AtoDoCatalogo, type ProblemaDaFase } from './configuracao-da-fase';
import { produtosPreliminares } from './problemas-do-recurso-da-fase';
import { bancasEscolhiveis, nomeDaBanca } from './secoes/bancas-da-fase';
import { EspelhoDaFase } from './espelho-da-fase';
import { idDaFase } from './ids-da-fase';

/**
 * A recusa fica no bloco da lista de publicações quando é à lista inteira, quando a pessoa já
 * alterou a fase por baixo dela (a conferir de novo) ou quando a linha que ela aponta não existe mais.
 */
function ficaNaListaDePublicacoes(recusa: RecusaOrdenada, quantidadeDeLinhas: number): boolean {
  const posicao = posicaoDaPublicacao(recusa.campo);
  if (posicao === null) return recusa.campo === 'produtos';
  return recusa.aConferir || posicao >= quantidadeDeLinhas;
}

/**
 * A fase como o seletor a apresenta: posição na linha do tempo e nome resolvido
 * pelo catálogo, ou pelo código quando a fase saiu dele.
 */
export interface FaseNoSeletor {
  readonly faseCanonicaId: string;
  readonly codigo: string;
  readonly ordem: number;
  readonly nome: string;
}

/**
 * O que as seções do passo da fase compartilham: qual fase está aberta, o formulário que a
 * espelha, o que a conferência recusa por campo e o id de cada elemento.
 * Cada passo da fase tem a sua instância, porque o Cronograma embute um por fase.
 */
@Injectable()
export class FaseEmEdicao {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly catalogoDeAtos = inject(CatalogoDeAtos);
  private readonly catalogoDeBancas = inject(CatalogoDeBancas);
  private readonly catalogoDeFases = inject(CatalogoDeFases);
  private readonly recusasDoServidor = inject(RecusasDoServidorNasFases);

  /** Fase aberta, pelo id da fase canônica — o identificador sempre presente. */
  readonly faseAberta = signal('');

  readonly espelho = new EspelhoDaFase(this.store, () =>
    this.recusasDoServidor.registrarAlteracao(),
  );

  /** As fases do certame na ordem em que ocorrem. */
  readonly fasesDoCronograma = computed<readonly FaseDoCronograma[]>(() =>
    [...this.store.draft().cronograma.fases].sort((uma, outra) => uma.ordem - outra.ordem),
  );

  /** As fases como o seletor as nomeia. */
  readonly fasesNoSeletor = computed<readonly FaseNoSeletor[]>(() => {
    const fasePorId = this.catalogoDeFases.fasePorId();
    return this.fasesDoCronograma().map((fase) => ({
      faseCanonicaId: fase.faseCanonicaId,
      codigo: fase.codigo,
      ordem: fase.ordem,
      nome: descreverFase(fase, fasePorId).nome,
    }));
  });

  /** A fase aberta como o rascunho a guarda, ou `null` sem cronograma. */
  readonly faseDoRascunho = computed<FaseDoCronograma | null>(() => {
    const aberta = this.faseAberta();
    return this.fasesDoCronograma().find((fase) => fase.faseCanonicaId === aberta) ?? null;
  });

  /**
   * Os formulários que se respondem na fase aberta — onde o documento pode ser apresentado. Vazio
   * na fase que não responde formulário nenhum, e aí não há o que escolher.
   */
  readonly finalidadesDaFaseAberta = computed<readonly string[]>(() => {
    const fase = this.faseDoRascunho();
    return fase === null ? [] : finalidadesDaFase(fase, this.catalogoDeFases.fasePorId());
  });

  /** Nome da fase aberta, para o cabeçalho e para as mensagens. */
  readonly nomeDaFaseAberta = computed(() => {
    const aberta = this.faseAberta();
    return this.fasesNoSeletor().find((fase) => fase.faseCanonicaId === aberta)?.nome ?? '';
  });

  /** As publicações preliminares da fase — as únicas que podem ancorar o prazo. */
  readonly ancorasPossiveis = computed<readonly { codigo: string; nome: string }[]>(() => {
    const fase = this.faseDoRascunho();
    if (fase === null) return [];

    const rotulos = this.catalogoDeAtos.rotuloDoAto();
    return produtosPreliminares(fase.produtos).map((produto) => ({
      codigo: produto.atoCodigo,
      nome: rotulos.get(produto.atoCodigo) ?? produto.atoCodigo,
    }));
  });

  /** Publicação preliminar única, que dispensa escolha; `null` com zero ou duas. */
  readonly ancoraUnica = computed(() => {
    const possiveis = this.ancorasPossiveis();
    return possiveis.length === 1 ? possiveis[0].codigo : null;
  });

  /** A fase abre ciclo recursal: publica ao menos um resultado preliminar. */
  readonly publicaPreliminar = computed(() => this.ancorasPossiveis().length > 0);

  /** Bancas que o seletor oferece. */
  readonly bancasEscolhiveis = computed(() => {
    this.espelho.versao();
    const doCadastro = this.catalogoDeBancas
      .bancas()
      .map((banca) => ({ id: banca.id, nome: banca.nome }));
    return bancasEscolhiveis(doCadastro, this.faseDoRascunho());
  });

  readonly atoPorCodigo = computed<ReadonlyMap<string, AtoDoCatalogo>>(
    () =>
      new Map(
        [...this.catalogoDeAtos.atoPorCodigo()].map(([codigo, ato]) => [
          codigo,
          { nome: ato.nome, ehResultado: ato.ehResultado },
        ]),
      ),
  );

  /** O que impede gravar a fase aberta, com o campo de cada recusa. */
  readonly problemas = computed<readonly ProblemaDaFase[]>(() => {
    const fase = this.faseDoRascunho();
    if (fase === null) return [];
    return problemasDaFase(fase, this.atoPorCodigo(), (id) => this.nomeDaBanca(id));
  });

  /** O que a conferência local diz do campo. */
  readonly problemaLocal = (campo: CampoDaRecusaDaFase): string | null =>
    this.problemas().find((problema) => problema.campo === campo)?.mensagem ?? null;

  /** As recusas do servidor à fase aberta, ativas e a conferir, sem ordem. */
  private readonly recusasDaFase = computed<readonly RecusaOrdenada[]>(() =>
    this.recusasDoServidor.recusasDaFase(this.faseAberta()),
  );

  /** As recusas do servidor a um campo da fase aberta, na ordem em que se leem. */
  readonly recusasDoCampo = (campo: CampoDaRecusaDaFase): readonly RecusaOrdenada[] =>
    this.recusasDoServidor.recusasDoCampo(this.faseAberta(), campo);

  /** As recusas que a tela não liga a um controle da fase, para o topo dela. */
  readonly recusasDaConfiguracao = computed(() =>
    emOrdem(this.recusasDaFase().filter((recusa) => recusa.campo === NO_TOPO_DA_FASE)),
  );

  /** As recusas ativas a uma linha da lista de publicações: ao ato, ao papel ou à linha inteira. */
  readonly recusasDaLinha = (posicao: number): readonly RecusaOrdenada[] =>
    emOrdem(
      this.recusasDaFase().filter(
        (recusa) => !recusa.aConferir && posicaoDaPublicacao(recusa.campo) === posicao,
      ),
    );

  /** As recusas do bloco da lista de publicações: as que não cabem numa linha, para o alto da lista. */
  readonly recusasDaListaDePublicacoes = computed(() => {
    const linhas = this.faseDoRascunho()?.produtos.length ?? 0;
    return emOrdem(
      this.recusasDaFase().filter((recusa) => ficaNaListaDePublicacoes(recusa, linhas)),
    );
  });

  /** O bloco da lista de publicações tem o que mostrar: um problema local ou uma recusa do bloco. */
  readonly temMensagemNaListaDePublicacoes = computed(
    () => this.problemaLocal('produtos') !== null || this.recusasDaListaDePublicacoes().length > 0,
  );

  /** As recusas à regra de recurso, de qualquer controle dela, para o alto da seção. */
  readonly recusasDoRecurso = computed(() =>
    emOrdem(this.recusasDaFase().filter((recusa) => recusa.campo.startsWith('recurso'))),
  );

  /** O campo tem o que mostrar: um problema local ou uma recusa do servidor, ativa ou a conferir. */
  readonly temMensagem = (campo: CampoDaRecusaDaFase): boolean =>
    this.problemaLocal(campo) !== null || this.recusasDoCampo(campo).length > 0;

  /** O que marca o campo como inválido: o problema local, ou a primeira recusa que ainda vale. */
  readonly erroDoCampo = (campo: CampoDaRecusaDaFase): string | null =>
    this.problemaLocal(campo) ??
    this.recusasDoCampo(campo).find((recusa) => !recusa.aConferir)?.mensagem ??
    null;

  readonly nomeDaBanca = (tipoBancaId: string): string =>
    nomeDaBanca(this.bancasEscolhiveis(), tipoBancaId);

  /**
   * O id de um elemento desta fase, único por instância. Todo id do template passa por aqui.
   */
  readonly idDaFase = (sufixo: string): string =>
    idDaFase(this.faseDoRascunho()?.codigo ?? '', sufixo);
}
