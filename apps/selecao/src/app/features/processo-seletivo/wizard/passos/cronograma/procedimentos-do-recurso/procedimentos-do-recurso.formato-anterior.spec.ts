import { describe, expect, it } from 'vitest';
import {
  AreaDoEnemDoProcedimento as Area,
  TipoDeDecisaoDoDocumento as Tipo,
} from '@uniplus/shared-data/selecao';

import {
  atualizar,
  escolher,
  montarEdicao,
  seletorDa,
  textoDe,
  COLEGIADO,
  MONOCRATICO,
  NOTA,
  HOMOLOGACAO,
} from './procedimentos-do-recurso.edicao.testing';
import { procedimento, procedimentoDoDocumento } from './procedimentos.testing';

const ANTIGO = procedimento({ tipoDeDecisao: NOTA });
const DOCUMENTAL = procedimentoDoDocumento({ tipoDeDecisao: HOMOLOGACAO });
const FORMATOS = [
  { formato: 'antigo', procedimentos: [ANTIGO] },
  { formato: 'misto', procedimentos: [ANTIGO, DOCUMENTAL] },
];
const remover = (seletor: HTMLSelectElement) =>
  (seletor.closest('.escolha')?.querySelector('button') as HTMLButtonElement).click();
const regraNova = { codigo: 'PROCEDIMENTO-RECURSO-MONOCRATICO', versao: 'v1' };

describe.each(FORMATOS)('edição do formato $formato', ({ procedimentos }) => {
  it('apresenta o antigo como declarado e troca sem declarar a mesma identidade', async () => {
    const { elementoDaTela, eventos } = await montarEdicao({
      procedimentos,
      tiposDeclarados: [NOTA],
    });
    const seletor = seletorDa(elementoDaTela, NOTA);
    expect(seletor.value).toBe(COLEGIADO);
    expect(seletor.querySelector('option[value=""]')).toBeNull();
    expect(elementoDaTela.querySelectorAll('li')).toHaveLength(0);
    escolher(seletor, MONOCRATICO);
    expect(eventos.trocarRegra).toHaveBeenCalledExactlyOnceWith({
      identidade: { tipoDeDecisao: NOTA, alvo: null },
      regra: regraNova,
    });
    expect(eventos.declarar).not.toHaveBeenCalled();
  });

  it('remove o antigo e permite nova declaração quando a entrada confirma a remoção', async () => {
    const { elementoDaTela, eventos, fixture } = await montarEdicao({
      procedimentos,
      tiposDeclarados: [NOTA],
    });
    remover(seletorDa(elementoDaTela, NOTA));
    expect(eventos.remover).toHaveBeenCalledExactlyOnceWith({ tipoDeDecisao: NOTA, alvo: null });
    await atualizar(fixture, { procedimentos: procedimentos.filter((atual) => atual !== ANTIGO) });
    expect(textoDe(elementoDaTela)).toContain(
      'Falta o procedimento de recurso para “Nota da etapa”',
    );
    escolher(seletorDa(elementoDaTela, NOTA), MONOCRATICO);
    expect(eventos.declarar).toHaveBeenCalledExactlyOnceWith({
      identidade: { tipoDeDecisao: NOTA, alvo: null },
      regra: regraNova,
    });
    expect(eventos.trocarRegra).not.toHaveBeenCalled();
  });

  it('declara uma decisão ausente sem alterar o procedimento antigo', async () => {
    const { elementoDaTela, eventos } = await montarEdicao({
      procedimentos,
      tiposDeclarados: [NOTA, HOMOLOGACAO, Tipo.CLASSIFICACAO],
    });
    escolher(seletorDa(elementoDaTela, Tipo.CLASSIFICACAO), MONOCRATICO);
    expect(eventos.declarar).toHaveBeenCalledExactlyOnceWith({
      identidade: { tipoDeDecisao: Tipo.CLASSIFICACAO, alvo: null },
      regra: regraNova,
    });
    expect(eventos.trocarRegra).not.toHaveBeenCalled();
    expect(seletorDa(elementoDaTela, NOTA).value).toBe(COLEGIADO);
    expect(procedimentos[0]).toBe(ANTIGO);
  });

  it('permite só remover quando não há período de recurso', async () => {
    const { elementoDaTela, eventos } = await montarEdicao({
      procedimentos,
      tiposDeclarados: [NOTA],
      temJanela: false,
    });
    const seletor = seletorDa(elementoDaTela, NOTA);
    expect(seletor.disabled).toBe(true);
    remover(seletor);
    expect(eventos.remover).toHaveBeenCalledExactlyOnceWith({ tipoDeDecisao: NOTA, alvo: null });
    expect(eventos.declarar).not.toHaveBeenCalled();
    expect(eventos.trocarRegra).not.toHaveBeenCalled();
  });
});

const ALVOS = [
  {
    nome: 'item',
    antigo: { itemDeAvaliacaoId: 'identificador-item-1' },
    documental: { itemDeAvaliacaoChave: 'item-1' },
  },
  {
    nome: 'área do ENEM',
    antigo: { areaDoEnem: Area.MATEMATICA },
    documental: { areaDoEnem: Area.MATEMATICA },
  },
];
describe.each(ALVOS)('formato antigo por $nome', ({ antigo, documental }) => {
  it('mantém a identidade ao trocar e remover e oferece declarar somente o item sem procedimento', async () => {
    const itensDaEtapa = [
      { id: 'identificador-item-1', chave: 'item-1', rotulo: 'Coerência', pontuacaoMaxima: '5' },
    ];
    const { elementoDaTela, eventos } = await montarEdicao({
      tiposDeclarados: [NOTA],
      itensDaEtapa,
      areasDoEnem: [Area.MATEMATICA],
      procedimentos: [procedimento({ tipoDeDecisao: NOTA, alvo: antigo })],
    });
    const seletores = Array.from(elementoDaTela.querySelectorAll('select'));
    const declarado = seletores.find((atual) => atual.value === COLEGIADO) as HTMLSelectElement;
    const ausente = seletores.find((atual) => atual.value === '') as HTMLSelectElement;
    escolher(declarado, MONOCRATICO);
    expect(eventos.trocarRegra).toHaveBeenCalledExactlyOnceWith({
      identidade: { tipoDeDecisao: NOTA, alvo: documental },
      regra: regraNova,
    });
    remover(declarado);
    expect(eventos.remover).toHaveBeenCalledExactlyOnceWith({
      tipoDeDecisao: NOTA,
      alvo: documental,
    });
    expect(eventos.declarar).not.toHaveBeenCalled();
    escolher(ausente, MONOCRATICO);
    expect(eventos.declarar).toHaveBeenCalledOnce();
    expect(eventos.declarar.mock.calls[0][0].identidade.alvo).not.toEqual(documental);
  });
});

it('preserva as ocorrências da mesma identidade em formatos mistos', async () => {
  const { elementoDaTela, eventos } = await montarEdicao({
    tiposDeclarados: [NOTA],
    procedimentos: [ANTIGO, procedimentoDoDocumento()],
  });
  const repetido = seletorDa(elementoDaTela, NOTA, 1);
  expect(repetido.disabled).toBe(true);
  expect(textoDe(elementoDaTela)).toContain('mesma decisão e mesmo item contestado');
  remover(repetido);
  expect(eventos.remover).toHaveBeenCalledExactlyOnceWith({
    tipoDeDecisao: NOTA,
    alvo: null,
    ocorrencia: 1,
  });
  expect(eventos.declarar).not.toHaveBeenCalled();
});

it('não habilita declaração enquanto a identidade antiga por item não tem correspondência documental', async () => {
  const { elementoDaTela, eventos } = await montarEdicao({
    tiposDeclarados: [NOTA],
    procedimentos: [
      procedimento({ tipoDeDecisao: NOTA, alvo: { itemDeAvaliacaoId: 'sem-chave' } }),
    ],
    itensDaEtapa: [{ id: 'sem-chave', rotulo: 'Coerência', pontuacaoMaxima: '5' }],
  });
  expect(textoDe(elementoDaTela)).toContain(
    'A edição dos procedimentos desta decisão está indisponível.',
  );
  expect(textoDe(elementoDaTela)).toContain('PROCEDIMENTO-RECURSO-COLEGIADO');
  expect(seletorDa(elementoDaTela, NOTA).disabled).toBe(true);
  escolher(seletorDa(elementoDaTela, NOTA), MONOCRATICO);
  expect(eventos.declarar).not.toHaveBeenCalled();
});
