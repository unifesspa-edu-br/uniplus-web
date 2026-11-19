import { describe, expect, it } from 'vitest';
import { MENSAGENS_DA_JANELA } from './janela/mensagens-da-janela';
import { orientacaoDaPropria } from './janela/rotulos-da-janela';
import { MENSAGENS_DA_RECLASSIFICACAO } from './reclassificacao/mensagens-da-reclassificacao';
import { TEXTOS_DA_CONTENCAO } from './versoes/textos-da-contencao';

/** Os textos que dizem quem decide seguem a ADR-0162: decide o Representante do controlador. */
const TEXTOS = [
  ...Object.values(MENSAGENS_DA_JANELA).flatMap((m) => [m.titulo, m.resolver]),
  ...Object.values(MENSAGENS_DA_RECLASSIFICACAO).flatMap((m) => [m.titulo, m.resolver]),
  ...Object.values(TEXTOS_DA_CONTENCAO).flatMap((t) => Object.values(t).map(String)),
  ...Object.values(orientacaoDaPropria('aguardando_protecao_de_dados')),
];

describe('papéis nos textos de versões, janela e reclassificação', () => {
  it('nenhum texto atribui decisão ao Encarregado de dados', () => {
    expect(TEXTOS.filter((texto) => /encarregad/i.test(texto))).toEqual([]);
  });

  it('nenhum texto diz que a proteção de dados decide', () => {
    expect(TEXTOS.filter((texto) => /a proteção de dados decide/i.test(texto))).toEqual([]);
  });

  it('a janela diz que o Representante do controlador decide a etapa de proteção de dados', () => {
    expect(MENSAGENS_DA_JANELA['migracao.sem_permissao_na_etapa']?.resolver).toContain(
      'o Representante do controlador decide a etapa de proteção de dados',
    );
    expect(MENSAGENS_DA_JANELA['migracao.lote_ja_enviado']?.resolver).toContain(
      'o que aguarda o Representante do controlador, pela etapa de proteção de dados',
    );
  });

  it('a reclassificação diz que o Representante do controlador decide a subida de classe', () => {
    for (const codigo of [
      'reclassificacao.etapa_nao_exigida',
      'reclassificacao.sem_permissao_na_etapa',
    ]) {
      expect(MENSAGENS_DA_RECLASSIFICACAO[codigo]?.resolver).toContain(
        'O Representante do controlador decide a subida de classe',
      );
    }
  });

  it('a concessão própria na etapa protegida aguarda outro Representante do controlador', () => {
    expect(orientacaoDaPropria('aguardando_protecao_de_dados')).toEqual({
      titulo: 'Na etapa de proteção de dados: outro Representante do controlador decide',
      dica: 'Concessões em que você é a pessoa beneficiada aguardam a decisão de outro Representante do controlador.',
      legenda: 'Concessões suas que aguardam outro Representante do controlador',
    });
  });
});
