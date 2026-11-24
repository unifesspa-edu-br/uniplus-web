import { afterEach, describe, expect, it, beforeAll } from 'vitest';
import {
  Pagina,
  montarPagina,
  sucesso,
  urlDoFato,
  compilarPaginaUmaVez,
} from './fatos-candidato.testing';
import {
  comAprovacao,
  comDefinicao,
  comProtecao,
  comValoresDeclarados,
  corRaca,
  emManutencao,
  tipoTexto,
  tipoSimOuNao,
  tipoOpcao,
  fonteCatalogo,
} from './fatos-candidato.fixtures';
import { OperadorCodigo, type FatoCandidatoDto } from '@uniplus/shared-data/configuracao';
import { campo, derivadoBooleano, ConducaoDaDefinicao } from './fatos-candidato.definicao.testing';

describe('FatosCandidatoPage — proteção de dados e tipo de dado na definição do fato', () => {
  beforeAll(compilarPaginaUmaVez);
  let p: Pagina;
  afterEach(() => {
    p.atenderApoios();
    p.atenderPendencias();
    p.http.verify();
  });

  const abrir = async (fato: FatoCandidatoDto): Promise<void> => {
    p = await montarPagina([fato]);
    await p.abrirEdicao(fato);
  };
  const { enviar, definir } = new ConducaoDaDefinicao(() => p);

  describe('a aprovação da proteção de dados', () => {
    it('ao abrir, não apaga a proteção que o servidor tem, ainda que a regra do domínio hoje não a admita', async () => {
      const sistema = comProtecao(
        comDefinicao({ ...corRaca, semeadoPeloSistema: true }, { dominio: tipoTexto }),
        { classificacao: 'INTERNO', hipoteseLegal: 'INTERESSE_LEGITIMO' },
      );
      await abrir(sistema);

      expect(p.editor.definicao.controls.classificacaoProtecao.value).toBe('INTERNO');
      expect(p.editor.definicao.controls.hipoteseLegal.value).toBe('INTERESSE_LEGITIMO');
    });

    it('esvazia a hipótese que a pessoa tornou incompatível ao trocar a classificação', async () => {
      const sistema = comProtecao(
        comDefinicao({ ...corRaca, semeadoPeloSistema: true }, { dominio: tipoSimOuNao }),
        { classificacao: 'PESSOAL', hipoteseLegal: 'INTERESSE_LEGITIMO' },
      );
      await abrir(sistema);

      p.digitar(campo('classificacaoProtecao'), 'SENSIVEL');
      await p.propagar();

      expect(p.elemento<HTMLSelectElement>(campo('hipoteseLegal')).value).toBe('');
    });

    it('avisa que o fato aprovado volta a pendente ao mudar a classificação, e não ao mudar o nome', async () => {
      await abrir(comAprovacao(corRaca, 'APROVADA'));

      p.digitar('#cfg-fato-descritivo [formcontrolname="nome"]', 'Cor ou raça declarada');
      await p.propagar();
      expect(p.texto()).not.toContain('O item volta a pendente');

      p.digitar(campo('classificacaoProtecao'), 'PESSOAL');
      p.digitar(campo('hipoteseLegal'), 'EXECUCAO_POLITICAS_PUBLICAS');
      await p.propagar();
      expect(p.texto()).toContain('O item volta a pendente');
    });

    it('não avisa quando o fato já está pendente', async () => {
      await abrir(comAprovacao({ ...corRaca, semeadoPeloSistema: true }, 'PENDENTE'));

      p.digitar(campo('classificacaoProtecao'), 'PESSOAL');
      await p.propagar();

      expect(p.texto()).not.toContain('O item volta a pendente');
    });

    it('mostra a situação como texto e a classificação que a proteção de dados recomendou', async () => {
      await abrir(
        comAprovacao(
          { ...corRaca, semeadoPeloSistema: true },
          'AJUSTE_RECOMENDADO',
          'IDENTIFICADOR',
        ),
      );

      expect(p.texto()).toContain('Ajuste recomendado');
      expect(p.texto()).toContain('Classificação recomendada: Identificador');
    });
  });

  describe('trocar o tipo de dado do derivado', () => {
    const categorico: FatoCandidatoDto = {
      ...comValoresDeclarados(
        comDefinicao(derivadoBooleano, { dominio: tipoOpcao }),
        [{ codigo: 'A', descricao: null, ordem: 0, ativo: true, orientacao: null }],
        fonteCatalogo,
      ),
      regrasPadrao: [
        {
          contribui: 'A',
          quando: [[{ fato: 'QUILOMBOLA', operador: OperadorCodigo.IGUAL, valor: true }]],
        },
      ],
    };

    it('trocar o tipo de dado limpa as marcas das contribuições e das condições', async () => {
      const comRegraIncompleta = {
        ...categorico,
        regrasPadrao: [{ contribui: 'A', quando: [] }],
      };
      await abrir(comRegraIncompleta);
      const select = p.elemento<HTMLSelectElement>('cfg-fato-regras select');
      select.value = '';
      select.dispatchEvent(new Event('change'));
      await p.acionar(p.botaoPeloTexto('Acrescentar regra', p.drawerDoFato()) as HTMLButtonElement);
      await p.acionar(p.botaoPeloTexto('Salvar regras', p.drawerDoFato()) as HTMLButtonElement);
      expect(p.texto('#cfg-fato-regra-0-erro')).not.toBe('');

      p.digitar(campo('dominio'), 'SIM_OU_NAO');
      await enviar();
      definir(categorico).flush(...sucesso());
      await p.propagar();
      p.http.expectOne(urlDoFato(categorico)).flush(
        emManutencao({
          ...comValoresDeclarados(comDefinicao(categorico, { dominio: tipoSimOuNao }), [], null),
          regrasPadrao: [{ contribui: null, quando: categorico.regrasPadrao[0].quando }],
        }),
      );
      p.pedidoDaLista().flush([categorico].map(emManutencao));
      await p.propagar();
      p.atenderPendencias();
      await p.propagar();

      expect(p.existe('#cfg-fato-regra-0-erro')).toBe(false);
      expect(p.drawerDoFato().querySelector('cfg-fato-regras [aria-invalid="true"]')).toBeNull();
    });

    it('as regras em tela só voltam a salvar quando chegam as do servidor', async () => {
      await abrir(categorico);
      p.digitar(campo('dominio'), 'SIM_OU_NAO');
      await enviar();
      definir(categorico).flush(...sucesso());
      await p.propagar();

      const salvar = p.botaoPeloTexto('Salvar regras', p.drawerDoFato()) as HTMLButtonElement;
      expect(salvar.getAttribute('aria-disabled')).toBe('true');
      salvar.click();
      p.http.expectNone(`${urlDoFato(categorico)}/regras-padrao`);

      p.http.expectOne(urlDoFato(categorico)).flush(
        emManutencao({
          ...comValoresDeclarados(comDefinicao(categorico, { dominio: tipoSimOuNao }), [], null),
          regrasPadrao: [{ contribui: null, quando: categorico.regrasPadrao[0].quando }],
        }),
      );
      p.pedidoDaLista().flush([categorico].map(emManutencao));
      await p.propagar();
      p.atenderPendencias();
      await p.propagar();

      expect(p.drawerDoFato().querySelectorAll('ui-editor-de-condicoes')).toHaveLength(1);
    });
  });
});
