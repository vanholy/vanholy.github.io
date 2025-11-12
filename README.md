# 🍺 Homebrewing Hub

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Active-brightgreen)](https://vanholy.github.io/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Made with Claude AI](https://img.shields.io/badge/Made%20with-Claude%20AI-blueviolet)](https://claude.ai)

**Homebrewing Hub** è una collezione completa di guide tecniche e strumenti interattivi per homebrewer e birrai artigianali italiani. Il sito offre database dettagliati, calcolatori avanzati e analisi approfondite per ogni aspetto della produzione birraria casalinga.

🔗 **[Visita il Sito](https://vanholy.github.io/)**

---

## 🌟 Caratteristiche Principali

### 🌿 Analisi Luppoli
- **115+ varietà di luppoli** con profili aromatici completi
- **Grafici radar interattivi** con modalità confronto sovrapposto
- Database ottimizzato per **Brewfather**
- Ricerca avanzata per stili birrari BJCP
- Dosaggi e tecniche di utilizzo (dry hopping, whirlpool, ecc.)
- Supporto **Cryo Hops** e varietà sperimentali

### 🌾 Analisi Malti
- **200+ varietà di malti** dai principali maltatori mondiali
  - Weyermann, Bestmalz, Simpson's, Dingemans, Briess, Château
- **Esploratore interattivo** con filtri avanzati
- **Recipe Builder** integrato
- Convertitori di unità (kg/lb, EBC/SRM, litri/galloni)
- Parametri tecnici completi (resa, colore, uso massimo)
- Guide d'uso per attrezzatura casalinga

### 💧 Analisi Acque
- **21 acque minerali italiane** analizzate per homebrewing
- **215 comuni bergamaschi** con parametri chimici completi (3.870 dati)
- Confronto acque locali vs supermercato
- Profili minerali con grafici radar
- Sistema di scoring per stili birrari
- Indicatori di conformità ai limiti di legge
- Tool comparativo side-by-side

### 🧽 Pulizia e Sanificazione
- Guida completa con sequenze operative
- Confronto prodotti economici vs professionali
- Calcolatori di costi e dosaggi
- Protocolli di sicurezza

### 📝 Ricette
- **15 ricette testate** ordinate per ABV (4.5-10.5%)
- Solo **lieviti secchi** e **alta fermentazione**
- Stili BJCP: Pale Ale, IPA, Stout, Porter, Belgian, ecc.
- Note tecniche avanzate
- Compatibilità Brewfather

---

## 🛠️ Tecnologie Utilizzate

- **HTML5** - Struttura semantica
- **CSS3** - Gradients, Flexbox, Grid, Animations
- **Vanilla JavaScript** - Zero dipendenze esterne
- **HTML5 Canvas API** - Visualizzazioni custom (radar charts)
- **GitHub Pages** - Hosting statico
- **Claude AI** - Assistenza sviluppo e automazione via GitHub Actions

---

## 📁 Struttura del Progetto

```
vanholy.github.io/
├── index.html                                      # Homepage principale
│
├── Strumenti Luppoli/
│   ├── hop-aroma-profiles-chart.html               # Grafici profili aromatici
│   ├── hop-radar-chart.html                        # Sistema radar avanzato (115+ varietà)
│   └── guida-luppoli.html                          # Guida completa luppoli
│
├── Strumenti Malti/
│   ├── malt-explorer.html                          # Database interattivo (200+ malti)
│   └── guida-malti.html                            # Guida tecnica malti
│
├── Strumenti Acque/
│   ├── acque-minerali-homebrewing-tabella.html     # 21 acque minerali italiane
│   ├── water_comparison_italian_supermarket.html   # Confronto Bergamo vs Italia
│   ├── profili_completi_12_acque.html              # Profili minerali radar
│   ├── confronto_completo_12_acque.html            # Comparatore interattivo
│   └── parametri-chimici-completi-bergamo.html     # 215 comuni bergamaschi
│
├── Guide/
│   ├── homebrewing_cleaning_website.html           # Pulizia e sanificazione
│   └── ricette-birra-html.html                     # 15 ricette testate
│
├── assets/
│   ├── 0.jpg - 4.jpg                               # Immagini birrarie
│   └── vaporwave_vr_background.png                 # Background hero
│
├── style.css                                        # Stili condivisi base
├── sitemap.xml                                      # Sitemap SEO
├── robots.txt                                       # Direttive crawler
├── parametri_bg.csv                                 # Dati acque Bergamo
│
├── .github/workflows/claude.yml                     # GitHub Actions automazione
└── README.md                                        # Questo file
```

---

## 🚀 Come Usare il Sito

### Navigazione Rapida
1. Visita [vanholy.github.io](https://vanholy.github.io/)
2. Scegli la categoria (Luppoli, Malti, Acque, Pulizia, Ricette)
3. Clicca su "🔗 Apri" per aprire lo strumento in una nuova finestra
4. Oppure espandi la sezione con il pulsante ▼ per visualizzare inline

### Ricerca e Filtri
Ogni strumento offre:
- 🔍 **Ricerca testuale** per nome ingrediente/località
- 🏷️ **Filtri per categoria** (stile birrario, maltatore, tipo acqua)
- 📊 **Ordinamento** per parametri tecnici (IBU, EBC, ABV, ecc.)
- ⚖️ **Modalità confronto** per comparazioni dirette

### Integrazione Brewfather
- Tutti i parametri sono compatibili con Brewfather
- Copia/incolla diretto dei valori tecnici
- Nomenclatura standardizzata
- Note d'uso per ogni ingrediente

---

## 💡 Utilizzo Consigliato

### Per Principianti
1. Inizia dalle **Ricette** → scegli uno stile semplice
2. Leggi la **Guida Luppoli** e **Guida Malti** per capire gli ingredienti
3. Usa la tabella **Acque Minerali** per scegliere l'acqua adatta
4. Segui la guida **Pulizia e Sanificazione** per l'igiene

### Per Esperti
1. Usa il **Malt Explorer** per progettare ricette custom
2. Confronta profili aromatici con i **Radar Chart Luppoli**
3. Ottimizza il profilo acqua con i **Parametri Chimici Bergamo**
4. Esporta i dati per Brewfather

---

## 🤝 Contribuire

I contributi sono benvenuti! Per contribuire:

1. **Fork** il repository
2. Crea un **branch** per la tua feature (`git checkout -b feature/NuovaFeature`)
3. **Commit** le modifiche (`git commit -m 'Aggiunta NuovaFeature'`)
4. **Push** al branch (`git push origin feature/NuovaFeature`)
5. Apri una **Pull Request**

### Aree di Miglioramento
- [ ] Aggiungere più ricette testate
- [ ] Espandere database luppoli con nuove varietà 2025
- [ ] Integrare calcolatore IBU/ABV automatico
- [ ] Aggiungere grafici pH e temperatura mashing
- [ ] Supporto multilingua (EN/DE/FR)
- [ ] Dark mode toggle
- [ ] PWA con cache offline
- [ ] Ottimizzazione immagini (WebP/AVIF)

---

## 📊 Statistiche del Progetto

- **115+ varietà di luppoli** documentate
- **200+ varietà di malti** dai principali maltatori
- **21 acque minerali** italiane analizzate
- **215 comuni bergamaschi** con dati chimici completi
- **15 ricette** testate e ottimizzate
- **14 strumenti interattivi** completi
- **3.870+ dati** totali sulle acque

---

## 📜 Licenza

Questo progetto è distribuito sotto licenza **MIT**. Vedi il file [LICENSE](LICENSE) per maggiori dettagli.

I dati sulle acque provengono da fonti pubbliche ufficiali. I database di luppoli e malti sono compilazioni di informazioni tecniche pubblicamente disponibili dai produttori.

---

## 📧 Contatti

- **Autore**: Vanholy
- **Email**: [higgorjjanimal@yahoo.it](mailto:higgorjjanimal@yahoo.it)
- **GitHub**: [@vanholy](https://github.com/vanholy)
- **Sito**: [vanholy.github.io](https://vanholy.github.io/)

---

## 🙏 Ringraziamenti

- **Claude AI** per l'assistenza nello sviluppo
- **Comunità Homebrewing Italiana** per i feedback
- **Maltatori e Produttori di Luppoli** per le schede tecniche
- **Uniacque Bergamo** per i dati pubblici sulle acque

---

## 🔄 Aggiornamenti

- **2025-01** - Aggiunta SEO completa, sitemap, robots.txt
- **2024-12** - Rilascio collezione 15 ricette testate
- **2024-11** - Integrazione parametri chimici 215 comuni Bergamo
- **2024-10** - Lancio database 200+ malti con Malt Explorer
- **2024-09** - Prima release con 115+ luppoli e strumenti acque

---

<p align="center">
  🍺 <strong>Fatto con passione per la birra artigianale</strong> 🍺
  <br>
  <em>Dalla teoria alla pratica - Per homebrewer appassionati</em>
</p>
