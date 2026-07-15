import { createContext, useContext } from 'react';
import { Role } from './types';

export type Lang = 'nl' | 'en';

const STRINGS: Record<Lang, Record<string, string>> = {
  nl: {
    tagline: 'Het kaartspel — word president, vermijd de foet!',
    yourName: 'Je naam',
    defaultName: 'Speler',
    playerCount: 'Aantal spelers:',
    playVsComputer: '🤖 Speel tegen de computer',
    orMultiplayer: '— of multiplayer —',
    createRoom: 'Nieuwe kamer maken',
    roomCode: 'Kamercode',
    join: 'Meedoen',
    roomTitle: 'Kamer {code}',
    shareCode: 'Deel deze code met vrienden om mee te doen (3–6 spelers).',
    addBot: '+ Bot',
    removeBot: '− Bot',
    startGame: 'Start het spel ({n}/6)',
    minPlayers: 'Minimaal 3 spelers — voeg bots toe of wacht op vrienden.',
    waitingHost: 'Wachten tot de host het spel start…',
    leaveRoom: 'Kamer verlaten',
    disconnected: '(verbroken)',
    headerRoom: 'Kamer {code} · Ronde {round}',
    leave: 'Verlaten',
    newTrick: 'Nieuwe slag — {name} komt uit',
    exchangePhase: 'Ruilfase…',
    statusExchangeChoose: 'Kies {n} kaart(en) om terug te geven.',
    statusExchanging: 'Kaarten worden geruild…',
    statusRoundOver: 'Ronde afgelopen!',
    statusYourTurnFollow: 'Jouw beurt: speel {n} hogere kaart(en), of pas.',
    statusYourTurnLead: 'Jouw beurt: kom uit met één of meer gelijke kaarten.',
    statusOtherTurn: '{name} is aan de beurt…',
    passed: 'gepast',
    finishedPos: '#{pos} klaar',
    botPlaysOn: '🤖 bot speelt verder',
    youAreDone: 'Je bent klaar! 🎉',
    yourRank: 'Jouw rang:',
    play: 'Spelen',
    pass: 'Passen',
    giveBack: 'Geef {n} kaart(en) terug',
    givenTo: 'Gegeven aan {who}:',
    received: 'Ontvangen:',
    thePresident: 'de president',
    theVicePresident: 'de vice-president',
    theViceFoet: 'de vice-foet',
    theFoet: 'de foet',
    roundOverTitle: 'Ronde {n} afgelopen',
    totals: 'Totaalstand',
    nextRound: 'Volgende ronde',
    colPresident: '👑 Pres.',
    colVicePresident: 'Vice-pres.',
    colBurger: 'Burger',
    colViceFoet: 'Vice-foet',
    colFoet: '💩 Foet',
    rolePresident: 'President',
    roleVicePresident: 'Vice-president',
    roleBurger: 'Burger',
    roleViceFoet: 'Vice-foet',
    roleFoet: 'Foet',
    connLost: 'Verbinding met de server verbroken…',
    roomGone: 'De kamer bestaat niet meer.',
    errNotPlaying: 'Het spel is niet bezig.',
    errNotYourTurn: 'Je bent niet aan de beurt.',
    errCardNotInHand: 'Kaart niet in je hand.',
    errDuplicateCards: 'Dubbele kaarten.',
    errSelectAtLeast: 'Selecteer minstens één kaart.',
    errSameRank: 'Alle kaarten moeten dezelfde waarde hebben.',
    errExactCount: 'Je moet precies {n} kaart(en) spelen.',
    errMustBeHigher: 'Je kaarten moeten hoger zijn.',
    errLeaderCannotPass: 'Je moet uitkomen, passen kan niet.',
    errNoExchange: 'Er is nu geen ruilfase.',
    errNothingToReturn: 'Jij hoeft geen kaarten terug te geven.',
    errChooseExact: 'Kies precies {n} kaart(en).',
    errRoomNotFound: 'Kamer niet gevonden.',
    errGameStarted: 'Het spel is al begonnen.',
    errRoomFull: 'De kamer is vol.',
    errHostOnly: 'Alleen de host kan dat doen.',
    errMinPlayers: 'Minimaal 3 spelers nodig (voeg bots toe).',
    errMaxPlayers: 'Maximaal 6 spelers.',
    noticeLeft: '{name} heeft het spel verlaten — een bot speelt verder.',
    noticeDisconnected: '{name} is de verbinding verloren — een bot speelt verder.',
    noticeReturned: '{name} doet weer zelf mee.',
    logTitle: 'Verloop',
    logToggle: '📜 Verloop',
    logRound: '— Ronde {n} —',
    logPlay: '{name} speelt {cards}',
    logPass: '{name} past',
    logWon: '{name} wint de slag',
    logDone: '{name} is klaar (#{pos})',
  },
  en: {
    tagline: 'The card game — become president, avoid the scum!',
    yourName: 'Your name',
    defaultName: 'Player',
    playerCount: 'Number of players:',
    playVsComputer: '🤖 Play against the computer',
    orMultiplayer: '— or multiplayer —',
    createRoom: 'Create a room',
    roomCode: 'Room code',
    join: 'Join',
    roomTitle: 'Room {code}',
    shareCode: 'Share this code with friends to join (3–6 players).',
    addBot: '+ Bot',
    removeBot: '− Bot',
    startGame: 'Start the game ({n}/6)',
    minPlayers: 'At least 3 players needed — add bots or wait for friends.',
    waitingHost: 'Waiting for the host to start the game…',
    leaveRoom: 'Leave room',
    disconnected: '(disconnected)',
    headerRoom: 'Room {code} · Round {round}',
    leave: 'Leave',
    newTrick: 'New trick — {name} leads',
    exchangePhase: 'Card exchange…',
    statusExchangeChoose: 'Pick {n} card(s) to give back.',
    statusExchanging: 'Cards are being exchanged…',
    statusRoundOver: 'Round over!',
    statusYourTurnFollow: 'Your turn: play {n} higher card(s), or pass.',
    statusYourTurnLead: 'Your turn: lead with one or more cards of the same rank.',
    statusOtherTurn: "{name}'s turn…",
    passed: 'passed',
    finishedPos: '#{pos} done',
    botPlaysOn: '🤖 bot plays on',
    youAreDone: "You're done! 🎉",
    yourRank: 'Your rank:',
    play: 'Play',
    pass: 'Pass',
    giveBack: 'Give back {n} card(s)',
    givenTo: 'Given to {who}:',
    received: 'Received:',
    thePresident: 'the president',
    theVicePresident: 'the vice-president',
    theViceFoet: 'the vice-scum',
    theFoet: 'the scum',
    roundOverTitle: 'Round {n} finished',
    totals: 'Standings',
    nextRound: 'Next round',
    colPresident: '👑 Pres.',
    colVicePresident: 'Vice-pres.',
    colBurger: 'Citizen',
    colViceFoet: 'Vice-scum',
    colFoet: '💩 Scum',
    rolePresident: 'President',
    roleVicePresident: 'Vice-president',
    roleBurger: 'Citizen',
    roleViceFoet: 'Vice-scum',
    roleFoet: 'Scum',
    connLost: 'Connection to the server lost…',
    roomGone: 'The room no longer exists.',
    errNotPlaying: 'The game is not in progress.',
    errNotYourTurn: "It's not your turn.",
    errCardNotInHand: 'Card is not in your hand.',
    errDuplicateCards: 'Duplicate cards.',
    errSelectAtLeast: 'Select at least one card.',
    errSameRank: 'All cards must have the same rank.',
    errExactCount: 'You must play exactly {n} card(s).',
    errMustBeHigher: 'Your cards must be higher.',
    errLeaderCannotPass: 'You must lead, passing is not allowed.',
    errNoExchange: 'There is no exchange right now.',
    errNothingToReturn: "You don't need to give back any cards.",
    errChooseExact: 'Pick exactly {n} card(s).',
    errRoomNotFound: 'Room not found.',
    errGameStarted: 'The game has already started.',
    errRoomFull: 'The room is full.',
    errHostOnly: 'Only the host can do that.',
    errMinPlayers: 'At least 3 players needed (add bots).',
    errMaxPlayers: 'A maximum of 6 players.',
    noticeLeft: '{name} left the game — a bot plays on.',
    noticeDisconnected: '{name} lost their connection — a bot plays on.',
    noticeReturned: '{name} is back in control.',
    logTitle: 'History',
    logToggle: '📜 History',
    logRound: '— Round {n} —',
    logPlay: '{name} plays {cards}',
    logPass: '{name} passes',
    logWon: '{name} wins the trick',
    logDone: '{name} is done (#{pos})',
  },
};

export interface ServerMessage {
  key: string;
  params?: Record<string, string | number>;
}

export function detectLang(): Lang {
  const saved = localStorage.getItem('presidenten-lang');
  if (saved === 'nl' || saved === 'en') return saved;
  return navigator.language?.toLowerCase().startsWith('nl') ? 'nl' : 'en';
}

export const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: 'nl',
  setLang: () => {},
});

export function useLang() {
  return useContext(LangContext);
}

function format(template: string, params?: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params?.[k] ?? ''));
}

export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  return format(STRINGS[lang][key] ?? key, params);
}

/** Hook returning the translate function for the active language. */
export function useT() {
  const { lang } = useLang();
  return (key: string, params?: Record<string, string | number>) => translate(lang, key, params);
}

const ROLE_KEYS: Record<Role, string> = {
  president: 'rolePresident',
  'vice-president': 'roleVicePresident',
  burger: 'roleBurger',
  'vice-foet': 'roleViceFoet',
  foet: 'roleFoet',
};

export function roleKey(role: Role): string {
  return ROLE_KEYS[role];
}

/** Court-card letters differ per language (B/V/H vs J/Q/K). */
export function rankLabel(r: number, lang: Lang): string {
  if (r <= 10) return String(r);
  const nl: Record<number, string> = { 11: 'B', 12: 'V', 13: 'H', 14: 'A', 15: '2' };
  const en: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2' };
  return (lang === 'nl' ? nl : en)[r];
}
