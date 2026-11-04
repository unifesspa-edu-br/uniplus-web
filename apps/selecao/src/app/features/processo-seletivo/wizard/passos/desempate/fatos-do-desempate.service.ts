import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isApiOk, ProblemI18nService } from '@uniplus/shared-core/http';
import { FatoCandidatoView, FatosCandidatoApi } from '@uniplus/shared-data/configuracao';

import { fatosParaGatilho } from '../../shared/gatilho-de-exigencia';

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
  private readonly problemI18n = inject(ProblemI18nService);
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

  readonly escolhiveis = computed(() => fatosParaGatilho(this.catalogo()));

  readonly porCodigo = computed(
    () => new Map(this.escolhiveis().map((fato) => [fato.codigo, fato])),
  );

  /** Busca o vocabulário. A tela oferece nova tentativa. */
  carregar(): void {
    this.falha.set(null);
    this.api
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          if (isApiOk(resultado)) {
            this.catalogo.set(resultado.data);
            this.lido.set(true);
            return;
          }

          this.falha.set(this.problemI18n.resolve(resultado.problem).title);
        },
        error: () =>
          this.falha.set(
            'Não foi possível carregar os dados do candidato que um critério pode citar. Tente novamente.',
          ),
      });
  }
}
