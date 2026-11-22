import { beforeEach, describe, expect, it } from 'vitest';
import { regrasDeComprovacaoParaEnvio } from '../../shared/exigencias/gravacao-das-exigencias';
import { fase, ID_AVALIACAO, ID_CPF, proximoPasso } from './fase.testing';
import { usarFase, type ContextoDaFase } from './fase-passo.testing';

/**
 * O que a edição das normas grava, conduzida pela tela: os campos são achados pelo rótulo visível,
 * para que o cenário valha qualquer que seja o componente que os desenha.
 */
describe('FasePassoComponent', () => {
  let store: ContextoDaFase['store'];
  let detectar: ContextoDaFase['detectar'];
  let nativo: ContextoDaFase['nativo'];
  let comCronograma: ContextoDaFase['comCronograma'];
  let documentos: ContextoDaFase['documentos'];

  usarFase((tela) => {
    ({ store, detectar, nativo, comCronograma, documentos } = tela);
  });

  describe('normas da exigência: o que a edição grava', () => {
    const normalizar = (texto: string | null | undefined) =>
      (texto ?? '').replace(/\s+/g, ' ').trim();

    /** O rótulo como a tela o mostra, sem o complemento só para leitor de tela. */
    function rotuloVisivel(rotulo: HTMLLabelElement): string {
      const copia = rotulo.cloneNode(true) as HTMLElement;
      copia.querySelectorAll('.sr-only').forEach((oculto) => oculto.remove());
      return normalizar(copia.textContent);
    }

    function campos<T extends HTMLElement>(rotulo: string): T[] {
      return Array.from(nativo.querySelectorAll<HTMLLabelElement>('label'))
        .filter((label) => rotuloVisivel(label) === rotulo)
        .map((label) => nativo.querySelector<T>(`[id="${label.htmlFor}"]`))
        .filter((campo): campo is T => campo !== null);
    }

    const referencias = () => campos<HTMLInputElement>('Norma que exige o documento');
    const alcances = () => campos<HTMLSelectElement>('Alcance da norma');
    const identificacoes = () => campos<HTMLSelectElement>('Identificação da norma');
    const observacoes = () => campos<HTMLInputElement>('Observação (opcional)');

    const botoes = (texto: string) =>
      Array.from(nativo.querySelectorAll<HTMLButtonElement>('button')).filter(
        (botao) => normalizar(botao.textContent) === texto,
      );

    function digitar(campo: HTMLInputElement, valor: string): void {
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
      detectar();
    }

    function escolher(campo: HTMLSelectElement, valor: string): void {
      campo.value = valor;
      campo.dispatchEvent(new Event('change'));
      detectar();
    }

    function clicar(botao: HTMLButtonElement): void {
      botao.click();
      detectar();
    }

    /** As normas como o comando as leva ao servidor. */
    const gravadas = () =>
      regrasDeComprovacaoParaEnvio(store.draft().documentos, {
        faseIdPorCodigo: new Map([['AVALIACAO', ID_AVALIACAO]]),
        modalidadesOfertadas: [],
        etapasVivas: new Set<string>(),
        finalidadesPorFase: new Map([['AVALIACAO', ['INSCRICAO']]]),
      })[0].documento?.indeferimento?.basesLegais;

    const AVISO = 'Sem uma norma declarada e identificada como "Resolvida"';
    const temAviso = () =>
      Array.from(nativo.querySelectorAll('.doc-item__aviso-norma')).some((aviso) =>
        aviso.textContent?.includes(AVISO),
      );

    beforeEach(() => {
      comCronograma(fase({}));
      documentos().escolherDocumento(ID_CPF);
      documentos().acrescentarDocumento();
      detectar();
    });

    it('a norma nasce em branco, no próprio edital e resolvida, e não viaja sem referência', () => {
      expect(referencias().map((campo) => campo.value)).toEqual(['']);
      expect(alcances().map((campo) => campo.value)).toEqual(['INTERNA_EDITAL']);
      expect(identificacoes().map((campo) => campo.value)).toEqual(['RESOLVIDO']);
      expect(observacoes().map((campo) => campo.value)).toEqual(['']);
      expect(gravadas()).toEqual([]);
    });

    it('"Acrescentar outra norma" abre uma segunda norma em branco, que também não viaja', () => {
      clicar(botoes('Acrescentar outra norma')[0]);

      expect(referencias()).toHaveLength(2);
      expect(alcances().map((campo) => campo.value)).toEqual(['INTERNA_EDITAL', 'INTERNA_EDITAL']);
      expect(identificacoes().map((campo) => campo.value)).toEqual(['RESOLVIDO', 'RESOLVIDO']);
      expect(gravadas()).toEqual([]);
    });

    it('grava referência e observação sem os espaços das pontas, e a observação em branco como null', () => {
      digitar(referencias()[0], '  Lei 12.711/2012, art. 3º  ');
      escolher(alcances()[0], 'FEDERAL');
      escolher(identificacoes()[0], 'PENDENTE');
      digitar(observacoes()[0], '   ');

      expect(gravadas()).toEqual([
        {
          referencia: 'Lei 12.711/2012, art. 3º',
          abrangencia: 'FEDERAL',
          situacao: 'PENDENTE',
          observacao: null,
        },
      ]);

      digitar(observacoes()[0], '  cotas raciais ');
      expect(gravadas()?.[0].observacao).toBe('cotas raciais');

      digitar(observacoes()[0], '');
      expect(gravadas()?.[0].observacao).toBeNull();
    });

    it('a única norma não se remove; com duas, sai a da posição escolhida', () => {
      expect(botoes('Remover esta norma')).toHaveLength(0);

      clicar(botoes('Acrescentar outra norma')[0]);
      digitar(referencias()[0], 'Lei A');
      digitar(referencias()[1], 'Lei B');
      expect(botoes('Remover esta norma')).toHaveLength(2);

      clicar(botoes('Remover esta norma')[0]);

      expect(referencias().map((campo) => campo.value)).toEqual(['Lei B']);
      expect(gravadas()?.map((base) => base.referencia)).toEqual(['Lei B']);
      expect(botoes('Remover esta norma')).toHaveLength(0);
    });

    it('o aviso de norma reage à digitação, sem esperar o campo perder o foco', () => {
      expect(temAviso()).toBe(true);

      digitar(referencias()[0], 'Lei 12.711/2012, art. 3º');
      expect(temAviso()).toBe(false);

      escolher(identificacoes()[0], 'PENDENTE');
      expect(temAviso()).toBe(true);
    });

    /** A tela só se atualiza depois do evento; a mudança seguinte não pode partir da lista velha. */
    it('acrescentar e logo trocar a identificação, antes de a tela se atualizar, mantém as duas normas', () => {
      digitar(referencias()[0], 'Lei A');
      botoes('Acrescentar outra norma')[0].click();
      const identificacao = identificacoes()[0];
      identificacao.value = 'PENDENTE';
      identificacao.dispatchEvent(new Event('change'));
      detectar();

      expect(referencias()).toHaveLength(2);
      expect(store.draft().documentos.regrasDeComprovacao[0].documento?.basesLegais).toEqual([
        expect.objectContaining({ referencia: 'Lei A', situacao: 'PENDENTE' }),
        expect.objectContaining({ referencia: '', situacao: 'RESOLVIDO' }),
      ]);
    });

    it('não deixa editar as normas enquanto a edição está suspensa', async () => {
      clicar(botoes('Acrescentar outra norma')[0]);
      digitar(referencias()[1], 'Lei B');

      store.salvando.set(true);
      detectar();
      await proximoPasso();
      detectar();

      expect(referencias().every((campo) => campo.disabled)).toBe(true);
      expect(alcances().every((campo) => campo.disabled)).toBe(true);
      expect(observacoes().every((campo) => campo.disabled)).toBe(true);
      expect(botoes('Acrescentar outra norma').every((botao) => botao.disabled)).toBe(true);
      expect(botoes('Remover esta norma').every((botao) => botao.disabled)).toBe(true);
    });
  });
});
