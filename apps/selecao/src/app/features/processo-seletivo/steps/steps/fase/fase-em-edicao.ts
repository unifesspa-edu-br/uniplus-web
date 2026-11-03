import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import type { FaseDoCronograma } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { descreverFase } from '../../shared/descricao-da-fase';
import { CatalogosDoCronogramaService } from '../cronograma/catalogos-do-cronograma.service';
import {
  problemasDaFase,
  type AtoDoCatalogo,
  type CampoDaFase,
  type ProblemaDaFase,
} from './configuracao-da-fase';
import { EspelhoDaFase } from './espelho-da-fase';
import { idDaFase } from './ids-da-fase';

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
 * espelha, o que a conferência e a última gravação recusaram por campo e o id de cada elemento.
 * Cada passo da fase tem a sua instância, porque o Cronograma embute um por fase.
 */
@Injectable()
export class FaseEmEdicao {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly catalogos = inject(CatalogosDoCronogramaService);

  /** Fase aberta, pelo id da fase canônica — o identificador sempre presente. */
  readonly faseAberta = signal('');

  readonly espelho = new EspelhoDaFase(this.store);

  /** O que a última gravação recusou, por campo desta fase. */
  readonly recusaPorCampo = signal<ReadonlyMap<CampoDaFase, string>>(new Map());

  /** Recusas que não pertencem a nenhum campo da fase aberta. */
  readonly recusasGerais = signal<readonly string[]>([]);

  /** As fases do certame na ordem em que ocorrem. */
  readonly fasesDoCronograma = computed<readonly FaseDoCronograma[]>(() =>
    [...this.store.draft().cronograma.fases].sort((uma, outra) => uma.ordem - outra.ordem),
  );

  /** As fases como o seletor as nomeia. */
  readonly fasesNoSeletor = computed<readonly FaseNoSeletor[]>(() => {
    const fasePorId = this.catalogos.fasePorId();
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

  /** Nome da fase aberta, para o cabeçalho e para as mensagens. */
  readonly nomeDaFaseAberta = computed(() => {
    const aberta = this.faseAberta();
    return this.fasesNoSeletor().find((fase) => fase.faseCanonicaId === aberta)?.nome ?? '';
  });

  /**
   * Bancas que o seletor oferece: as do cadastro, mais a que esta fase já exige
   * e saiu dele. A banca congelada continua fazendo parte do edital; fora da
   * lista, ela seguiria sendo enviada a cada gravação sem que o operador a
   * visse — nem pudesse tirá-la.
   */
  readonly bancasEscolhiveis = computed<readonly { id: string; nome: string }[]>(() => {
    this.espelho.versao();
    const doCadastro = this.catalogos.bancas().map((banca) => ({ id: banca.id, nome: banca.nome }));
    const conhecidas = new Set(doCadastro.map((banca) => banca.id));

    const fase = this.faseDoRascunho();
    const codigoCongelado = new Map(
      (fase?.congelados?.bancas ?? []).map((banca) => [banca.id, banca.codigo]),
    );

    const congeladas = (fase?.bancasRequeridas ?? [])
      .map((banca) => banca.tipoBancaId)
      .filter((id) => id !== '' && !conhecidas.has(id))
      .map((id) => ({
        id,
        nome: `${codigoCongelado.get(id) ?? 'Banca'} (fora do cadastro atual)`,
      }));

    return [...doCadastro, ...congeladas];
  });

  readonly atoPorCodigo = computed<ReadonlyMap<string, AtoDoCatalogo>>(
    () =>
      new Map(
        [...this.catalogos.atoPorCodigo()].map(([codigo, ato]) => [
          codigo,
          { nome: ato.nome, ehResultado: ato.ehResultado },
        ]),
      ),
  );

  /** O que impede gravar a fase aberta, com o campo de cada recusa. */
  readonly problemas = computed<readonly ProblemaDaFase[]>(() => {
    const fase = this.faseDoRascunho();
    if (fase === null) return [];
    return problemasDaFase(fase, this.fasesDoCronograma(), this.atoPorCodigo(), (id) =>
      this.nomeDaBanca(id),
    );
  });

  /**
   * O que a tela mostra sob um campo: a conferência local, e a recusa que o
   * servidor devolveu por aquele mesmo campo. A conferência vem primeiro porque
   * descreve o estado atual — a recusa descreve o que foi enviado.
   */
  readonly erroDoCampo = (campo: CampoDaFase): string | null => {
    const local = this.problemas().find((problema) => problema.campo === campo);
    return local?.mensagem ?? this.recusaPorCampo().get(campo) ?? null;
  };

  readonly nomeDaBanca = (tipoBancaId: string): string =>
    this.bancasEscolhiveis().find((banca) => banca.id === tipoBancaId)?.nome ?? tipoBancaId;

  /**
   * O id de um elemento desta fase, único por instância. Todo id do template passa por aqui.
   */
  readonly idDaFase = (sufixo: string): string =>
    idDaFase(this.faseDoRascunho()?.codigo ?? '', sufixo);

  constructor() {
    // Outro processo entra em cena: a recusa que está na tela era do anterior.
    effect(() => {
      this.store.geracao();
      untracked(() => this.limparRecusa());
    });
  }

  limparRecusa(): void {
    this.recusaPorCampo.set(new Map());
    this.recusasGerais.set([]);
  }
}
