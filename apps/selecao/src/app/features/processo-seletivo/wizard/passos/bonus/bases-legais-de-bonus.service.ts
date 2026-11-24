import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { coletarPaginas, isApiOk } from '@uniplus/shared-core/http';
import {
  BaseLegalBonusRegionalApi,
  BaseLegalBonusRegionalDto,
  TiposInstrumentoNormativoApi,
  type TipoInstrumentoNormativoComDescricao,
} from '@uniplus/shared-data/configuracao';
import { acompanharCatalogo } from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';

const MENSAGEM_DAS_BASES_LEGAIS = 'Não foi possível carregar as bases legais de FADA.';
const MENSAGEM_DOS_TIPOS_DE_NORMA = 'Não foi possível carregar como se lê o tipo de cada norma.';

/** O que o `<select>` de base legal exibe — o mesmo par que `RegraEscolhivel` usa. */
export interface BaseLegalEscolhivel {
  readonly id: string;
  readonly identificacao: string;
  /**
   * O que a norma é e o que ela diz. Sem os dois, escolher entre duas portarias de identificação
   * parecida é adivinhar, e é a norma que sustenta o FADA. Vêm do cadastro, e também do snapshot
   * congelado no processo, que guarda os dois.
   *
   * `tipo` é o rótulo do tipo da norma. A base do cadastro o traz da API; a que só o snapshot do
   * processo conhece guarda o código, e o rótulo vem do vocabulário de tipos — vazio até ele
   * chegar, para que o código não apareça na tela.
   */
  readonly tipo: string;
  readonly descricao: string;
  readonly municipios: readonly MunicipioBeneficiado[];
}

/** Município de uma base legal — mesma forma tanto no catálogo quanto no snapshot congelado. */
export interface MunicipioBeneficiado {
  readonly codigoIbge: string;
  readonly nome: string;
  readonly uf: string;
}

function escolhivelDoCadastro(base: BaseLegalBonusRegionalDto): BaseLegalEscolhivel {
  return {
    id: base.id,
    identificacao: base.identificacao,
    tipo: base.tipoInstrumento.rotulo,
    descricao: base.descricao,
    municipios: base.municipios,
  };
}

/** As bases legais do FADA, com o tipo de cada norma como a API o entregou. */
@Injectable()
export class BasesLegaisDeBonus {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly baseLegalApi = inject(BaseLegalBonusRegionalApi);
  private readonly tiposInstrumentoApi = inject(TiposInstrumentoNormativoApi);
  private readonly destroyRef = inject(DestroyRef);

  private readonly basesLegais = signal<readonly BaseLegalBonusRegionalDto[]>([]);
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);

  /** O foco volta ao seletor de base legal, que a leitura alimenta. */
  private readonly destinoNoSeletor = () => document.getElementById('f-bonus-base-legal');

  readonly leituraDasBasesLegais = acompanharCatalogo({
    assunto: 'bases legais',
    falha: this.erro,
    pendente: this.carregando,
    recarregar: () => this.carregar(),
    destino: this.destinoNoSeletor,
  });

  private readonly tiposDeInstrumento = signal<readonly TipoInstrumentoNormativoComDescricao[]>([]);
  readonly tiposInstrumentoCarregando = signal(false);
  readonly tiposInstrumentoErro = signal<string | null>(null);

  readonly leituraDosTiposDeInstrumento = acompanharCatalogo({
    assunto: 'tipos de norma',
    falha: computed(() => {
      const erro = this.tiposInstrumentoErro();
      return erro === null
        ? null
        : `${erro} O tipo da norma gravada no processo não aparece até o catálogo responder.`;
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
    const catalogo = this.basesLegais().map(escolhivelDoCadastro);
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
      .subscribe((resultado) => {
        if (isApiOk(resultado)) this.tiposDeInstrumento.set(resultado.data);
        else this.tiposInstrumentoErro.set(MENSAGEM_DOS_TIPOS_DE_NORMA);
        this.tiposInstrumentoCarregando.set(false);
      });
  }

  /** A norma pelo tipo e pela identificação, no seletor e na consulta. */
  rotuloDaBaseLegal(base: Pick<BaseLegalEscolhivel, 'tipo' | 'identificacao'>): string {
    return `${base.tipo} ${base.identificacao}`.trim();
  }

  private rotuloDoTipoDoSnapshot(codigo: string): string {
    return this.tiposDeInstrumento().find((tipo) => tipo.codigo === codigo)?.rotulo ?? '';
  }

  /**
   * A base legal que o processo congelou. O snapshot guarda os quatro campos, não só dois, e é
   * exatamente quando a norma saiu do cadastro que o tipo e a descrição fazem falta para reconhecê-la.
   */
  private gravadaForaDoCatalogo(selecionadoId: string): BaseLegalEscolhivel | null {
    const snapshot = this.store.remoteSnapshot()?.bonusRegional;
    if (!snapshot || snapshot.baseLegal.id !== selecionadoId) return null;

    const base = snapshot.baseLegal;
    return {
      id: base.id,
      identificacao: base.identificacao,
      tipo: this.rotuloDoTipoDoSnapshot(base.tipoInstrumento),
      descricao: base.descricao,
      municipios: base.municipios,
    };
  }
}
