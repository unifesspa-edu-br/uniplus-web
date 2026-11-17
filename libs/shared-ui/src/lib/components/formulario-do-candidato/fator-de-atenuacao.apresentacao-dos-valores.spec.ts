import { TestBed } from '@angular/core/testing';

import { ligarRelogioControlado, passarOTempo } from '@uniplus/shared-testing';

import {
  ESPERA_DA_DIGITACAO_MS,
  NomesDeMunicipios,
} from '../editor-de-condicoes/valor-de-municipio';

import {
  ATIVIDADES_NA_AREA,
  CenarioDaRevisaoDoFator,
  DATA_INICIO_NA_AREA,
  MESES_NA_AREA,
  MUNICIPIO_DO_FATOR,
  SOLICITA_O_FATOR,
  TELEFONE_DO_CONTATO,
  comMunicipioPorBusca,
  formularioComOFator,
} from './fator-de-atenuacao.testing';

describe('Resumo do Fator de Atenuação na Revisão', () => {
  let cenario: CenarioDaRevisaoDoFator;

  beforeEach(() => (cenario = CenarioDaRevisaoDoFator.preparar()));
  afterEach(() => cenario.encerrar());

  it('o campo de município por busca aparece com o nome ou, sem ele, sem o código solto', () => {
    cenario.abrirNaRevisao(comMunicipioPorBusca(formularioComOFator()), {
      respostas: { [SOLICITA_O_FATOR]: true, [MUNICIPIO_DO_FATOR]: '2105302' },
    });

    const texto = cenario.resumo()?.textContent ?? '';
    expect(texto).toContain('Nome do município não carregado (código IBGE 2105302)');
  });

  it('o município gravado no envio aparece com a UF, mesmo que uma busca devolva outro nome', () => {
    TestBed.inject(NomesDeMunicipios).lembrar([
      { codigoIbge: '2927408', nome: 'Salvador da Bahia', uf: 'BA' },
    ]);
    cenario.gravados = { [MUNICIPIO_DO_FATOR]: { codigo: '2927408', rotulo: 'Salvador' } };

    cenario.abrirNaRevisao(comMunicipioPorBusca(formularioComOFator()), {
      respostas: { [SOLICITA_O_FATOR]: true, [MUNICIPIO_DO_FATOR]: '2927408' },
    });

    const texto = cenario.resumo()?.textContent ?? '';
    expect(texto).toContain('Salvador (BA)');
    expect(texto).not.toContain('Salvador da Bahia');
  });

  it('o município trocado depois da abertura mostra o nome da busca, não o gravado', async () => {
    ligarRelogioControlado();
    cenario.achadosPelaBusca = [{ codigoIbge: '2105302', nome: 'Imperatriz', uf: 'MA' }];
    cenario.gravados = { [MUNICIPIO_DO_FATOR]: { codigo: '2927408', rotulo: 'Salvador' } };
    cenario.abrir(comMunicipioPorBusca(formularioComOFator()), {
      respostas: { [SOLICITA_O_FATOR]: true, [MUNICIPIO_DO_FATOR]: '2927408' },
    });
    const campo = (): HTMLInputElement =>
      cenario.tela.querySelector(
        `[data-campo="${MUNICIPIO_DO_FATOR}"] input[role="combobox"]`,
      ) as HTMLInputElement;
    expect(campo().value).toBe('Salvador (BA)');

    campo().value = 'Imp';
    campo().dispatchEvent(new Event('input'));
    await passarOTempo(ESPERA_DA_DIGITACAO_MS);
    cenario.fixture.detectChanges();
    const opcao = [...cenario.tela.querySelectorAll<HTMLElement>('[role="option"]')].find((o) =>
      o.textContent?.includes('Imperatriz (MA)'),
    );
    opcao?.dispatchEvent(new MouseEvent('mousedown'));
    cenario.fixture.detectChanges();

    expect(campo().value).toBe('Imperatriz (MA)');
    cenario.irParaARevisao();
    expect(cenario.resumo()?.textContent).toContain('Imperatriz (MA)');
    expect(cenario.resumo()?.textContent).not.toContain('Salvador');
  });

  it('a resposta fixa aparece pela exibição mascarada, nunca pelo valor', () => {
    cenario.abrirNaRevisao(formularioComOFator({ fatos: [TELEFONE_DO_CONTATO], grupos: [] }), {
      respostas: {},
      fixas: { [TELEFONE_DO_CONTATO]: { valor: '61981951555', exibicao: '(**) *****-1555' } },
    });

    const texto = cenario.resumo()?.textContent ?? '';
    expect(texto).toContain('(**) *****-1555');
    expect(texto).not.toContain('61981951555');
    expect(texto).not.toContain('98195-1555');
  });

  it('a data aparece no formato brasileiro e o telefone com a máscara, como no comprovante', () => {
    const dependencias = { fatos: [DATA_INICIO_NA_AREA, TELEFONE_DO_CONTATO], grupos: [] };
    cenario.abrirNaRevisao(formularioComOFator(dependencias), {
      respostas: { [DATA_INICIO_NA_AREA]: '2001-03-09', [TELEFONE_DO_CONTATO]: '61981951555' },
    });

    const itens = [...(cenario.resumo()?.querySelectorAll('dd') ?? [])].map((e) =>
      e.textContent?.trim(),
    );
    expect(itens).toEqual(['09/03/2001', '(61) 98195-1555']);
  });

  it('o número aparece formatado e a seleção múltipla pelas descrições, separadas por vírgula', () => {
    const dependencias = { fatos: [MESES_NA_AREA, ATIVIDADES_NA_AREA], grupos: [] };
    cenario.abrirNaRevisao(formularioComOFator(dependencias), {
      respostas: { [MESES_NA_AREA]: 1234.5, [ATIVIDADES_NA_AREA]: ['PESCA', 'ROCA'] },
    });

    const texto = cenario.resumo()?.textContent ?? '';
    expect(texto).toContain('1.234,5');
    expect(texto).toContain('Pesca artesanal, Roça de subsistência');
  });
});
