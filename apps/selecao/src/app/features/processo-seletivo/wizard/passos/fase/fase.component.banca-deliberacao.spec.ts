import {
  ModoDeDeliberacao,
  PapelDaBancaCodigo,
  StatusProcesso,
} from '@uniplus/shared-data/selecao';
import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { comRotulos } from '../../shared/deliberacao/vocabularios-da-regra.testing';
import { COLEGIADA, comRegra } from '../../shared/deliberacao/regra-de-deliberacao.testing';
import { usarFase, type ContextoDaFase } from './fase-passo.testing';
import { fase, ID_BANCA_HETERO } from './fase.testing';

const ID_DA_REGRA = 'fase-AVALIACAO-regra-banca-teste';
const SEM_RECORTE = { tipoBancaId: ID_BANCA_HETERO, categoriasDocumentoIds: [] };

describe('FasePassoComponent', () => {
  let componente: ContextoDaFase['componente'];
  let store: ContextoDaFase['store'];
  let detectar: ContextoDaFase['detectar'];
  let nativo: ContextoDaFase['nativo'];
  let comCronograma: ContextoDaFase['comCronograma'];

  usarFase((tela) => {
    ({ componente, store, detectar, nativo, comCronograma } = tela);
  });

  const campo = <T extends HTMLElement>(sufixo: string) =>
    nativo.querySelector<T>(`#${ID_DA_REGRA}-${sufixo}`);
  const escolher = (sufixo: string, valor: string) => {
    const select = campo<HTMLSelectElement>(sufixo);
    if (select === null) throw new Error(`Seletor ${sufixo} não está na tela.`);
    select.value = valor;
    select.dispatchEvent(new Event('change'));
    detectar();
  };
  const digitar = (sufixo: string, valor: string) => {
    const input = campo<HTMLInputElement>(sufixo);
    if (input === null) throw new Error(`Campo ${sufixo} não está na tela.`);
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    detectar();
  };
  const regraDoRascunho = () =>
    store.draft().cronograma.fases[0].bancasRequeridas[0]?.regraDeDeliberacao;

  describe('regra de deliberação da banca requerida', () => {
    it('declara a banca sem regra, com o seletor de modo e nada mais', () => {
      comCronograma(
        fase({
          bancasRequeridas: [
            {
              id: null,
              identificadorLocal: 'banca-teste',
              copiaDoTipo: null,
              ...SEM_RECORTE,
              regraDeDeliberacao: null,
            },
          ],
        }),
      );

      expect(campo<HTMLSelectElement>('modo')?.value).toBe('');
      expect(campo('integrantes')).toBeNull();
    });

    it('cria a regra ao escolher o modo e a completa campo a campo', () => {
      comCronograma(
        fase({
          bancasRequeridas: [
            {
              id: null,
              identificadorLocal: 'banca-teste',
              copiaDoTipo: null,
              ...SEM_RECORTE,
              regraDeDeliberacao: null,
            },
          ],
        }),
      );

      escolher('modo', ModoDeDeliberacao.colegiadaComVotacao);
      digitar('integrantes', '5');
      escolher('encerramento', 'presidenciaNoQuorum');
      digitar('quorum', '3');
      escolher('criterio', 'maioriaSimples');
      escolher('desempate', 'votoDaPresidencia');
      digitar('suplentes', '2');

      expect(regraDoRascunho()).toEqual(comRotulos(COLEGIADA));
      expect(componente.erroDoCampo('bancasRequeridas.0.quorum')).toBeNull();
    });

    it('cobra sob o campo o que a regra ainda não tem, antes de gravar', () => {
      comCronograma(
        fase({
          bancasRequeridas: [
            {
              id: null,
              identificadorLocal: 'banca-teste',
              copiaDoTipo: null,
              ...SEM_RECORTE,
              regraDeDeliberacao: comRegra({ criterio: '' }),
            },
          ],
        }),
      );

      expect(campo('criterio-erro')?.textContent).toContain('Escolha o critério');
      expect(campo('criterio')?.getAttribute('aria-invalid')).toBe('true');
      expect(campo('quorum-erro')).toBeNull();
    });

    it('volta a banca a sem regra ao escolher a opção de não declará-la', () => {
      comCronograma(
        fase({
          bancasRequeridas: [
            {
              id: null,
              identificadorLocal: 'banca-teste',
              copiaDoTipo: null,
              ...SEM_RECORTE,
              regraDeDeliberacao: COLEGIADA,
            },
          ],
        }),
      );

      escolher('modo', '');

      expect(regraDoRascunho()).toBeNull();
      expect(campo('integrantes')).toBeNull();
    });

    it('preserva a votação ao declarar o ato individual', () => {
      comCronograma(
        fase({
          bancasRequeridas: [
            {
              id: null,
              identificadorLocal: 'banca-teste',
              copiaDoTipo: null,
              ...SEM_RECORTE,
              regraDeDeliberacao: COLEGIADA,
            },
          ],
        }),
      );

      escolher('modo', ModoDeDeliberacao.atoIndividual);
      digitar('integrantes', '1');
      digitar('suplentes', '0');

      expect(regraDoRascunho()).toEqual({
        ...COLEGIADA,
        modo: ModoDeDeliberacao.atoIndividual,
        integrantes: '1',
        suplentes: '0',
        desempate: '',
        rotulos: { modo: { codigo: 'atoIndividual', rotulo: 'Ato individual' } },
      });
      expect(campo('criterio')).not.toBeNull();
    });

    it('não aceita edição enquanto uma gravação corre', () => {
      comCronograma(
        fase({
          bancasRequeridas: [
            {
              id: null,
              identificadorLocal: 'banca-teste',
              copiaDoTipo: null,
              ...SEM_RECORTE,
              regraDeDeliberacao: COLEGIADA,
            },
          ],
        }),
      );

      store.salvando.set(true);
      detectar();

      expect(campo<HTMLSelectElement>('modo')?.disabled).toBe(true);
      expect(campo<HTMLInputElement>('integrantes')?.disabled).toBe(true);
    });

    it('lê a regra em consulta como uma linha, sem campo nem seletor', () => {
      comCronograma(
        fase({
          bancasRequeridas: [
            {
              id: null,
              identificadorLocal: 'banca-teste',
              copiaDoTipo: null,
              ...SEM_RECORTE,
              regraDeDeliberacao: comRotulos(COLEGIADA),
            },
          ],
        }),
      );
      store.remoteSnapshot.set({
        status: StatusProcesso.publicado,
      } as unknown as ProcessoSeletivoDto);
      detectar();

      const leitura = (nativo.textContent ?? '').replace(/\s+/g, ' ');
      expect(leitura).toContain(
        '5 titulares, 2 suplentes; Colegiada, com votação; quórum 3; Maioria simples',
      );
      expect(campo('modo')).toBeNull();
    });

    it('lê em consulta a banca sem regra declarada como tal', () => {
      comCronograma(
        fase({
          bancasRequeridas: [
            {
              id: null,
              identificadorLocal: 'banca-teste',
              copiaDoTipo: null,
              ...SEM_RECORTE,
              regraDeDeliberacao: null,
            },
          ],
        }),
      );
      store.remoteSnapshot.set({
        status: StatusProcesso.publicado,
      } as unknown as ProcessoSeletivoDto);
      detectar();

      expect(nativo.textContent).toContain('Sem regra de deliberação declarada');
    });

    it('mostra a cópia e a posição de cada banca em consulta', () => {
      const copiaDoTipo = {
        rotulo: 'Tipo preservado',
        papel: { codigo: PapelDaBancaCodigo.AVALIA_O_MERITO, rotulo: 'Avalia' },
        exigeDuasOuMaisBancas: false,
        encerraRecursoNaPrimeiraInstancia: false,
      };
      const banca = {
        id: 'gravada',
        identificadorLocal: 'banca-gravada',
        copiaDoTipo,
        ...SEM_RECORTE,
        regraDeDeliberacao: null,
      };
      comCronograma(
        fase({
          bancasRequeridas: [banca, { ...banca, id: 'outra', identificadorLocal: 'banca-outra' }],
        }),
      );
      store.remoteSnapshot.set({
        status: StatusProcesso.publicado,
      } as unknown as ProcessoSeletivoDto);
      detectar();

      expect(nativo.textContent).toContain('Tipo preservado 1');
      expect(nativo.textContent).toContain('Tipo preservado 2');
      expect(nativo.querySelector('sel-bancas-da-fase')?.textContent).not.toContain(
        'Heteroidentificação',
      );
    });
  });
});
