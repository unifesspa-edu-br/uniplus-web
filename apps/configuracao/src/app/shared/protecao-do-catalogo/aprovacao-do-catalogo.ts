import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, switchMap } from 'rxjs';
import type { ProblemDetails } from '@uniplus/shared-core/http';
import {
  PERMISSAO,
  PermissoesService,
  type CodigoDePermissao,
} from '@uniplus/shared-auth/bootstrap';
import {
  ProtecaoDoCatalogoApi,
  type AprovacaoDaProtecaoDto,
  type CadastroDoCatalogo,
  type ItemDaProtecaoDoCatalogoDto,
} from '@uniplus/shared-data/configuracao';

const PERMISSAO_DE_MANTER: Readonly<Record<CadastroDoCatalogo, CodigoDePermissao>> = {
  TIPO_DOCUMENTO: PERMISSAO.configuracao.tiposDocumentoManter,
  FATO: PERMISSAO.configuracao.fatosCandidatoManter,
};

/** Quem pode ler a lista de pendências: a API responde 403 aos demais, e o 403 leva a tela ao acesso negado. */
const PERMISSOES_DE_LEITURA: readonly CodigoDePermissao[] = [
  PERMISSAO.configuracao.protecaoDoCatalogoAprovar,
  PERMISSAO.configuracao.tiposDocumentoManter,
  PERMISSAO.configuracao.fatosCandidatoManter,
];

const APROVADA: AprovacaoDaProtecaoDto = {
  situacao: 'APROVADA',
  ciclo: 0,
  solicitadaEm: null,
  decididaEm: null,
  classificacaoRecomendada: null,
  justificativa: null,
  aceitaEm: null,
  manifestadaEm: null,
  manifestacaoDesfavoravel: false,
  manifestacoesNoCiclo: 0,
};

/**
 * O que ainda aguarda a proteção de dados no catálogo, para a tela de um cadastro mostrar a
 * situação de cada item e oferecer o envio da solicitação. A API só lista o que não está
 * aprovado, então o item que não aparece na lista está aprovado — desde que a lista tenha chegado.
 *
 * Provido pela página, e não pela raiz: a situação é lida de novo a cada abertura da tela.
 */
@Injectable()
export class AprovacaoDoCatalogo {
  private readonly api = inject(ProtecaoDoCatalogoApi);
  private readonly permissoes = inject(PermissoesService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _itens = signal<readonly ItemDaProtecaoDoCatalogoDto[]>([]);
  private readonly _carregado = signal(false);
  private readonly _comErro = signal(false);
  private readonly _pendente = signal(false);
  private readonly _ultimoProblema = signal<ProblemDetails | null>(null);

  /** Verdadeiro quando a última leitura da lista falhou: a situação dos itens não é conhecida. */
  readonly comErro = this._comErro.asReadonly();

  /** Verdadeiro enquanto a lista é lida. */
  readonly pendente = this._pendente.asReadonly();

  /** A recusa da API na última leitura; `null` quando deu certo ou falhou sem resposta da API. */
  readonly ultimoProblema = this._ultimoProblema.asReadonly();

  /** Os itens pendentes que a solicitação leva: só dos cadastros que a pessoa pode manter. */
  readonly solicitaveis = computed(() =>
    this._itens().filter(
      (item) =>
        item.aprovacao.situacao === 'PENDENTE' &&
        this.permissoes.tem(PERMISSAO_DE_MANTER[item.tipo as CadastroDoCatalogo]),
    ),
  );

  private readonly porId = computed(
    () => new Map(this._itens().map((item) => [item.id, item.aprovacao] as const)),
  );

  /** Cada leitura cancela a anterior: a resposta velha que chega depois não sobrescreve a nova. */
  private readonly leituras = new Subject<void>();

  constructor() {
    this.leituras
      .pipe(
        switchMap(() => this.api.listar()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resultado) => {
        this._pendente.set(false);
        if (resultado.ok) this.aplicar(resultado.data);
        else this.falhar(resultado.problem);
      });
  }

  private aplicar(itens: readonly ItemDaProtecaoDoCatalogoDto[]): void {
    this._ultimoProblema.set(null);
    this._itens.set(itens);
    this._carregado.set(true);
  }

  /** A releitura falhou: o que sobrou na memória é velho, e o item que não aparece nele não é aprovado. */
  private falhar(problema: ProblemDetails): void {
    this._carregado.set(false);
    this._itens.set([]);
    this._comErro.set(true);
    this._ultimoProblema.set(problema);
  }

  /** Lê a lista só de quem pode vê-la: quem apenas consulta o cadastro não a pede. Devolve se leu. */
  carregar(): boolean {
    if (!PERMISSOES_DE_LEITURA.some((codigo) => this.permissoes.tem(codigo))) return false;
    this._comErro.set(false);
    this._pendente.set(true);
    this.leituras.next();
    return true;
  }

  /** Onde o item está no circuito; `null` enquanto a lista não chegou ou quando a leitura falhou. */
  aprovacaoDe(id: string): AprovacaoDaProtecaoDto | null {
    if (!this._carregado()) return null;
    return this.porId().get(id) ?? APROVADA;
  }
}
