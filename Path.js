;
let TRNS = [
    { name: "unknown", color: "#613", defchar: '?', obscure: true },
    { name: "shrublands", color: "#292", defchar: '"τ', obscure: false },
    { name: "marsh", color: "#050", defchar: 'ⁿ"', obscure: true },
    { name: "jungle", color: "#050", defchar: "┤Γ", obscure: true },
    { name: "desert", color: "#aa0", defchar: "~≈", obscure: false },
    { name: "hills", color: "#da2", defchar: "n∩", obscure: false },
    { name: "mountains", color: "#a84", defchar: "▲", obscure: false }
];
class Hex {
    constructor(x, y, height = 1, seen = false, pois = [], terrain) {
        this.x = x;
        this.y = y;
        this.height = height;
        this.seen = seen;
        this.pois = pois;
        this.terrain = TRNS[0];
        this.char = "?";
        if (typeof terrain === "string") {
            this.terrain = TRNS.find(v => v.name === terrain) || TRNS[0];
        }
        else if (terrain) {
            this.terrain = terrain;
        }
        this.updateTRN();
    }
    get key() { return this.x + "," + this.y; }
    get info() {
        return "<pre>" +
            this.terrain.name + "\n" +
            "Height: " + this.height + "\n" +
            "</pre>";
    }
    remove() {
        if (currentHex === this) {
            currentHex = undefined;
            UI.updateInfo();
        }
        delete data[this.key];
    }
    update() {
        this.seen = document.getElementById("seen").checked;
        if (this.pois) {
            this.pois.forEach((f, i) => {
                f.name = document.getElementById("name" + i).value;
                f.char = document.getElementById("char" + i).value;
                f.hidden = document.getElementById("hidden" + i).checked;
            });
        }
    }
    addPoi() { this.pois.push({ name: "noname", char: "??", hidden: false }); }
    updateTRN(t) {
        if (t) {
            this.terrain = t;
        }
        this.char = this.terrain.defchar.substr(dice(1, this.terrain.defchar.length) - 1, 1);
    }
    getData() {
        return { x: this.x, y: this.y, height: this.height, seen: this.seen, pois: this.pois, terrain: this.terrain.name };
    }
}
let data = {};
let partyloc = "";
let currentHex;
let dice = (f = 1, t = 10) => ((ROT.RNG.getUniform() * (t - f + 1) + f) | 0);
var UI;
(function (UI) {
    const lightPasses = (x, y) => {
        var key = x + "," + y;
        return data[key] &&
            data[partyloc].height >= data[key].height &&
            ((data[partyloc].height > data[key].height) || (!data[key].terrain.obscure));
    };
    const fov = new ROT.FOV.PreciseShadowcasting(lightPasses, { topology: 6 });
    const dim = (c, n) => rgbToHex.apply(null, hexToRgb(c).map(v => Math.min(255, (v * n) | 0)));
    const rgbToHex = (r, g, b) => '#' + [r, g, b].map(x => { const hex = x.toString(16); return hex.length === 1 ? '0' + hex : hex; }).join('');
    const hexToRgb = (hex) => hex.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, (m, r, g, b) => '#' + r + r + g + g + b + b)
        .substring(1).match(/.{2}/g).map(x => parseInt(x, 16));
    UI.DISPLAY = new ROT.Display({
        width: 16,
        height: 12,
        layout: "hex",
        transpose: false,
        fontSize: 40
    });
    UI.draw = () => {
        UI.DISPLAY.clear();
        for (let i in data) {
            UI.DISPLAY.draw(data[i].x, data[i].y, data[i].pois.length > 0 ? data[i].pois[0].char : data[i].char, data[i].terrain.color, dim(data[i].terrain.color, 0.5));
        }
        if (partyloc !== "") {
            let loc = partyloc.split(",").map(v => +v);
            fov.compute(loc[0], loc[1], 2, (x, y, r, vis) => {
                let hex = data[x + "," + y];
                if (hex) {
                    let ch = (r ? (hex.pois.length > 0 ? hex.pois[0].char : hex.char) : "@");
                    hex.seen = true;
                    UI.DISPLAY.draw(x, y, ch, r !== 0 && (!hex.seen || hex.pois.length === 0) ? dim(hex.terrain.color, 2) : "#fff", hex.terrain.color);
                }
            });
        }
        if (currentHex && Input.lock) {
            UI.DISPLAY.draw(currentHex.x, currentHex.y, currentHex.char, currentHex.terrain.color, "#f00");
        }
    };
    UI.init = () => {
        document.getElementById("mapContainer").appendChild(UI.DISPLAY.getContainer());
        UI.DISPLAY.getContainer().addEventListener("mouseout", () => { Input.mouseover = false; });
        UI.DISPLAY.getContainer().addEventListener("mouseover", () => { Input.mouseover = true; });
    };
    UI.updateInfo = () => {
        const featureNode = document.getElementById("featureHolder");
        while (featureNode.lastChild) {
            featureNode.removeChild(featureNode.lastChild);
        }
        if (!currentHex) {
            return;
        }
        document.getElementById("textHolder").innerHTML = currentHex.info;
        document.getElementById("seen").checked = currentHex.seen;
        document.getElementById("seen").disabled = !Input.lock;
        if (currentHex.pois && currentHex.pois.length > 0) {
            featureNode.appendChild(document.createElement("p")).innerHTML = " Places of interest: ";
            currentHex.pois.forEach((f, i) => {
                const newNode = document.createElement("div");
                newNode.id = "feature" + i;
                featureNode.appendChild(newNode);
                const buttonElement = newNode.appendChild(document.createElement("button"));
                buttonElement.innerHTML = "REMOVE";
                buttonElement.onclick = () => {
                    currentHex.pois.splice(i, 1);
                    UI.updateInfo();
                };
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
    };
})(UI || (UI = {}));
var Input;
(function (Input) {
    Input.lock = false;
    Input.mouseover = false;
    let trnPaint = undefined;
    const setCurrent = (h) => {
        if (Input.lock || h === undefined) {
            return false;
        }
        if (currentHex === h) {
            return true;
        }
        if (currentHex) {
            currentHex.update();
        }
        currentHex = h;
        UI.updateInfo();
        return true;
    };
    Input.init = () => {
        document.addEventListener("keypress", Input.keypress);
        UI.DISPLAY.getContainer().addEventListener('mousedown', (evt) => {
            if (evt instanceof MouseEvent) {
                let loc = UI.DISPLAY.eventToPosition(evt).join(",");
                if (evt.button === 2) {
                    Input.lock = !Input.lock;
                    UI.updateInfo();
                }
                else {
                    if (data[loc]) {
                        const index = (TRNS.findIndex((v) => v.name === data[loc].terrain.name) + 1) % (TRNS.length);
                        trnPaint = TRNS[index === 0 ? 1 : index];
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
            Input.mouseover = true;
            if (!(evt instanceof MouseEvent) || !setCurrent(data[UI.DISPLAY.eventToPosition(evt).join(",")])) {
                return;
            }
            if (trnPaint !== undefined && currentHex.terrain !== trnPaint) {
                currentHex.updateTRN(trnPaint);
                UI.draw();
            }
        });
    };
    Input.keypress = (e) => {
        if (!Input.mouseover) {
            return;
        }
        switch (e.which ? e.which : e.keyCode) {
            case 43:
                if (currentHex) {
                    currentHex.height++;
                }
                break;
            case 45:
                if (currentHex) {
                    currentHex.height--;
                }
                break;
            case 97:
                if (currentHex) {
                    currentHex.addPoi();
                    UI.updateInfo();
                }
                break;
            case 109:
                if (currentHex) {
                    partyloc = currentHex.key;
                }
                break;
            case 114:
                if (currentHex) {
                    currentHex.remove();
                }
                break;
            case 115:
                if (currentHex) {
                    picture();
                }
                break;
            case 100:
                if (currentHex) {
                    download();
                }
                break;
            default: return;
        }
        UI.draw();
    };
    Input.applySettings = (s) => {
        UI.DISPLAY.setOptions(s ? s : {
            width: +document.getElementById("mapWidth").value * 2,
            height: +document.getElementById("mapHeight").value,
            layout: "hex",
            transpose: !!document.getElementById("mapTranspose").checked,
            fontSize: +document.getElementById("mapFontsize").value
        });
    };
})(Input || (Input = {}));
let load = (s = "data") => {
    let filter = (d) => {
        const retHexes = {};
        for (let i in d) {
            retHexes[i] = (new Hex(d[i].x, d[i].y, d[i].height, d[i].seen, d[i].pois, d[i].terrain));
        }
        return retHexes;
    };
    const input = document.getElementById('jsoninput');
    if (input.files) {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
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
            document.getElementById("mapWidth").value = String(newOptions.width / 2 | 0);
            document.getElementById("mapHeight").value = newOptions.height;
            document.getElementById("mapFontsize").value = newOptions.fontSize;
            document.getElementById("mapTranspose").checked = newOptions.transpose;
            UI.draw();
        };
        reader.readAsText(file);
    }
};
let download = () => {
    let dataclean = (d) => {
        const retObjects = {};
        for (let i in d) {
            retObjects[i] = d[i].getData();
        }
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
};
let picture = () => {
    let a = UI.DISPLAY.getContainer();
    let temp = document.createElement("a");
    document.body.appendChild(temp);
    temp.href = a.toDataURL("image/png").replace("image/png", "image/octet-stream");
    temp.download = "kartta.png";
    temp.click();
    temp.remove();
};
UI.init();
Input.init();
