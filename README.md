# Fitness & Health Test | CrossFit Viseu

Protótipo web responsivo baseado no ficheiro Excel `CROSSFIT VISEU — FITNESS & HEALTH TEST.xlsx`.

## Como abrir

Abra `index.html` no browser. A aplicação é estática e pode ser publicada no GitHub Pages.

## Acesso demo

- Admin: palavra-passe `cfviseu`
- Área do atleta: use um código gerado ou carregue o exemplo no painel Admin.

## Lógica importada do Excel

- Score total: `40% Health Index + 20% Força Relativa + 20% Endurance + 20% Metcon`
- Health Index: `60% CRI + 30% SORI + 10% FBI`
- Força Relativa: back squat `34%`, shoulder press `33%`, pull pattern `33%`
- Endurance: VO2 estimado por row 2000m ou row 6 minutos, com benchmarks por sexo e idade
- Metcon: total reps `rondas × 27 + reps`, com escalas RX, Intermediate e Beginner
- Curva Sickness-Wellness-Fitness: `0-39`, `40-69`, `70-100`

## Limitação importante

Este protótipo guarda dados em `localStorage`, ou seja, no browser. Para uso real com equipa e atletas, deve ser ligado a uma base de dados e autenticação.

Opções simples para produção:

- Supabase: autenticação, base de dados Postgres e permissões por atleta.
- Firebase: rápido para protótipos com login e dados em tempo real.
- Backend próprio: Node/Express ou Laravel com PostgreSQL.

## Estrutura de dados recomendada

- `users`: equipa/admin
- `athletes`: nome, sexo, idade, grupo, código individual
- `assessments`: atleta, data, notas do coach, scores calculados
- `assessment_results`: resultados por teste, valores brutos e derivados
- `reports`: snapshot opcional do relatório exportado

## Publicar no GitHub Pages

1. Criar um repositório no GitHub.
2. Enviar `index.html`, `styles.css`, `app.js` e `README.md`.
3. Em `Settings > Pages`, escolher a branch principal e a pasta raiz.
4. Abrir o URL gerado pelo GitHub Pages.
