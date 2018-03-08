jQuery(($) => {
	const MapEditor = require("../js/editor.js");

	let editor = null;
	Promise.resolve(new MapEditor(nw, $, $('#root'))).then((e) => editor = e).then(
		() => editor.checkRecursedDirectory()
	).then(() => {
		editor.saveConfig();
		editor.createNewMap();
	}).catch((e) => {
		console.error(e);
	});
});
