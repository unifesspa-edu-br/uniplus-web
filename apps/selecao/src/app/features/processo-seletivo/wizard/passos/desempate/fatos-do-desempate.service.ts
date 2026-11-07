import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isApiOk, type ApiResult } from '@uniplus/shared-core/http';
import { FatoCandidatoView, FatosCandidatoApi } from '@uniplus/shared-data/configuracao';
import { acompanharLeitura } from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { fatosParaGatilho } from '../../shared/gatilho-de-exigencia';
import { tituloDoPasso } from '../../shared/titulo-do-passo';

const MENSAGEM_DE_FALHA = 'Não foi possível carregar os dados do candidato que um critério pode citar.';
const EFEITO_DA_FALHA =
  'Sem esses dados, um critério que cita um fato do candidato aparece como desconhecido e a gravação do passo é recusada.';
const EFEITO_DA_FALHA_EM_CONSULTA = 'Os critérios que citam um fato aparecem pelo código gravado.';

/**
 * O vocabulário de fatos do candidato, como o critério de desempate pode citá-lo.
 *
 * Não inclui fato de domínio dinâmico — modalidade, condição de atendimento —, e isso não é
 * omissão da tela: o comando de desempate resolve o vocabulário sem eles, de modo que citar um
 * aqui seria recusado como fato desconhecido. Oferecê-los daria ao operador uma escolha que a
 * gravação desfaz.
 */
@Injectable()
export class FatosDoDesempate {
  private readonly api = inject(FatosCandidatoApi);
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly destroyRef = inject(DestroyRef);

  private readonly catalogo = signal<readonly FatoCandidatoView[]>([]);

  /**
   * Só um catálogo lido permite dizer que um fato saiu dele: enquanto a busca não responde, ou
   * quando falha, o vazio é falta de dado, não ausência do fato.
   */
  readonly lido = signal(false);

  /**
   * A falha ao buscar o vocabulário, dita na tela em vez de engolida. Sem isto, um 500 passageiro
   * deixava o catálogo vazio para sempre: todo critério por predicado já configurado aparecia como
   * fato fora do cadastro, a validação o recusava, e não havia na tela nem a explicação nem um
   * caminho de volta que não fosse recarregar a página.
   */
  readonly falha = signal<string | null>(null);

  /** Uma busca do vocabulário corre; sobe antes da requisição e cai junto de `falha`. */
  readonly pendente = signal(false);

  /** A falha com o que ela causa no passo, que muda quando o processo está só em consulta. */
  readonly leitura = acompanharLeitura({
    falha: computed(() => {
      const falha = this.falha();
      if (falha === null) return null;
      return `${falha} ${this.store.emConsulta() ? EFEITO_DA_FALHA_EM_CONSULTA : EFEITO_DA_FALHA}`;
    }),
    pendente: this.pendente,
    recarregar: () => this.carregar(),
    destino: tituloDoPasso,
  });

  readonly escolhiveis = computed(() => fatosParaGatilho(this.catalogo()));

  readonly porCodigo = computed(
    () => new Map(this.escolhiveis().map((fato) => [fato.codigo, fato])),
  );

  /** Busca o vocabulário. A tela oferece nova tentativa. */
  carregar(): void {
    this.falha.set(null);
    this.pendente.set(true);
    this.api
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => this.concluir(resultado),
        error: () => this.concluir(null),
      });
  }

  private concluir(resultado: ApiResult<readonly FatoCandidatoView[]> | null): void {
    if (resultado !== null && isApiOk(resultado)) {
      this.catalogo.set(resultado.data);
      this.lido.set(true);
    } else {
      this.falha.set(MENSAGEM_DE_FALHA);
    }
    this.pendente.set(false);
  }
}
