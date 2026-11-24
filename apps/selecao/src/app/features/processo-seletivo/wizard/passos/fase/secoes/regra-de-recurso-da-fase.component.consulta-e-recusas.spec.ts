import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { RecusaDoProblema } from '@uniplus/shared-core/http';
import { StatusProcessoCodigo, type ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { FaseDoCronograma } from '../../../processo-seletivo.models';
import type { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { RecusasDoServidorNasFases } from '../../cronograma/servicos/recusas-do-servidor-nas-fases.service';
import { montarFase } from '../fase.testing';
import { faseComRegra, PREFIXO } from './regra-de-recurso-da-fase.testing';

describe('RegraDeRecursoDaFaseComponent: consulta e recusas', () => {
  let controller: HttpTestingController;
  let nativo: HTMLElement;
  let store: ProcessoSeletivoStore;
  let detectar: () => void;
  let comCronograma: (...fases: readonly FaseDoCronograma[]) => void;

  beforeEach(async () => {
    ({ controller, nativo, comCronograma, store, detectar } = await montarFase());
  });

  afterEach(() => controller.verify());

  const textoDe = (id: string) => nativo.querySelector(`#${id}`)?.textContent ?? null;

  const emConsulta = () => {
    store.remoteSnapshot.set({
      status: StatusProcessoCodigo.PUBLICADO,
    } as unknown as ProcessoSeletivoDto);
    detectar();
  };

  describe('publicação de que o prazo corre, em consulta', () => {
    const leitura = () => (nativo.textContent ?? '').replace(/\s+/g, ' ');

    it('mostra o nome que o catálogo dá à publicação', () => {
      comCronograma(faseComRegra({ atoAncoraCodigo: 'RESULTADO_PRELIMINAR' }));
      emConsulta();

      expect(leitura()).toContain('Resultado preliminar');
    });

    it('mostra o código da publicação que o catálogo não conhece', () => {
      comCronograma(faseComRegra({ atoAncoraCodigo: 'PUBLICACAO_FORA_DO_CATALOGO' }));
      emConsulta();

      expect(leitura()).toContain('PUBLICACAO_FORA_DO_CATALOGO');
    });

    it('mostra "Não informado" quando a regra ainda não escolheu entre duas publicações preliminares', () => {
      comCronograma({
        ...faseComRegra({ atoAncoraCodigo: '' }),
        produtos: [
          { atoCodigo: 'GABARITO_PRELIMINAR', papel: 'PRELIMINAR' },
          { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' },
        ],
      });
      emConsulta();

      const publicacao = nativo.querySelector(
        'ui-valor-em-consulta[rotulo="Publicação de que o prazo corre"]',
      );
      expect(publicacao?.textContent).toContain('Não informado');
    });
  });

  describe('parâmetros do recurso, em consulta', () => {
    const leitura = () => (nativo.textContent ?? '').replace(/\s+/g, ' ');

    it('lê o prazo, o efeito suspensivo, a guarda da vaga e o prazo da 2ª instância com o nome da API', () => {
      comCronograma(faseComRegra());
      emConsulta();

      expect(leitura()).toContain('2 — Dias úteis');
      expect(leitura()).toContain('Sem efeito suspensivo');
      expect(leitura()).toContain('Guarda a vaga até o resultado definitivo');
      expect(leitura()).toContain('3 — Dias úteis');
    });

    it('não desenha os controles da configuração do recurso', () => {
      comCronograma(faseComRegra());
      emConsulta();

      expect(nativo.querySelector('sel-parametros-do-recurso')).toBeNull();
      expect(nativo.querySelector(`#${PREFIXO}-prazo-interposicao-valor`)).toBeNull();
    });
  });

  describe('recusas do servidor à regra de recurso', () => {
    const recusar = (campo: string): void => {
      const recusa: RecusaDoProblema = {
        campo,
        codigo: 'uniplus.selecao.codigo_a',
        mensagem: 'Prazo de recurso recusado.',
        pagina: null,
        ordem: 0,
        identificadores: [],
      };
      const enviadas = store.draft().cronograma.fases;
      TestBed.inject(RecusasDoServidorNasFases).registrar(1, enviadas, [recusa], () => true);
      detectar();
    };

    it('mostra no alto da seção a recusa ao prazo quando a fase não admite recurso', () => {
      comCronograma(faseComRegra(null));

      recusar('fases[0].regraRecurso.prazoValor');

      expect(textoDe('fase-AVALIACAO-recurso-recusa')).toContain('Prazo de recurso recusado.');
    });

    it('mostra a recusa ao prazo junto do campo e também no alto da seção, com o botão para ir ao campo', () => {
      comCronograma(faseComRegra());

      recusar('fases[0].regraRecurso.prazoValor');

      expect(textoDe(`${PREFIXO}-prazo-interposicao-recusas-valor`)).toContain(
        'Prazo de recurso recusado.',
      );
      expect(textoDe('fase-AVALIACAO-recurso-recusa')).toContain('Ir ao campo');
      expect(
        nativo.querySelector(`#${PREFIXO}-prazo-interposicao-valor`)?.getAttribute('aria-invalid'),
      ).toBe('true');
    });

    it.each([
      ['efeitoSuspensivo', 'efeito'],
      ['guardaDaVaga', 'guarda'],
    ])('mostra a recusa a %s junto do grupo de opções', (campo, grupo) => {
      comCronograma(faseComRegra());

      recusar(`fases[0].regraRecurso.${campo}`);

      const bloco = nativo.querySelector(`#${PREFIXO}-${grupo}-grupo`);
      expect(bloco?.textContent).toContain('Prazo de recurso recusado.');
      expect(bloco?.getAttribute('aria-invalid')).toBe('true');
    });

    it('mostra no alto da seção a recusa ao prazo da 2ª instância quando a regra não admite instância superior', () => {
      comCronograma(faseComRegra({ admiteInstanciaSuperior: false }));

      recusar('fases[0].regraRecurso.prazoSegundaInstanciaValor');

      expect(textoDe('fase-AVALIACAO-recurso-recusa')).toContain('Prazo de recurso recusado.');
    });

    it('mostra no alto da seção a recusa aos procedimentos, que não têm controle, mesmo com a fase admitindo recurso', () => {
      comCronograma(faseComRegra());

      recusar('fases[0].regraRecurso.procedimentosDeRecurso');

      expect(textoDe('fase-AVALIACAO-recurso-recusa')).toContain('Prazo de recurso recusado.');
    });

    it('liga a recusa da regra de contagem ao seletor dela como descrição', () => {
      comCronograma(faseComRegra());

      recusar('fases[0].regraRecurso.regraCodigo');

      const seletor = nativo.querySelector('#fase-AVALIACAO-regra');
      expect(seletor?.getAttribute('aria-describedby')).toContain(
        'fase-AVALIACAO-recusa-recurso-regra',
      );
    });
  });
});
