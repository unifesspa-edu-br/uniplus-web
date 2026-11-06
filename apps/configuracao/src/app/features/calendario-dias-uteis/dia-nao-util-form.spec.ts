import { describe, expect, it } from 'vitest';
import {
  aplicarAbrangencia,
  aplicarErroNoDia,
  comandoDoDiaNaoUtil,
  criarGrupoDeDiaNaoUtil,
  errosDoDia,
  gravarOpcaoEscolhida,
  indiceDoDiaNoServidor,
  municipioSelecionadoDe,
  type GrupoDoDia,
} from './dia-nao-util-form';

const MARABA = { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' };

function diaMunicipalEscolhido(): GrupoDoDia {
  const grupo = criarGrupoDeDiaNaoUtil();
  grupo.controls.abrangencia.setValue('MUNICIPAL');
  aplicarAbrangencia(grupo);
  grupo.controls.codigoMunicipio.setValue(MARABA.codigoIbge);
  gravarOpcaoEscolhida(grupo, MARABA);
  grupo.controls.data.setValue('2026-04-05');
  grupo.controls.descricao.setValue('Aniversário de Marabá');
  return grupo;
}

describe('dia não útil — formulário', () => {
  it('nasce estadual, no Pará e sem município escolhido', () => {
    const grupo = criarGrupoDeDiaNaoUtil();

    expect(grupo.controls.abrangencia.value).toBe('ESTADUAL');
    expect(grupo.controls.uf.value).toBe('PA');
    expect(municipioSelecionadoDe(grupo)).toBeNull();
  });

  it('a abrangência municipal começa sem nenhum município, nem o de uma constante', () => {
    const grupo = criarGrupoDeDiaNaoUtil();
    grupo.controls.abrangencia.setValue('MUNICIPAL');
    aplicarAbrangencia(grupo);

    expect(grupo.controls.codigoMunicipio.value).toBe('');
    expect(grupo.controls.municipioNome.value).toBeNull();
    expect(grupo.controls.municipioUf.value).toBeNull();
    expect(grupo.controls.buscaMunicipio.value).toBe('');
    expect(grupo.errors?.['snapshotMunicipal']).toBe(true);
  });

  it('mudar para nacional descarta o snapshot inteiro, a UF e a busca, e as regras da região', () => {
    const grupo = diaMunicipalEscolhido();
    expect(grupo.errors).toBeNull();

    grupo.controls.abrangencia.setValue('NACIONAL');
    aplicarAbrangencia(grupo);

    expect(grupo.controls.codigoMunicipio.value).toBe('');
    expect(grupo.controls.municipioNome.value).toBeNull();
    expect(grupo.controls.municipioUf.value).toBeNull();
    expect(grupo.controls.uf.value).toBe('');
    expect(grupo.controls.buscaMunicipio.value).toBe('');
    expect(grupo.controls.codigoMunicipio.validator).toBeNull();
    expect(grupo.controls.uf.validator).toBeNull();
    expect(grupo.errors).toBeNull();
  });

  it('recusa o snapshot cuja UF não corresponde ao prefixo do código IBGE', () => {
    const grupo = diaMunicipalEscolhido();

    grupo.controls.municipioUf.setValue('SP');

    expect(grupo.errors?.['snapshotMunicipal']).toBe(true);
  });

  it('o dia municipal sem escolha da Geo mostra o aviso do município, mas só depois de tocado', () => {
    const grupo = criarGrupoDeDiaNaoUtil();
    grupo.controls.abrangencia.setValue('MUNICIPAL');
    aplicarAbrangencia(grupo);

    expect(errosDoDia(grupo, false).codigoMunicipio).toBeNull();
    grupo.controls.codigoMunicipio.markAsTouched();
    expect(errosDoDia(grupo, false).codigoMunicipio).toBe('Selecione um município na busca.');
  });

  it('a duplicidade vence o erro de obrigatoriedade na data', () => {
    const grupo = criarGrupoDeDiaNaoUtil();
    grupo.controls.data.markAsTouched();

    expect(errosDoDia(grupo, false).data).toBe('Campo obrigatório.');
    expect(errosDoDia(grupo, true).data).toBe(
      'Esta data está duplicada para a mesma abrangência e região.',
    );
  });

  it('bloqueia a descrição composta só por espaços', () => {
    const grupo = criarGrupoDeDiaNaoUtil();
    grupo.controls.descricao.setValue('   ');

    expect(grupo.controls.descricao.errors?.['required']).toBe(true);
  });

  it('envia o snapshot completo no dia municipal e a UF nula', () => {
    expect(comandoDoDiaNaoUtil(diaMunicipalEscolhido())).toEqual({
      abrangencia: 'MUNICIPAL',
      data: '2026-04-05',
      uf: null,
      municipioIbge: '1504208',
      municipioNome: 'Marabá',
      municipioUf: 'PA',
      descricao: 'Aniversário de Marabá',
    });
  });

  it('envia nulos nos campos regionais que a abrangência não usa', () => {
    const grupo = criarGrupoDeDiaNaoUtil();
    grupo.controls.abrangencia.setValue('NACIONAL');
    aplicarAbrangencia(grupo);
    grupo.controls.data.setValue('2026-09-07');
    grupo.controls.descricao.setValue('  Independência  ');

    expect(comandoDoDiaNaoUtil(grupo)).toEqual({
      abrangencia: 'NACIONAL',
      data: '2026-09-07',
      uf: null,
      municipioIbge: null,
      municipioNome: null,
      municipioUf: null,
      descricao: 'Independência',
    });
  });

  it('envia a UF só no dia estadual', () => {
    const grupo = criarGrupoDeDiaNaoUtil();
    grupo.controls.data.setValue('2026-08-15');

    expect(comandoDoDiaNaoUtil(grupo).uf).toBe('PA');
  });
});

describe('dia não útil — recusas do servidor', () => {
  const recusa = (field: string) => ({
    field,
    code: 'uniplus.configuracao.calendario_dias_uteis.descricao_obrigatoria',
    message: 'Recusado.',
  });

  it('aponta o campo que o servidor recusou, qualquer que seja a posição do dia no comando', () => {
    const grupo = criarGrupoDeDiaNaoUtil();

    expect(aplicarErroNoDia(grupo, recusa('DiasNaoUteis[2].Descricao'))).toBe(true);

    expect(grupo.controls.descricao.errors?.['backend']).toMatchObject({ message: 'Recusado.' });
    expect(grupo.controls.descricao.touched).toBe(true);
  });

  it.each(['municipioIbge', 'municipioNome', 'municipioUf'])(
    'a recusa de %s cai no campo Município, o único que a pessoa corrige',
    (campo) => {
      const grupo = criarGrupoDeDiaNaoUtil();

      expect(aplicarErroNoDia(grupo, recusa(`diasNaoUteis[0].${campo}`))).toBe(true);

      expect(grupo.controls.codigoMunicipio.errors?.['backend']).toBeDefined();
    },
  );

  it('não aponta nada quando o campo não existe na tela', () => {
    expect(aplicarErroNoDia(criarGrupoDeDiaNaoUtil(), recusa('diasNaoUteis'))).toBe(false);
  });

  it('lê a posição do dia no nome do campo', () => {
    expect(indiceDoDiaNoServidor('diasNaoUteis[3].data')).toBe(3);
    expect(indiceDoDiaNoServidor('versaoDataset')).toBeNull();
  });
});
