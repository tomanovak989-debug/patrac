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
| > 5 … ≤ 7.5 km | weak | ořezaný text / chyby |
| > 7.5 … ≤ 10 km | fragment | útržky zprávy |
| > 10 … ≤ 12.5 km | noise | jen šum / anomálie |
| > 12.5 km | none | ticho / žádný příjem |

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

### F2 — Autoscan — hotovo
- Menu AUTOSKEN — celé pásmo, zachycení aktivity, zamčení, složka AUTOSKEN ve ZPRÁVÁCH
- [x] Band-scan (krok 0.025 MHz po pásmu)

### F2b — SMS / ZPRÁVY (MVP hotovo)
- Seznam zpráv ze staničníku, nová zpráva T9, OK = TX

### F4 — Receivery / Repeater (MVP hotovo)
- [x] Uložitelný bod mapy (RX+) — název, frekvence, šifra
- [x] Open-Meteo výška + cache
- [x] Zesílení signálu jen na shodném kanálu (freq + šifra)
- [x] Mesh příjem přes receiver komunity
- [x] Mapové kruhy dosahu: 5 / 7.5 / 10 / 12.5 km bez výplně (modrá poloha, oranž RX)
- [ ] Nabourání cizích receiverů → odhalení kanálu (F4b)
- [ ] **Útočiště v dosahu:** receiver kamkoliv rozšíří signál hráče, ale příběhové mise / hlavní úkoly útočiště vyžadují spojení útočiště ↔ síť — až po dokončení zadávání questů (F5)

### F4b — BEACON (MVP)
- [x] Menu 4 · BEACON — SMS nebo PTT na celé pásmo 400–470 MHz, vždy PT (bez šifry)
- [x] SMS: každý puls na všech kanálech (krok 2,5 MHz); PTT: rotace po pásmu
- [x] Opakování ~18 s, mapa bliká, příjem na naladěném kanálu + autosken (dosah)
- [x] Opakované vysílání do vypnutí (~18 s interval)
- [x] Příjem: naladěný kanál + autosken (dosahová matice + výškový profil)
- [x] Blikající bod na mapě u GPS zapnutí
- [ ] Sdílení aktivního beaconu mezi hráči komunity (Firestore stav)

### F3 — Šifra a luštění
### F5 — Živý staničník + mise

---

## Stav

- [x] Matice dosahu
- [x] Pásmo + dial
- [x] Freq-first Firestore
- [ ] Nasadit `firestore.rules` (`radio_freq`)
- [x] F2 Autoscan (celé pásmo)
- [x] F4 Receivery / výška / mesh (MVP)
- [x] SMS / ZPRÁVY v menu vysílačky
