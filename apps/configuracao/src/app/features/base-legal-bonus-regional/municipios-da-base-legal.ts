import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { acompanharLeitura, type LeituraAcompanhada } from '@uniplus/shared-ui/components';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, of, switchMap, timer } from 'rxjs';
import { BaseLegalBonusRegionalMunicipioDto } from '@uniplus/shared-data/configuracao';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { type CidadeResumoDto, GeoApi } from '@uniplus/shared-data/geo';

/** Espera após a última tecla antes de buscar municípios (mesmo valor do calendário de dias úteis). */
const BUSCA_ESPERA_EM_MS = 300;

/** Nome completo evita lista poluída com resultados irrelevantes. */
export const BUSCA_MINIMO_DE_CARACTERES = 3;

/** Teto do parâmetro de busca da API de municípios: acima dele a resposta é 400. */
export const BUSCA_MAXIMO_DE_CARACTERES = 256;

/** Janela de resultados da busca de município (mesmo valor do calendário de dias úteis). */
const BUSCA_LIMITE = 20;

/** O campo dos municípios como o formulário o apresenta. */
export interface CampoDeMunicipios {
  readonly selecionados: readonly BaseLegalBonusRegionalMunicipioDto[];
  readonly erro: string | null;
  readonly termo: string;
  readonly resultados: readonly CidadeResumoDto[];
  readonly buscando: boolean;
  readonly leitura: LeituraAcompanhada;
  readonly semResultado: boolean;
}

/**
 * Os municípios que a base legal beneficia: a seleção, a recusa que o campo mostra e a busca
 * de municípios na API de geografia que alimenta a escolha.
 */
@Injectable()
export class MunicipiosDaBaseLegal {
  private readonly geo = inject(GeoApi);
  private readonly notifications = inject(NotificationService);

  private readonly escolhidos = signal<readonly BaseLegalBonusRegionalMunicipioDto[]>([]);
  private readonly tocado = signal(false);
  private readonly recusa = signal<string | null>(null);
  private readonly termo = signal('');
  private readonly achados = signal<readonly CidadeResumoDto[]>([]);
  private readonly buscando = signal(false);
  private readonly buscaFalhou = signal(false);
  private readonly pedidos = new Subject<string>();

  readonly itens: Signal<readonly BaseLegalBonusRegionalMunicipioDto[]> =
    this.escolhidos.asReadonly();
  readonly vazia = computed(() => this.escolhidos().length === 0);

  private readonly erro = computed(() => {
    if (this.recusa() !== null) {
      return this.recusa();
    }
    return this.tocado() && this.vazia() ? 'Adicione ao menos um município.' : null;
  });

  /** Ao dar certo a nova tentativa, o aviso sai levando o botão: o foco volta ao campo de busca. */
  readonly leitura = acompanharLeitura({
    assunto: 'municípios',
    falha: computed(() => (this.buscaFalhou() ? 'Não foi possível buscar municípios.' : null)),
    pendente: this.buscando,
    recarregar: () => this.pedidos.next(this.termo()),
    destino: () => document.getElementById('cfg-blbr-municipios-busca'),
  });

  readonly campo = computed<CampoDeMunicipios>(() => {
    const codigos = new Set(this.escolhidos().map((municipio) => municipio.codigoIbge));
    const resultados = this.achados().filter((cidade) => !codigos.has(cidade.codigoIbge));
    const termoBuscavel = this.termo().trim().length >= BUSCA_MINIMO_DE_CARACTERES;
    const buscaFalhou = this.leitura.visivel();
    return {
      selecionados: this.escolhidos(),
      erro: this.erro(),
      termo: this.termo(),
      resultados,
      buscando: this.buscando(),
      leitura: this.leitura,
      semResultado: termoBuscavel && !this.buscando() && !buscaFalhou && resultados.length === 0,
    };
  });

  constructor() {
    this.pedidos
      .pipe(
        // O switchMap vem direto no Subject: qualquer termo novo, mesmo a limpeza, cancela a busca
        // em voo. A espera da digitação mora no observable interno, só quando há o que buscar.
        switchMap((termo) => {
          if (termo.trim().length < BUSCA_MINIMO_DE_CARACTERES) {
            return of(null);
          }
          this.buscando.set(true);
          return timer(BUSCA_ESPERA_EM_MS).pipe(
            switchMap(() => this.geo.listarCidades({ q: termo, limit: BUSCA_LIMITE })),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((resposta) => {
        this.buscando.set(false);
        this.buscaFalhou.set(resposta !== null && !resposta.ok);
        this.achados.set(resposta?.ok ? resposta.data : []);
        if (resposta !== null && !resposta.ok && resposta.problem.status >= 500) {
          this.notifications.errorFromProblem(resposta.problem);
        }
      });
  }

  /** Parte de uma seleção nova, a da base em edição ou nenhuma, sem busca nem recusa pendentes. */
  carregar(municipios: readonly BaseLegalBonusRegionalMunicipioDto[]): void {
    this.escolhidos.set(municipios);
    this.tocado.set(false);
    this.recusa.set(null);
    this.buscar('');
  }

  buscar(termo: string): void {
    this.termo.set(termo);
    this.pedidos.next(termo);
  }

  adicionar(cidade: CidadeResumoDto): void {
    if (this.escolhidos().some((municipio) => municipio.codigoIbge === cidade.codigoIbge)) {
      return;
    }
    const { codigoIbge, nome, uf } = cidade;
    this.escolhidos.update((atuais) => [...atuais, { codigoIbge, nome, uf }]);
    this.tocado.set(true);
    this.recusa.set(null);
    this.buscar('');
  }

  remover(codigoIbge: string): void {
    this.escolhidos.update((atuais) => atuais.filter((m) => m.codigoIbge !== codigoIbge));
    this.tocado.set(true);
    this.recusa.set(null);
  }

  /** Passa a mostrar a falta de município, mesmo que a pessoa nunca tenha mexido no campo. */
  exigir(): void {
    this.tocado.set(true);
  }

  recusar(mensagem: string): void {
    this.recusa.set(mensagem);
  }

  descartarRecusa(): void {
    this.recusa.set(null);
  }
}
