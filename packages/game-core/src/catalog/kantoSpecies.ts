/**
 * Snapshot verificável dos Pokémon #001–#151 de Kanto — PokéAPI.
 * Origem: PokeAPI/pokeapi @ ac2f1acb055026e3dff1e0aca743bb46256a810a
 * Fonte: data/v2/csv/{pokemon,pokemon_stats,pokemon_types,
 *   pokemon_species,pokemon_species_names,types}.csv
 * Campos: nome EN (language_id=9), tipos em ordem de slot, atributos-base,
 * preevolução, capture_rate e status lendário/mítico.
 *
 * SEM chamadas remotas, Random, cálculos ou progresso neste catálogo.
 * Golpes são tratados SEPARADAMENTE em combat/kantoBattle.ts;
 * a seleção provisória de golpe da Arena não é learnset oficial.
 * O progresso da Pokédex deriva somente de save.seen e save.roster.
 */
import type { StatValues } from '../stats/types.js';

export interface KantoCatalogSpecies {
  readonly id: number;
  readonly name: string;
  readonly types: readonly string[];
  readonly base: Readonly<StatValues>;
  readonly evolvesFrom: number | null;
  readonly captureRate: number;
  readonly legendary: boolean;
  readonly mythical: boolean;
}

export const KANTO_CATALOG_SOURCE_COMMIT = 'ac2f1acb055026e3dff1e0aca743bb46256a810a';
export const KANTO_POKEDEX: readonly KantoCatalogSpecies[] = [
  {id:1,name:"Bulbasaur",types:["grass","poison"],base:{"hp":45,"attack":49,"defense":49,"specialAttack":65,"specialDefense":65,"speed":45},evolvesFrom:null,captureRate:45,legendary:false,mythical:false},
  {id:2,name:"Ivysaur",types:["grass","poison"],base:{"hp":60,"attack":62,"defense":63,"specialAttack":80,"specialDefense":80,"speed":60},evolvesFrom:1,captureRate:45,legendary:false,mythical:false},
  {id:3,name:"Venusaur",types:["grass","poison"],base:{"hp":80,"attack":82,"defense":83,"specialAttack":100,"specialDefense":100,"speed":80},evolvesFrom:2,captureRate:45,legendary:false,mythical:false},
  {id:4,name:"Charmander",types:["fire"],base:{"hp":39,"attack":52,"defense":43,"specialAttack":60,"specialDefense":50,"speed":65},evolvesFrom:null,captureRate:45,legendary:false,mythical:false},
  {id:5,name:"Charmeleon",types:["fire"],base:{"hp":58,"attack":64,"defense":58,"specialAttack":80,"specialDefense":65,"speed":80},evolvesFrom:4,captureRate:45,legendary:false,mythical:false},
  {id:6,name:"Charizard",types:["fire","flying"],base:{"hp":78,"attack":84,"defense":78,"specialAttack":109,"specialDefense":85,"speed":100},evolvesFrom:5,captureRate:45,legendary:false,mythical:false},
  {id:7,name:"Squirtle",types:["water"],base:{"hp":44,"attack":48,"defense":65,"specialAttack":50,"specialDefense":64,"speed":43},evolvesFrom:null,captureRate:45,legendary:false,mythical:false},
  {id:8,name:"Wartortle",types:["water"],base:{"hp":59,"attack":63,"defense":80,"specialAttack":65,"specialDefense":80,"speed":58},evolvesFrom:7,captureRate:45,legendary:false,mythical:false},
  {id:9,name:"Blastoise",types:["water"],base:{"hp":79,"attack":83,"defense":100,"specialAttack":85,"specialDefense":105,"speed":78},evolvesFrom:8,captureRate:45,legendary:false,mythical:false},
  {id:10,name:"Caterpie",types:["bug"],base:{"hp":45,"attack":30,"defense":35,"specialAttack":20,"specialDefense":20,"speed":45},evolvesFrom:null,captureRate:255,legendary:false,mythical:false},
  {id:11,name:"Metapod",types:["bug"],base:{"hp":50,"attack":20,"defense":55,"specialAttack":25,"specialDefense":25,"speed":30},evolvesFrom:10,captureRate:120,legendary:false,mythical:false},
  {id:12,name:"Butterfree",types:["bug","flying"],base:{"hp":60,"attack":45,"defense":50,"specialAttack":90,"specialDefense":80,"speed":70},evolvesFrom:11,captureRate:45,legendary:false,mythical:false},
  {id:13,name:"Weedle",types:["bug","poison"],base:{"hp":40,"attack":35,"defense":30,"specialAttack":20,"specialDefense":20,"speed":50},evolvesFrom:null,captureRate:255,legendary:false,mythical:false},
  {id:14,name:"Kakuna",types:["bug","poison"],base:{"hp":45,"attack":25,"defense":50,"specialAttack":25,"specialDefense":25,"speed":35},evolvesFrom:13,captureRate:120,legendary:false,mythical:false},
  {id:15,name:"Beedrill",types:["bug","poison"],base:{"hp":65,"attack":90,"defense":40,"specialAttack":45,"specialDefense":80,"speed":75},evolvesFrom:14,captureRate:45,legendary:false,mythical:false},
  {id:16,name:"Pidgey",types:["normal","flying"],base:{"hp":40,"attack":45,"defense":40,"specialAttack":35,"specialDefense":35,"speed":56},evolvesFrom:null,captureRate:255,legendary:false,mythical:false},
  {id:17,name:"Pidgeotto",types:["normal","flying"],base:{"hp":63,"attack":60,"defense":55,"specialAttack":50,"specialDefense":50,"speed":71},evolvesFrom:16,captureRate:120,legendary:false,mythical:false},
  {id:18,name:"Pidgeot",types:["normal","flying"],base:{"hp":83,"attack":80,"defense":75,"specialAttack":70,"specialDefense":70,"speed":101},evolvesFrom:17,captureRate:45,legendary:false,mythical:false},
  {id:19,name:"Rattata",types:["normal"],base:{"hp":30,"attack":56,"defense":35,"specialAttack":25,"specialDefense":35,"speed":72},evolvesFrom:null,captureRate:255,legendary:false,mythical:false},
  {id:20,name:"Raticate",types:["normal"],base:{"hp":55,"attack":81,"defense":60,"specialAttack":50,"specialDefense":70,"speed":97},evolvesFrom:19,captureRate:127,legendary:false,mythical:false},
  {id:21,name:"Spearow",types:["normal","flying"],base:{"hp":40,"attack":60,"defense":30,"specialAttack":31,"specialDefense":31,"speed":70},evolvesFrom:null,captureRate:255,legendary:false,mythical:false},
  {id:22,name:"Fearow",types:["normal","flying"],base:{"hp":65,"attack":90,"defense":65,"specialAttack":61,"specialDefense":61,"speed":100},evolvesFrom:21,captureRate:90,legendary:false,mythical:false},
  {id:23,name:"Ekans",types:["poison"],base:{"hp":35,"attack":60,"defense":44,"specialAttack":40,"specialDefense":54,"speed":55},evolvesFrom:null,captureRate:255,legendary:false,mythical:false},
  {id:24,name:"Arbok",types:["poison"],base:{"hp":60,"attack":95,"defense":69,"specialAttack":65,"specialDefense":79,"speed":80},evolvesFrom:23,captureRate:90,legendary:false,mythical:false},
  {id:25,name:"Pikachu",types:["electric"],base:{"hp":35,"attack":55,"defense":40,"specialAttack":50,"specialDefense":50,"speed":90},evolvesFrom:172,captureRate:190,legendary:false,mythical:false},
  {id:26,name:"Raichu",types:["electric"],base:{"hp":60,"attack":90,"defense":55,"specialAttack":90,"specialDefense":80,"speed":110},evolvesFrom:25,captureRate:75,legendary:false,mythical:false},
  {id:27,name:"Sandshrew",types:["ground"],base:{"hp":50,"attack":75,"defense":85,"specialAttack":20,"specialDefense":30,"speed":40},evolvesFrom:null,captureRate:255,legendary:false,mythical:false},
  {id:28,name:"Sandslash",types:["ground"],base:{"hp":75,"attack":100,"defense":110,"specialAttack":45,"specialDefense":55,"speed":65},evolvesFrom:27,captureRate:90,legendary:false,mythical:false},
  {id:29,name:"Nidoran♀",types:["poison"],base:{"hp":55,"attack":47,"defense":52,"specialAttack":40,"specialDefense":40,"speed":41},evolvesFrom:null,captureRate:235,legendary:false,mythical:false},
  {id:30,name:"Nidorina",types:["poison"],base:{"hp":70,"attack":62,"defense":67,"specialAttack":55,"specialDefense":55,"speed":56},evolvesFrom:29,captureRate:120,legendary:false,mythical:false},
  {id:31,name:"Nidoqueen",types:["poison","ground"],base:{"hp":90,"attack":92,"defense":87,"specialAttack":75,"specialDefense":85,"speed":76},evolvesFrom:30,captureRate:45,legendary:false,mythical:false},
  {id:32,name:"Nidoran♂",types:["poison"],base:{"hp":46,"attack":57,"defense":40,"specialAttack":40,"specialDefense":40,"speed":50},evolvesFrom:null,captureRate:235,legendary:false,mythical:false},
  {id:33,name:"Nidorino",types:["poison"],base:{"hp":61,"attack":72,"defense":57,"specialAttack":55,"specialDefense":55,"speed":65},evolvesFrom:32,captureRate:120,legendary:false,mythical:false},
  {id:34,name:"Nidoking",types:["poison","ground"],base:{"hp":81,"attack":102,"defense":77,"specialAttack":85,"specialDefense":75,"speed":85},evolvesFrom:33,captureRate:45,legendary:false,mythical:false},
  {id:35,name:"Clefairy",types:["fairy"],base:{"hp":70,"attack":45,"defense":48,"specialAttack":60,"specialDefense":65,"speed":35},evolvesFrom:173,captureRate:150,legendary:false,mythical:false},
  {id:36,name:"Clefable",types:["fairy"],base:{"hp":95,"attack":70,"defense":73,"specialAttack":95,"specialDefense":90,"speed":60},evolvesFrom:35,captureRate:25,legendary:false,mythical:false},
  {id:37,name:"Vulpix",types:["fire"],base:{"hp":38,"attack":41,"defense":40,"specialAttack":50,"specialDefense":65,"speed":65},evolvesFrom:null,captureRate:190,legendary:false,mythical:false},
  {id:38,name:"Ninetales",types:["fire"],base:{"hp":73,"attack":76,"defense":75,"specialAttack":81,"specialDefense":100,"speed":100},evolvesFrom:37,captureRate:75,legendary:false,mythical:false},
  {id:39,name:"Jigglypuff",types:["normal","fairy"],base:{"hp":115,"attack":45,"defense":20,"specialAttack":45,"specialDefense":25,"speed":20},evolvesFrom:174,captureRate:170,legendary:false,mythical:false},
  {id:40,name:"Wigglytuff",types:["normal","fairy"],base:{"hp":140,"attack":70,"defense":45,"specialAttack":85,"specialDefense":50,"speed":45},evolvesFrom:39,captureRate:50,legendary:false,mythical:false},
  {id:41,name:"Zubat",types:["poison","flying"],base:{"hp":40,"attack":45,"defense":35,"specialAttack":30,"specialDefense":40,"speed":55},evolvesFrom:null,captureRate:255,legendary:false,mythical:false},
  {id:42,name:"Golbat",types:["poison","flying"],base:{"hp":75,"attack":80,"defense":70,"specialAttack":65,"specialDefense":75,"speed":90},evolvesFrom:41,captureRate:90,legendary:false,mythical:false},
  {id:43,name:"Oddish",types:["grass","poison"],base:{"hp":45,"attack":50,"defense":55,"specialAttack":75,"specialDefense":65,"speed":30},evolvesFrom:null,captureRate:255,legendary:false,mythical:false},
  {id:44,name:"Gloom",types:["grass","poison"],base:{"hp":60,"attack":65,"defense":70,"specialAttack":85,"specialDefense":75,"speed":40},evolvesFrom:43,captureRate:120,legendary:false,mythical:false},
  {id:45,name:"Vileplume",types:["grass","poison"],base:{"hp":75,"attack":80,"defense":85,"specialAttack":110,"specialDefense":90,"speed":50},evolvesFrom:44,captureRate:45,legendary:false,mythical:false},
  {id:46,name:"Paras",types:["bug","grass"],base:{"hp":35,"attack":70,"defense":55,"specialAttack":45,"specialDefense":55,"speed":25},evolvesFrom:null,captureRate:190,legendary:false,mythical:false},
  {id:47,name:"Parasect",types:["bug","grass"],base:{"hp":60,"attack":95,"defense":80,"specialAttack":60,"specialDefense":80,"speed":30},evolvesFrom:46,captureRate:75,legendary:false,mythical:false},
  {id:48,name:"Venonat",types:["bug","poison"],base:{"hp":60,"attack":55,"defense":50,"specialAttack":40,"specialDefense":55,"speed":45},evolvesFrom:null,captureRate:190,legendary:false,mythical:false},
  {id:49,name:"Venomoth",types:["bug","poison"],base:{"hp":70,"attack":65,"defense":60,"specialAttack":90,"specialDefense":75,"speed":90},evolvesFrom:48,captureRate:75,legendary:false,mythical:false},
  {id:50,name:"Diglett",types:["ground"],base:{"hp":10,"attack":55,"defense":25,"specialAttack":35,"specialDefense":45,"speed":95},evolvesFrom:null,captureRate:255,legendary:false,mythical:false},
  {id:51,name:"Dugtrio",types:["ground"],base:{"hp":35,"attack":100,"defense":50,"specialAttack":50,"specialDefense":70,"speed":120},evolvesFrom:50,captureRate:50,legendary:false,mythical:false},
  {id:52,name:"Meowth",types:["normal"],base:{"hp":40,"attack":45,"defense":35,"specialAttack":40,"specialDefense":40,"speed":90},evolvesFrom:null,captureRate:255,legendary:false,mythical:false},
  {id:53,name:"Persian",types:["normal"],base:{"hp":65,"attack":70,"defense":60,"specialAttack":65,"specialDefense":65,"speed":115},evolvesFrom:52,captureRate:90,legendary:false,mythical:false},
  {id:54,name:"Psyduck",types:["water"],base:{"hp":50,"attack":52,"defense":48,"specialAttack":65,"specialDefense":50,"speed":55},evolvesFrom:null,captureRate:190,legendary:false,mythical:false},
  {id:55,name:"Golduck",types:["water"],base:{"hp":80,"attack":82,"defense":78,"specialAttack":95,"specialDefense":80,"speed":85},evolvesFrom:54,captureRate:75,legendary:false,mythical:false},
  {id:56,name:"Mankey",types:["fighting"],base:{"hp":40,"attack":80,"defense":35,"specialAttack":35,"specialDefense":45,"speed":70},evolvesFrom:null,captureRate:190,legendary:false,mythical:false},
  {id:57,name:"Primeape",types:["fighting"],base:{"hp":65,"attack":105,"defense":60,"specialAttack":60,"specialDefense":70,"speed":95},evolvesFrom:56,captureRate:75,legendary:false,mythical:false},
  {id:58,name:"Growlithe",types:["fire"],base:{"hp":55,"attack":70,"defense":45,"specialAttack":70,"specialDefense":50,"speed":60},evolvesFrom:null,captureRate:190,legendary:false,mythical:false},
  {id:59,name:"Arcanine",types:["fire"],base:{"hp":90,"attack":110,"defense":80,"specialAttack":100,"specialDefense":80,"speed":95},evolvesFrom:58,captureRate:75,legendary:false,mythical:false},
  {id:60,name:"Poliwag",types:["water"],base:{"hp":40,"attack":50,"defense":40,"specialAttack":40,"specialDefense":40,"speed":90},evolvesFrom:null,captureRate:255,legendary:false,mythical:false},
  {id:61,name:"Poliwhirl",types:["water"],base:{"hp":65,"attack":65,"defense":65,"specialAttack":50,"specialDefense":50,"speed":90},evolvesFrom:60,captureRate:120,legendary:false,mythical:false},
  {id:62,name:"Poliwrath",types:["water","fighting"],base:{"hp":90,"attack":95,"defense":95,"specialAttack":70,"specialDefense":90,"speed":70},evolvesFrom:61,captureRate:45,legendary:false,mythical:false},
  {id:63,name:"Abra",types:["psychic"],base:{"hp":25,"attack":20,"defense":15,"specialAttack":105,"specialDefense":55,"speed":90},evolvesFrom:null,captureRate:200,legendary:false,mythical:false},
  {id:64,name:"Kadabra",types:["psychic"],base:{"hp":40,"attack":35,"defense":30,"specialAttack":120,"specialDefense":70,"speed":105},evolvesFrom:63,captureRate:100,legendary:false,mythical:false},
  {id:65,name:"Alakazam",types:["psychic"],base:{"hp":55,"attack":50,"defense":45,"specialAttack":135,"specialDefense":95,"speed":120},evolvesFrom:64,captureRate:50,legendary:false,mythical:false},
  {id:66,name:"Machop",types:["fighting"],base:{"hp":70,"attack":80,"defense":50,"specialAttack":35,"specialDefense":35,"speed":35},evolvesFrom:null,captureRate:180,legendary:false,mythical:false},
  {id:67,name:"Machoke",types:["fighting"],base:{"hp":80,"attack":100,"defense":70,"specialAttack":50,"specialDefense":60,"speed":45},evolvesFrom:66,captureRate:90,legendary:false,mythical:false},
  {id:68,name:"Machamp",types:["fighting"],base:{"hp":90,"attack":130,"defense":80,"specialAttack":65,"specialDefense":85,"speed":55},evolvesFrom:67,captureRate:45,legendary:false,mythical:false},
  {id:69,name:"Bellsprout",types:["grass","poison"],base:{"hp":50,"attack":75,"defense":35,"specialAttack":70,"specialDefense":30,"speed":40},evolvesFrom:null,captureRate:255,legendary:false,mythical:false},
  {id:70,name:"Weepinbell",types:["grass","poison"],base:{"hp":65,"attack":90,"defense":50,"specialAttack":85,"specialDefense":45,"speed":55},evolvesFrom:69,captureRate:120,legendary:false,mythical:false},
  {id:71,name:"Victreebel",types:["grass","poison"],base:{"hp":80,"attack":105,"defense":65,"specialAttack":100,"specialDefense":70,"speed":70},evolvesFrom:70,captureRate:45,legendary:false,mythical:false},
  {id:72,name:"Tentacool",types:["water","poison"],base:{"hp":40,"attack":40,"defense":35,"specialAttack":50,"specialDefense":100,"speed":70},evolvesFrom:null,captureRate:190,legendary:false,mythical:false},
  {id:73,name:"Tentacruel",types:["water","poison"],base:{"hp":80,"attack":70,"defense":65,"specialAttack":80,"specialDefense":120,"speed":100},evolvesFrom:72,captureRate:60,legendary:false,mythical:false},
  {id:74,name:"Geodude",types:["rock","ground"],base:{"hp":40,"attack":80,"defense":100,"specialAttack":30,"specialDefense":30,"speed":20},evolvesFrom:null,captureRate:255,legendary:false,mythical:false},
  {id:75,name:"Graveler",types:["rock","ground"],base:{"hp":55,"attack":95,"defense":115,"specialAttack":45,"specialDefense":45,"speed":35},evolvesFrom:74,captureRate:120,legendary:false,mythical:false},
  {id:76,name:"Golem",types:["rock","ground"],base:{"hp":80,"attack":120,"defense":130,"specialAttack":55,"specialDefense":65,"speed":45},evolvesFrom:75,captureRate:45,legendary:false,mythical:false},
  {id:77,name:"Ponyta",types:["fire"],base:{"hp":50,"attack":85,"defense":55,"specialAttack":65,"specialDefense":65,"speed":90},evolvesFrom:null,captureRate:190,legendary:false,mythical:false},
  {id:78,name:"Rapidash",types:["fire"],base:{"hp":65,"attack":100,"defense":70,"specialAttack":80,"specialDefense":80,"speed":105},evolvesFrom:77,captureRate:60,legendary:false,mythical:false},
  {id:79,name:"Slowpoke",types:["water","psychic"],base:{"hp":90,"attack":65,"defense":65,"specialAttack":40,"specialDefense":40,"speed":15},evolvesFrom:null,captureRate:190,legendary:false,mythical:false},
  {id:80,name:"Slowbro",types:["water","psychic"],base:{"hp":95,"attack":75,"defense":110,"specialAttack":100,"specialDefense":80,"speed":30},evolvesFrom:79,captureRate:75,legendary:false,mythical:false},
  {id:81,name:"Magnemite",types:["electric","steel"],base:{"hp":25,"attack":35,"defense":70,"specialAttack":95,"specialDefense":55,"speed":45},evolvesFrom:null,captureRate:190,legendary:false,mythical:false},
  {id:82,name:"Magneton",types:["electric","steel"],base:{"hp":50,"attack":60,"defense":95,"specialAttack":120,"specialDefense":70,"speed":70},evolvesFrom:81,captureRate:60,legendary:false,mythical:false},
  {id:83,name:"Farfetch’d",types:["normal","flying"],base:{"hp":52,"attack":90,"defense":55,"specialAttack":58,"specialDefense":62,"speed":60},evolvesFrom:null,captureRate:45,legendary:false,mythical:false},
  {id:84,name:"Doduo",types:["normal","flying"],base:{"hp":35,"attack":85,"defense":45,"specialAttack":35,"specialDefense":35,"speed":75},evolvesFrom:null,captureRate:190,legendary:false,mythical:false},
  {id:85,name:"Dodrio",types:["normal","flying"],base:{"hp":60,"attack":110,"defense":70,"specialAttack":60,"specialDefense":60,"speed":110},evolvesFrom:84,captureRate:45,legendary:false,mythical:false},
  {id:86,name:"Seel",types:["water"],base:{"hp":65,"attack":45,"defense":55,"specialAttack":45,"specialDefense":70,"speed":45},evolvesFrom:null,captureRate:190,legendary:false,mythical:false},
  {id:87,name:"Dewgong",types:["water","ice"],base:{"hp":90,"attack":70,"defense":80,"specialAttack":70,"specialDefense":95,"speed":70},evolvesFrom:86,captureRate:75,legendary:false,mythical:false},
  {id:88,name:"Grimer",types:["poison"],base:{"hp":80,"attack":80,"defense":50,"specialAttack":40,"specialDefense":50,"speed":25},evolvesFrom:null,captureRate:190,legendary:false,mythical:false},
  {id:89,name:"Muk",types:["poison"],base:{"hp":105,"attack":105,"defense":75,"specialAttack":65,"specialDefense":100,"speed":50},evolvesFrom:88,captureRate:75,legendary:false,mythical:false},
  {id:90,name:"Shellder",types:["water"],base:{"hp":30,"attack":65,"defense":100,"specialAttack":45,"specialDefense":25,"speed":40},evolvesFrom:null,captureRate:190,legendary:false,mythical:false},
  {id:91,name:"Cloyster",types:["water","ice"],base:{"hp":50,"attack":95,"defense":180,"specialAttack":85,"specialDefense":45,"speed":70},evolvesFrom:90,captureRate:60,legendary:false,mythical:false},
  {id:92,name:"Gastly",types:["ghost","poison"],base:{"hp":30,"attack":35,"defense":30,"specialAttack":100,"specialDefense":35,"speed":80},evolvesFrom:null,captureRate:190,legendary:false,mythical:false},
  {id:93,name:"Haunter",types:["ghost","poison"],base:{"hp":45,"attack":50,"defense":45,"specialAttack":115,"specialDefense":55,"speed":95},evolvesFrom:92,captureRate:90,legendary:false,mythical:false},
  {id:94,name:"Gengar",types:["ghost","poison"],base:{"hp":60,"attack":65,"defense":60,"specialAttack":130,"specialDefense":75,"speed":110},evolvesFrom:93,captureRate:45,legendary:false,mythical:false},
  {id:95,name:"Onix",types:["rock","ground"],base:{"hp":35,"attack":45,"defense":160,"specialAttack":30,"specialDefense":45,"speed":70},evolvesFrom:null,captureRate:45,legendary:false,mythical:false},
  {id:96,name:"Drowzee",types:["psychic"],base:{"hp":60,"attack":48,"defense":45,"specialAttack":43,"specialDefense":90,"speed":42},evolvesFrom:null,captureRate:190,legendary:false,mythical:false},
  {id:97,name:"Hypno",types:["psychic"],base:{"hp":85,"attack":73,"defense":70,"specialAttack":73,"specialDefense":115,"speed":67},evolvesFrom:96,captureRate:75,legendary:false,mythical:false},
  {id:98,name:"Krabby",types:["water"],base:{"hp":30,"attack":105,"defense":90,"specialAttack":25,"specialDefense":25,"speed":50},evolvesFrom:null,captureRate:225,legendary:false,mythical:false},
  {id:99,name:"Kingler",types:["water"],base:{"hp":55,"attack":130,"defense":115,"specialAttack":50,"specialDefense":50,"speed":75},evolvesFrom:98,captureRate:60,legendary:false,mythical:false},
  {id:100,name:"Voltorb",types:["electric"],base:{"hp":40,"attack":30,"defense":50,"specialAttack":55,"specialDefense":55,"speed":100},evolvesFrom:null,captureRate:190,legendary:false,mythical:false},
  {id:101,name:"Electrode",types:["electric"],base:{"hp":60,"attack":50,"defense":70,"specialAttack":80,"specialDefense":80,"speed":150},evolvesFrom:100,captureRate:60,legendary:false,mythical:false},
  {id:102,name:"Exeggcute",types:["grass","psychic"],base:{"hp":60,"attack":40,"defense":80,"specialAttack":60,"specialDefense":45,"speed":40},evolvesFrom:null,captureRate:90,legendary:false,mythical:false},
  {id:103,name:"Exeggutor",types:["grass","psychic"],base:{"hp":95,"attack":95,"defense":85,"specialAttack":125,"specialDefense":75,"speed":55},evolvesFrom:102,captureRate:45,legendary:false,mythical:false},
  {id:104,name:"Cubone",types:["ground"],base:{"hp":50,"attack":50,"defense":95,"specialAttack":40,"specialDefense":50,"speed":35},evolvesFrom:null,captureRate:190,legendary:false,mythical:false},
  {id:105,name:"Marowak",types:["ground"],base:{"hp":60,"attack":80,"defense":110,"specialAttack":50,"specialDefense":80,"speed":45},evolvesFrom:104,captureRate:75,legendary:false,mythical:false},
  {id:106,name:"Hitmonlee",types:["fighting"],base:{"hp":50,"attack":120,"defense":53,"specialAttack":35,"specialDefense":110,"speed":87},evolvesFrom:236,captureRate:45,legendary:false,mythical:false},
  {id:107,name:"Hitmonchan",types:["fighting"],base:{"hp":50,"attack":105,"defense":79,"specialAttack":35,"specialDefense":110,"speed":76},evolvesFrom:236,captureRate:45,legendary:false,mythical:false},
  {id:108,name:"Lickitung",types:["normal"],base:{"hp":90,"attack":55,"defense":75,"specialAttack":60,"specialDefense":75,"speed":30},evolvesFrom:null,captureRate:45,legendary:false,mythical:false},
  {id:109,name:"Koffing",types:["poison"],base:{"hp":40,"attack":65,"defense":95,"specialAttack":60,"specialDefense":45,"speed":35},evolvesFrom:null,captureRate:190,legendary:false,mythical:false},
  {id:110,name:"Weezing",types:["poison"],base:{"hp":65,"attack":90,"defense":120,"specialAttack":85,"specialDefense":70,"speed":60},evolvesFrom:109,captureRate:60,legendary:false,mythical:false},
  {id:111,name:"Rhyhorn",types:["ground","rock"],base:{"hp":80,"attack":85,"defense":95,"specialAttack":30,"specialDefense":30,"speed":25},evolvesFrom:null,captureRate:120,legendary:false,mythical:false},
  {id:112,name:"Rhydon",types:["ground","rock"],base:{"hp":105,"attack":130,"defense":120,"specialAttack":45,"specialDefense":45,"speed":40},evolvesFrom:111,captureRate:60,legendary:false,mythical:false},
  {id:113,name:"Chansey",types:["normal"],base:{"hp":250,"attack":5,"defense":5,"specialAttack":35,"specialDefense":105,"speed":50},evolvesFrom:440,captureRate:30,legendary:false,mythical:false},
  {id:114,name:"Tangela",types:["grass"],base:{"hp":65,"attack":55,"defense":115,"specialAttack":100,"specialDefense":40,"speed":60},evolvesFrom:null,captureRate:45,legendary:false,mythical:false},
  {id:115,name:"Kangaskhan",types:["normal"],base:{"hp":105,"attack":95,"defense":80,"specialAttack":40,"specialDefense":80,"speed":90},evolvesFrom:null,captureRate:45,legendary:false,mythical:false},
  {id:116,name:"Horsea",types:["water"],base:{"hp":30,"attack":40,"defense":70,"specialAttack":70,"specialDefense":25,"speed":60},evolvesFrom:null,captureRate:225,legendary:false,mythical:false},
  {id:117,name:"Seadra",types:["water"],base:{"hp":55,"attack":65,"defense":95,"specialAttack":95,"specialDefense":45,"speed":85},evolvesFrom:116,captureRate:75,legendary:false,mythical:false},
  {id:118,name:"Goldeen",types:["water"],base:{"hp":45,"attack":67,"defense":60,"specialAttack":35,"specialDefense":50,"speed":63},evolvesFrom:null,captureRate:225,legendary:false,mythical:false},
  {id:119,name:"Seaking",types:["water"],base:{"hp":80,"attack":92,"defense":65,"specialAttack":65,"specialDefense":80,"speed":68},evolvesFrom:118,captureRate:60,legendary:false,mythical:false},
  {id:120,name:"Staryu",types:["water"],base:{"hp":30,"attack":45,"defense":55,"specialAttack":70,"specialDefense":55,"speed":85},evolvesFrom:null,captureRate:225,legendary:false,mythical:false},
  {id:121,name:"Starmie",types:["water","psychic"],base:{"hp":60,"attack":75,"defense":85,"specialAttack":100,"specialDefense":85,"speed":115},evolvesFrom:120,captureRate:60,legendary:false,mythical:false},
  {id:122,name:"Mr. Mime",types:["psychic","fairy"],base:{"hp":40,"attack":45,"defense":65,"specialAttack":100,"specialDefense":120,"speed":90},evolvesFrom:439,captureRate:45,legendary:false,mythical:false},
  {id:123,name:"Scyther",types:["bug","flying"],base:{"hp":70,"attack":110,"defense":80,"specialAttack":55,"specialDefense":80,"speed":105},evolvesFrom:null,captureRate:45,legendary:false,mythical:false},
  {id:124,name:"Jynx",types:["ice","psychic"],base:{"hp":65,"attack":50,"defense":35,"specialAttack":115,"specialDefense":95,"speed":95},evolvesFrom:238,captureRate:45,legendary:false,mythical:false},
  {id:125,name:"Electabuzz",types:["electric"],base:{"hp":65,"attack":83,"defense":57,"specialAttack":95,"specialDefense":85,"speed":105},evolvesFrom:239,captureRate:45,legendary:false,mythical:false},
  {id:126,name:"Magmar",types:["fire"],base:{"hp":65,"attack":95,"defense":57,"specialAttack":100,"specialDefense":85,"speed":93},evolvesFrom:240,captureRate:45,legendary:false,mythical:false},
  {id:127,name:"Pinsir",types:["bug"],base:{"hp":65,"attack":125,"defense":100,"specialAttack":55,"specialDefense":70,"speed":85},evolvesFrom:null,captureRate:45,legendary:false,mythical:false},
  {id:128,name:"Tauros",types:["normal"],base:{"hp":75,"attack":100,"defense":95,"specialAttack":40,"specialDefense":70,"speed":110},evolvesFrom:null,captureRate:45,legendary:false,mythical:false},
  {id:129,name:"Magikarp",types:["water"],base:{"hp":20,"attack":10,"defense":55,"specialAttack":15,"specialDefense":20,"speed":80},evolvesFrom:null,captureRate:255,legendary:false,mythical:false},
  {id:130,name:"Gyarados",types:["water","flying"],base:{"hp":95,"attack":125,"defense":79,"specialAttack":60,"specialDefense":100,"speed":81},evolvesFrom:129,captureRate:45,legendary:false,mythical:false},
  {id:131,name:"Lapras",types:["water","ice"],base:{"hp":130,"attack":85,"defense":80,"specialAttack":85,"specialDefense":95,"speed":60},evolvesFrom:null,captureRate:45,legendary:false,mythical:false},
  {id:132,name:"Ditto",types:["normal"],base:{"hp":48,"attack":48,"defense":48,"specialAttack":48,"specialDefense":48,"speed":48},evolvesFrom:null,captureRate:35,legendary:false,mythical:false},
  {id:133,name:"Eevee",types:["normal"],base:{"hp":55,"attack":55,"defense":50,"specialAttack":45,"specialDefense":65,"speed":55},evolvesFrom:null,captureRate:45,legendary:false,mythical:false},
  {id:134,name:"Vaporeon",types:["water"],base:{"hp":130,"attack":65,"defense":60,"specialAttack":110,"specialDefense":95,"speed":65},evolvesFrom:133,captureRate:45,legendary:false,mythical:false},
  {id:135,name:"Jolteon",types:["electric"],base:{"hp":65,"attack":65,"defense":60,"specialAttack":110,"specialDefense":95,"speed":130},evolvesFrom:133,captureRate:45,legendary:false,mythical:false},
  {id:136,name:"Flareon",types:["fire"],base:{"hp":65,"attack":130,"defense":60,"specialAttack":95,"specialDefense":110,"speed":65},evolvesFrom:133,captureRate:45,legendary:false,mythical:false},
  {id:137,name:"Porygon",types:["normal"],base:{"hp":65,"attack":60,"defense":70,"specialAttack":85,"specialDefense":75,"speed":40},evolvesFrom:null,captureRate:45,legendary:false,mythical:false},
  {id:138,name:"Omanyte",types:["rock","water"],base:{"hp":35,"attack":40,"defense":100,"specialAttack":90,"specialDefense":55,"speed":35},evolvesFrom:null,captureRate:45,legendary:false,mythical:false},
  {id:139,name:"Omastar",types:["rock","water"],base:{"hp":70,"attack":60,"defense":125,"specialAttack":115,"specialDefense":70,"speed":55},evolvesFrom:138,captureRate:45,legendary:false,mythical:false},
  {id:140,name:"Kabuto",types:["rock","water"],base:{"hp":30,"attack":80,"defense":90,"specialAttack":55,"specialDefense":45,"speed":55},evolvesFrom:null,captureRate:45,legendary:false,mythical:false},
  {id:141,name:"Kabutops",types:["rock","water"],base:{"hp":60,"attack":115,"defense":105,"specialAttack":65,"specialDefense":70,"speed":80},evolvesFrom:140,captureRate:45,legendary:false,mythical:false},
  {id:142,name:"Aerodactyl",types:["rock","flying"],base:{"hp":80,"attack":105,"defense":65,"specialAttack":60,"specialDefense":75,"speed":130},evolvesFrom:null,captureRate:45,legendary:false,mythical:false},
  {id:143,name:"Snorlax",types:["normal"],base:{"hp":160,"attack":110,"defense":65,"specialAttack":65,"specialDefense":110,"speed":30},evolvesFrom:446,captureRate:25,legendary:false,mythical:false},
  {id:144,name:"Articuno",types:["ice","flying"],base:{"hp":90,"attack":85,"defense":100,"specialAttack":95,"specialDefense":125,"speed":85},evolvesFrom:null,captureRate:3,legendary:true,mythical:false},
  {id:145,name:"Zapdos",types:["electric","flying"],base:{"hp":90,"attack":90,"defense":85,"specialAttack":125,"specialDefense":90,"speed":100},evolvesFrom:null,captureRate:3,legendary:true,mythical:false},
  {id:146,name:"Moltres",types:["fire","flying"],base:{"hp":90,"attack":100,"defense":90,"specialAttack":125,"specialDefense":85,"speed":90},evolvesFrom:null,captureRate:3,legendary:true,mythical:false},
  {id:147,name:"Dratini",types:["dragon"],base:{"hp":41,"attack":64,"defense":45,"specialAttack":50,"specialDefense":50,"speed":50},evolvesFrom:null,captureRate:45,legendary:false,mythical:false},
  {id:148,name:"Dragonair",types:["dragon"],base:{"hp":61,"attack":84,"defense":65,"specialAttack":70,"specialDefense":70,"speed":70},evolvesFrom:147,captureRate:45,legendary:false,mythical:false},
  {id:149,name:"Dragonite",types:["dragon","flying"],base:{"hp":91,"attack":134,"defense":95,"specialAttack":100,"specialDefense":100,"speed":80},evolvesFrom:148,captureRate:45,legendary:false,mythical:false},
  {id:150,name:"Mewtwo",types:["psychic"],base:{"hp":106,"attack":110,"defense":90,"specialAttack":154,"specialDefense":90,"speed":130},evolvesFrom:null,captureRate:3,legendary:true,mythical:false},
  {id:151,name:"Mew",types:["psychic"],base:{"hp":100,"attack":100,"defense":100,"specialAttack":100,"specialDefense":100,"speed":100},evolvesFrom:null,captureRate:45,legendary:false,mythical:true},
] as const;

/** ID nacional #001–#151; nada acima da 1ª geração ou forma não padrão. */
export function kantoSpecies(id: number): KantoCatalogSpecies | null {
  return Number.isSafeInteger(id) && id >= 1 && id <= 151
    ? KANTO_POKEDEX[id - 1] ?? null : null;
}

export type KantoDexStatus = 'unknown' | 'seen' | 'caught';

/** Captura = espécie presente no roster, independentemente do UID. */
export function kantoDexStatus(
  id: number,
  seenIds: ReadonlySet<number>,
  capturedIds: ReadonlySet<number>
): KantoDexStatus {
  if (!kantoSpecies(id)) return 'unknown';
  if (capturedIds.has(id)) return 'caught';
  if (seenIds.has(id)) return 'seen';
  return 'unknown';
}
