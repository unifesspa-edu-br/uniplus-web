import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { apiOk } from '@uniplus/shared-core/http';
import { PesosEnemApi } from '@uniplus/shared-data/configuracao';
import {
  RegrasCatalogoApi,
  StatusProcesso,
  type ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { AcompanhamentoDoCadastroDePesos } from './acompanhamento-do-cadastro-de-pesos.service';
import { CatalogosDeClassificacaoService } from './catalogos-de-classificacao.service';

const RESOLUCAO = 'Resolução nº 805/2024/Consepe';

/** Um grupo da resolução com as áreas dadas, como o cadastro de Peso por Área o devolve. */
function linha(grupo: string, areas: readonly string[]) {
  return {
    id: grupo,
    resolucao: RESOLUCAO,
    grupoCurso: { codigo: grupo, rotulo: grupo },
    areas: areas.map((codigo) => ({ codigo, rotulo: codigo, peso: 1, corte: null })),
    baseLegal: 'Anexo I',
    criadoEm: '2026-09-01T00:00:00Z',
  };
}

/** Uma classificação gravada com cópia, diferente da que o processo tinha. */
const CLASSIFICACAO_COM_COPIA = {
  resolucaoPesoAreaEnem: RESOLUCAO,
  quadroPesoAreaEnem: [
    { grupoAreaEnem: { codigo: 'G', rotulo: 'G' }, baseLegal: 'Anexo I', areas: [] },
  ],
} as unknown as ProcessoSeletivoDto['classificacao'];

/** O cadastro tem, na resolução, as áreas dadas para o segundo grupo. */
function montar(areasDaSaude: readonly string[] = ['MATEMATICA']) {
  const listarPesos = vi.fn(() =>
    of(
      apiOk(
        [linha('TECNOLOGICA', ['MATEMATICA', 'REDACAO']), linha('SAUDE', areasDaSaude)],
        200,
        new HttpHeaders(),
      ),
    ),
  );
  TestBed.configureTestingModule({
    providers: [
      ProcessoSeletivoStore,
      CatalogosDeClassificacaoService,
      AcompanhamentoDoCadastroDePesos,
      { provide: RegrasCatalogoApi, useValue: { listar: vi.fn() } },
      {
        provide: PesosEnemApi,
        useValue: {
          listar: listarPesos,
          listarAreas: () => of(apiOk([], 200, new HttpHeaders())),
        },
      },
    ],
  });
  const store = TestBed.inject(ProcessoSeletivoStore);
  store.patchObjectSection('classificacao', {
    regraCalculoCodigo: 'FORMULA-MEDIA-PONDERADA',
    baseadoEmEnem: true,
    resolucaoPesoAreaEnem: RESOLUCAO,
  });
  return { store, acompanhamento: TestBed.inject(AcompanhamentoDoCadastroDePesos), listarPesos };
}

describe('AcompanhamentoDoCadastroDePesos', () => {
  beforeEach(() => TestBed.resetTestingModule());

  describe('acompanhar', () => {
    it('lê o cadastro uma vez para o editor, quando a classificação exige a resolução', () => {
      const { acompanhamento, listarPesos } = montar();
      acompanhamento.acompanhar();
      // Os passos que usam o quadro pedem o mesmo acompanhamento: continua um só.
      acompanhamento.acompanhar();

      TestBed.tick();

      expect(listarPesos).toHaveBeenCalledTimes(1);
      expect(acompanhamento.quadroDaResolucaoEscolhida().map((grupo) => grupo.codigo)).toEqual([
        'SAUDE',
        'TECNOLOGICA',
      ]);
    });

    it('só para consulta, com a cópia gravada, não relê o cadastro, e a leitura anterior deixa de valer', () => {
      const { store, acompanhamento, listarPesos } = montar();
      acompanhamento.acompanhar();
      TestBed.tick();
      expect(acompanhamento.leitura().lido).toBe(true);

      store.remoteSnapshot.set({
        status: StatusProcesso.publicado,
      } as unknown as ProcessoSeletivoDto);
      store.registrarClassificacaoLida({
        resolucaoPesoAreaEnem: RESOLUCAO,
        quadroPesoAreaEnem: [
          { grupoAreaEnem: { codigo: 'G', rotulo: 'G' }, baseLegal: 'Anexo I', areas: [] },
        ],
      } as unknown as ProcessoSeletivoDto['classificacao']);
      TestBed.tick();

      expect(listarPesos).toHaveBeenCalledTimes(1);
      expect(acompanhamento.leitura().lido).toBe(false);
    });

    it('uma tecla em outro campo do rascunho não refaz o quadro da resolução', () => {
      const { store, acompanhamento } = montar();
      acompanhamento.acompanhar();
      TestBed.tick();
      const antes = acompanhamento.quadroDaResolucaoEscolhida();

      store.patchObjectSection('identificacao', { nome: 'Processo de teste' });

      expect(acompanhamento.quadroDaResolucaoEscolhida()).toBe(antes);
    });
  });

  describe('leitura', () => {
    it('a resposta de uma leitura pedida antes de a classificação mudar não conta como lida', () => {
      const { store, acompanhamento, listarPesos } = montar();
      const emVoo = new Subject<ReturnType<typeof apiOk>>();
      listarPesos.mockReturnValueOnce(emVoo as never);
      acompanhamento.acompanhar();
      TestBed.tick();
      // Só para consulta, com a cópia: a classificação nova não pede outra leitura.
      store.remoteSnapshot.set({
        status: StatusProcesso.publicado,
      } as unknown as ProcessoSeletivoDto);
      store.registrarClassificacaoLida(CLASSIFICACAO_COM_COPIA);
      TestBed.tick();

      emVoo.next(apiOk([linha('SAUDE', ['MATEMATICA'])], 200, new HttpHeaders()));
      emVoo.complete();

      expect(acompanhamento.leitura().lido).toBe(false);
      expect(acompanhamento.resolucaoForaDoCadastro('Outra')).toBe(false);
    });

    it('as linhas da leitura anterior ficam como prévia enquanto a nova não chega, sem julgar', () => {
      const { store, acompanhamento, listarPesos } = montar();
      acompanhamento.acompanhar();
      TestBed.tick();
      listarPesos.mockReturnValueOnce(new Subject() as never);

      store.registrarClassificacaoLida(CLASSIFICACAO_COM_COPIA);
      TestBed.tick();

      expect(listarPesos).toHaveBeenCalledTimes(2);
      expect(acompanhamento.leitura()).toMatchObject({ lido: false, carregando: true });
      expect(acompanhamento.quadroDaResolucaoEscolhida()).toHaveLength(2);
      expect(TestBed.inject(CatalogosDeClassificacaoService).resolucoesPesoAreaEnem()).toEqual([
        RESOLUCAO,
      ]);
    });

    it('só acusa resolução fora do cadastro lido para a versão atual', () => {
      const { acompanhamento } = montar();
      expect(acompanhamento.resolucaoForaDoCadastro('Outra')).toBe(false);

      acompanhamento.acompanhar();
      TestBed.tick();

      expect(acompanhamento.resolucaoForaDoCadastro('Outra')).toBe(true);
      expect(acompanhamento.resolucaoForaDoCadastro(RESOLUCAO)).toBe(false);
    });

    it('cada leitura que dá certo tem um número maior que a anterior', () => {
      const { acompanhamento } = montar();
      acompanhamento.acompanhar();
      TestBed.tick();
      const primeira = acompanhamento.leitura().leitura;

      acompanhamento.relerCadastroAPedido(() => undefined);

      expect(acompanhamento.leitura().leitura).toBe(primeira + 1);
    });
  });

  describe('relerCadastroAPedido', () => {
    it('tira a recusa da resolução, que julgou o cadastro de antes, e avisa quem pediu', () => {
      const { store, acompanhamento } = montar();
      store.recusaDaResolucaoPesoAreaEnem.set('Recusa da resolução.');
      store.recusaPeloDesempatePorArea.set('Recusa pelo desempate.');
      const depoisDeLer = vi.fn();

      acompanhamento.relerCadastroAPedido(depoisDeLer);

      expect(store.recusaDaResolucaoPesoAreaEnem()).toBeNull();
      // A do desempate é de quem orquestra a reavaliação, não do cadastro.
      expect(store.recusaPeloDesempatePorArea()).toBe('Recusa pelo desempate.');
      expect(depoisDeLer).toHaveBeenCalledTimes(1);
    });
  });
});
