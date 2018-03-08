function ImageLoader(){
	this.canvas = document.createElement('canvas');
	this.context = this.canvas.getContext('2d');
};

ImageLoader.prototype.load = function ImageLoader$load(path){
	return new Promise((resolve, reject) => {
		let image = new Image();
		image.src = path;
		image.onload = () => {
			this.canvas.width = image.width;
			this.canvas.height = image.height;
			this.context.drawImage(image, 0, 0);
			resolve(this.context);
		};
	});
};

module.exports = ImageLoader;
