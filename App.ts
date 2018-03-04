/// <reference path="./rot.d.ts" />

// Major TODO: -list
// * JQuery
// * Editor needs actually two modes: one for editing (current) and another for gaming
//   * Time tracking for party movement, different amount of movement time for terrain
//   * Full log of tracked movement
//   * Fog of war for gaming view
// * Save location of latest loaded map

// Data models
interface HexMap { [index: string]: Hex };

interface PoI { // Aka. point of interest
	name: string;
	char: string;
	hidden: boolean;
}

interface Terrain {
	name: string;
	color: string;
	defchar: string;
	obscure: boolean; // Blocks los if on same height, TODO: How to prevent 0-visibility?
}

// Static terrain data, chars are borrowed from DF map legend:
// http://dwarffortresswiki.org/index.php/Map_legend
let TRNS: Terrain[] = [
	{ name: "unknown",    color: "#613", defchar: '?',  obscure: true  }, // Keep unknown always first, is default for new hexes
	{ name: "shrublands", color: "#292", defchar: '"τ', obscure: false },
	{ name: "marsh",      color: "#050", defchar: 'ⁿ"', obscure: true  },
	{ name: "jungle",     color: "#050", defchar: "┤Γ", obscure: true  },
	{ name: "desert",     color: "#aa0", defchar: "~≈", obscure: false },
	{ name: "hills",      color: "#da2", defchar: "n∩", obscure: false },
	{ name: "mountains",  color: "#a84", defchar: "▲",  obscure: false }
];

// Interfaces for uploading / downloading
interface DataMap { [index: string]: HexData }

interface HexData {
	x: number;
	y: number;
	height: number;
	seen: boolean;
	pois: PoI[];
	terrain: Terrain | string; // Cannot be just string as Hex implements this
}

class Hex implements HexData {
	public terrain: Terrain = TRNS[0];
	public char: string = "?"; // Not saved to JSON
	constructor(
		readonly x: number, // Not shown to user, hex indexing is wonky anyways
		readonly y: number,
		public height: number = 1,
		public seen: boolean = false,
		public pois: PoI[] = [],
		terrain?: Terrain | string
	) {
		if (typeof terrain === "string") { this.terrain = TRNS.find(v => v.name === terrain) || TRNS[0]; }
		else if (terrain) { this.terrain = terrain; }
		this.updateTRN();
	}
	get key(): string { return this.x + "," + this.y; }
	get info(): string {
		return "<pre>" +
			this.terrain.name + "\n" +
			"Height: " + this.height + "\n" +
			"</pre>"
	}
	public remove(): void {
		if (currentHex === this) {
			currentHex = undefined;
			UI.updateInfo();
		}
		delete data[this.key];
	}
	public update(): void { // Fetch input data
		this.seen = (<HTMLInputElement>document.getElementById("seen")!).checked;
		if (this.pois) {
			this.pois.forEach((f, i) => {
				f.name = (<HTMLInputElement>document.getElementById("name" + i)!).value;
				f.char = (<HTMLInputElement>document.getElementById("char" + i)!).value;
				f.hidden = (<HTMLInputElement>document.getElementById("hidden" + i)!).checked;
			});
		}
	}
	public addPoi(): void { this.pois.push({ name: "noname", char: "??", hidden: false }); }
	public updateTRN(t?: Terrain) {
		if (t) { this.terrain = t; }
		this.char = this.terrain.defchar.substr(dice(1, this.terrain.defchar.length) - 1, 1);
	}
	public getData(): HexData {
		return { x: this.x, y: this.y, height: this.height, seen: this.seen, pois: this.pois, terrain: this.terrain.name };
	}
}

// Horrible global variables for data
let data: HexMap = {};
let partyloc: string = "";
let currentHex: Hex | undefined;

// Atm. only for defchars, maybe someday for weather and stuff
let dice = (f: number = 1, t: number = 10): number => ((ROT.RNG.getUniform() * (t - f + 1) + f) | 0)

namespace UI {
	const lightPasses = (x, y) => {
    var key = x + "," + y;
    return data[key] &&
    	data[partyloc]!.height >= data[key].height &&
    	((data[partyloc]!.height > data[key].height) || (!data[key].terrain.obscure));
	}
	const fov = new ROT.FOV.PreciseShadowcasting(lightPasses, { topology: 6 });

	// Hex coloring stuff
	const dim = (c: string, n: number): string => rgbToHex.apply(null, hexToRgb(c).map(v => Math.min(255, (v * n) | 0)))

	// Borrowed https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
	const rgbToHex = (r, g, b) => '#' + [r, g, b].map(x => { const hex = x.toString(16); return hex.length === 1 ? '0' + hex : hex }).join('')
	const hexToRgb = (hex): [number, number, number] => // NOTE: Works with short form (e.g. #fff)
	  hex.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, (m, r, g, b) => '#' + r + r + g + g + b + b)
	  .substring(1).match(/.{2}/g).map(x => parseInt(x, 16))

	export const DISPLAY = new ROT.Display({
		width: 16,
		height: 12,
		layout: "hex",
		transpose: false,
		fontSize: 40 // TODO: to editable settings
	});
	export const draw = (): void => {
		DISPLAY.clear()
		// TODO: Draw every hex only once
		for (let i in data) {
			DISPLAY.draw(
				data[i].x,
				data[i].y,
				data[i].pois.length > 0 ? data[i].pois[0].char : data[i].char,
				data[i].terrain.color,
				dim(data[i].terrain.color,0.5)
			);
		}
		if (partyloc !== "") {
			let loc = partyloc.split(",").map(v => +v);
			fov.compute(loc[0], loc[1], 2, (x, y, r, vis) => { // TODO: los-range to editable settings
				let hex = data[x + "," + y];
				if (hex) {
			    let ch = (r ? (hex.pois.length > 0 ? hex.pois[0].char : hex.char) : "@");
			    hex.seen = true;
			    DISPLAY.draw(x, y, ch, r !== 0 && (!hex.seen || hex.pois.length === 0) ? dim(hex.terrain.color, 2) : "#fff", hex.terrain.color);
			  }
			});
		}
		if (currentHex && Input.lock) {
			DISPLAY.draw(currentHex.x, currentHex.y, currentHex.char, currentHex.terrain.color, "#f00");
		}
	}
	export const init = (): void => {
		document.getElementById("mapContainer")!.appendChild(DISPLAY.getContainer());
		// Capture key events only when mouse is over canvas, TODO: There must be a better way for this
		DISPLAY.getContainer().addEventListener("mouseout",  () => { Input.mouseover = false; });
		DISPLAY.getContainer().addEventListener("mouseover", () => { Input.mouseover = true; });
	}
	export const updateInfo = (): void => {
		const featureNode = document.getElementById("featureHolder")!;
		while (featureNode.lastChild) { featureNode.removeChild(featureNode.lastChild); }
		if (!currentHex) { return; }
		document.getElementById("textHolder")!.innerHTML = currentHex.info;
		(<HTMLInputElement>document.getElementById("seen")!).checked = currentHex.seen;
		(<HTMLInputElement>document.getElementById("seen")!).disabled = !Input.lock;
		if (currentHex.pois && currentHex.pois.length > 0) {
			featureNode.appendChild(document.createElement("p")).innerHTML = " Places of interest: ";
			currentHex.pois.forEach((f, i) => {
				const newNode = document.createElement("div");
				newNode.id = "feature" + i;
				featureNode.appendChild(newNode);
				const buttonElement = newNode.appendChild(document.createElement("button"));
				buttonElement.innerHTML = "REMOVE";
				buttonElement.onclick = () => {
					currentHex!.pois!.splice(i, 1);
					updateInfo();
				}
				buttonElement.disabled = !Input.lock;
				newNode.appendChild(document.createTextNode(" Name: "));
				const nameElement = newNode.appendChild(document.createElement("input"));
				nameElement.id = "name" + i;
				nameElement.value = f.name;
				nameElement.disabled = !Input.lock;
				newNode.appendChild(document.createTextNode(" Char: "));
				const charElement = newNode.appendChild(document.createElement("input"));
				charElement.id = "char" + i;
				charElement.value = f.char;
				charElement.disabled = !Input.lock;
				newNode.appendChild(document.createTextNode(" Hidden: "));
				const hiddenElement = newNode.appendChild(document.createElement("input"));
				hiddenElement.id = "hidden" + i;
				hiddenElement.type = "checkbox";
				hiddenElement.checked = f.hidden;
				hiddenElement.disabled = !Input.lock;
			});
		}
	}
}

namespace Input {
	export let lock: boolean = false;
	export let mouseover: boolean = false;
	let trnPaint: Terrain | undefined = undefined;
	const setCurrent = (h: Hex | undefined): boolean => {
		if (lock || h === undefined) { return false; }
		if (currentHex === h) { return true; }
		if (currentHex) { currentHex.update(); }
		currentHex = h;
		UI.updateInfo();
		return true;
	}
	
	export const init = (): void => {
		document.addEventListener("keypress", keypress);
		UI.DISPLAY.getContainer().addEventListener('mousedown', (evt) => {
			if (evt instanceof MouseEvent) {
				let loc = UI.DISPLAY.eventToPosition(evt).join(",");
				if (evt.button === 2) { lock = !lock; UI.updateInfo(); }
				else {
					if (data[loc]) {
						const index = (TRNS.findIndex((v) => v.name === data[loc].terrain.name) + 1) % (TRNS.length);
						trnPaint = TRNS[index === 0 ? 1 : index]; // NOTE: This skips unknown terrain
						data[loc].updateTRN(trnPaint);
					}
					else {
						data[loc] = new Hex(+loc.split(',')[0], +loc.split(',')[1]);
					}
				}
				UI.draw();
			}
		});
		UI.DISPLAY.getContainer().addEventListener('mouseup', (evt) => { trnPaint = undefined; });
		UI.DISPLAY.getContainer().addEventListener('mousemove', (evt) => {
			mouseover = true;
			if (!(evt instanceof MouseEvent) || !setCurrent(data[UI.DISPLAY.eventToPosition(evt).join(",")])) { return; }
			if (trnPaint !== undefined && currentHex!.terrain !== trnPaint) { // Painting multiple terrain
				currentHex!.updateTRN(trnPaint);
				UI.draw();
			}
		});
	}
	export const keypress = (e: KeyboardEvent): void => {
		if (!mouseover) { return; } // To not mess with input since this is used globally
		switch (e.which ? e.which : e.keyCode) {
			case 43:  if (currentHex) { currentHex.height++; } break; // '+'
			case 45:  if (currentHex) { currentHex.height--; } break; // '-'
			case 97:  if (currentHex) { currentHex.addPoi(); UI.updateInfo(); } break; // 'a'
			case 109: if (currentHex) { partyloc = currentHex.key; } break; // 'm'
			case 114: if (currentHex) { currentHex.remove(); } break; // 'r'
			case 115: if (currentHex) { picture(); } break; // 's'
			case 100: if (currentHex) { download(); } break; // 'd'

			default: return; // Skip draw
		}
		UI.draw();
	}
	export const applySettings = (s?: ROT.DisplayOptions) => {
		UI.DISPLAY.setOptions(s ? s : {
			width: +(<HTMLInputElement>document.getElementById("mapWidth")!).value * 2,
			height: +(<HTMLInputElement>document.getElementById("mapHeight")!).value,
			layout: "hex",
			transpose: !!(<HTMLInputElement>document.getElementById("mapTranspose")!).checked,
			fontSize: +(<HTMLInputElement>document.getElementById("mapFontsize")!).value
		});
	}
}

// Load user given JSON file
let load = (s: string = "data") => {
	let filter = (d: DataMap): HexMap => {
		const retHexes: HexMap = {};
		for (let i in d) {
			retHexes[i] = (new Hex(
				d[i].x,
				d[i].y,
				d[i].height,
				d[i].seen,
				d[i].pois,
				d[i].terrain
			));
		}
		return retHexes;
	}
	const input = (<HTMLInputElement>document.getElementById('jsoninput')!);
	if (input.files) {
		const file = input.files[0];
		const reader = new FileReader();
		reader.onload = (e: Event) => {
      const json = JSON.parse(reader.result);
      data = filter(json.hexes);
			partyloc = json.partyloc ? json.partyloc : "";
			const newOptions = {
				width: json.width ? json.width : 16,
				height: json.height ? json.height : 12,
				layout: "hex",
				transpose: json.transpose !== undefined ? json.transpose : false,
				fontSize: json.fontsize ? json.fontsize : 40
			};
			UI.DISPLAY.setOptions(newOptions);
			// NOTE: Width is reduced to half for more human readable form
			(<HTMLInputElement>document.getElementById("mapWidth")!).value = String(newOptions.width / 2 | 0);
			(<HTMLInputElement>document.getElementById("mapHeight")!).value = newOptions.height;
			(<HTMLInputElement>document.getElementById("mapFontsize")!).value = newOptions.fontSize;
			(<HTMLInputElement>document.getElementById("mapTranspose")!).checked = newOptions.transpose;
			UI.draw();
		};
		reader.readAsText(file);
	}
}

// Download current data
let download = () => {
	let dataclean = (d: HexMap): DataMap => {
		const retObjects: DataMap = {};
		for (let i in d) { retObjects[i] = d[i].getData(); }
		return retObjects;
	};
	let temp = document.createElement("a");
	document.body.appendChild(temp);
	const currentOptions = UI.DISPLAY.getOptions();
	temp.href = "data:" + "text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
		partyloc: partyloc,
		height: currentOptions.height,
		width: currentOptions.width,
		transpose: currentOptions.transpose,
		fontsize: currentOptions.fontSize,
		hexes: dataclean(data)
	}));
	temp.download = "data.json";
	temp.click();
	temp.remove();
}

// Screenshot
let picture = () => {
	let a = <HTMLCanvasElement>UI.DISPLAY.getContainer();
	let temp = document.createElement("a");
	document.body.appendChild(temp);
	temp.href = a.toDataURL("image/png").replace("image/png", "image/octet-stream");
	temp.download = "kartta.png";
	temp.click();
	temp.remove();
}

// Start everything, TODO: Do these after loading everything
UI.init();
Input.init();
