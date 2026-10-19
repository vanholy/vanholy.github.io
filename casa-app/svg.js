/* ===== Schemi grafici (resi cliccabili) ===== */
const SVG_DEFS = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" style="fill:var(--c-fill)"/><line x1="0" y1="0" x2="0" y2="7" style="stroke:var(--c-hatch);stroke-width:2"/></pattern></defs></svg>';

const SVG_SECTION = `<svg viewBox="0 0 760 430" role="img" aria-label="Sezione della casa per piani: tocca un subalterno">
<rect class="ground" x="0" y="312" width="760" height="6"/>
<rect class="c-fill" data-sub="701" x="0" y="298" width="70" height="14"/><rect class="c-fill" data-sub="701" x="680" y="298" width="80" height="14"/>
<text class="lbl sm" x="35" y="338" text-anchor="middle">701 giardino</text><text class="lbl sm" x="720" y="338" text-anchor="middle">701 giardino</text>
<polygon class="c-fill strong" data-sub="706" points="80,92 360,26 640,92"/><rect class="c-fill strong" data-sub="706" x="80" y="92" width="560" height="58"/>
<text class="n" x="360" y="118" text-anchor="middle">706</text><text class="lbl" x="360" y="138" text-anchor="middle">sottotetto · comune a entrambi</text>
<text class="lvl" x="65" y="125" text-anchor="end">P2</text>
<rect class="p-fill" data-sub="703" x="80" y="150" width="110" height="78"/><rect class="c-fill strong" data-sub="701" x="190" y="150" width="70" height="78"/><rect class="p-fill" data-sub="4" x="260" y="150" width="380" height="78"/><rect class="p-fill" data-sub="4" x="640" y="206" width="58" height="8"/>
<text class="n" x="135" y="184" text-anchor="middle">703</text><text class="lbl sm" x="135" y="203" text-anchor="middle">cucina</text><text class="lbl sm" x="135" y="218" text-anchor="middle">17 m²</text>
<text class="n sm" x="225" y="184" text-anchor="middle">701</text><text class="lbl sm" x="225" y="203" text-anchor="middle">scala</text>
<text class="n" x="450" y="186" text-anchor="middle">4</text><text class="lbl" x="450" y="207" text-anchor="middle">abitazione · 94 m² + balcone 14 m²</text>
<text class="lvl" x="65" y="193" text-anchor="end">P1</text>
<rect class="b-fill" data-sub="702" x="80" y="228" width="110" height="78"/><rect class="c-fill strong" data-sub="701" x="190" y="228" width="70" height="78"/><rect class="b-fill" data-sub="704" x="260" y="228" width="380" height="78"/><rect class="b-fill" data-sub="704" x="640" y="284" width="52" height="8"/>
<text class="n" x="135" y="262" text-anchor="middle">702</text><text class="lbl sm" x="135" y="281" text-anchor="middle">deposito</text><text class="lbl sm" x="135" y="296" text-anchor="middle">12 m²</text>
<text class="n sm" x="225" y="262" text-anchor="middle">701</text><text class="lbl sm" x="225" y="281" text-anchor="middle">scala</text>
<text class="n" x="450" y="264" text-anchor="middle">704</text><text class="lbl" x="450" y="285" text-anchor="middle">abitazione · 95 m² (balcone 8 m² compreso)</text>
<text class="lvl" x="65" y="271" text-anchor="end">PT</text>
<rect class="b-fill" data-sub="705" x="260" y="320" width="190" height="62"/><rect class="p-fill" data-sub="2" x="450" y="320" width="190" height="62"/>
<text class="n" x="355" y="348" text-anchor="middle">705</text><text class="lbl sm" x="355" y="368" text-anchor="middle">cantina · 27 m²</text>
<text class="n" x="545" y="348" text-anchor="middle">2</text><text class="lbl sm" x="545" y="368" text-anchor="middle">cantina · 37 m²</text>
<text class="lvl" x="65" y="356" text-anchor="end">S1</text><text class="note" x="170" y="356" text-anchor="middle">terra piena</text>
<text class="note" x="135" y="418" text-anchor="middle">corpo scala (lato ovest)</text><text class="note" x="450" y="418" text-anchor="middle">corpo principale</text>
<line class="dim" x1="80" y1="402" x2="260" y2="402"/><line class="dim" x1="260" y1="402" x2="640" y2="402"/>
</svg>`;

const NORTH = '<g class="north" transform="translate(354,275)"><path d="M0,-14 L6,6 L0,2 L-6,6 Z"/><text x="0" y="20" text-anchor="middle">N</text></g>';
const LOT = 'points="22.2,22.2 345.2,15.4 370.7,93.6 336.7,289.1 47.7,297.6 13.7,144.6"';

const SVG_PLANS = [
  { cap:'Piano interrato (S1)', svg:`<svg viewBox="0 0 384 313" role="img" aria-label="Piano interrato"><polygon class="ghost" ${LOT}/>
<polygon class="b-fill" data-sub="705" points="153.1,46.0 314.6,42.6 312.1,103.8 153.1,103.8"/><polygon class="p-fill" data-sub="2" points="153.1,103.8 312.1,103.8 304.4,171.8 153.1,171.8"/>
<polygon class="ghost-b" points="81.7,69.8 153.1,69.8 153.1,171.8 81.7,171.8"/>
<text class="n" x="233" y="72.3" text-anchor="middle">705</text><text class="lbl" x="233" y="91" text-anchor="middle">cantina · 27 m²</text>
<text class="n" x="229.6" y="135.2" text-anchor="middle">2</text><text class="lbl" x="229.6" y="153.9" text-anchor="middle">cantina · 37 m²</text>
<text class="note" x="117.4" y="124.2" text-anchor="middle">terra piena</text>${NORTH}</svg>` },
  { cap:'Piano terra (rialzato)', svg:`<svg viewBox="0 0 384 313" role="img" aria-label="Piano terra"><polygon class="c-fill" data-sub="701" ${LOT}/>
<polygon class="b-fill" data-sub="704" points="153.1,46.0 314.6,42.6 304.4,171.8 153.1,171.8"/><polygon class="b-fill" data-sub="704" points="168.4,171.8 280.6,171.8 280.6,192.2 168.4,192.2"/>
<polygon class="b-fill" data-sub="702" points="81.7,69.8 129.3,69.8 129.3,115.7 81.7,115.7"/>
<polygon class="c-fill strong" data-sub="701" points="129.3,69.8 153.1,69.8 153.1,171.8 81.7,171.8 81.7,115.7 129.3,115.7"/>
<polygon class="c-fill strong" data-sub="701" points="120.8,171.8 144.6,171.8 144.6,193.9 120.8,193.9"/>
<text class="n" x="231.3" y="101.2" text-anchor="middle">704</text><text class="lbl" x="231.3" y="119.9" text-anchor="middle">abitazione · 95 m²</text>
<text class="lbl sm" x="224.5" y="186.2" text-anchor="middle">balcone 704</text>
<text class="n" x="105.5" y="89.3" text-anchor="middle">702</text><text class="lbl xs" x="105.5" y="106.3" text-anchor="middle">deposito</text>
<text class="n sm" x="117.4" y="148" text-anchor="middle">701</text><text class="lbl sm" x="117.4" y="163.3" text-anchor="middle">scala</text>
<text class="lbl" x="188.8" y="250" text-anchor="middle">701 · giardino e corte comuni</text><text class="note" x="233" y="33.2" text-anchor="middle">confine nord</text>${NORTH}</svg>` },
  { cap:'Piano primo', svg:`<svg viewBox="0 0 384 313" role="img" aria-label="Piano primo"><polygon class="ghost" ${LOT}/>
<polygon class="p-fill" data-sub="4" points="153.1,46.0 314.6,42.6 304.4,171.8 153.1,171.8"/><polygon class="p-fill" data-sub="4" points="161.6,171.8 294.2,171.8 294.2,202.4 161.6,202.4"/>
<polygon class="p-fill" data-sub="703" points="81.7,69.8 129.3,69.8 129.3,115.7 81.7,115.7"/>
<polygon class="c-fill strong" data-sub="701" points="129.3,69.8 153.1,69.8 153.1,171.8 81.7,171.8 81.7,115.7 129.3,115.7"/>
<text class="n" x="231.3" y="101.2" text-anchor="middle">4</text><text class="lbl" x="231.3" y="119.9" text-anchor="middle">abitazione · 94 m²</text>
<text class="lbl sm" x="227.9" y="191.4" text-anchor="middle">balcone 4 · 14 m²</text>
<text class="n" x="105.5" y="89.3" text-anchor="middle">703</text><text class="lbl xs" x="105.5" y="106.3" text-anchor="middle">cucina</text>
<text class="n sm" x="117.4" y="148" text-anchor="middle">701</text><text class="lbl sm" x="117.4" y="163.3" text-anchor="middle">scala</text>${NORTH}</svg>` },
  { cap:'Piano secondo (sottotetto)', svg:`<svg viewBox="0 0 384 313" role="img" aria-label="Sottotetto"><polygon class="ghost" ${LOT}/>
<polygon class="c-fill strong" data-sub="706" points="153.1,46.0 314.6,42.6 304.4,171.8 153.1,171.8"/>
<polygon class="c-fill strong" data-sub="706" points="81.7,69.8 153.1,69.8 153.1,171.8 81.7,171.8"/>
<polygon class="bot" data-sub="701" points="93.6,127.6 105.5,127.6 105.5,139.5 93.6,139.5"/>
<text class="n" x="226.2" y="101.2" text-anchor="middle">706</text><text class="lbl" x="226.2" y="119.9" text-anchor="middle">sottotetto comune</text>
<text class="lbl sm" x="99.6" y="156.5" text-anchor="middle">701 botola</text>
<text class="note" x="226.2" y="137.8" text-anchor="middle">h 0,80–2,90 m</text><text class="note" x="226.2" y="153.1" text-anchor="middle">non abitabile</text>${NORTH}</svg>` }
];
