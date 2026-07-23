# Rádio — procesní logická mapa

Cíl: věrná vysílačka (pásmo, dosah, scan, šifra, receivery) napojená na staničník a mise.

**Principy**

- Frekvence = fyzika (nosná vlna, příjem)
- Heslo = čitelnost (F3 = skutečná šifra; teď cizí heslo = šum)
- Vzdálenost = filtr dosahu
- Receiver / Repeater = buff dosahu
- Staničník = živý log (hráči + mise)

---

## Ovládání a ladění (UHF 400–470 MHz)

**Rozsah:** 70 MHz (400–470 MHz)  
**Krok ladění:** 0.025 MHz  
Implementace: `radioBand.js`

Dva režimy:

1. **Presetové kolečko** — PRE / VOL+ / −+ / swipe displeje (~15–20 pozic)
2. **Přímý zápis** — MD → frekvence → numerická klávesnice → ENT

### Dosah (`radioPropagation.js`)

| Vzdálenost | Stav | Staničník |
|------------|------|-----------|
| ≤ 5 km | clear | plný plaintext |
| > 5 … ≤ 15 km | weak | ořezaný text |
| > 15 … ≤ 50 km | noise | jen šum (později Repeater) |
| > 50 km | none | ticho / NO CARRIER |

---

## Runtime tok zprávy

```
TX → radio_freq/{f_400025}/messages
  → posluchač jen na naladěné frekvenci
  → filtr vzdálenosti
  → cizí šifra = šum (F3 = luštění)
  → staniční list
```

---

## Fáze

### F1 — Fyzika pásma — hotovo

1. [x] Pásmo + dial
2. [x] Freq-first kanál (`radio_freq`)
3. [x] Origin TX
4. [x] Matice dosahu RX
5. [x] Stejná freq + PT/stejné heslo → text; cizí heslo → šum
6. [x] Presety / přímý zápis

### F2 — Autoscan (další)
### F3 — Šifra a luštění
### F4 — Receivery / Repeater
### F5 — Živý staničník + mise

---

## Stav

- [x] Matice dosahu
- [x] Pásmo + dial
- [x] Freq-first Firestore
- [ ] Nasadit `firestore.rules` (`radio_freq`)
- [ ] F2 Autoscan
