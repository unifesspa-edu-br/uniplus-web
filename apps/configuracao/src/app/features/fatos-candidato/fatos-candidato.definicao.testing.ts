import { type FatoCandidatoDto } from '@uniplus/shared-data/configuracao';
import { type Pagina, problema, sucesso, urlDoFato } from './fatos-candidato.testing';
import { comDefinicao, comResolucao, corRaca } from './fatos-candidato.fixtures';

export const DEFINICAO = '#cfg-fato-definicao';
export const campo = (nome: string): string => `${DEFINICAO} [formcontrolname="${nome}"]`;
export const derivadoBooleano: FatoCandidatoDto = {
  ...comResolucao(
    comDefinicao(corRaca, {
      dominio: 'BOOLEANO',
      valores: { fonte: null, declarados: [] },
      protecao: {
        ...corRaca.definicao.protecao,
        classificacao: 'PESSOAL',
        hipoteseLegal: 'CUMPRIMENTO_OBRIGACAO_LEGAL',
      },
    }),
    { origem: 'DERIVADO', binding: 'REGRA_DERIVACAO:PERFIL' },
  ),
  codigo: 'PERFIL',
};
export const agregadoDeRenda: FatoCandidatoDto = {
  ...comResolucao(derivadoBooleano, { binding: 'AGREGACAO_GRUPO:RENDA' }),
  codigo: 'PERFIL_FAMILIAR',
};

export const recusa = (status: number, corpo: object) =>
  problema(status, { title: 'Problema', ...corpo });

/** Conduz o envio da definição como a pessoa faz, sobre a página que o teste montou. */
export class ConducaoDaDefinicao {
  constructor(private readonly pagina: () => Pagina) {}

  readonly enviar = async (): Promise<void> => {
    const p = this.pagina();
    p.submeter(DEFINICAO);
    await p.propagar();
  };

  readonly definir = (fato: FatoCandidatoDto) =>
    this.pagina().http.expectOne(
      (r) => r.method === 'PUT' && r.url === `${urlDoFato(fato)}/definicao`,
    );

  readonly entregar = async (
    fato: FatoCandidatoDto,
    pedido = this.definir(fato),
  ): Promise<void> => {
    pedido.flush(...sucesso());
    await this.pagina().recarregarOFato(fato);
  };
}
