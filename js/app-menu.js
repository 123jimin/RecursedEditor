function AppMenu(){
	this.menu = new nw.Menu({'type': 'menubar'});
	this.menu_file = new nw.Menu();
	this.menu_file.append(new nw.MenuItem({'label': "New Map", 'modifiers': "ctrl", 'key': "N", 'click': () => this.onClickNew()}));
	this.menu_file.append(new nw.MenuItem({'label': "Open Map...", 'modifiers': "ctrl", 'key': "O", 'click': () => this.onClickOpen()}));
	this.menu_file.append(new nw.MenuItem({'label': "Save Map", 'modifiers': "ctrl", 'key': "S", 'click': () => this.onClickSave(false)}));
	this.menu_file.append(new nw.MenuItem({'label': "Save Map As...", 'modifiers': "ctrl+alt", 'key': "S", 'click': () => this.onClickSave(true)}));
	this.menu_file.append(new nw.MenuItem({'type': 'separator'}));
	this.menu_file.append(new nw.MenuItem({'label': "Map Properties...", 'click': () => this.onClickMapConfig()}));
	this.menu_file.append(new nw.MenuItem({'label': "Run Map", 'key': "F5", 'click': () => this.onClickRun()}));
	this.menu_file.append(new nw.MenuItem({'type': 'separator'}));
	this.menu_file.append(new nw.MenuItem({'label': "App Settings...", 'click': () => this.onClickAppConfig()}));
	this.menu.append(new nw.MenuItem({'label': "File", 'submenu': this.menu_file}));

	this.menu_edit = new nw.Menu();
	this.menu_edit.append(new nw.MenuItem({'label': "Clear Room", 'click': () => this.onClickClearRoom()}));
	// this.menu_edit.append(new nw.MenuItem({'label': "Copy to Wet/Dry", 'click': this.onClickCopyInst()}));
	this.menu_edit.append(new nw.MenuItem({'type': 'separator'}));
	this.menu_edit_flooded = new nw.MenuItem({'type': 'checkbox', 'modifiers': "alt", 'key': "F", 'label': "Edit Flooded Room", 'click': ()=>{}});
	this.menu_edit_sync = new nw.MenuItem({'type': 'checkbox', 'modifiers': "alt", 'key': "S", 'label': "Sync Edit", 'click': ()=>{}});
	this.menu_edit_items = new nw.MenuItem({'type': 'checkbox', 'modifiers': "alt", 'key': "E", 'label': "Edit Items", 'click': ()=>{}});
	this.menu_edit.append(this.menu_edit_flooded);
	this.menu_edit.append(this.menu_edit_sync);
	this.menu_edit.append(this.menu_edit_items);
	this.menu.append(new nw.MenuItem({'label': "Edit", 'submenu': this.menu_edit}));
};

AppMenu.prototype.onClickNew = function AppMenu$onClickNew(){};
AppMenu.prototype.onClickOpen = function AppMenu$onClickOpen(){};
AppMenu.prototype.onClickSave = function AppMenu$onClickSave(save_as){};

AppMenu.prototype.onClickMapConfig = function AppMenu$onClickMapConfig(){};
AppMenu.prototype.onClickAppConfig = function AppMenu$onClickAppConfig(){};

AppMenu.prototype.onClickRun = function AppMenu$onClickRun(){};

AppMenu.prototype.onClickClearRoom = function AppMenu$onClickClearRoom(){};
AppMenu.prototype.onClickCopyInst = function AppMenu$onClickCopyInst(){};

module.exports = AppMenu;
