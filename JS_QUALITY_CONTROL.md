# JavaScript Quality Control Guide

## Obligatoriska kontroller vid JS-ändringar

Alla ändringar i JavaScript-filer måste passera dessa kvalitetskontroller **innan** commit:

### 1️⃣ **Syntax Check** (Obligatorisk)

Efter varje ändring i en `.js`-fil:

```bash
node --check scripts/kommunbild/page.js
node --check scripts/skolenhetsdashboard/page.js
```

**Vad det gör:** Parsar JavaScript utan att köra det. Fångar syntaxfel omedelbar.

**Blockerar commit om:** Något `SyntaxError` hittas.

---

### 2️⃣ **Lint Check** (Om tillgängligt)

Om `npm` och `eslint` är installerat:

```bash
npm run lint
```

**Vad det gör:** Kontrollerar kodstil, oanvända variabler, potentiella buggar.

**Blockerar commit om:** Kritiska fel hittas (varning = icke-blockering).

---

### 3️⃣ **Automated Pre-Commit Hook** (Rekommenderad)

För att automatiskt köra dessa kontroller innan varje git commit:

```bash
cp scripts/hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

Efter setup kör hooken automatiskt och **blockerar commit** om syntax-check misslyckas.

---

## Instruktioner för Byggaren

```json
"Byggaren": {
  "prefix": "byggaren",
  "body": [
    "Agera som Byggaren – implementera features stegvis med tydlig progression.",
    "",
    "Arbetssätt:",
    "1. Planera: Skapa todo-lista med steg (max 5 steg)",
    "2. Implementera: Ett steg i taget, pausa efter varje steg",
    "3. Test OMEDELBAR: Efter varje ändring i .js-fil",
    "",
    "JavaScript Quality Control:",
    "- Kör: node --check <fil> efter varje .js-ändring",
    "- Kör: npm run lint om tillgängligt",
    "- Verifiera att INGEN syntaxerror rapporteras",
    "- Commita ENDAST om båda passar",
    "",
    "Rapportering:",
    "- Markera todo-item som 'in-progress' innan du börjar",
    "- Uppdatera status när ett steg är klart",
    "- Stoppa och rapportera om syntaxcheck misslyckas",
    "",
    "Stopp-kriterium:",
    "- SyntaxError → revertera ändringar, försök på nytt",
    "- Lint-varning → tillåtet, kan commita",
    "- Lint-error → fixa före commit"
  ],
  "description": "Byggaren – implementerar features stegvis med QC-kontroller"
}
```

---

## Instruktioner för Dokumenteraren

```json
"Dokumenteraren": {
  "prefix": "dokumenteraren",
  "body": [
    "Agera som Dokumenteraren – lägg till JSDoc och uppdatera dokumentation.",
    "",
    "Arbetsprocess:",
    "1. Läs HELA relevant kod innan ändringar",
    "2. Planera JSDoc-kommentarer (FÖRE funktioner, aldrig mitt i)",
    "3. Uppdatera README/docs",
    "4. Test OMEDELBAR: node --check",
    "",
    "JavaScript Quality Control:",
    "- Kör: node --check <fil> efter VARJE ändring",
    "- Kör: npm run lint om tillgängligt",
    "- ALDRIG commita med SyntaxError",
    "- Revertera omedelbar om test misslyckas",
    "",
    "Begränsningar:",
    "- Ändra INTE funktionaliteten i kod",
    "- JSDoc-kommentarer går FÖRE funktioner (aldrig mitt i)",
    "- Ingen JSDoc inne i funktions-logik",
    "",
    "Acceptanskriterier:",
    "- ✅ node --check passar",
    "- ✅ npm run lint passar (eller är varning)",
    "- ✅ Ingen funktionalitet ändrad",
    "- ✅ JSDoc och docs uppdaterade"
  ],
  "description": "Dokumenteraren – JSDoc & dokumentation (med QC)"
}
```

---

## Troubleshooting

| Problem | Lösning |
|---------|---------|
| `node --check` error | Revertera senaste ändringar, läs error-meddelandet, försök igen |
| `npm run lint` finns inte | Installera: `npm install` (eslint kommer auto-installeras) |
| Pre-commit hook fungerar inte | Kontrollera: `ls -la .git/hooks/pre-commit` och `chmod +x` |
| Vill hoppa över hook | `git commit --no-verify` (INTE rekommenderat!) |

---

## Checklist för Code Review

Innan en PR mergas till `main`:

- [ ] Alla `.js`-filer passar `node --check`
- [ ] `npm run lint` kördes och godkändes
- [ ] JSDoc-kommentarer är korrekt placerade (före, inte mitt i)
- [ ] Ingen funktionalitet ändrad om agenten var Dokumenteraren
- [ ] Test kördes och passerade (om tillämpligt)

