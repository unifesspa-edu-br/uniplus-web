import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { coletarPaginas, isApiOk } from '@uniplus/shared-core/http';
import {
  CursoDto,
  CursosApi,
  ModalidadeDto,
  ModalidadesApi,
  OfertaCursoDto,
  OfertasCursoApi,
  ReferenciaReservaDemograficaDto,
  ReservaDemograficaApi,
} from '@uniplus/shared-data/configuracao';
import { RegraCatalogoDto, RegrasCatalogoApi } from '@uniplus/shared-data/selecao';

import { ModalidadeDoCatalogo } from './distribuicao-de-vagas';

/** Tipos do `rol_de_regras` que esta tela referencia. */
const TIPO_REGRA_DISTRIBUICAO = 'regra_distribuicao_vagas';
const TIPO_REGRA_AJUSTE = 'regra_ajuste_distribuicao_vagas';

/**
 * Catálogos que a distribuição de vagas referencia, todos vindos de fora do
 * módulo Seleção: ofertas, modalidades e referência demográfica são cadastro de
 * Configuração, e as regras são o `rol_de_regras` versionado.
 *
 * Carrega os quatro por cursor até o fim, porque uma escolha só sabe o que
 * oferecer quando conhece todas as opções — diferente de uma listagem, em que
 * a página é o que o operador navega.
 */
@Injectable()
export class CatalogosDeDistribuicaoService {
  private readonly ofertasApi = inject(OfertasCursoApi);
  private readonly cursosApi = inject(CursosApi);
  private readonly modalidadesApi = inject(ModalidadesApi);
  private readonly reservaApi = inject(ReservaDemograficaApi);
  private readonly regrasApi = inject(RegrasCatalogoApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly ofertas = signal<readonly OfertaCursoDto[]>([]);
  readonly cursos = signal<readonly CursoDto[]>([]);
  readonly modalidades = signal<readonly ModalidadeDto[]>([]);
  readonly referencias = signal<readonly ReferenciaReservaDemograficaDto[]>([]);
  readonly regrasDistribuicao = signal<readonly RegraCatalogoDto[]>([]);
  readonly regrasAjuste = signal<readonly RegraCatalogoDto[]>([]);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);

  /** Modalidade por id, na forma que a validação consome. */
  readonly modalidadePorId = computed<ReadonlyMap<string, ModalidadeDoCatalogo>>(
    () =>
      new Map(
        this.modalidades().map((modalidade) => [
          modalidade.id,
          {
            id: modalidade.id,
            codigo: modalidade.codigo,
            composicaoVagas: modalidade.composicaoVagas,
            composicaoOrigemCodigo: modalidade.composicaoOrigem,
            regraRemanejamento: modalidade.regraRemanejamento,
            remanejamentoDestino: modalidade.remanejamentoDestino,
            remanejamentoPar: modalidade.remanejamentoPar,
            remanejamentoFallback: modalidade.remanejamentoFallback,
          },
        ]),
      ),
  );

  readonly ofertaPorId = computed<ReadonlyMap<string, OfertaCursoDto>>(
    () => new Map(this.ofertas().map((oferta) => [oferta.id, oferta])),
  );

  /**
   * Como a oferta se apresenta a quem escolhe.
   *
   * `OfertaCursoDto` traz o `cursoId`, não o nome, e sem ele três ofertas do
   * mesmo instituto ficam com o mesmo rótulo — o operador não tem como saber
   * qual está escolhendo.
   */
  /**
   * Teto de vagas que o ato de autorização concede a cada oferta. Ausente
   * quando a oferta não registra o número — ali não há teto a aplicar.
   */
  readonly vagasAutorizadasPorOferta = computed<ReadonlyMap<string, number | null>>(
    () =>
      new Map(
        this.ofertas().map((oferta) => [oferta.id, comoInteiro(oferta.vagasAnuaisAutorizadas)]),
      ),
  );

  /** Curso e unidade: o que nomeia a oferta, antes do que a distingue. */
  readonly nomeDaOferta = computed<ReadonlyMap<string, string>>(() => {
    const nomes = new Map(this.cursos().map((curso) => [curso.id, curso.nome]));

    return new Map(
      this.ofertas().map((oferta) => [
        oferta.id,
        `${nomes.get(oferta.cursoId) ?? 'Curso não identificado'} · ${oferta.unidadeOfertante.sigla}`,
      ]),
    );
  });

  /**
   * O que distingue uma oferta de outra do mesmo curso: regime e turnos, mais
   * programa e formato quando não são os usuais. Omite o comum para não
   * repetir "REGULAR · PRESENCIAL" em toda a lista.
   */
  readonly detalheDaOferta = computed<ReadonlyMap<string, string>>(
    () =>
      new Map(
        this.ofertas().map((oferta) => [
          oferta.id,
          [
            oferta.regimeDeTurno,
            oferta.turnos.join(' e '),
            ...(oferta.programaDeOferta === 'REGULAR' ? [] : [oferta.programaDeOferta]),
            ...(oferta.formatoPedagogico === 'PRESENCIAL' ? [] : [oferta.formatoPedagogico]),
          ]
            .filter((parte) => parte !== '' && parte !== null)
            .join(' · '),
        ]),
      ),
  );

  /** Nome e detalhe juntos, para mensagens e rótulos acessíveis. */
  readonly rotuloDaOferta = computed<ReadonlyMap<string, string>>(() => {
    const nomes = this.nomeDaOferta();
    const detalhes = this.detalheDaOferta();

    return new Map(
      this.ofertas().map((oferta) => [
        oferta.id,
        [nomes.get(oferta.id), detalhes.get(oferta.id)]
          .filter((parte) => parte !== undefined && parte !== '')
          .join(' · '),
      ]),
    );
  });

  carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);

    forkJoin({
      ofertas: coletarPaginas((cursor) => this.ofertasApi.listar({ cursor })),
      cursos: coletarPaginas((cursor) => this.cursosApi.listar({ cursor })),
      modalidades: coletarPaginas((cursor) => this.modalidadesApi.listar({ cursor })),
      referencias: coletarPaginas((cursor) => this.reservaApi.listar({ cursor })),
      distribuicao: coletarPaginas((cursor) =>
        this.regrasApi.listar({ tipo: TIPO_REGRA_DISTRIBUICAO, cursor }),
      ),
      ajuste: coletarPaginas((cursor) =>
        this.regrasApi.listar({ tipo: TIPO_REGRA_AJUSTE, cursor }),
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultados) => {
          const { ofertas, cursos, modalidades, referencias, distribuicao, ajuste } = resultados;

          // Um catálogo faltando deixa a tela oferecendo menos do que existe, e
          // o operador não teria como saber. Ou vêm todos, ou nenhum.
          if (
            !isApiOk(ofertas) ||
            !isApiOk(cursos) ||
            !isApiOk(modalidades) ||
            !isApiOk(referencias) ||
            !isApiOk(distribuicao) ||
            !isApiOk(ajuste)
          ) {
            this.anunciarErro();
            return;
          }

          this.ofertas.set(ofertas.data);
          this.cursos.set(cursos.data);
          this.modalidades.set(modalidades.data);
          this.referencias.set(referencias.data);
          this.regrasDistribuicao.set(distribuicao.data);
          this.regrasAjuste.set(ajuste.data);
          this.carregando.set(false);
        },
        error: () => this.anunciarErro(),
      });
  }

  private anunciarErro(): void {
    this.erro.set(
      'Não foi possível carregar os catálogos de ofertas, modalidades e regras. Tente novamente.',
    );
    this.carregando.set(false);
  }
}

/** O contrato admite o inteiro como texto; fora disso, não há teto conhecido. */
function comoInteiro(valor: number | string | null | undefined): number | null {
  if (typeof valor === 'number') return Number.isInteger(valor) ? valor : null;
  if (typeof valor === 'string' && /^\d+$/.test(valor.trim())) return Number(valor.trim());
  return null;
}
