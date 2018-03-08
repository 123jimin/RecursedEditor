const path = require('path');
const fs = require('fs');
const child_process = require('child_process');

const AppMenu = require("./app-menu.js");
const RecursedMap = require("./recursed-map.js");
const RecursedTile = require("./recursed-tile.js");

const checkPathType = (check_path, check_dir = true) => {
	try{
		let stat = fs.lstatSync(check_path);
		return check_dir ? stat.isDirectory() : stat.isFile();
	}catch(e){
		return false;
	}
};

const isRecursedDirectory = (folder) => {
	if(folder === "") return false;
	let data_directory = path.join(folder, 'data');
	return checkPathType(data_directory) && checkPathType(path.join(data_directory, "init.lua"), false);
};

const normalizeRecursedDirectory = (folder) => {
	if(folder === "" || !checkPathType(folder)) return folder;
	switch(path.basename(folder).toLowerCase()){
		case 'data':
			return normalizeRecursedDirectory(path.dirname(folder));
		case 'steam':
			return normalizeRecursedDirectory(path.join(folder, 'steamapps'));
		case 'steamapps':
			return normalizeRecursedDirectory(path.join(folder, 'common'));
		case 'common':
			return normalizeRecursedDirectory(path.join(folder, 'Recursed'));
		case 'Recursed':
			// check for Mac
			let mac_path = path.join(folder, 'Recursed.app', 'Contents', 'Resources');
			if(checkPathType(mac_path)) return normalizeRecursedDirectory(mac_path);
	}
	return folder;
};

function MapEditor(nw_gui, jQuery, $root){
	this.app_menu = new AppMenu();

	this.app_menu.onClickNew = () => {
		if(this.current_dirty){
			if(!confirm("Any changes to the current map will be discarded.")) return;
		}
		this.createNewMap();
	};

	this.app_menu.onClickOpen = () => {
		if(this.current_dirty){
			if(!confirm("Any changes to the current map will be discarded.")) return;
		}
		this.showOpenFileDialog().then((file) => this.openMap(file));
	};

	this.app_menu.onClickSave = (save_as) => {
		if(this.current_file !== "" && !save_as){
			this.saveMap(this.current_file);
		}else{
			this.showSaveFileDialog().then((file) => this.saveMap(file));
		}
	};

	this.app_menu.onClickRun = () => {
		this.runGame();
	};

	this.app_menu.onClickClearRoom = () => {
		if(confirm("Do you really want to clear current room?")){
			this.current_room.dry.clearMap();
			this.current_room.wet.clearMap();
			this.showRoom(this.current_room.name, true);
		}
	};

	this.app_menu.onClickMapConfig = () => {
		if(this.current_map !== null)
			this.openMapConfig();
	};

	this.app_menu.onClickAppConfig = () => {
		this.openAppConfig();
	};

	this.window = nw_gui.Window.get();
	this.window.menu = this.app_menu.menu;

	this.app_config_window = null;

	this.current_file = "";
	this.current_dirty = false;

	this.current_map = null;
	this.current_room = null;
	this.current_tile = null;
	this.current_tile_type = 'empty';
	this.$tile_selects = {};

	this.$selected_item = null;
	this.selected_item = null;

	this.$item_dragging = null;
	this.drag_oc = [0, 0];
	this.drag_oc_item = [0, 0];

	this.current_running_game = null;

	this.config = {
		'recursed_base_path': "",
		'grid_snap': 4
	};

	this.loadConfig();

	// UI
	(() => {
		this.$ = jQuery;
		this.$root = $root;
		this.$loading = $root.find('#loading-cover');

		this.$rooms = $root.find('#sel-rooms');
		this.$tileSelect = $root.find('#list-tile-select');
		this.$itemEdit = $root.find('#item-edit');

		this.$roomShow = $root.find('#room-show');
		this.$roomShowCover = $root.find('#room-show-cover');
		this.$roomTileLoc = $root.find('#room-tile-loc');
		this.$roomItems = $root.find('#room-items');

		this.$flooded = $root.find('#check-flooded');
		this.$syncEdit = $root.find('#check-sync');
		this.$editItems = $root.find('#check-item');

		this.$itemTypes = $root.find('#sel-items');
		this.$checkGlobal = $root.find('#check-global');
		this.$inItemData = $root.find('#in-item-data');

		this.$fileDialog = this.$root.find('#file-dialog');
		this.$folderDialog = this.$root.find('#folder-dialog');

		this.room_tile_img = $root.find('#room-tiles')[0].getContext('2d');
		this.room_tile_img.scale(2, 2);

		this.$root.find('#btn-create').click(() => this.createRoom());
		this.$root.find('#btn-delete').click(() => {
			let room_name = this.$rooms.val();
			if(confirm(`Do you really want to delete the room '${room_name}'?`))
				this.deleteRoom(room_name);
		});
		this.$root.find('#btn-rename').click(() => {
			let room_name = this.$rooms.val();
			this.changeRoomName(room_name, prompt("Enter the new name for the room:").trim());
		});

		this.$rooms.change(() => {
			this.$flooded.prop('checked', false);
			this.$syncEdit.prop('checked', true);
			this.showRoom(this.$rooms.val());
		});

		this.app_menu.menu_edit_flooded.click = () => {
			this.$flooded.prop('checked', this.app_menu.menu_edit_flooded.checked).change();
		};

		this.app_menu.menu_edit_sync.click = () => {
			this.$syncEdit.prop('checked', this.app_menu.menu_edit_sync.checked).change();
		};

		this.app_menu.menu_edit_items.click = () => {
			this.$editItems.prop('checked', this.app_menu.menu_edit_items.checked).change();
		};

		this.$flooded.change(() => {
			this.$syncEdit.prop('checked', false).change();
			this.app_menu.menu_edit_flooded.checked = this.$flooded.is(':checked');
			this.showRoom(this.current_room.name, true);
		});

		this.$syncEdit.change(() => {
			this.app_menu.menu_edit_sync.checked = this.$syncEdit.is(':checked');
		});

		this.$editItems.change(() => {
			let edit_items = this.$editItems.is(':checked');
			if(edit_items) this.$syncEdit.prop('checked', true).change();
			this.app_menu.menu_edit_items.checked = edit_items;
			this.$tileSelect.css({'display': edit_items ? 'none' : 'block'});
			this.$roomTileLoc.css({'display': edit_items ? 'none' : 'block'});
			this.$itemEdit.css({'display': edit_items ? 'block' : 'none'});

			if(this.$selected_item !== null) this.$selected_item.removeClass('item-sel');
			this.$selected_item = null;
			this.selected_item = null;
			this.$item_dragging = null;
		});

		this.$root.find('#btn-create-item').click(() => {
			let item_type = this.$itemTypes.val();
			let item_data = this.$inItemData.val().trim();
			let obj = {'type': item_type, 'pos': [10, 7.5], 'global': this.$checkGlobal.is(':checked')};
			if(item_type === 'chest' || item_type === 'cauldron'){
				obj.data = item_data || prompt("Enter the name of the room to enter...").trim();
			}else if(item_type === 'record'){
				obj.data = item_data || prompt("Enter the name of the sound file to play...").trim();
			}
			if('data' in obj && obj.data === '') return;
			this.$inItemData.val('');
			this.addItem(obj);
		});

		// Tile editing
		this.$roomShowCover.mousemove((e) => {
			let x = e.offsetX/32;
			let y = e.offsetY/32;
			if(this.$editItems.is(':checked')){
				if(e.which === 1){
					if(this.$item_dragging){
						let dx = (e.offsetX-this.drag_oc[0])/32;
						let dy = (e.offsetY-this.drag_oc[1])/32;
						let nx = (0|(this.drag_oc_item[0]+dx)*this.config.grid_snap)/this.config.grid_snap;
						let ny = (0|(this.drag_oc_item[1]+dy)*this.config.grid_snap)/this.config.grid_snap;
						this.changeSelectedItemData((obj) => obj.pos = [nx, ny]);
						this.$item_dragging.css({
							'left': `${(nx-this.$item_dragging.data('width')/2)*32}px`,
							'top': `${(ny-this.$item_dragging.data('height')/2)*32}px`
						});
					}
				}
			}else{
				this.$roomTileLoc.css({
					'display': 'block',
					'left': `${(0|x)*32-1}px`,
					'top': `${(0|y)*32-1}px`
				});
				if(e.which === 1) this.setMapTile(0|x, 0|y, this.current_tile_type);
				else if(e.which === 3) this.setMapTile(0|x, 0|y, 'empty');
			}
		}).mouseleave(() => {
			this.$roomTileLoc.css('display', 'none');
			this.$item_dragging = null;
		}).mousedown((e) => {
			let x = e.offsetX/32;
			let y = e.offsetY/32;
			if(this.$editItems.is(':checked')){
				let item_arr = this.getItemUnderCursor(x, y);
				if(this.$selected_item !== null) this.$selected_item.removeClass('item-sel');
				if(item_arr === null) return;
				this.$selected_item = item_arr[0];
				this.selected_item = [this.current_room.dry.itemIndexOf(item_arr[1]), this.current_room.wet.itemIndexOf(item_arr[1])];
				if(e.which === 1){
					this.$item_dragging = this.$selected_item.addClass('item-sel');
					this.drag_oc = [e.offsetX, e.offsetY];
					this.drag_oc_item = [item_arr[1].pos[0], item_arr[1].pos[1]];
					this.$inItemData.val('data' in item_arr[1] ? item_arr[1].data : "");
					this.$itemTypes.val(item_arr[1].type);
					this.$checkGlobal.prop('checked', item_arr[1].global);
				}else if(e.which === 3){
					this.deleteSelectedItem();
				}
			}else{
				if(e.which === 1) this.setMapTile(0|x, 0|y, this.current_tile_type);
				else if(e.which === 2) this.selectTileType(this.getDisplayedInst().map[0|y][0|x]);
				else if(e.which === 3) this.setMapTile(0|x, 0|y, 'empty');
			}
		}).mouseup((e) => {
			this.$item_dragging = null;
		});

		this.$inItemData.change(() => {
			this.changeSelectedItemData((obj) => {
				if('data' in obj) obj.data = this.$inItemData.val().trim();
			});
		});

		this.$checkGlobal.change(() => {
			let is_global = this.$checkGlobal.is(':checked');
			this.$selected_item.css('border-color', is_global ? '#090' : '#FFF');
			this.changeSelectedItemData((obj) => {
				obj.global = is_global;
			});
		});
	})();

	this.window.on('close', () => {
		nw.App.quit();
	});
};

MapEditor.prototype.loadConfig = function MapEditor$loadConfig(){
	try{
		if(!('config' in window.localStorage)) return;
		let obj = JSON.parse(window.localStorage.config);
		for(let key in this.config) if(key in obj) this.config[key] = obj[key];
	}catch(e){};
};

MapEditor.prototype.saveConfig = function MapEditor$saveConfig(){
	window.localStorage.config = JSON.stringify(this.config);
};

MapEditor.prototype.openAppConfig = function MapEditor$openAppConfig(){
	if(this.app_config_window !== null) return;

	this.app_config_window = nw.Window.open("./ui/app-config.html");
	this.app_config_window.on('closed', () => {
		this.app_config_window = null;
	});
};

MapEditor.prototype.showError = function MapEditor$showError(e){
	alert(e.toString());
};

MapEditor.prototype.setTitle = function MapEditor$setTitle(title){
	this.window.title = `Recursed Map Editor - ${title === '' ? 'New map' : title}${this.current_dirty ? ' *' : ''}`;
};

MapEditor.prototype.openMapConfig = function MapEditor$openMapConfig(){

};

MapEditor.prototype.setDirty = function MapEditor$setDirty(dirty){
	this.current_dirty = dirty;
	this.setTitle(path.basename(this.current_file));
};

MapEditor.prototype.showOpenFileDialog = function MapEditor$showOpenFile(){
	return new Promise((resolve, reject) => {
		this.$fileDialog.removeAttr('nwsaveas').unbind('change');
		this.$fileDialog.change(() => {
			let v = this.$fileDialog.val();
			this.$fileDialog.val('');
			resolve(v);
		}).trigger('click');
	})
};

MapEditor.prototype.showSaveFileDialog = function MapEditor$showSaveFileDialog(){
	return new Promise((resolve, reject) => {
		this.$fileDialog.attr('nwsaveas', this.current_file === "" ? 'new_map' : this.current_file).unbind('change');
		this.$fileDialog.change(() => {
			let v = this.$fileDialog.val();
			this.$fileDialog.val('');
			resolve(v);
		}).trigger('click');
	})
};

MapEditor.prototype.showFolderDialog = function MapEditor$showFolderDialog(){
	return new Promise((resolve, reject) => {
		this.$folderDialog.unbind('change');
		this.$folderDialog.change(() => {
			let v = this.$folderDialog.val();
			this.$folderDialog.val('');
			resolve(v);
		}).trigger('click');
	})
};

MapEditor.prototype.checkRecursedDirectory = function MapEditor$checkRecursedDirectory(){
	let chooseRecursedDirectory = () => {
		return this.showFolderDialog().then((folder) => {
			this.config.recursed_base_path = folder;
			return this.checkRecursedDirectory();
		});
	};
	if(this.config.recursed_base_path === ""){
		alert("Select the folder where Recursed is.\n(Usually `Steam/steamapps/common/Recursed`)");
		return chooseRecursedDirectory();
	}
	this.config.recursed_base_path = normalizeRecursedDirectory(this.config.recursed_base_path);
	if(!isRecursedDirectory(this.config.recursed_base_path)){
		alert("The correct Recursed directory should has data/ in it.\n(Usually `Steam/steamapps/common/Recursed`)");
		return chooseRecursedDirectory();
	}
	return new Promise((resolve, reject) => resolve());
};

MapEditor.prototype.openMap = function MapEditor$openMap(file){
	if(file === '') return;
	try{
		let code = fs.readFileSync(file, 'utf-8');
		let map = RecursedMap.fromCode(code);
		if(map === null) throw new SyntaxError("Invalid map file");
		this.current_file = file;
		this.current_map = map;
		return this.initUI();
	}catch(e){
		this.showError(e);
		return Promise.reject();
	}
};

MapEditor.prototype.saveMap = function MapEditor$saveMap(file){
	fs.writeFileSync(file, this.current_map.toCode(this.current_tile.getTileMap()), 'utf-8');
	this.current_file = file;
	this.setDirty(false);
};

MapEditor.prototype.createNewMap = function MapEditor$createNewMap(){
	this.current_map = new RecursedMap;
	this.current_file = "";
	return this.initUI();
};

MapEditor.prototype.createRoom = function MapEditor$createRoom(){
	let room_name = prompt("Enter the name of the new room.").trim();
	if(room_name === "") return;
	let room = this.current_map.createRoom(room_name);
	if(room === null){
		this.showError("Error: Invalid name!");
	}else{
		this.setDirty(true);
		this.initSelect();
		this.showRoom(room_name, true);
	}
};

MapEditor.prototype.deleteRoom = function MapEditor$deleteRoom(room_name){
	if(this.current_map.deleteRoom(room_name)){
		this.setDirty(true);
		this.initSelect();
		this.showRoom('start', true);
	}else{
		this.showError("Error: This room couldn't be deleted.");
	}
};

MapEditor.prototype.changeRoomName = function MapEditor$changeRoomName(old_name, new_name){
	if(new_name === "") return;
	if(this.current_map.changeRoomName(old_name, new_name)){
		this.setDirty(true);
		this.initSelect();
		this.showRoom(new_name, true);
	}else{
		this.showError("Error: The name couldn't be changed.");
	}
};

MapEditor.prototype.addItem = function MapEditor$addItem(obj){
	this.setDirty(true);
	this.getEditedInst().forEach((inst) => inst.addItem(obj));
	this.showItems();
};

MapEditor.prototype.setMapTile = function MapEditor$setMapTile(x, y, type){
	let data = this.current_tile.getImageData(type);
	if(data !== null){
		this.getEditedInst().forEach((inst) => {
			if(inst.map[y][x] !== type)
				this.setDirty(true);
			inst.map[y][x] = type;
		});
		this.room_tile_img.putImageData(data, x*16, y*16);
	}
};

MapEditor.prototype.getDisplayedInst = function MapEditor$getDisplayedInst(){
	let flooded = this.$flooded.is(':checked');
	return flooded ? this.current_room.wet : this.current_room.dry;
};

MapEditor.prototype.getEditedInst = function MapEditor$getEditedInst(){
	let flooded = this.$flooded.is(':checked');
	let synced = this.$syncEdit.is(':checked');
	let arr = [];
	if(synced || !flooded) arr.push(this.current_room.dry);
	if(synced || flooded) arr.push(this.current_room.wet);
	return arr;
};

MapEditor.prototype.getItemUnderCursor = function MapEditor$getItemUnderCursor(x, y){
	let $items = this.$roomItems.children();
	for(let i=$items.length; i-->0;){
		let $elem = this.$($items[i]);
		let item = $elem.data('item');
		let w = $elem.data('width');
		let h = $elem.data('height');
		if(item.pos[0]-w/2 <= x && x <= item.pos[0]+w/2 && item.pos[1]-h/2 <= y && y <= item.pos[1]+h/2){
			return [$elem, item];
		}
	}
	return null;
};

MapEditor.prototype.changeSelectedItemData = function MapEditor$changeSelectedItemData(change){
	if(this.$selected_item === null) return;
	this.setDirty(true);
	this.getEditedInst().forEach((inst) => {
		let item_ind = this.selected_item[inst.is_wet ? 1 : 0];
		if(item_ind >= 0) change(inst.items[item_ind]);
	});
};

MapEditor.prototype.deleteSelectedItem = function MapEditor$deleteSelectedItem(){
	if(this.$selected_item === null) return;
		this.setDirty(true);
	this.getEditedInst().forEach((inst) => {
		let item_ind = this.selected_item[inst.is_wet ? 1 : 0];
		if(item_ind >= 0) inst.removeItemAt(item_ind);
	});
	this.$selected_item.remove();
	this.$selected_item = null;
	this.selected_item = null;
};

MapEditor.prototype.showItems = function MapEditor$showItems(){
	let inst = this.getDisplayedInst();
	this.$roomItems.empty();
	inst.items.forEach((item) => {
		let $item = this.$("<div class='item'/>");
		let item_data = [1, 1, '#000'];
		let text_color = '#FFF';
		switch(item.type){
			case 'chest': item_data[2] = '#960'; break;
			case 'crystal': item_data[2] = '#808'; break;
			case 'cauldron': item_data[2] = '#666'; break;
			case 'ruby': item_data[2] = '#F11'; break;
			case 'generic': item_data[2] = '#0AA'; break;
			case 'record': item_data[2] = '#44F'; break;
			case 'fan': item_data[2] = '#C04'; break;
			case 'lock':
				item_data = [1, 3, '#DD0'];
				text_color = '#000';
				break;
			case 'player':
				item_data = [1, 2, '#F6A'];
				text_color = '#000';
				break;
			case 'yield':
				item_data = [1, 2, '#0F0'];
				text_color = '#000';
				break;
			case 'key':
				item_data[2] = '#DD0';
				text_color = '#000';
				break;
			case 'diamond':
				item_data[2] = '#DDD';
				text_color = '#000';
				break;
		}
		$item.css({
			'left': `${(item.pos[0]-item_data[0]/2)*32}px`,
			'top': `${(item.pos[1]-item_data[1]/2)*32}px`,
			'width': `${item_data[0]*32-4}px`,
			'height': `${item_data[1]*32-4}px`,
			'background': item_data[2],
			'border-color': item.global ? '#090' : '#FFF',
			'line-height': `${item_data[1]*32-8}px`,
			'color': text_color
		}).text(item.type.slice(0, 4));
		$item.data({'item': item, 'width': item_data[0], 'height': item_data[1]});
		this.$roomItems.append($item);
	});
};

MapEditor.prototype.showRoom = function MapEditor$showRoom(room_name, forced = false){
	if(!(room_name in this.current_map.rooms)) return;
	if(!forced && this.current_room !== null && room_name === this.current_room.name) return;

	let room = this.current_map.rooms[room_name];
	this.current_room = room;

	let inst = this.getDisplayedInst();
	for(let x=0; x<RecursedMap.MAP_WIDTH; x++){
		for(let y=0; y<RecursedMap.MAP_HEIGHT; y++){
			let data = this.current_tile.getImageData(inst.map[y][x]);
			if(data !== null){
				this.room_tile_img.putImageData(data, x*16, y*16);
			}else{
				this.room_tile_img.fillStyle = `rgba(0, 0, 0, 0)`;
				this.room_tile_img.fillRect(x*16, y*16, 16, 16);
			}
		}
	}
	this.showItems();

	this.$root.find("#btn-delete, #btn-rename").attr('disabled', room_name in RecursedMap.RESERVED_NAMES);
	if(forced) this.$rooms.val(room_name);
};

MapEditor.prototype.getPath = function MapEditor$getPath(child_path){
	let data_path = path.join(this.config.recursed_base_path, 'data', child_path);
	let custom_path = path.join(this.config.recursed_base_path, 'custom', child_path);
	return checkPathType(data_path, false) ? data_path : custom_path;
};

MapEditor.prototype.selectTileType = function MapEditor$selectTileType(type){
	if(this.current_tile_type in this.$tile_selects){
		this.$tile_selects[this.current_tile_type].removeClass('tile-sel-current');
	}
	if(type in this.$tile_selects){
		this.$tile_selects[type].addClass('tile-sel-current');
		this.current_tile_type = type;
	}
};

MapEditor.prototype.loadTileset = function MapEditor$loadTileset(tileset){
	return new Promise((resolve, reject) => {
		let path_img = this.getPath(`${tileset}.png`);
		let path_lua = this.getPath(`${tileset}.lua`);
		let tile = new RecursedTile(path_img, path_lua);
		tile.load().then(() => {
			this.current_tile = tile;
			this.current_tile_type = 'empty';
			this.$tileSelect.empty();
			this.$tile_selects = {};
			tile.tile_def_orders.forEach((tile_type) => {
				let $tile_sel = this.$(`<li class='tile-sel'/>`).attr('title', tile_type);
				this.$tile_selects[tile_type] = $tile_sel;
				$tile_sel.css({
					'background-image': `url(file://${encodeURI(path_img.replace(/\\/g, '/'))})`,
					'background-size': `${2*tile.dimension[0]}px ${2*tile.dimension[1]}px`,
					'background-position': `-${2*tile.tile_defs[tile_type].frame[0]}px -${2*tile.tile_defs[tile_type].frame[1]}px`
				}).click(() => this.selectTileType(tile_type));
				this.$tileSelect.append($tile_sel);
			});
			this.showRoom(this.current_room.name, true);
		}).catch(reject);
	});
};

MapEditor.prototype.loadPattern = function MapEditor$loadPattern(pattern){
	return new Promise((resolve, reject) => {
		let path_img = this.getPath(`${pattern}.png`);
		resolve();
	})
};

MapEditor.prototype.initUI = function MapEditor$initUI(){
	this.$loading.css('display', 'block');
	this.current_room = this.current_map.rooms.start;

	this.$flooded.prop('checked', this.app_menu.menu_edit_flooded.checked = false);
	this.$syncEdit.prop('checked', this.app_menu.menu_edit_sync.checked = true);
	this.$checkGlobal.prop('checked', false);

	this.stopGame();
	this.setDirty(false);
	this.initSelect();
	return this.loadPattern(this.current_map.pattern).then(
		this.loadTileset(this.current_map.tileset)
	).then(() => this.$loading.css('display', 'none')).catch((err) => this.showError(err));
};

MapEditor.prototype.initSelect = function MapEditor$initSelect(){
	this.$rooms.empty();
	this.current_map.rooms_order.forEach((label) => {
		let $opt = this.$("<option/>").val(label).text(label);
		this.$rooms.append($opt);
	});
};

MapEditor.prototype.stopGame = function MapEditor$stopGame(){
	if(this.current_running_game === null) return;
	this.current_running_game.removeAllListeners('close');
	this.current_running_game.kill();
	this.current_running_game = null;
};

MapEditor.prototype.runGame = function MapEditor$runGame(){
	if(this.current_file === ""){
		this.showError("Save the file first!");
		return;
	}

	this.stopGame();
	this.current_running_game = child_process.spawn(path.join(this.config.recursed_base_path, "Recursed"),
		[path.relative(path.join(this.config.recursed_base_path, 'data'), this.current_file).replace(/\.lua$/i, '')],
		{'cwd': this.config.recursed_base_path});
	this.current_running_game.on('close', (code) => {
		this.current_running_game = null;
	});
};

module.exports = MapEditor;
