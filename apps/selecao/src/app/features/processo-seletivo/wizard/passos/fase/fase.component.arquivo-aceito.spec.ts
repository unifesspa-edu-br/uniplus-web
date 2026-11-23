import { TestBed } from '@angular/core/testing';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { beforeEach, describe, expect, it } from 'vitest';
import { CatalogoDosFormatosPermitidos } from '../cronograma/catalogos/catalogo-dos-formatos-permitidos.service';
import {
  comExigenciaSemGrupo,
  exigenciaNova,
  exigenciasVazias,
} from '../../shared/exigencias/exigencias-documentais';
import { exigenciasDe } from '../../shared/exigencias/leitura-das-exigencias';
import { faseDoServidor } from '../../shared/cronograma-do-servidor.testing';
import { detalheDaApi, exigenciaDaApi } from '../../shared/exigencias/exigencias.testing';
import { regrasDeComprovacaoParaEnvio } from '../../shared/exigencias/gravacao-das-exigencias';
import { BASE, fase, ID_AVALIACAO, ID_CPF, PROCESSO_ID } from './fase.testing';
import { identificadorDaRegra, usarFase, type ContextoDaFase } from './fase-passo.testing';

const MEGABYTE = 1024 * 1024;
const FORMATOS_DO_CATALOGO = ['PDF', 'PNG'].map((codigo) => ({ codigo, rotulo: codigo }));
const FORMATOS_RECEBIDOS = [
  { formato: 'PDF', tamanhoMaximoBytesMax: 4 * MEGABYTE },
  { formato: 'PNG', tamanhoMaximoBytesMax: 5 * MEGABYTE },
];
const REQUISITOS_ENVIADOS = {
  tamanhoMaximoBytes: 5 * MEGABYTE,
  formatosPermitidos: ['PDF', 'PNG'].map((formato) => ({
    formato,
    tamanhoMaximoBytesMax: 5 * MEGABYTE,
  })),
};

describe('Formatos aceitos na fase', () => {
  let tela: ContextoDaFase;
  usarFase((contexto) => {
    tela = contexto;
  });

  beforeEach(() => {
    tela.comCronograma(fase({}));
    tela.store.patchSection(
      'documentos',
      comExigenciaSemGrupo(exigenciasVazias(), exigenciaNova(ID_CPF, 'AVALIACAO')),
    );
    tela.detectar();
    tela.documentos().alternarEdicao(identificadorDaRegra(tela.exigencias(), ID_CPF), true);
    tela.detectar();
    tela.atenderCatalogos();
    TestBed.inject(CatalogoDosFormatosPermitidos).formatos.set(FORMATOS_DO_CATALOGO);
    tela.detectar();
  });

  function campo(seletor: string): HTMLInputElement {
    const elemento = tela.nativo.querySelector<HTMLInputElement>(seletor);
    if (!elemento) throw new Error(`Campo ausente: ${seletor}`);
    return elemento;
  }

  function alterar(elemento: HTMLInputElement, valor: string): void {
    elemento.value = valor;
    elemento.dispatchEvent(new Event('input'));
    tela.detectar();
  }

  function marcar(elemento: HTMLInputElement): void {
    elemento.checked = true;
    elemento.dispatchEvent(new Event('change'));
    tela.detectar();
  }

  function escolherFormatos(): void {
    const radios = tela.nativo.querySelectorAll<HTMLInputElement>(
      'sel-arquivo-aceito input[type=radio]',
    );
    marcar(radios[1]);
    const caixas = tela.nativo.querySelectorAll<HTMLInputElement>(
      'sel-arquivo-aceito input[type=checkbox]',
    );
    marcar(caixas[0]);
    marcar(caixas[1]);
    alterar(campo('sel-arquivo-aceito input[id$="-tamanho"]'), '5');
    alterar(campo('sel-arquivo-aceito input[id$="-PDF"]'), '5');
    alterar(campo('sel-arquivo-aceito input[id$="-PNG"]'), '5');
  }

  function regrasParaEnvio() {
    return regrasDeComprovacaoParaEnvio(tela.store.draft().documentos, {
      faseIdPorCodigo: new Map([['AVALIACAO', ID_AVALIACAO]]),
      modalidadesOfertadas: [],
      etapasVivas: new Set<string>(),
      finalidadesPorFase: new Map(),
    }).regras;
  }

  it('preserva PNG ao editar os tamanhos antes de atualizar as entradas do seletor', () => {
    const radios = tela.nativo.querySelectorAll<HTMLInputElement>(
      'sel-arquivo-aceito input[type=radio]',
    );
    marcar(radios[1]);
    const caixas = tela.nativo.querySelectorAll<HTMLInputElement>(
      'sel-arquivo-aceito input[type=checkbox]',
    );
    marcar(caixas[0]);

    caixas[1].checked = true;
    caixas[1].dispatchEvent(new Event('change'));
    const tamanho = campo('sel-arquivo-aceito input[id$="-tamanho"]');
    tamanho.value = '5';
    tamanho.dispatchEvent(new Event('input'));
    const pdf = campo('sel-arquivo-aceito input[id$="-PDF"]');
    pdf.value = '5';
    pdf.dispatchEvent(new Event('input'));
    tela.detectar();

    expect(tela.exigencias().exigenciaDoDocumento(ID_CPF).formatosPermitidos).toEqual({
      tipo: 'lista',
      itens: [
        { formato: 'PDF', tamanhoMaximoBytes: 5 * MEGABYTE },
        { formato: 'PNG', tamanhoMaximoBytes: null },
      ],
    });
    expect(caixas[1].checked).toBe(true);
    expect(campo('sel-arquivo-aceito input[id$="-PNG"]')).toBeTruthy();
  });

  it('envia os formatos e os tamanhos escolhidos', async () => {
    escolherFormatos();
    const gravacao = TestBed.inject(CadastroInicial).definirDocumentosExigidos(
      PROCESSO_ID,
      regrasParaEnvio(),
    );
    const pedido = tela.controller.expectOne(
      `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/documentos-exigidos`,
    );
    expect(pedido.request.method).toBe('PUT');
    expect(pedido.request.body[0].documento.requisitos).toMatchObject(REQUISITOS_ENVIADOS);
    pedido.flush(null, { status: 204, statusText: 'No Content' });
    await gravacao;
  });

  it('descarta a lista ao aceitar qualquer formato', () => {
    escolherFormatos();
    marcar(campo('sel-arquivo-aceito input[type=radio]'));
    expect(tela.exigencias().exigenciaDoDocumento(ID_CPF).formatosPermitidos).toEqual({
      tipo: 'qualquer',
    });
  });

  function detalheComFormatos() {
    const regra = exigenciaDaApi({
      faseId: ID_AVALIACAO,
      requisitos: { formatosPermitidos: FORMATOS_RECEBIDOS, tamanhoMaximoBytes: 5 * MEGABYTE },
    });
    if (!regra.documento) throw new Error('Documento ausente');
    const documento = {
      ...regra.documento,
      tipoDocumento: { ...regra.documento.tipoDocumento, id: ID_CPF },
    };
    return {
      ...detalheDaApi([{ ...regra, documento }]),
      cronogramaFases: [faseDoServidor({ id: ID_AVALIACAO, codigo: 'AVALIACAO' })],
    };
  }

  it('mostra os formatos e os tamanhos recebidos do servidor', () => {
    tela.store.patchSection('documentos', exigenciasDe(detalheComFormatos()));
    tela.detectar();
    tela.documentos().alternarEdicao(identificadorDaRegra(tela.exigencias(), ID_CPF), true);
    tela.detectar();
    expect(campo('sel-arquivo-aceito input[id$="-PDF"]').value).toBe('4');
    expect(campo('sel-arquivo-aceito input[id$="-PNG"]').value).toBe('5');
    expect(campo('sel-arquivo-aceito input[id$="-tamanho"]').value).toBe('5');
  });
});
