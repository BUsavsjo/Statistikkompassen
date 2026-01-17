# UI & CSS Styling Guide

## Överblick

För att säkerställa **konsekvent styling** över alla sidor i Statistikkompassen använder vi nu ett enhetligt designsystem baserat på:

1. **Globalt tema** (`styles/theme.css`) - Centraliserade CSS-variabler och komponenter
2. **Sidspecifika stilar** - Kompletterande stilar för specifika funktioner
3. **CSS-variabler** - Enhetliga färger, typografi och storlekar

---

## CSS-filstruktur

### 1. `styles/theme.css` (Obligatorisk)
**Den nya huvudfilen** som definierar det globala temat.

Innehåller:
- CSS-variabler (`:root`)
- Reset och bas-styling
- Typografi (h1-h6, p)
- Knappar (`.btn-primary`, `.btn-secondary`, `.btn-neutral`)
- Formulär och inmatning
- Kort och behållare
- Grid-system
- Status-indikatorer
- Navigering
- Notifikationer
- Tabeller
- Animationer

**Måste inkluderas först** i alla HTML-filer:
```html
<link rel="stylesheet" href="styles/theme.css">
```

### 2. `styles/main.css`
Startsidans specifika styling. Använder nu CSS-variabler från `theme.css`.

### 3. `styles/betygkolada.css`
Styling för betyg- och förskole-sidorna. Redan kompatibel med tema-systemet.

### 4. `styles/skolenhetsdashboard.css`
Dashboard-specifika stilar för KPI-kort, grider och komponenter.

### 5. `styles/executive-summary.css`
Stilar för sammanfattningar och rapporter.

---

## CSS-variabler (Design Tokens)

### Färger
```css
--primary: #2563eb          /* Primär blå */
--primary-dark: #1e3a8a     /* Mörk blå */
--primary-light: #dbeafe    /* Ljus blå */
--secondary: #f2c811        /* Gul/guld */
--success: #10b981          /* Grön */
--warning: #f59e0b          /* Orange */
--danger: #ef4444           /* Röd */
```

### Bakgrunder
```css
--bg-app: #f5f7fb           /* App-bakgrund */
--bg-surface: #ffffff       /* Kort/ytor */
--bg-muted: #f8fafc         /* Dämpad bakgrund */
```

### Text
```css
--text-primary: #0f172a     /* Huvudtext */
--text-secondary: #475569   /* Sekundär text */
--text-tertiary: #94a3b8    /* Tertial text */
```

### Typografi
```css
--font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif
--font-mono: 'Monaco', 'Courier New', monospace
```

### Storlekar
```css
--radius-sm: 6px
--radius-md: 12px
--radius-lg: 14px
--radius-xl: 16px
```

### Skuggor
```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05)
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07)
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1)
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15)
```

### Övergångar
```css
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-normal: 250ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-slow: 350ms cubic-bezier(0.4, 0, 0.2, 1)
```

---

## Komponenter

### Knappar
```html
<!-- Primär knapp -->
<button class="btn-primary">Primär knapp</button>

<!-- Sekundär knapp -->
<button class="btn-secondary">Sekundär knapp</button>

<!-- Neutral knapp -->
<button class="btn-neutral">Neutral knapp</button>

<!-- Små/stora varianter -->
<button class="btn-primary btn-small">Liten knapp</button>
<button class="btn-primary btn-large">Stor knapp</button>
```

### Kort
```html
<div class="card">
  <div class="card-header">
    <h3>Kort-titel</h3>
  </div>
  <div class="card-body">
    <p>Innehål här...</p>
  </div>
  <div class="card-footer">
    <button class="btn-primary">Åtgärd</button>
  </div>
</div>
```

### Grid-system
```html
<!-- 2 kolumner -->
<div class="grid grid-2">
  <div class="card">...</div>
  <div class="card">...</div>
</div>

<!-- 3 kolumner -->
<div class="grid grid-3">
  <div class="card">...</div>
  <div class="card">...</div>
  <div class="card">...</div>
</div>

<!-- 4-6 kolumner -->
<div class="grid grid-4">...</div>
<div class="grid grid-6">...</div>
```

### Aviseringar
```html
<div class="alert alert-success">Framgång!</div>
<div class="alert alert-warning">Varning</div>
<div class="alert alert-danger">Fel</div>
<div class="alert alert-info">Info</div>
```

### Status-indikatorer
```html
<span class="status-badge status-success">✓ Aktiv</span>
<span class="status-badge status-warning">⚠ Väntar</span>
<span class="status-badge status-danger">✗ Inaktiv</span>

<!-- Trender -->
<span class="trend trend-up">↑ Förbättring</span>
<span class="trend trend-down">↓ Försämring</span>
<span class="trend trend-stable">→ Stabil</span>
```

### Sektion
```html
<div class="section">
  <div class="section-header">
    <h2>Sektion-titel</h2>
    <p class="section-description">Beskrivning...</p>
  </div>
  <!-- Innehål här -->
</div>
```

---

## HTML-filernas struktur

### Alla HTML-filer ska ha:

```html
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sidan</title>
  
  <!-- 1. Global tema (måste vara först!) -->
  <link rel="stylesheet" href="styles/theme.css">
  
  <!-- 2. Sidspecifika stilar (valfritt) -->
  <link rel="stylesheet" href="styles/main.css">
</head>
<body>
  <!-- Innehål här -->
</body>
</html>
```

---

## Uppdaterade HTML-filer

Följande filer har uppdaterats för att använda det enhetliga tema-systemet:

- ✅ `index.html` - Startsida
- ✅ `betygkolada.html` - Betyg (Grundskola)
- ✅ `forskola.html` - Förskola
- ✅ `skolenhetsdashboard.html` - Skolenheter
- ✅ `skolenhetsdashboard kommun.html` - Kommunbild

---

## Responsiv design

Temat inkluderar redan responsiv design:

- **Desktop** (>768px): Grid med flera kolumner
- **Tablet** (768px): 1 kolumn, optimerad
- **Mobil** (<480px): Full-width, optimerad text-storlek

Använd dessa media queries om du behöver anpassa:
```css
@media (max-width: 768px) {
  /* Tablet & mobil */
}

@media (max-width: 480px) {
  /* Endast mobil */
}
```

---

## Best practices

### ✅ Gör detta:
1. Använd CSS-variabler (`--primary`, `--shadow-lg`, osv.)
2. Använd fördefinierade klasser (`.btn-primary`, `.grid grid-3`, osv.)
3. Inkludera `theme.css` först i alla HTML-filer
4. Använd semantisk HTML (`.section`, `.card`, `.card-header`, osv.)
5. Testa på mobil (använd browser dev-tools)

### ❌ Undvik detta:
1. Hårdkodade färger (`#2563eb` → använd `var(--primary)`)
2. Inline styles (`style="color: red"` → använd klasser)
3. Anpassade skuggor (`box-shadow: 0 10px 30px rgba(...)` → använd `var(--shadow-lg)`)
4. Olika klassnamn för samma sak (använd enhetliga namn)

---

## Exempel på uppdatering

### Innan (inkonsekventa stilar):
```html
<button style="background: #2563eb; padding: 10px 20px; border-radius: 5px;">
  Knapp
</button>
```

### Efter (konsekvent):
```html
<button class="btn-primary">Knapp</button>
```

---

## Felsökning

### Problem: Stilarna ser inte ut rätt
**Lösning:** Kontrollera att `theme.css` är inkluderad innan andra CSS-filer.

### Problem: Färgerna är olika på olika sidor
**Lösning:** Använd CSS-variablerna från `theme.css` istället för hårdkodade värden.

### Problem: Responsiviteten fungerar inte
**Lösning:** Kontrollera att `<meta name="viewport">` är inkluderad.

---

## Support för framtida uppdateringar

Om du behöver uppdatera temat:

1. Redigera endast `styles/theme.css`
2. Alla ändringar speglas automatiskt på alla sidor
3. Inga HTML-filer behöver uppdateras (så länge klassnamnen inte ändras)

---

**Skapad:** 2025-12-19
**Version:** 1.0
**Ansvarig:** Design System Team
