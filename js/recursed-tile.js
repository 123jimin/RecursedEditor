const fs = require('fs');
const ImageLoader = require("./image-loader.js");

const TILE_SIZE = 16;
const TILE_CHAR = `.0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%=?!^&/:;*+~-_,(){}<>'`;

function RecursedTile(path_img, path_lua){
	this.loader = new ImageLoader;
	this.path_img = path_img;
	this.path_lua = path_lua;

	this.canvas = null;
	this.context = null;
	this.dimension = [0, 0];
	this.tile_defs = {};
	this.tile_def_orders = [];
};

RecursedTile.prototype.loadImage = function RecursedTile$loadImage(){
	this.canvas = null;
	this.context = null;
	return this.loader.load(this.path_img).then(() => {
		this.canvas = this.loader.canvas;
		this.context = this.loader.context;
		this.dimension = [this.loader.canvas.width, this.loader.canvas.height];
		let x = this.context.getImageData(0, 0, this.dimension[0], this.dimension[1]);
		for(let i=0; i<x.data.length; i+=4){
			if(x.data[i] === 0xFF && x.data[i+1] === 0x00 && x.data[i+2] === 0xFF){
				x.data[i+3] = 0x00;
			}
		}
		this.context.putImageData(x, 0, 0);
		return this.context;
	});
};

RecursedTile.prototype.getTileMap = function RecursedTile$getTileMap(){
	if(this.tile_def_orders.length > TILE_CHAR.length) throw new Error("Too many kinds of tiles!");
	let obj = {};
	this.tile_def_orders.forEach((label, ind) => obj[label] = TILE_CHAR[ind]);
	return obj;
};

RecursedTile.prototype.frameToPosition = function RecursedTile$frameToPosition(frame){
	let tile_w = 0|this.dimension[0]/TILE_SIZE;
	return [(frame%tile_w)*TILE_SIZE, (0|frame/tile_w)*TILE_SIZE];
};

RecursedTile.prototype.loadLua = function RecursedTile$loadLua(){
	let lua = fs.readFileSync(this.path_lua, 'utf-8');
	let tile_definitions = lua.match(/(?:^|\n)\s*[A-Z_][A-Z0-9_]*\s*=\s*{(?:{[^}]+}|[^{}])+}/ig);
	if(tile_definitions === null) return;
	this.tile_defs = {
		'empty': {
			'type': "Tile.Solid",
			'frame': [0, 0]
		}
	};
	this.tile_def_orders = ['empty'];
	tile_definitions.forEach((line) => {
		let def_name = line.split('=', 1)[0];
		let def_spec = line.slice(def_name.length+1).trim().slice(1, -1);
		let arr_specs = def_spec.match(/[A-Z_][A-Z0-9_]*\s*=\s*(?:[^\s{},]+|{[^}]+})\s*(?:,|$)/ig);
		let spec_obj = {};
		def_name = def_name.trim();
		if(arr_specs !== null) arr_specs.forEach((spec) => {
			let spec_name = spec.split('=', 1)[0];
			let spec_rest;
			if(spec[spec.length-1] === ',') spec_rest = spec.slice(spec_name.length+1, -1);
			else spec_rest = spec.slice(spec_name.length+1);
			spec_name = spec_name.trim();
			spec_rest = spec_rest.trim();
			switch(spec_name){
				case 'time':
					spec_rest = +spec_rest;
					break;
				case 'frame':
					if(spec_rest[0] === '{' && spec_rest[spec_rest.length-1] === '}'){
						spec_rest = spec_rest.slice(1, -1).split(',').map((s) => this.frameToPosition(+s));
						spec_obj['frames'] = spec_rest;
						spec_rest = spec_rest[0];
					}else{
						spec_rest = this.frameToPosition(+spec_rest);
					}
					break;
			}
			spec_obj[spec_name] = spec_rest;
		});
		this.tile_defs[def_name] = spec_obj;
		this.tile_def_orders.push(def_name);
	});
	this.tile_def_orders.sort((x, y) => {
		let xc = this.tile_defs[x].frame;
		let yc = this.tile_defs[y].frame;
		return xc[1] == yc[1] ? xc[0] - yc[0] : xc[1] - yc[1];
	});
};

RecursedTile.prototype.load = function RecursedTile$load(){
	return this.loadImage().then(() => this.loadLua());
};


RecursedTile.prototype.getImageData = function RecursedTile$getImageData(tile_name){
	if(this.context === null || !(tile_name in this.tile_defs)) return null;
	let def = this.tile_defs[tile_name];
	if(!('frame' in def)) return null;
	let frame = def.frame;
	return this.context.getImageData(frame[0], frame[1], TILE_SIZE, TILE_SIZE);
};

module.exports = RecursedTile;
