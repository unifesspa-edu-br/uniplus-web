import { describe, expect, it } from 'vitest';
import { regrasDeComprovacaoParaEnvio } from '../../shared/exigencias/gravacao-das-exigencias';
import { congeladosDaFase, fase, ID_AVALIACAO, ID_CPF } from './fase.testing';
import { identificadorDaRegra, usarFase, type ContextoDaFase } from './fase-passo.testing';

describe('FasePassoComponent: prazo para reenvio', () => {
  let store: ContextoDaFase['store'];
  let detectar: ContextoDaFase['detectar'];
  let nativo: ContextoDaFase['nativo'];
  let comCronograma: ContextoDaFase['comCronograma'];
  let exigencias: ContextoDaFase['exigencias'];
  let documentos: ContextoDaFase['documentos'];

  usarFase((tela) => {
    ({ store, detectar, nativo, comCronograma, exigencias, documentos } = tela);
  });

  const caixa = () =>
    nativo.querySelector<HTMLInputElement>(
      `#fase-AVALIACAO-doc-reenvio-${identificadorDaRegra(exigencias(), ID_CPF)}`,
    );

  function exigirCpf(): void {
    documentos().escolherDocumento(ID_CPF);
    documentos().acrescentarDocumento();
    detectar();
  }

  function alternar(): void {
    (caixa() as HTMLInputElement).click();
    detectar();
  }

  it('não oferece o prazo em fase que não admite complementação', () => {
    comCronograma(fase({}));
    exigirCpf();

    expect(caixa()).toBeNull();
  });

  it('a exigência nasce sem prazo; marcar e desmarcar grava o campo no rascunho e no comando', () => {
    comCronograma(fase({ congelados: congeladosDaFase({ permiteComplementacao: true }) }));
    exigirCpf();
    expect(caixa()?.checked).toBe(false);
    expect(exigencias().exigenciaDoDocumento(ID_CPF).abrePrazoParaReenvio).toBe(false);

    alternar();
    expect(caixa()?.checked).toBe(true);
    expect(exigencias().exigenciaDoDocumento(ID_CPF).abrePrazoParaReenvio).toBe(true);
    expect(prazoEnviado()).toBe(true);

    alternar();
    expect(exigencias().exigenciaDoDocumento(ID_CPF).abrePrazoParaReenvio).toBe(false);
    expect(prazoEnviado()).toBe(false);
  });

  it('rotula a caixa em português, com o rótulo ligado a uma caixa de marcação nativa', () => {
    comCronograma(fase({ congelados: congeladosDaFase({ permiteComplementacao: true }) }));
    exigirCpf();

    expect(caixa()?.type).toBe('checkbox');
    expect(caixa()?.closest('label')?.textContent).toContain(
      'Abrir prazo para o candidato reenviar o documento',
    );
  });

  it('mantém visível, para ser desligado, o prazo já gravado numa fase que não o admite', () => {
    comCronograma(fase({}));
    exigirCpf();
    exigencias().escreverExigencia(ID_CPF, { abrePrazoParaReenvio: true });
    detectar();

    expect(caixa()?.checked).toBe(true);
    alternar();
    expect(exigencias().exigenciaDoDocumento(ID_CPF).abrePrazoParaReenvio).toBe(false);
  });

  function prazoEnviado(): boolean | undefined {
    const regras = regrasDeComprovacaoParaEnvio(store.draft().documentos, {
      faseIdPorCodigo: new Map([['AVALIACAO', ID_AVALIACAO]]),
      modalidadesOfertadas: [],
      etapasVivas: new Set<string>(),
      formulariosPorFase: new Map(),
    }).regras;
    return regras[0].documento?.indeferimento?.abrePrazoParaReenvio;
  }
});
