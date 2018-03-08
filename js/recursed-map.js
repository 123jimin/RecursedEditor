const MAP_WIDTH = 20, MAP_HEIGHT = 15;
const RESERVED_NAMES = {'start': true, 'glitch': true, 'reject': true, 'threadless': true};

const CODE_HEADER = "Created with RecursedEditor";

const is_valid_name = (name) => /^[A-Z_][A-Z0-9_]*$/i.test(name);
const escape_str = (name) => name.replace(/([\\"])/g, "\\$1");
const unescape_str = (name) => name;

const item_identical = (item_a, item_b) => {
	if(item_a.type !== item_b.type) return false;
	if(item_a.pos[0] !== item_b.pos[0] || item_a.pos[1] !== item_b.pos[1]) return false;
	if(item_a.global !== item_b.global) return false;
	if('data' in item_a) return item_a.data === item_b.data;
	return true;
};

function RecursedMapRoomInstance(is_wet){
	this.map = [];
	this.items = [];
	this.is_wet = is_wet;

	for(let i=0; i<MAP_HEIGHT; i++){
		let row = [];
		for(let j=0; j<MAP_WIDTH; j++){
			row.push('empty');
		}
		this.map.push(row);
	}
};

RecursedMapRoomInstance.prototype.clearMap = function RecursedMapRoomInstance$clearMap(){
	for(let i=0; i<MAP_HEIGHT; i++) for(let j=0; j<MAP_WIDTH; j++){
		this.map[i][j] = 'empty';
	}
	this.items = [];
};

RecursedMapRoomInstance.prototype.toString = function RecursedMapRoomInstance$toString(){
	return this.map.map((row) => row.join(' ')).join('\n');
};

RecursedMapRoomInstance.prototype.applyMap = function RecursedMapRoomInstance$applyMap(arr, tilemap){
	for(let i=0; i<MAP_HEIGHT && i<arr.length; i++) for(let j=0; j<MAP_WIDTH && j<arr[i].length; j++){
		if(arr[i][j] in tilemap) this.map[i][j] = tilemap[arr[i][j]];
	}
};

RecursedMapRoomInstance.prototype.addItem = function RecursedMapRoomInstance$addItem(item){
	let item_clone = {};
	for(let key in item) item_clone[key] = item[key];
	this.items.push(item_clone);
};

RecursedMapRoomInstance.prototype.removeItemAt = function RecursedMapRoomInstance$removeItemAt(ind){
	if(ind < 0) return null;
	return this.items.splice(ind, 1)[0];
};

RecursedMapRoomInstance.prototype.removeItem = function RecursedMapRoomInstance$removeItem(item){
	this.removeItemAt(this.itemIndexOf(item));
};

RecursedMapRoomInstance.prototype.itemIndexOf = function RecursedMapRoomInstance$itemIndexOf(item){
	for(let i=0; i<this.items.length; i++){
		if(item_identical(this.items[i], item)) return i;
	}
	return -1;
};

RecursedMapRoomInstance.prototype.toCode = function RecursedMapRoomInstance$toCode(tile_map, indent){
	return RecursedMapRoomInstance.getMapCode(this.map, tile_map) + RecursedMapRoomInstance.getItemCode(this.items, indent);
};

RecursedMapRoomInstance.getMapCode = function RecursedMapRoomInstance$getMapCode(map, tile_map){
	let code = map.map((row) => row.map((cell) => tile_map[cell]).join('')).join('\n');
	return `ApplyTiles(tile_mapping, 0, 0, [[\n${code}\n]])`;
};

RecursedMapRoomInstance.getItemCode = function RecursedMapRoomInstance$getItemCode(items, indent){
	return items.map((item) => {
		let args;
		switch(item.type){
			case 'chest':
			case 'cauldron':
			case 'record':
				args = `("${item.type}", ${item.pos[0]}, ${item.pos[1]}, "${escape_str(item.data)}")`;
				break;
			case 'bird':
				args = `("${item.type}", ${item.pos[0]}, ${item.pos[1]}, ${item.data})`;
				break;
			default:
				args = `("${item.type}", ${item.pos[0]}, ${item.pos[1]})`;
		}
		return `\n${indent}${item.global ? 'Global' : 'Spawn'}${args}`;
	}).join('');
};

function RecursedMapRoom(name){
	this.name = name;
	this.dry = new RecursedMapRoomInstance(false);
	this.wet = new RecursedMapRoomInstance(true);
};

RecursedMapRoom.prototype.toCode = function RecursedMapRoom$toCode(tile_map){
	let intro = `function ${this.name}(is_wet)`;
	let identical_map = true;
	let items_dry = [], items_wet = [], items_all = [];
	for(let i=0; i<MAP_HEIGHT && identical_map; i++) for(let j=0; j<MAP_WIDTH; j++){
		if(this.wet.map[i][j] !== this.dry.map[i][j]){
			identical_map = false; break;
		}
	}
	for(let i=0; i<this.wet.items.length; i++){
		if(this.dry.itemIndexOf(this.wet.items[i]) === -1) items_wet.push(this.wet.items[i]);
		else items_all.push(this.wet.items[i]);
	}

	for(let i=0; i<this.dry.items.length; i++){
		if(this.wet.itemIndexOf(this.dry.items[i]) === -1) items_dry.push(this.dry.items[i]);
	}

	if(identical_map){
		let intro_map = `${intro}\n  ${RecursedMapRoomInstance.getMapCode(this.dry.map, tile_map)}`
		if(items_dry.length > 0 && items_wet.length > 0) return `${intro_map}
  if is_wet then${RecursedMapRoomInstance.getItemCode(items_wet, '    ')}
  else${RecursedMapRoomInstance.getItemCode(items_dry, '    ')}
  end${RecursedMapRoomInstance.getItemCode(items_all, '  ')}\nend`;
		if(items_dry.length > 0) return `${intro_map}
  if not is_wet then${RecursedMapRoomInstance.getItemCode(items_dry, '    ')}
  end${RecursedMapRoomInstance.getItemCode(items_all, '  ')}\nend`;
		if(items_wet.length > 0) return `${intro_map}
  if is_wet then${RecursedMapRoomInstance.getItemCode(items_wet, '    ')}
  end${RecursedMapRoomInstance.getItemCode(items_all, '    ')}\nend`;
		return `${intro_map}${RecursedMapRoomInstance.getItemCode(items_all, '  ')}\nend`;
	}else{
		return `${intro}
  if is_wet then
    ${RecursedMapRoomInstance.getMapCode(this.wet.map, tile_map)}${RecursedMapRoomInstance.getItemCode(items_wet, '    ')}
  else
    ${RecursedMapRoomInstance.getMapCode(this.dry.map, tile_map)}${RecursedMapRoomInstance.getItemCode(items_dry, '    ')}
  end${RecursedMapRoomInstance.getItemCode(items_all, '  ')}\nend`;
	}
};

function RecursedMap(){
	this.rooms = {
		'start': new RecursedMapRoom('start'),
	};
	this.rooms_order = ['start'];
	this.tileset = "tiles/wip";
	this.pattern = "backgrounds/wip";
};

RecursedMap.prototype.createRoom = function RecursedMap$createRoom(new_name){
	if(new_name in this.rooms) return this.rooms[new_name];
	if(!is_valid_name(new_name)) return null;

	let room = new RecursedMapRoom(new_name);
	this.rooms[new_name] = room;
	this.rooms_order.push(new_name);

	return room;
};

RecursedMap.prototype.deleteRoom = function RecursedMap$deleteRoom(room_name){
	if(!(room_name in this.rooms)) return false;
	if(room_name in RESERVED_NAMES) return false;

	this.rooms_order.splice(this.rooms_order.indexOf(room_name), 1);
	delete this.rooms[room_name];

	return true;
}

RecursedMap.prototype.changeRoomName = function RecursedMap$changeRoomName(old_name, new_name){
	if(old_name === new_name && new_name in this.rooms) return true;
	if(!(old_name in this.rooms) || new_name in this.rooms) return false;
	if(old_name in RESERVED_NAMES || new_name in RESERVED_NAMES || !is_valid_name(new_name)) return false;
	this.rooms[new_name] = this.rooms[old_name];
	this.rooms_order[this.rooms_order.indexOf(old_name)] = new_name;
	this.rooms[new_name].name = new_name;
	delete this.rooms[old_name];
	return true;
};

RecursedMap.prototype.toCode = function RecursedMap$toCode(tile_map){
	let tile_codes = `local tile_mapping = {${Object.keys(tile_map).map((ch) => `["${escape_str(tile_map[ch])}"]="${escape_str(ch)}"`).join(', ')}}`;
	let room_codes = this.rooms_order.map((label) => this.rooms[label].toCode(tile_map)).join('\n\n');
	let theme = `tiles = "${escape_str(this.tileset)}"\npattern = "${escape_str(this.pattern)}"`;
	return `-- ${CODE_HEADER}\n\n${tile_codes}\n\n${room_codes}\n\n${theme}\n`
};

RecursedMap.fromCode = function RecursedMap_fromCode(code){
	let parse_mode = 'outer';
	let arr_elems = [];

	let cur_tileset_name = "";
	let cur_tileset_buffer = [];
	let parse_tileset_buffer = () => {
		let str = cur_tileset_buffer.join(' ');
		let tmp_def = str.split('=', 1)[0];
		str = str.slice(tmp_def.length+1).trim().slice(1, -1);
		let tileset_chars = str.match(/\s*(?:\S|\["[^"\\]"\])\s*=\s*"[^"]*"\s*(?:,|$)/g) || [];
		let tileset_obj = {};
		tileset_chars.forEach((x) => {
			let chs = x.match(/\s*(?:(\S)|\["([^"\\])"\])\s*=\s*"([^"]*)"/);
			if(chs === null) return null;
			tileset_obj[chs[1] || unescape_str(chs[2])] = unescape_str(chs[3]);
		})
		return ['tileset', cur_tileset_name, tileset_obj];
	};

	let cur_function_name = "";
	let cur_function_wet = "";
	let cur_function_body = [];
	let cur_function_stack = [];
	let is_stack_wet = () => {
		let wet = cur_function_wet;
		let wet_positive = new RegExp(`^(?:${wet}|true\s*==\s*${wet}|${wet}\s*==\s*true)$`);
		let wet_negative = new RegExp(`^(?:(?:not\s|\!)\s*${wet}|false\s*==\s*${wet}|${wet}\s*==\s*false)$`);
		for(let i=cur_function_stack.length; i-->0;){
			let a = cur_function_stack[i];
			if(a[0] === 'if' && a[1].match(wet_positive)) return 'wet';
			if(a[0] === 'if' && a[1].match(wet_negative)) return 'dry';
			if(a[0] === 'else' && a[1].match(wet_positive)) return 'dry';
			if(a[0] === 'else' && a[1].match(wet_negative)) return 'wet';
		}
		return 'all';
	};
	let parse_item_args = (args) => {
		switch(args.split(',', 1)[0].trim()){
			case '"bird"':
				break;
			case '"record"':
			default:
				return args.split(',').map((token) => {
					token = token.trim();
					return token[0] === '"' && token[token.length-1] === '"' ? token.slice(1,-1) : token;
				});
		}
	};

	let cur_map_tile = "";
	let cur_map_buffer = [];

	// Parse the code
	code.split('\n').forEach((line) => {
		if(parse_mode !== 'map') line = line.replace(/(?:^\s+|\s+$|--.+$)/g, '');
		// console.log(`Parse mode: ${parse_mode} | ${line}`);
		switch(parse_mode){
			case 'outer':
				let match_var_def = line.match(/^(tiles|pattern)\s*=\s*"([^"]+)"$/);
				if(match_var_def !== null){
					arr_elems.push(['value', match_var_def[1], unescape_str(match_var_def[2])]);
					break;
				}
				let match_color_def = line.match(/^(light|dark)\s*=\s*{\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*}$/);
				if(match_color_def !== null){
					arr_elems.push(['value', match_color_def[1], [match_color_def[2], match_color_def[3], match_color_def[4]]]);
					break;
				}
				let match_function_def = line.match(/^function\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)?\s*\)$/);
				if(match_function_def !== null){
					cur_function_name = match_function_def[1];
					cur_function_wet = match_function_def[2];
					cur_function_body = [];
					parse_mode = 'function';
					break;
				}
				let tileset_def = line.match(/^(?:local\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*{/);
				if(tileset_def !== null){
					cur_tileset_name = tileset_def[1];
					cur_tileset_buffer = [line];
					if(line[line.length-1] === '}'){
						arr_elems.push(parse_tileset_buffer());
					}else{
						parse_mode = 'tileset';
					}
					break;
				}
				break;
			case 'tileset':
				cur_tileset_buffer.push(line);
				if(line[line.length-1] === '}'){
					arr_elems.push(parse_tileset_buffer());
					parse_mode = 'outer';
				}
				break;
			case 'function':
				if(line === 'end'){
					if(cur_function_stack.length === 0){
						arr_elems.push(['function', cur_function_name, cur_function_body]);
						parse_mode = 'outer';
					}else{
						cur_function_stack.pop();
					}
					break;
				}
				if(line === 'else'){
					let condition = cur_function_stack.pop();
					cur_function_stack.push(['else', condition[1]]);
				}
				let match_map_def = line.match(/^ApplyTiles\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*0\s*,\s*0\s*,\s*\[\[$/);
				if(match_map_def !== null){
					cur_map_tile = match_map_def[1];
					cur_map_buffer = [];
					parse_mode = 'map';
					break;
				}
				let match_item = line.match(/^(Spawn|Global)\s*\(([^)]+)\)$/);
				if(match_item !== null){
					cur_function_body.push(['item', match_item[1] === 'Global', is_stack_wet(), parse_item_args(match_item[2])]);
					break;
				}
				let match_if = line.match(/^if\s(.+)\sthen$/);
				if(match_if !== null){
					cur_function_stack.push(['if', match_if[1].trim()]);
					break;
				}
				let match_else_if = line.match(/^elseif\s(.+)\sthen$/);
				if(match_else_if !== null){
					cur_function_stack.pop();
					cur_function_stack.push(['if', '#']);
					break;
				}
				if(line.startsWith("for ") || line.startsWith("while ")){
					cur_function_stack.push([line.split(' ', 1)[0], '#']);
					break;
				}
				break;
			case 'map':
				if(line.includes(']]')){
					parse_mode = 'function';
					cur_function_body.push(['map', is_stack_wet(), cur_map_tile, cur_map_buffer]);
				}else{
					cur_map_buffer.push(line);
				}
				break;
		}
	});

	let tilesets = {};
	let values = {
		'tiles': "tiles/wip",
		'pattern':"backgrounds/wip"
	};
	let functions = [];

	arr_elems.forEach((elem) => {
		if(elem[0] === 'tileset') tilesets[elem[1]] = elem[2];
		else if(elem[0] === 'value') values[elem[1]] = elem[2];
		else if(elem[0] === 'function') functions.push([elem[1], elem[2]]);
	});

	let return_map = new RecursedMap;
	return_map.tileset = values.tiles;
	return_map.pattern = values.pattern;

	functions.forEach((arr) => {
		let room_name = arr[0];
		let room_content = arr[1];
		let room = return_map.createRoom(room_name);
		if(room === null) throw new SyntaxError("Invalid room name");
		room_content.forEach((content) => {
			let is_wet;
			switch(content[0]){
				case 'map':
					is_wet = content[1];
					if(!(content[2] in tilesets)) throw new SyntaxError("Invalid tileset");
					if(is_wet === 'all' || is_wet === 'dry')
						room.dry.applyMap(content[3], tilesets[content[2]]);
					if(is_wet === 'all' || is_wet === 'wet')
						room.wet.applyMap(content[3], tilesets[content[2]]);
					break;
				case 'item':
					let item_args = content[3];
					let item_obj = {'type': item_args[0], 'pos': [+item_args[1], +item_args[2]], 'global': content[1]};
					switch(item_args[0]){
						case 'chest':
						case 'cauldron':
						case 'record':
							item_obj.data = item_args[3];
							break;
						case 'bird':
							break;
					}
					is_wet = content[2];
					if(is_wet === 'all' || is_wet === 'dry') room.dry.items.push(item_obj);
					if(is_wet === 'all' || is_wet === 'wet') room.wet.items.push(item_obj);
					break;
			}
		});
	});

	return return_map;
};

RecursedMap.RESERVED_NAMES = RESERVED_NAMES;
RecursedMap.MAP_WIDTH = MAP_WIDTH;
RecursedMap.MAP_HEIGHT = MAP_HEIGHT;

module.exports = RecursedMap;
