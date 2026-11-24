import { StatusProcessoCodigo } from '@uniplus/shared-data/selecao';
import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { umProcessoLidoComOsTiposDeDecisao } from '../../shared/decisoes-da-fase-ou-etapa/tipos-de-decisao-da-api.testing';
import { fase } from './fase.testing';
import { usarFase, type ContextoDaFase } from './fase-passo.testing';

const GRUPO = 'fase-AVALIACAO-tipos-de-decisao';

describe('FasePassoComponent: tipos de decisão da fase', () => {
  let store: ContextoDaFase['store'];
  let componente: ContextoDaFase['componente'];
  let detectar: ContextoDaFase['detectar'];
  let nativo: ContextoDaFase['nativo'];
  let comCronograma: ContextoDaFase['comCronograma'];

  usarFase((tela) => {
    ({ store, componente, detectar, nativo, comCronograma } = tela);
  });

  const caixa = (codigo: string) =>
    nativo.querySelector<HTMLInputElement>(`#${GRUPO}-${codigo}`) as HTMLInputElement;

  const marcar = (codigo: string, marcado: boolean) => {
    caixa(codigo).checked = marcado;
    caixa(codigo).dispatchEvent(new Event('change'));
    detectar();
  };

  it('mostra marcados os tipos que a fase já declara', () => {
    comCronograma(fase({ tiposDeDecisao: ['CLASSIFICACAO'] }));

    expect(caixa('CLASSIFICACAO').checked).toBe(true);
    expect(caixa('GABARITO_DA_PROVA').checked).toBe(false);
  });

  it('nomeia o grupo pela legenda e liga a dica a ele', () => {
    comCronograma(fase({}));

    const grupo = nativo.querySelector(`fieldset[aria-describedby="${GRUPO}-ajuda"]`);
    expect(grupo?.querySelector('legend')?.textContent).toContain('Decisões que esta fase toma');
    expect(nativo.querySelector(`#${GRUPO}-ajuda`)).not.toBeNull();
  });

  it('grava no rascunho os tipos marcados, em ordem alfabética do código', () => {
    comCronograma(fase({}));

    marcar('NOTA_DA_ETAPA', true);
    marcar('CLASSIFICACAO', true);

    expect(store.draft().cronograma.fases[0].tiposDeDecisao).toEqual([
      'CLASSIFICACAO',
      'NOTA_DA_ETAPA',
    ]);
  });

  it('tira do rascunho o tipo que foi desmarcado', () => {
    comCronograma(fase({ tiposDeDecisao: ['CLASSIFICACAO', 'NOTA_DA_ETAPA'] }));

    marcar('CLASSIFICACAO', false);

    expect(store.draft().cronograma.fases[0].tiposDeDecisao).toEqual(['NOTA_DA_ETAPA']);
  });

  it('trava as caixas quando o formulário está desabilitado', () => {
    comCronograma(fase({}));

    componente.formulario()?.disable();
    detectar();

    expect(caixa('CLASSIFICACAO').disabled).toBe(true);
  });

  it('lê em consulta os nomes dos tipos declarados, sem caixas de marcar', () => {
    comCronograma(fase({ tiposDeDecisao: ['CLASSIFICACAO', 'TIPO_DO_FUTURO'] }));
    store.remoteSnapshot.set({
      ...umProcessoLidoComOsTiposDeDecisao(),
      status: StatusProcessoCodigo.PUBLICADO,
    } as unknown as ProcessoSeletivoDto);
    detectar();

    const leitura = nativo.querySelector('sel-decisoes-da-fase')?.textContent ?? '';
    expect(leitura).toContain('Decisões que esta fase toma');
    expect(leitura).toContain('Classificação');
    expect(leitura).not.toContain('TIPO_DO_FUTURO');
    expect(nativo.querySelector('sel-decisoes-da-fase input')).toBeNull();
  });

  it('diz que nenhuma decisão foi declarada quando a fase publicada não declara tipo', () => {
    comCronograma(fase({}));
    store.remoteSnapshot.set({
      status: StatusProcessoCodigo.PUBLICADO,
    } as unknown as ProcessoSeletivoDto);
    detectar();

    expect(nativo.querySelector('sel-decisoes-da-fase')?.textContent).toContain(
      'Nenhuma decisão declarada',
    );
  });
});
