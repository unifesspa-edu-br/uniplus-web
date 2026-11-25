import { montarPagina as montarPaginaOriginal } from './tipos-ato.testing';

export * from './tipos-ato.testing';

export async function montarPagina(...argumentos: Parameters<typeof montarPaginaOriginal>) {
  const pagina = await montarPaginaOriginal(...argumentos);
  const abrirCadastro = pagina.abrirCadastro;
  pagina.abrirCadastro = async () => {
    await abrirCadastro();
    pagina.preencher('codigo', 'RESULTADO_PRELIMINAR_INSCRICAO');
    await pagina.propagar();
  };
  return pagina;
}
