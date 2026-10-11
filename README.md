# 💥 GIGÁSZOK CSATÁJA, AVAGY ZSOLESZ, ÉS GAZI HARCA

Kétszemélyes, körökre osztott, böngészőben futó tankos ügyességi játék. A két parancsnok **Gazi** (bal oldal, zöld tank, sötét haj) és **Zsolesz** (jobb oldal, szürke tank, rövid haj). A pálya közepén álló téglafal **minden teljes forduló után 1 méterrel magasabb lesz**, ezért folyamatosan új szöget és erőt kell keresni.

▶ **Játék online:** https://zsirafmix.github.io/tank-duel/

## Indítás

- Online: nyisd meg a fenti linket.
- Helyben: `python3 -m http.server` a mappában, majd `http://localhost:8000`. Az `index.html` dupla kattintással is elindul (nincs külső függőség, nincs backend).
- Bármilyen statikus tárhelyre feltölthető (GitHub Pages, Netlify stb.).

## Irányítás

| | Bal játékos (Gazi) | Jobb játékos (Zsolesz) |
|---|---|---|
| Szög | A / D | ← / → |
| Erő | W / S | ↑ / ↓ |
| Tüzelés | SPACE | ENTER |

- Az ellenféltől elfelé mutató gomb emeli a csövet, a felé mutató süllyeszti.
- **Shift** nyomva tartva: finom állítás. **P / Esc**: szünet. **M**: hang ki/be.
- Egérrel és érintéssel: alsó csúszkák, **−/+** gombok (nyomva tartva ismétel), **TÜZELÉS!** gomb.
- Gép elleni módban a gép a jobb oldali (szürke) tankot irányítja, te mindkét billentyűkiosztást használhatod.

## Szabályok

- Mindkét tank 100 életerővel indul, felváltva lőtök (szög 0–90°, erő 0–100%).
- **Közvetlen találat: 30**, **közeli robbanás: 10–20** (a távolsággal csökken, 6 m-en belül), **falba csapódás: 0** sebzés.
- A fal minden forduló után nő (1 m, 2 m, 3 m …). A találat kiüti a téglákat, a lyukak megmaradnak, a következő sorok rájuk épülnek.
- A szél fordulónként változik (HUD + az antennán lévő zászló mutatja).
- Akinek az életereje 0 lesz, veszít.

## Játékmódok

1. **Kétjátékos** – két ember egy gépen.
2. **Gép ellen** – *Könnyű* (a szelet figyelmen kívül hagyja, nagy szórás), *Közepes* (közelítő ballisztika, a szelet csak becsüli), *Nehéz* (pontos számítás, kis maradék hiba).
3. **Végtelen fal** – a fal minden fordulóban nő, a szél is erősödik; a cél minél tovább életben maradni (rekord mentve). A fal 30 m-ig nő: ennél a magasságnál – a teszt szerint – minden szélerősségnél (−10…+10 m/s) még biztosan van lövési megoldás, így a fal sosem válik átlőhetetlenné. (Klasszikus módban a határ 15 m.)

További: nappali/éjszakai pálya, véletlen időjárás (derült, felhős, eső, hó, vihar villámlással), röppálya-előnézet (rövid / teljes / ki), **„Utolsó lövés”** – játékosonként halványan megmarad az előző lövedék pályája, eredményjelző (helyi tárolás), győzelmi képernyő, szünet, némítás, mobilos érintésvezérlés.

## Fizika

- Állandó szimulációs időlépés: `dt = 1/120 s`, állandó gyorsulásra pontos integrálás (`x += v·dt + ½·a·dt²`).
- Gravitáció 9,81 m/s², kezdősebesség 100%-on 32 m/s, a szél vízszintes gyorsulás (1 m/s szél = 0,2 m/s²).
- Ütközés: tankok (test, torony, parancsnok), téglánként a fal, terep, pályán kívül.
- A teszt szerint a szimuláció az analitikus parabolától ~10⁻¹² m-re tér el.

## Fájlok

```
tank-duel/
├── index.html
├── css/style.css
├── js/
│   ├── physics.js     – ballisztika, terep, beállítások
│   ├── wall.js        – a növekvő téglafal
│   ├── tanks.js       – tankok, rajzfilmes parancsnokok, arckifejezések
│   ├── projectile.js  – lövedék, ütközésvizsgálat
│   ├── ai.js          – gépi ellenfél
│   ├── ui.js          – HUD, menük, csúszkák
│   └── game.js        – játékmotor, effektek, hangok, renderelés
├── assets/images/     – rajzfilmesített arcok és portrék
├── assets/sounds/     – (a hangokat a WebAudio valós időben szintetizálja)
└── README.md
```

## Megjegyzés a képekről

Az arcok a feltöltött fényképekből készültek, **helyben** (Python/PIL): kivágás, simítás, poszterizálás, kontúr. Az eredeti fényképek nincsenek a tárolóban, csak a feldolgozott rajzfilmes kivágások. A kifejezéseket (szemöldök, száj, szemek, izzadságcsepp, csillagok, kormos arc, összenyomás) a játék futás közben rajzolja rá.
