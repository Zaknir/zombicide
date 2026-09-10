// ==========================================
// DATI CENTRALIZZATI DELLE SOPRAVVISSUTE (Zombieside)
// ==========================================
// I testi (nome, descrizione, abilità) vivono in un unico file: personaggi.json.
// Sia la scheda "overview" (anteprima) sia la scheda "card" (gioco) leggono da qui.

let personaggiCache = null;

// Testo mostrato quando un livello offre più abilità tra cui scegliere
const TESTO_SCELTA_MULTIPLA = 'Scegli una tra:';

async function caricaPersonaggi() {
  if (!personaggiCache) {
    const risposta = await fetch('personaggi.json');
    personaggiCache = await risposta.json();
  }
  return personaggiCache;
}

// ==========================================
// SCHEDA "OVERVIEW" (anteprima/riepilogo, sola lettura)
// ==========================================
class PersonaggioOverview extends HTMLElement {
  async connectedCallback() {
    const personaggi = await caricaPersonaggi();
    const p = personaggi[this.dataset.id];
    if (!p) {
      this.innerHTML = `<p>Sopravvissuta "${this.dataset.id}" non trovata.</p>`;
      return;
    }

    this.innerHTML = `
    <section>
      <h1>${p.nome}, anteprima</h1>
    </section>
    <section>
      <p>${p.descrizione}</p>
    </section>
    <section>
      ${p.livelli.map(l => `
        <h2>${l.livello}</h2>
        ${l.sceltaMultipla ? `<p>Abilità: ${TESTO_SCELTA_MULTIPLA}</p>` : `<p>Abilità: </p>`}
        <ul>
          ${l.abilita.map(voce => `<li>${voce}</li>`).join('')}
        </ul>
      `).join('')}
      <h2>Condizioni di salute:</h2>
      <p>${p.salute}</p>
      <ul>
        <a href="${p.nome}_card.html">Scegli di giocare con ${p.nome}</a>
      </ul>
    </section>
    `;
  }
}

// ==========================================
// SCHEDA "CARD" (interattiva, in gioco)
// ==========================================
class PersonaggioCard extends HTMLElement {
  async connectedCallback() {
    const personaggi = await caricaPersonaggi();
    const p = personaggi[this.dataset.id];
    if (!p) {
      this.innerHTML = `<p>Sopravvissuta "${this.dataset.id}" non trovata.</p>`;
      return;
    }

    // Punti ferita salvati in localStorage, così restano invariati ricaricando la pagina
    const chiaveHp = `zombieside_hp_${this.dataset.id}`;
    let hpAttuali = parseInt(localStorage.getItem(chiaveHp), 10);
    if (isNaN(hpAttuali)) hpAttuali = 0;

    // Creature zombie eliminate salvate in localStorage, così restano invariate ricaricando la pagina
    const chiaveZombie = `zombieside_killed_zombie_${this.dataset.id}`;
    let zombieAttuali = parseInt(localStorage.getItem(chiaveZombie), 10);
    if (isNaN(zombieAttuali)) zombieAttuali = 0;

    // Scelte della giocatrice per i livelli con più abilità tra cui scegliere (sceltaMultipla),
    // salvate in localStorage così restano invariate ricaricando la pagina
    const chiaveScelte = `zombieside_scelte_${this.dataset.id}`;
    let scelteAbilita = {};
    try {
      scelteAbilita = JSON.parse(localStorage.getItem(chiaveScelte)) || {};
    } catch {
      scelteAbilita = {};
    }

    // Oggetti dell'inventario (mani e zaino) salvati in localStorage in tempo reale,
    // così restano invariati ricaricando la pagina
    const chiaveInventario = `zombieside_inventario_${this.dataset.id}`;
    let inventario = {};
    try {
      inventario = JSON.parse(localStorage.getItem(chiaveInventario)) || {};
    } catch {
      inventario = {};
    }

    // Il livello attuale è determinato dal numero di creature zombie eliminate: si passa al
    // livello successivo quando zombieAttuali raggiunge il suo "zombieCounter".
    const livelloAttualeObj = () => {
      let corrente = null;
      p.livelli.forEach(l => {
        if (zombieAttuali >= l.zombieCounter) corrente = l;
      });
      return corrente;
    };
    const livelloCorrente = () => {
      const corrente = livelloAttualeObj();
      return corrente ? corrente.livello : 'nessuno';
    };

    // Restituisce il livello raggiunto per il quale la giocatrice deve ancora scegliere
    // un'abilità (sceltaMultipla), oppure null se non c'è nessuna scelta in sospeso.
    const livelloInAttesaDiScelta = () => {
      const attuale = livelloAttualeObj();
      if (attuale && attuale.sceltaMultipla && !scelteAbilita[attuale.livello]) return attuale;
      return null;
    };

    // Elenco delle abilità dei livelli già raggiunti: per i livelli con
    // sceltaMultipla viene inclusa solo l'abilità scelta dalla giocatrice (se presente).
    const abilitaRaggiunte = () => {
      const raccolte = [];
      p.livelli.forEach(l => {
        if (zombieAttuali >= l.zombieCounter) {
          if (l.sceltaMultipla) {
            const scelta = scelteAbilita[l.livello];
            if (scelta) raccolte.push(scelta);
          } else {
            raccolte.push(...l.abilita);
          }
        }
      });
      return raccolte;
    };

    // Genera il blocco di dettaglio di un livello: se il livello è raggiunto ed è
    // a sceltaMultipla, ogni abilità è racchiusa in un pulsante radio selezionabile.
    const renderDettaglioLivelli = () => p.livelli.map(l => {
      const raggiunto = zombieAttuali >= l.zombieCounter;
      return `
        <h3>${l.livello}</h3>
        <p class="nota-livello" data-soglia="${l.zombieCounter}">${raggiunto ? '' : 'Non hai ancora raggiunto questo livello.'}</p>
        ${l.sceltaMultipla ? `<p>Abilità: ${TESTO_SCELTA_MULTIPLA}</p>` : `<p>Abilità: </p>`}
        <ul>
          ${l.abilita.map(voce => {
            if (l.sceltaMultipla && raggiunto) {
              const checked = scelteAbilita[l.livello] === voce ? 'checked' : '';
              return `<li><label><input type="radio" name="scelta-${l.livello}" data-livello="${l.livello}" value="${voce}" ${checked}> ${voce}</label></li>`;
            }
            return `<li>${voce}</li>`;
          }).join('')}
        </ul>
      `;
    }).join('');

    this.innerHTML = `
      <section>
        <h1>${p.nome.toUpperCase()}, scheda di gioco</h1>
      </section>

      <section>
        <div class="game-area" role="region" aria-label="Area di gioco">
          <div class="status-summary" aria-live="polite">
              <p id="livello-riga">Livello attuale: ${livelloCorrente()}</p>
              <p id="abilita-riga">Abilità attuali: ${abilitaRaggiunte().length}</p>
              <div class="abilita-list" aria-live="off">
                <ul>${abilitaRaggiunte().map(voce => `<li>${voce}</li>`).join('')}</ul>
              </div>
              <!-- TODO: commentato perché non più richiesto in V2 -->
              <!-- <p id="hp-riga">Ferite: ${hpAttuali} / ${p.hpMax}</p> -->
              <p id="zombie-riga">Creature zombie eliminate: ${zombieAttuali}</p>
          </div>
          <p id="avviso-scelta" aria-live="assertive"></p>
              
          <!-- TODO: commentato perché non più richiesto in V2 -->
          <!-- <div class="hp-counter-controls"> -->
              <!-- <button type="button" data-azione-hp="meno" aria-label="Rimuovi una ferita">− 1 ferita</button> -->
              <!-- <button type="button" data-azione-hp="piu" aria-label="Aggiungi una ferita">+ 1 ferita</button> -->
          <!-- </div> -->
          <div class="zombie-counter-controls">
              <button type="button" data-azione-zombie="meno" aria-label="Rimuovi creatura zombie">− 1 zombie</button>
              <button type="button" data-azione-zombie="piu" aria-label="Aggiungi creatura zombie">+ 1 zombie</button>
          </div>
        
          <div class="inventory-area" role="region">
            <form>
                <fieldset>
                <legend>Inventario</legend>
                <div id="inventory-tip"> <p>Segna qui gli oggetti che hai in mano e nello zaino, ${p.inventoryInfo}</p> </div>
                    <label for="lHand">Mano sinistra:</label>
                    <input type="text" id="lHand" name="lhand" value="${inventario.lHand ?? ''}" aria-describedby="inventory-tip">
                    <label for="rHand">Mano destra:</label>
                    <input type="text" id="rHand" name="rhand" value="${inventario.rHand ?? ''}" aria-describedby="inventory-tip">
                    <br>
                    <label for="backPack1">Zaino 1:</label>
                    <input type="text" id="backPack1" name="backpack1" value="${inventario.backPack1 ?? ''}" aria-describedby="inventory-tip"><br>
                    <label for="backPack2">Zaino 2:</label>
                    <input type="text" id="backPack2" name="backpack2" value="${inventario.backPack2 ?? ''}" aria-describedby="inventory-tip"><br>
                    <label for="backPack3">Zaino 3:</label>
                    <input type="text" id="backPack3" name="backpack3" value="${inventario.backPack3 ?? ''}" aria-describedby="inventory-tip"><br>
                </fieldset>
            </form>
          </div>

          <p>${p.levelCounterInfo}</p>
          <br>
        
          <!-- <button type="button" data-azione-reset-all="reset" aria-label="Resetta tutti i dati">Reset</button> -->
          <input type="reset" data-azione-reset-all="reset" aria-label="Resetta tutti i dati">
        </div>
      </section>

      <section>
        <h2>Livelli e abilità:</h2>

        <div id="dettaglio-livelli">${renderDettaglioLivelli()}</div>
      </section>
    `;

    // TODO: commentato perché non più richiesto nella V2
    // const rigaHp = this.querySelector('#hp-riga');
    // this.querySelectorAll('[data-azione-hp]').forEach(hpButton => {
    //    hpButton.addEventListener('click', () => {
    //      if (hpButton.dataset.azioneHp === 'piu' && hpAttuali < p.hpMax) hpAttuali++;
    //      if (hpButton.dataset.azioneHp === 'meno' && hpAttuali > 0) hpAttuali--;
    //      rigaHp.textContent = `Punti ferita: ${hpAttuali} / ${p.hpMax}`;
    //      localStorage.setItem(chiaveHp, hpAttuali);
    //    });
    // });

    const rigaZombie = this.querySelector('#zombie-riga');
    const rigaLivello = this.querySelector('#livello-riga');
    const rigaAbilita = this.querySelector('#abilita-riga');
    const listaAbilita = this.querySelector('.abilita-list');
    const dettaglioLivelli = this.querySelector('#dettaglio-livelli');
    const avvisoScelta = this.querySelector('#avviso-scelta');
    const zombiePiuButton = this.querySelector('[data-azione-zombie="piu"]');

    const aggiornaAbilitaRaggiunte = () => {
      const elenco = abilitaRaggiunte();
      rigaAbilita.textContent = `Abilità attuali: ${elenco.length}`;
      listaAbilita.innerHTML = `<ul>${elenco.map(voce => `<li>${voce}</li>`).join('')}</ul>`;
    };

    // Finché un livello raggiunto a sceltaMultipla non ha ancora un'abilità scelta,
    // impedisce di avanzare (disabilita "+ 1 creatura") e avvisa via screen-reader.
    const aggiornaStatoScelta = () => {
      const inAttesa = livelloInAttesaDiScelta();
      zombiePiuButton.disabled = !!inAttesa;
      avvisoScelta.textContent = inAttesa
        ? `Devi scegliere un'abilità del livello ${inAttesa.livello} prima di continuare.`
        : '';
    };
    aggiornaStatoScelta();

    // Delegazione: quando la giocatrice sceglie un'abilità con un pulsante radio,
    // la scelta viene salvata e la lista delle abilità raggiunte aggiornata.
    dettaglioLivelli.addEventListener('change', e => {
      const input = e.target.closest('input[type="radio"][data-livello]');
      if (!input) return;
      scelteAbilita[input.dataset.livello] = input.value;
      localStorage.setItem(chiaveScelte, JSON.stringify(scelteAbilita));
      aggiornaAbilitaRaggiunte();
      aggiornaStatoScelta();
    });

    // Salvataggio in tempo reale degli oggetti dell'inventario: ad ogni digitazione
    // il valore del campo viene scritto in localStorage.
    const inventarioArea = this.querySelector('.inventory-area');
    inventarioArea.addEventListener('input', e => {
      const input = e.target.closest('input[type="text"]');
      if (!input) return;
      inventario[input.id] = input.value;
      localStorage.setItem(chiaveInventario, JSON.stringify(inventario));
    });

    this.querySelectorAll('[data-azione-zombie]').forEach(zombieButton => {
      zombieButton.addEventListener('click', () => {
        if (zombieButton.dataset.azioneZombie === 'piu') zombieAttuali++;
        if (zombieButton.dataset.azioneZombie === 'meno' && zombieAttuali > 0) zombieAttuali--;
        rigaZombie.textContent = `Creature zombie eliminate: ${zombieAttuali}`;
        rigaLivello.textContent = `Livello attuale: ${livelloCorrente()}`;
        dettaglioLivelli.innerHTML = renderDettaglioLivelli();
        aggiornaAbilitaRaggiunte();
        aggiornaStatoScelta();
        localStorage.setItem(chiaveZombie, zombieAttuali);
      });
    });

    this.querySelectorAll('[data-azione-reset-all]').forEach(resetButton => {
      resetButton.addEventListener('click', () => {
        const confermato = window.confirm('Vuoi veramente azzerare tutti i contatori (punti ferita, creature zombie eliminate e livelli raggiunti)?');
        if (!confermato) return;

        // TODO: commentato perché non più richiesto in V2
        // hpAttuali = 0;
        zombieAttuali = 0;
        scelteAbilita = {};
        inventario = {};
        inventarioArea.querySelectorAll('input[type="text"]').forEach(input => {
          input.value = '';
        });

        // TODO: commentato perché non più richiesto in V2
        // rigaHp.textContent = `Punti ferita: ${hpAttuali} / ${p.hpMax}`;
        rigaZombie.textContent = `Creature zombie eliminate: ${zombieAttuali}`;
        rigaLivello.textContent = `Livello attuale: ${livelloCorrente()}`;
        dettaglioLivelli.innerHTML = renderDettaglioLivelli();
        aggiornaAbilitaRaggiunte();
        aggiornaStatoScelta();

        // TODO: commentato perché non più richiesto in V2
        // localStorage.setItem(chiaveHp, hpAttuali);
        localStorage.setItem(chiaveZombie, zombieAttuali);
        localStorage.setItem(chiaveScelte, JSON.stringify(scelteAbilita));
        localStorage.setItem(chiaveInventario, JSON.stringify(inventario));
      });
    });
  }
}

customElements.define('personaggio-overview', PersonaggioOverview);
customElements.define('personaggio-card', PersonaggioCard);
