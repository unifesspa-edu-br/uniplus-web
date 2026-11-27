import { describe, expect, it } from 'vitest';
import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';
import { conteudoDoDocumento } from './conversao-do-formulario';
import { aceita, editar, formulario, CATALOGOS } from './conversao.testing';
import { edicaoDoConteudo } from '../adaptadores/formulario.adaptador';

describe('recusas da conversão do formulário', () => {
  it('recusa a leitura dependente de catálogos indisponíveis e aceita após a nova tentativa', () => {
    const original = formulario();
    const recusada = conteudoDoDocumento(original, { fatos: null, termos: null });
    expect(recusada.ok).toBe(false);
    if (recusada.ok) return;
    expect(recusada.impedimentos.map((item) => item.caminho)).toEqual([
      '/itens/0/fatoCodigo',
      '/grupos/0/subitens/0/fatoCodigo',
      '/termos/0',
    ]);
    expect(recusada.impedimentos.every((item) => item.mensagem.includes('novamente'))).toBe(true);
    expect(conteudoDoDocumento(original, CATALOGOS).ok).toBe(true);
  });

  it('não depende do catálogo de termos quando o formulário não exige termos', () => {
    expect(
      conteudoDoDocumento({ ...formulario(), termos: [] }, { ...CATALOGOS, termos: null }).ok,
    ).toBe(true);
  });

  it('recusa referência ambígua e não escolhe outra versão ao ler', () => {
    const recusada = conteudoDoDocumento(formulario(), {
      ...CATALOGOS,
      termos: [...(CATALOGOS.termos ?? []), CATALOGOS.termos?.[0]].filter(
        (item) => item !== undefined,
      ),
    });
    expect(recusada.ok).toBe(false);
    if (!recusada.ok) expect(recusada.impedimentos[0].caminho).toBe('/termos/0');
  });

  it('recusa a versão de outro termo e deixa o documento inteiro inalterado', () => {
    const original = formulario();
    const recusada = editar(original, (conteudo) => ({
      ...conteudo,
      titulo: 'Outro título',
      termos:
        conteudo.termos?.map((termo) => ({
          ...termo,
          termo: { ...termo.termo, versaoId: 'terceira' },
        })) ?? null,
    }));
    expect(recusada.ok).toBe(false);
    const documento: DocumentoDaConfiguracao = {
      formato: 'uniplus.selecao.configuracao',
      versaoFormato: 1,
      formularios: [original],
    };
    expect(edicaoDoConteudo('INSCRICAO', recusada)(documento)).toBe(documento);
    expect(documento.formularios?.[0]).not.toHaveProperty('titulo');
  });

  it('a indisponibilidade durante a edição também recusa o resultado inteiro', () => {
    const recusada = editar(formulario(), (conteudo) => ({ ...conteudo, titulo: 'Cadastro' }), [], {
      fatos: null,
      termos: null,
    });
    expect(recusada.ok).toBe(false);
  });

  it.each(['texto reservado', '', 'Infinity', Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
    'recusa mínimo inválido sem repetir o valor (%s)',
    (minimo) => {
      const recusada = editar(formulario(), (conteudo) => ({
        ...conteudo,
        grupos: conteudo.grupos?.map((grupo) => ({
          ...grupo,
          ocorrencias: { ...grupo.ocorrencias, minimo },
        })),
      }));
      expect(recusada.ok).toBe(false);
      if (recusada.ok) return;
      expect(recusada.impedimentos).toEqual([
        { caminho: '/grupos/0/minimo', mensagem: 'Informe um número válido.' },
      ]);
    },
  );

  it('acumula as recusas por assunto e posição, sem publicar um resultado parcial', () => {
    const recusada = editar(
      formulario(),
      (conteudo) => ({
        ...conteudo,
        pressupostos: ['RENDA'],
        grupos: conteudo.grupos?.map((grupo) => ({
          ...grupo,
          ocorrencias: { ...grupo.ocorrencias, minimo: 'texto reservado' },
        })),
        termos: [
          { ...(conteudo.termos ?? [])[0], termo: { termoId: 'ausente', versaoId: 'primeira' } },
          {
            ...(conteudo.termos ?? [])[0],
            codigo: 'segundo',
            termo: { termoId: 'termo', versaoId: 'terceira' },
          },
        ],
      }),
      [],
      { ...CATALOGOS, fatos: [] },
    );
    expect(recusada.ok).toBe(false);
    if (recusada.ok) return;
    expect(recusada.impedimentos.map((item) => item.caminho)).toEqual([
      '/itens/0/fatoCodigo',
      '/grupos/0/subitens/0/fatoCodigo',
      '/termos/0',
      '/termos/1',
      '/grupos/0/minimo',
      '/pressupostos',
    ]);
    expect(JSON.stringify(recusada.impedimentos)).not.toContain('texto reservado');
    expect(recusada).not.toHaveProperty('formulario');
  });

  it('recusa pressupostos declarados sem descartá-los silenciosamente', () => {
    const recusada = editar(formulario(), (conteudo) => ({ ...conteudo, pressupostos: ['RENDA'] }));
    expect(recusada.ok).toBe(false);
    if (!recusada.ok) expect(recusada.impedimentos[0].caminho).toBe('/pressupostos');
  });

  it('valida operadores e opções fechadas sem substituir o valor recusado', () => {
    const recusada = editar(formulario(), (conteudo) => ({
      ...conteudo,
      itens:
        conteudo.itens?.map((item) => ({
          ...item,
          regras: {
            ...item.regras,
            exibicao: [[{ fato: 'RENDA', operador: 'texto reservado', valor: true }]],
          },
        })) ?? null,
    }));
    expect(recusada.ok).toBe(false);
    if (!recusada.ok)
      expect(recusada.impedimentos).toEqual([
        { caminho: '/itens/0/exibicao/0/0/operador', mensagem: 'Selecione uma opção válida.' },
      ]);
  });

  it('uma nova tentativa usa os catálogos atuais e mantém a versão solicitada', () => {
    const resultado = aceita(
      editar(formulario(), (conteudo) => ({
        ...conteudo,
        termos:
          conteudo.termos?.map((termo) => ({
            ...termo,
            termo: { ...termo.termo, versaoId: 'segunda' },
          })) ?? null,
      })),
    );
    expect(resultado.formulario.termos?.[0].versaoNumero).toBe(2);
  });
});
