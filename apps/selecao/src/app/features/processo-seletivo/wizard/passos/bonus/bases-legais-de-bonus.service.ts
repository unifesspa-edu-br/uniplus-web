import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { coletarPaginas, isApiOk, ProblemI18nService } from '@uniplus/shared-core/http';
import {
  BaseLegalBonusRegionalApi,
  BaseLegalBonusRegionalDto,
  TiposInstrumentoNormativoApi,
} from '@uniplus/shared-data/configuracao';
import { acompanharCatalogo } from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';

const MENSAGEM_DAS_BASES_LEGAIS = 'Não foi possível carregar as bases legais de bônus regional.';

/** O que o `<select>` de base legal exibe — o mesmo par que `RegraEscolhivel` usa. */
export interface BaseLegalEscolhivel {
  readonly id: string;
  readonly identificacao: string;
  /**
   * O que a norma é e o que ela diz. Sem os dois, escolher entre duas portarias de identificação
   * parecida é adivinhar, e é a norma que sustenta o bônus. Vêm do cadastro, e também do snapshot
   * congelado no processo, que guarda os dois.
   *
   * `tipoInstrumento` é o código canônico do vocabulário fechado, não o rótulo: quem traduz é o
   * próprio vocabulário, servido pela API.
   */
  readonly tipoInstrumento: string;
  readonly descricao: string;
  readonly municipios: readonly MunicipioBeneficiado[];
}

/** Município de uma base legal — mesma forma tanto no catálogo quanto no snapshot congelado. */
export interface MunicipioBeneficiado {
  readonly codigoIbge: string;
  readonly nome: string;
  readonly uf: string;
}

/** As bases legais do bônus regional e o vocabulário que dá nome ao tipo de cada norma. */
@Injectable()
export class BasesLegaisDeBonus {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly baseLegalApi = inject(BaseLegalBonusRegionalApi);
  private readonly tiposInstrumentoApi = inject(TiposInstrumentoNormativoApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly basesLegais = signal<readonly BaseLegalBonusRegionalDto[]>([]);
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);

  /** O foco volta ao seletor de base legal, que as duas leituras alimentam. */
  private readonly destinoNoSeletor = () => document.getElementById('f-bonus-base-legal');

  readonly leituraDasBasesLegais = acompanharCatalogo({
    assunto: 'bases legais',
    falha: this.erro,
    pendente: this.carregando,
    recarregar: () => this.carregar(),
    destino: this.destinoNoSeletor,
  });

  /**
   * Os rótulos dos tipos de instrumento normativo, indexados pelo código. O código é UPPER_SNAKE,
   * e exibi-lo cru numa tela em português mostra a grafia da máquina a quem monta o edital. A lista
   * não se escreve aqui: é vocabulário fechado derivado de enum no servidor, e é ele quem publica o rótulo.
   */
  private readonly rotuloDoTipoInstrumento = signal<ReadonlyMap<string, string>>(new Map());

  /**
   * Se o vocabulário não pôde ser carregado. Engolir a falha deixaria o código da máquina
   * permanente na tela, sem nada dizendo que algo falhou nem como tentar de novo.
   */
  readonly tiposInstrumentoErro = signal<string | null>(null);

  /** Se o vocabulário está sendo buscado — trava o botão e evita duas chamadas concorrentes. */
  readonly tiposInstrumentoCarregando = signal(false);

  readonly leituraDosTiposDeInstrumento = acompanharCatalogo({
    assunto: 'tipos de norma',
    falha: computed(() => {
      const erro = this.tiposInstrumentoErro();
      return erro === null ? null : `${erro} O tipo de cada norma aparece pelo código até o catálogo responder.`;
    }),
    pendente: this.tiposInstrumentoCarregando,
    recarregar: () => this.carregarTiposDeInstrumento(),
    destino: this.destinoNoSeletor,
  });

  /**
   * O catálogo ativo mais, quando faltar, a base legal que o processo já tem gravada: reabrir um
   * processo cuja base legal foi desativada depois não pode mostrar o `<select>` em branco. O
   * snapshot do próprio processo carrega `identificacao` mesmo quando a base já saiu do catálogo.
   */
  readonly escolhiveis = computed<readonly BaseLegalEscolhivel[]>(() => {
    const catalogo = this.basesLegais().map((base) => ({
      id: base.id,
      identificacao: base.identificacao,
      tipoInstrumento: base.tipoInstrumento,
      descricao: base.descricao,
      municipios: base.municipios,
    }));
    const selecionadoId = this.store.draft().bonus.baseLegalBonusRegionalId;
    if (selecionadoId === '' || catalogo.some((base) => base.id === selecionadoId)) {
      return catalogo;
    }

    const gravada = this.gravadaForaDoCatalogo(selecionadoId);
    return gravada === null ? catalogo : [gravada, ...catalogo];
  });

  private readonly selecionada = computed(() =>
    this.escolhiveis().find(
      (base) => base.id === this.store.draft().bonus.baseLegalBonusRegionalId,
    ),
  );

  /** O que a norma escolhida diz. */
  readonly descricaoDaSelecionada = computed<string>(() => this.selecionada()?.descricao ?? '');

  /**
   * Municípios da base legal escolhida, ordenados por nome: o mesmo catálogo ou snapshot de
   * `escolhiveis`, então uma base fora do catálogo continua mostrando os municípios do
   * congelamento. Exibida junto ao select para o gestor confirmar a cobertura sem abrir o cadastro.
   */
  readonly municipiosDaSelecionada = computed<readonly MunicipioBeneficiado[]>(() =>
    [...(this.selecionada()?.municipios ?? [])].sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR'),
    ),
  );

  constructor() {
    this.carregar();
    this.carregarTiposDeInstrumento();
  }

  carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);

    coletarPaginas((cursor) => this.baseLegalApi.listar({ cursor, direction: 'next' }))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        if (isApiOk(resultado)) this.basesLegais.set(resultado.data);
        else this.erro.set(MENSAGEM_DAS_BASES_LEGAIS);
        this.carregando.set(false);
      });
  }

  carregarTiposDeInstrumento(): void {
    if (this.tiposInstrumentoCarregando()) return;

    this.tiposInstrumentoErro.set(null);
    this.tiposInstrumentoCarregando.set(true);

    this.tiposInstrumentoApi
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          if (isApiOk(resultado)) {
            this.rotuloDoTipoInstrumento.set(
              new Map(resultado.data.map((tipo) => [tipo.codigo, tipo.nome])),
            );
          } else {
            this.tiposInstrumentoErro.set(this.problemI18n.resolve(resultado.problem).title);
          }
          this.tiposInstrumentoCarregando.set(false);
        },
        error: () => {
          this.tiposInstrumentoErro.set(
            'Não foi possível carregar como se lê o tipo de cada norma.',
          );
          this.tiposInstrumentoCarregando.set(false);
        },
      });
  }

  /** O tipo da norma como se lê, ou o código quando o vocabulário ainda não chegou. */
  rotuloDoTipo(codigo: string): string {
    if (codigo === '') return '';
    return this.rotuloDoTipoInstrumento().get(codigo) ?? codigo;
  }

  /** A norma pelo tipo e pela identificação, no seletor e na consulta. */
  rotuloDaBaseLegal(base: Pick<BaseLegalEscolhivel, 'tipoInstrumento' | 'identificacao'>): string {
    return `${this.rotuloDoTipo(base.tipoInstrumento)} ${base.identificacao}`.trim();
  }

  /**
   * A base legal que o processo congelou. O snapshot guarda os quatro campos, não só dois, e é
   * exatamente quando a norma saiu do cadastro que o tipo e a descrição fazem falta para reconhecê-la.
   */
  private gravadaForaDoCatalogo(selecionadoId: string): BaseLegalEscolhivel | null {
    const snapshot = this.store.remoteSnapshot()?.bonusRegional;
    if (!snapshot || snapshot.baseLegalBonusRegionalId !== selecionadoId) return null;

    return {
      id: snapshot.baseLegalBonusRegionalId,
      identificacao: snapshot.identificacao,
      tipoInstrumento: snapshot.tipoInstrumento,
      descricao: snapshot.descricao,
      municipios: snapshot.municipios,
    };
  }
}
