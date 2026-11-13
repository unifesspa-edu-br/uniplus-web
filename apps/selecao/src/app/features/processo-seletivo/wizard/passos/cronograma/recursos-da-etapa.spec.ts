import type { RegraCatalogoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { PAPEL_DEFINITIVO, PAPEL_PRELIMINAR } from '../../processo-seletivo.models';
import { etapa } from './cronograma-do-certame.testing';
import { grupoDaEtapa } from './cronograma-form';
import {
  acrescentarRecurso,
  alterarRecurso,
  declararInstanciaSuperior,
  preliminaresDaEtapa,
  regraDoCatalogo,
  removerRecurso,
} from './recursos-da-etapa';

function regra(codigo: string, versao: string): RegraCatalogoDto {
  return {
    codigo,
    versao,
    tipo: 'PRAZO',
    esquemaArgs: {},
    invariantes: {},
    baseLegal: 'Base legal de teste',
    modalidadesAdmitidas: null,
    hash: 'h'.repeat(64),
  };
}

const REGRAS = [regra('PRAZO-ANCORADO-EM-ATO', 'v1'), regra('PRAZO-ANCORADO-EM-CIENCIA', 'v2')];

function grupoCom(produtos: { atoCodigo: string; papel: string | null }[] = []) {
  return grupoDaEtapa(etapa({ produtos }));
}

describe('recursos da etapa', () => {
  it('escolhe no catálogo a regra do relógio de cada âncora', () => {
    expect(regraDoCatalogo(REGRAS, 'atoPublicado')?.versao).toBe('v1');
    expect(regraDoCatalogo(REGRAS, 'cienciaIndividual')?.versao).toBe('v2');
    expect(regraDoCatalogo([regra('OUTRA', 'v9')], 'atoPublicado')?.codigo).toBe('OUTRA');
    expect(regraDoCatalogo([], 'atoPublicado')).toBeUndefined();
  });

  it('lista só os produtos preliminares', () => {
    const grupo = grupoCom([
      { atoCodigo: 'DEF', papel: PAPEL_DEFINITIVO },
      { atoCodigo: 'PRE', papel: PAPEL_PRELIMINAR },
    ]);

    expect(preliminaresDaEtapa(grupo).map((p) => p.atoCodigo)).toEqual(['PRE']);
  });

  it('acrescenta a janela ancorada no primeiro preliminar, sem suspensividade nem instância superior', () => {
    const grupo = grupoCom([{ atoCodigo: 'PRE', papel: PAPEL_PRELIMINAR }]);

    acrescentarRecurso(grupo, REGRAS);

    expect(grupo.controls.recursos.value).toEqual([
      expect.objectContaining({
        ancora: 'atoPublicado',
        regraCodigo: 'PRAZO-ANCORADO-EM-ATO',
        regraVersao: 'v1',
        atoAncoraCodigo: 'PRE',
        admiteInstanciaSuperior: null,
        suspensividadePrimeiraInstanciaValor: '',
        suspensividadeSegundaInstanciaValor: '',
      }),
    ]);
    expect(grupo.controls.recursos.dirty).toBe(true);
  });

  it('acrescenta a janela sem âncora e sem regra quando nada oferece', () => {
    const grupo = grupoCom();

    acrescentarRecurso(grupo, []);

    expect(grupo.controls.recursos.value[0]).toEqual(
      expect.objectContaining({ atoAncoraCodigo: '', regraCodigo: '', regraVersao: '' }),
    );
  });

  it('remove só a janela da posição pedida', () => {
    const grupo = grupoCom();
    acrescentarRecurso(grupo, REGRAS);
    acrescentarRecurso(grupo, REGRAS);
    alterarRecurso(grupo, 1, { campo: 'prazoValor', valor: '7' }, REGRAS);

    removerRecurso(grupo, 0);

    expect(grupo.controls.recursos.value.map((r) => r.prazoValor)).toEqual(['7']);
  });

  it('troca a regra e a versão juntas quando o operador escolhe outra regra', () => {
    const grupo = grupoCom();
    acrescentarRecurso(grupo, REGRAS);

    alterarRecurso(grupo, 0, { campo: 'regraCodigo', valor: 'PRAZO-ANCORADO-EM-CIENCIA' }, REGRAS);

    expect(grupo.controls.recursos.value[0]).toEqual(
      expect.objectContaining({ regraCodigo: 'PRAZO-ANCORADO-EM-CIENCIA', regraVersao: 'v2' }),
    );
  });

  it('muda a regra e solta o ato âncora ao ancorar na ciência', () => {
    const grupo = grupoCom([{ atoCodigo: 'PRE', papel: PAPEL_PRELIMINAR }]);
    acrescentarRecurso(grupo, REGRAS);

    alterarRecurso(grupo, 0, { campo: 'ancora', valor: 'cienciaIndividual' }, REGRAS);

    expect(grupo.controls.recursos.value[0]).toEqual(
      expect.objectContaining({
        ancora: 'cienciaIndividual',
        regraCodigo: 'PRAZO-ANCORADO-EM-CIENCIA',
        atoAncoraCodigo: '',
      }),
    );
  });

  it('mantém o ato âncora ao voltar a ancorar na publicação', () => {
    const grupo = grupoCom([{ atoCodigo: 'PRE', papel: PAPEL_PRELIMINAR }]);
    acrescentarRecurso(grupo, REGRAS);

    alterarRecurso(grupo, 0, { campo: 'ancora', valor: 'atoPublicado' }, REGRAS);

    expect(grupo.controls.recursos.value[0].atoAncoraCodigo).toBe('PRE');
  });

  it('registra a resposta sobre a instância superior só na janela indicada', () => {
    const grupo = grupoCom();
    acrescentarRecurso(grupo, REGRAS);
    acrescentarRecurso(grupo, REGRAS);

    declararInstanciaSuperior(grupo, 1, true);

    expect(grupo.controls.recursos.value.map((r) => r.admiteInstanciaSuperior)).toEqual([
      null,
      true,
    ]);
  });
});
