# Revisão de design — Site Promessa Lago dos Peixes

Você fez o design original deste site (handoff "Redesign Site Promessa LP"). Ele foi implementado, publicado e depois evoluiu bastante com uso real. Quero que você **revise o site como está hoje no ar** e aponte melhorias de design.

## Onde ver
- **Site no ar:** https://promessalagodospeixes.com.br (página única com rolagem — decisão final do cliente, não propor multi-páginas)
- Veja também no celular (maioria do público acessa por lá).

## O que mudou desde o seu handoff
1. **Página única** com âncoras (o cliente testou multi-páginas e preferiu rolagem).
2. **Capa em carrossel** com fotos reais e controle de enquadramento (Topo/Centro/Base).
3. **Galeria "Nossa gente"**: 1 foto grande em destaque + trilha de miniaturas com setas; a grande acompanha a navegação; clique amplia (lightbox).
4. **Mensagens/pregações**: viraram trilha horizontal estilo reels (cards 9/16 com capa do Instagram), sem botão "Ver todas" (só volta quando houver canal do YouTube).
5. **Ministérios**: também em trilha horizontal com setas (10+ cards).
6. **Seção nova "Conheça nossa agenda"**: eventos futuros vêm do sistema de gestão; card com foto de capa OU card claro com logo da igreja + data + ministério.
7. **Células**: cards com Quando/Onde/Líder/Anfitrião; sem formulário de cadastro (só WhatsApp).
8. **Participe**: 2 abas (Quero servir · Pedido de oração) com envio real de e-mail.
9. **Família pastoral**: seção "Conheça nossa família Pastoral" com carrossel de fotos.
10. **Rodapé**: Instagram, Facebook, YouTube TV Viva Promessa, Promessistas Brasil.
11. Card azul do Quem Somos virou "1 + 1 = 150" (visão de discipulado).

## Regras invioláveis (não propor mudanças nisso)
- **Todo o conteúdo é editável pelo pastor** num painel de gestão (textos, fotos, listas). Propostas de design não podem depender de conteúdo fixo no código.
- Página única com rolagem (sem rotas).
- Em nenhum lugar aparece "Igreja Adventista da Promessa" — apenas **Promessa Lago dos Peixes**.
- Sem custo: nada de fontes pagas, serviços pagos ou bibliotecas pesadas.
- Manter React + Vite + CSS puro (sem Tailwind/framework novo).
- Formulários enviam para /api/participe (não mexer).

## O que quero de você
1. **Auditoria visual** do site no ar: hierarquia, espaçamentos, consistência entre as novas trilhas horizontais (reels, mensagens, ministérios, eventos, miniaturas), estados vazios, contraste.
2. **Mobile primeiro**: apontar tudo que estiver desconfortável em tela de celular (390px).
3. Sugestões objetivas, priorizadas (alto/médio/baixo impacto), descrevendo o ajuste de CSS/layout — sem reescrever o site.
4. Se quiser propor algo maior, entregar como especificação (tokens/medidas/textos), não como código pronto.

Entregue a revisão como um documento único (pode ser markdown), organizado por seção do site.
