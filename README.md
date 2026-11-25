# Colher de Prosa

Portal de receitas brasileiras: 90 receitas em 9 categorias, 86 com foto, feito para usar no celular, na cozinha.

## Recursos

- **Porções que se ajustam:** as quantidades (e os pesos entre parênteses) são recalculadas para o número de pessoas.
- **Modo cozinhar:** um passo por vez, letras grandes e timers.
- **O que tem na geladeira?** Busca de receitas pelos ingredientes que a pessoa tem.
- **Salvar no WhatsApp:** a receita completa vai para a conversa da própria pessoa.
- **Favoritas, busca ao vivo, impressão e compartilhamento.**
- **Coleções automáticas:** prontas em até 30 min, vegetarianas, sem forno, boas para congelar, para receber.
- **Sem cadastro e sem servidor:** nenhum dado pessoal sai do navegador de quem visita.
- **Pronto para buscadores:** cada receita e categoria tem uma página própria com título, descrição, imagem de compartilhamento e dados estruturados de receita (schema.org/Recipe), além de `sitemap.xml` e `robots.txt`.

## Tecnologia

HTML, CSS e JavaScript puros, sem frameworks e sem etapa de build obrigatória. Roda em qualquer hospedagem estática (GitHub Pages, Netlify, Vercel, Cloudflare Pages, uma hospedagem comum).

```
index.html            página principal (aplicação de página única)
app.js                rotas, telas e recursos
styles.css            visual completo, responsivo
data/*.js             receitas, uma categoria por arquivo
data/fotos.js         fotos e créditos
assets/fotos/         imagens das receitas
scripts/gerar-paginas.js   gera as páginas estáticas, sitemap e robots
receitas/ categorias/ sobre/ privacidade/ creditos/ 404.html   páginas geradas (não editar à mão)
```

## Publicar

1. Envie a pasta inteira para a hospedagem. No GitHub Pages: Settings → Pages → *Deploy from a branch* → `main` / raiz.
2. Gere as páginas com o endereço definitivo do site:

```bash
SITE_URL=https://www.seudominio.com.br/ node scripts/gerar-paginas.js
```

3. Cadastre o `sitemap.xml` no Google Search Console.

## Adicionar ou editar uma receita

1. Abra o arquivo da categoria em `data/` (por exemplo, `data/doces.js`) e copie uma receita existente como modelo. O `id` vira o endereço (`/receitas/<id>/`) e deve ser único.
2. Para a foto, coloque a imagem em `assets/fotos/` e registre em `data/fotos.js` com autor e licença.
3. Rode `node scripts/gerar-paginas.js` de novo (precisa do Node.js 18 ou mais novo).

## Fotos

As fotos atuais vêm do Wikimedia Commons, sob licenças livres que permitem uso comercial desde que os créditos sejam mantidos. O site exibe os créditos na legenda de cada foto e na página "Créditos das fotos". Ao trocar por fotos próprias, basta substituir o arquivo e o registro em `data/fotos.js`.
