import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture } from '@angular/core/testing';
import {
  ConsequenciaDoDescumprimentoCodigo,
  type ModeloFormularioView,
} from '@uniplus/shared-data/configuracao';
import { expect } from 'vitest';
import { ModeloFormularioEdicaoPage } from './modelo-formulario-edicao.page';
import {
  MODELO,
  modelo,
  propagarAlteracoes,
  salvar,
} from './modelo-formulario-edicao.page.testing';

type Conjunto = ModeloFormularioView['conteudo']['conjuntoDeDocumentos'];
export type DocumentoDoModelo = Conjunto['documentosExigidos'][number];
export type GrupoDoModelo = Conjunto['gruposDeDocumentos'][number];

export const PREFIXO = 'cfg-modelo-docs';
export const idDoDocumento = (indice: number, parte: string): string =>
  `${PREFIXO}-doc-${indice}-${parte}`;

export const LAUDO: DocumentoDoModelo = modelo.conteudo.conjuntoDeDocumentos.documentosExigidos[0];

export function modeloComDocumentos(
  documentosExigidos: readonly DocumentoDoModelo[],
  gruposDeDocumentos: readonly GrupoDoModelo[] = [],
): ModeloFormularioView {
  return {
    ...modelo,
    conteudo: {
      ...modelo.conteudo,
      conjuntoDeDocumentos: { documentosExigidos, gruposDeDocumentos },
    },
  };
}

export function laudoComIndeferimento(
  indeferimento: Partial<DocumentoDoModelo['indeferimento']>,
): DocumentoDoModelo {
  return { ...LAUDO, indeferimento: { ...LAUDO.indeferimento, ...indeferimento } };
}

export const consequenciaGravada = (
  consequenciaDoDescumprimento: null | ConsequenciaDoDescumprimentoCodigo,
): Partial<DocumentoDoModelo['indeferimento']> => ({ consequenciaDoDescumprimento });

type DocumentoEnviado = Omit<DocumentoDoModelo, 'indeferimento' | 'requisitos'> &
  Pick<DocumentoDoModelo, 'indeferimento'>;

// A releitura devolve o que foi gravado; o que a tela não edita (normas e requisitos) vem do molde.
function documentoLido(enviado: DocumentoEnviado, molde: DocumentoDoModelo): DocumentoDoModelo {
  const { basesLegais } = molde.indeferimento;
  const indeferimento = { ...enviado.indeferimento, basesLegais };
  return { ...molde, ...enviado, indeferimento, requisitos: molde.requisitos };
}

function releituraDe(enviado: Conjunto): ModeloFormularioView {
  const base = modelo.conteudo.conjuntoDeDocumentos;
  const grupoLido = (grupo: GrupoDoModelo): GrupoDoModelo => ({
    ...grupo,
    indeferimento: grupo.indeferimento && { ...grupo.indeferimento, basesLegais: [] },
    documentos: grupo.documentos.map((doc) => documentoLido(doc, LAUDO)),
  });
  return modeloComDocumentos(
    enviado.documentosExigidos.map((doc, i) =>
      documentoLido(doc, base.documentosExigidos[i] ?? LAUDO),
    ),
    enviado.gruposDeDocumentos.map(grupoLido),
  );
}

export class AcoesDaTela {
  constructor(
    private readonly fixture: ComponentFixture<ModeloFormularioEdicaoPage>,
    private readonly controller: HttpTestingController,
  ) {}

  propagar(): Promise<HTMLElement> {
    return propagarAlteracoes(this.fixture);
  }

  campo<T extends HTMLElement>(id: string): T {
    return (this.fixture.nativeElement as HTMLElement).querySelector<T>(`#${id}`) as T;
  }

  async escolher(id: string, valor: string): Promise<void> {
    const select = this.campo<HTMLSelectElement>(id);
    select.value = valor;
    select.dispatchEvent(new Event('change'));
    await this.propagar();
  }

  async marcar(id: string, marcado: boolean): Promise<void> {
    const caixa = this.campo<HTMLInputElement>(id);
    caixa.checked = marcado;
    caixa.dispatchEvent(new Event('change'));
    await this.propagar();
  }

  async clicar(id: string): Promise<void> {
    this.campo<HTMLButtonElement>(id).click();
    await this.propagar();
  }

  async gravar(): Promise<Conjunto> {
    salvar(this.fixture.nativeElement as HTMLElement);
    const req = this.controller.expectOne((r) => r.method === 'PUT' && r.url === MODELO);
    const enviado = req.request.body.conteudo.conjuntoDeDocumentos as Conjunto;
    req.flush(null, { status: 204, statusText: 'No Content' });
    await this.propagar();
    this.controller.expectOne(MODELO).flush(releituraDe(enviado));
    await this.propagar();
    return enviado;
  }

  opcoesDe(id: string): { codigo: string; rotulo: string | undefined }[] {
    return Array.from(this.campo<HTMLSelectElement>(id).options).map((opcao) => ({
      codigo: opcao.value,
      rotulo: opcao.textContent?.trim(),
    }));
  }

  consequenciaMostrada(indice: number): string {
    const select = this.campo<HTMLSelectElement>(idDoDocumento(indice, 'consequencia'));
    return `${select.value}|${select.selectedOptions[0]?.textContent?.trim()}`;
  }
}

export function esperarIndeferimento(
  documento: unknown,
  esperado: Partial<DocumentoDoModelo['indeferimento']>,
): void {
  expect((documento as DocumentoDoModelo).indeferimento).toMatchObject(esperado);
}
