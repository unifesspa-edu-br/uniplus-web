import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, map } from 'rxjs';
import { coletarPaginas } from '@uniplus/shared-core/http';
import {
  CategoriaDocumentoDto,
  CategoriasDocumentoApi,
  TipoDocumentoDto,
  TiposDocumentoApi,
} from '@uniplus/shared-data/configuracao';

import type { DocumentoGrupo } from '../../../processo-seletivo.models';
import { documentosPorCategoria } from '../documentos-por-categoria';
import { dadosOuNulo, LeituraDeCatalogo } from './leitura-de-catalogo';

/**
 * Os tipos de documento e as categorias que os agrupam, cadastro de Configuração. A categoria é a
 * exceção à leitura por cursor: o backend não pagina aquele recurso.
 */
@Injectable()
export class CatalogoDeDocumentos {
  private readonly categoriasApi = inject(CategoriasDocumentoApi);
  private readonly tiposDocumentoApi = inject(TiposDocumentoApi);

  readonly categorias = signal<readonly CategoriaDocumentoDto[]>([]);
  readonly tiposDocumento = signal<readonly TipoDocumentoDto[]>([]);

  /**
   * Os tipos de documento cuja proteção de dados ainda não foi aprovada (UNI-REQ-0205): não aceitam
   * vínculo novo. A situação vem do próprio tipo, que a API informa a todo usuário.
   */
  readonly tiposAguardandoProtecao = computed<ReadonlySet<string>>(
    () =>
      new Set(
        this.tiposDocumento()
          .filter((tipo) => !tipo.protecaoAprovada)
          .map((tipo) => tipo.id),
      ),
  );

  /** Os tipos de documento agrupados pela categoria do cadastro, que é o que a exigência oferece. */
  readonly documentosPorCategoria = computed<readonly DocumentoGrupo[]>(() =>
    documentosPorCategoria(this.tiposDocumento(), this.categorias()),
  );

  /**
   * O tipo de documento pelo id do cadastro. É dele que a exigência tira formato aceito e
   * tamanho máximo — os mesmos valores que a tela já mostra ao lado do seletor de documento.
   */
  readonly tipoDocumentoPorId = computed<ReadonlyMap<string, TipoDocumentoDto>>(
    () => new Map(this.tiposDocumento().map((tipo) => [tipo.id, tipo])),
  );

  /** Categoria de documento por id, para nomear o recorte de competência. */
  readonly categoriaPorId = computed<ReadonlyMap<string, CategoriaDocumentoDto>>(
    () => new Map(this.categorias().map((categoria) => [categoria.id, categoria])),
  );

  private readonly leitura = new LeituraDeCatalogo({
    buscar: () =>
      forkJoin({
        categorias: this.categoriasApi.listar(),
        tiposDocumento: coletarPaginas((cursor) => this.tiposDocumentoApi.listar({ cursor })),
      }).pipe(
        map(({ categorias, tiposDocumento }) => {
          const categoriasLidas = dadosOuNulo(categorias);
          const tiposLidos = dadosOuNulo(tiposDocumento);
          return categoriasLidas && tiposLidos
            ? { categorias: categoriasLidas, tiposDocumento: tiposLidos }
            : null;
        }),
      ),
    aplicar: (dados) => {
      this.categorias.set(dados.categorias);
      this.tiposDocumento.set(dados.tiposDocumento);
    },
    mensagemDeErro: 'Não foi possível carregar os tipos de documento.',
  });

  readonly carregando = this.leitura.carregando;
  readonly erro = this.leitura.erro;

  carregar(): void {
    this.leitura.carregar();
  }

  /** Busca de novo, descartando a resposta de uma busca anterior ainda em voo. */
  recarregar(): void {
    this.leitura.recarregar();
  }
}
