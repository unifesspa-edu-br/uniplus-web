import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture } from '@angular/core/testing';
import {
  ConsequenciaDoDescumprimentoCodigo,
  OperadorCodigo,
  type FatoDoCatalogoDto,
  type ModeloFormularioView,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ModeloFormularioEdicaoPage } from './modelo-formulario-edicao.page';
import {
  AcoesDaTela,
  consequenciaGravada,
  esperarIndeferimento,
  idDoDocumento,
  laudoComIndeferimento,
  LAUDO,
  modeloComDocumentos,
  PREFIXO,
} from './modelo-formulario-edicao.page.documentos-exigidos.testing';
import {
  FASES,
  fato,
  modelo,
  montarTelaDeEdicao,
  responderCarga,
} from './modelo-formulario-edicao.page.testing';
import {
  CONSEQUENCIAS_DO_DESCUMPRIMENTO,
  DADO_OPCAO,
  FONTE_MUNICIPIOS,
} from './vocabulario-do-modelo.testing';

const { ELIMINA_DO_PROCESSO, RETIRA_A_MODALIDADE, RETIRA_O_ACRESCIMO } =
  ConsequenciaDoDescumprimentoCodigo;
const SEM_CONSEQUENCIA = { codigo: '', rotulo: 'Sem consequência definida' };
const GESTANTE = [[{ fato: 'GESTANTE', operador: OperadorCodigo.IGUAL, valor: true }]];

describe('ModeloFormularioEdicaoPage', () => {
  let fixture: ComponentFixture<ModeloFormularioEdicaoPage>;
  let controller: HttpTestingController;

  beforeEach(() => {
    ({ fixture, controller } = montarTelaDeEdicao());
  });

  afterEach(() => controller.verify());

  const acoes = (): AcoesDaTela => new AcoesDaTela(fixture, controller);

  async function carregar(
    doModelo: ModeloFormularioView = modelo,
    fatosExtras: readonly FatoDoCatalogoDto[] = [],
  ): Promise<HTMLElement> {
    responderCarga(controller, { modelo: doModelo, fatosExtras, fases: FASES, falhando: [] });
    return acoes().propagar();
  }

  it('mostra o conjunto padrão e grava a troca do tipo, o documento incluído e sem o removido', async () => {
    const tela = await carregar();
    expect(tela.textContent).toContain('Documentos exigidos (padrão)');
    expect(tela.textContent).toContain('só para processos aos quais o modelo for aplicado depois');
    await acoes().escolher(idDoDocumento(0, 'tipo'), 'ATESTADO');
    await acoes().clicar(idDoDocumento(1, 'remover'));
    await acoes().clicar(`${PREFIXO}-acrescentar`);

    const { documentosExigidos } = await acoes().gravar();

    expect(documentosExigidos).toHaveLength(2);
    const [atestado, novo] = documentosExigidos;
    expect(atestado).toMatchObject({ tipoDocumentoCodigo: 'ATESTADO', quando: LAUDO.quando });
    expect(novo).toMatchObject({ faseCodigo: 'INSCRICAO', quando: null });
  });

  it('marca junto da condição o dado do candidato que o modelo não coleta, antes de enviar', async () => {
    const tela = await carregar(modeloComDocumentos([{ ...LAUDO, quando: GESTANTE }]));

    const documento = tela.querySelector(`[aria-labelledby="${idDoDocumento(0, 'titulo')}"]`);
    expect(documento?.textContent).toContain('o modelo não coleta este dado do candidato');
  });

  it('mantém o mesmo campo ao editar o documento, para o foco do teclado não se perder', async () => {
    const tela = await carregar();
    const antes = tela.querySelector(`#${idDoDocumento(0, 'base-0-ref')}`) as HTMLInputElement;

    antes.value = 'Lei 14.723/2023';
    antes.dispatchEvent(new Event('change'));
    await acoes().propagar();

    expect(tela.querySelector(`#${idDoDocumento(0, 'base-0-ref')}`)).toBe(antes);
  });

  it('oferece o prazo para reenvio só em fase que admite complementação', async () => {
    const tela = await carregar();
    expect(tela.querySelector(`#${idDoDocumento(0, 'prazo-reenvio')}`)).not.toBeNull();

    await acoes().escolher(idDoDocumento(0, 'fase'), 'HOMOLOGACAO_INSCRICOES');

    expect(tela.querySelector(`#${idDoDocumento(0, 'prazo-reenvio')}`)).toBeNull();
  });

  it('desfaz o prazo para reenvio ao trocar para fase que não admite complementação', async () => {
    await carregar();
    await acoes().escolher(idDoDocumento(1, 'fase'), 'HOMOLOGACAO_INSCRICOES');

    const { documentosExigidos } = await acoes().gravar();

    expect(documentosExigidos[1]).toMatchObject({ faseCodigo: 'HOMOLOGACAO_INSCRICOES' });
    esperarIndeferimento(documentosExigidos[1], { abrePrazoParaReenvio: false });
  });

  it('oferece o fato de município que a condição do documento cita', async () => {
    const municipio = [
      [{ fato: 'MUNICIPIO', operador: OperadorCodigo.ALGUM_DE, valor: ['1500000'] }],
    ];
    const extra = {
      fato: { ...fato('MUNICIPIO').fato, dominio: DADO_OPCAO, fonteValores: FONTE_MUNICIPIOS },
      operadoresAdmitidos: [{ codigo: OperadorCodigo.ALGUM_DE, rotulo: 'é um de' }],
    };

    const tela = await carregar(modeloComDocumentos([{ ...LAUDO, quando: municipio }]), [extra]);

    const documento = tela.querySelector(`[aria-labelledby="${idDoDocumento(0, 'titulo')}"]`);
    expect(documento?.textContent).not.toContain('fora do catálogo');
  });

  it('oferece as consequências da API com o rótulo dela, sem o reenvio, e a opção de nenhuma', async () => {
    await carregar();

    const opcoes = acoes().opcoesDe(idDoDocumento(0, 'consequencia'));

    expect(opcoes).toEqual([SEM_CONSEQUENCIA, ...CONSEQUENCIAS_DO_DESCUMPRIMENTO]);
  });

  it('mostra a consequência e a escolha de prazo que o modelo gravado traz', async () => {
    const tela = await carregar();

    expect(acoes().consequenciaMostrada(0)).toBe(`${ELIMINA_DO_PROCESSO}|Eliminação do processo`);
    expect(acoes().consequenciaMostrada(1)).toBe('|Sem consequência definida');
    const prazos = tela.querySelectorAll<HTMLInputElement>('[id$="-prazo-reenvio"]');
    expect(Array.from(prazos).map((campo) => campo.checked)).toEqual([false, true]);
  });

  it('grava a consequência escolhida e o prazo para reenvio marcado na chave do contrato', async () => {
    await carregar();
    await acoes().escolher(idDoDocumento(0, 'consequencia'), RETIRA_O_ACRESCIMO);
    await acoes().marcar(idDoDocumento(0, 'prazo-reenvio'), true);

    const { documentosExigidos } = await acoes().gravar();

    esperarIndeferimento(documentosExigidos[0], {
      obrigatorio: true,
      consequenciaDoDescumprimento: RETIRA_O_ACRESCIMO,
      abrePrazoParaReenvio: true,
    });
    expect(documentosExigidos[0].indeferimento).not.toHaveProperty('consequencia');
    expect(acoes().consequenciaMostrada(0)).toBe(`${RETIRA_O_ACRESCIMO}|Retirada do acréscimo`);
    expect(acoes().campo<HTMLInputElement>(idDoDocumento(0, 'prazo-reenvio')).checked).toBe(true);
  });

  it('lê a consequência nula como "Sem consequência definida" e a grava nula', async () => {
    await carregar(modeloComDocumentos([laudoComIndeferimento(consequenciaGravada(null))]));

    expect(acoes().consequenciaMostrada(0)).toBe('|Sem consequência definida');
    const { documentosExigidos } = await acoes().gravar();

    esperarIndeferimento(documentosExigidos[0], { consequenciaDoDescumprimento: null });
  });

  it('volta a nenhuma consequência quando a pessoa escolhe "Sem consequência definida"', async () => {
    await carregar();
    await acoes().escolher(idDoDocumento(0, 'consequencia'), '');

    const { documentosExigidos } = await acoes().gravar();

    esperarIndeferimento(documentosExigidos[0], { consequenciaDoDescumprimento: null });
  });

  it('declara que o documento novo não abre prazo para reenvio e envia a escolha explícita', async () => {
    const tela = await carregar();
    await acoes().clicar(`${PREFIXO}-acrescentar`);

    expect(acoes().campo<HTMLInputElement>(idDoDocumento(2, 'prazo-reenvio')).checked).toBe(false);
    expect(tela.textContent).toContain('Não abre prazo para reenvio.');
    const { documentosExigidos } = await acoes().gravar();

    esperarIndeferimento(documentosExigidos[2], {
      obrigatorio: true,
      consequenciaDoDescumprimento: null,
      abrePrazoParaReenvio: false,
    });
  });

  it('leva ao grupo de documentos a consequência e o prazo para reenvio que ele trazia', async () => {
    const indeferimento = {
      consequenciaDoDescumprimento: RETIRA_A_MODALIDADE,
      basesLegais: [],
      abrePrazoParaReenvio: true,
    };
    await carregar(
      modeloComDocumentos([LAUDO], [{ quantidadeMinima: 1, indeferimento, documentos: [LAUDO] }]),
    );

    const { gruposDeDocumentos } = await acoes().gravar();
    const { gruposDeDocumentos: relido } = await acoes().gravar();

    expect(gruposDeDocumentos[0].indeferimento).toEqual(indeferimento);
    expect(relido[0].indeferimento).toEqual(indeferimento);
  });
});
