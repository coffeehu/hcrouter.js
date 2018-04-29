/*思路源于 director.js*/

(function(exports){

//用于绑定事件
var listener = {
	init:function(fn){

		if('onhashchange' in window 
			&& (document.documentMode > 7 || document.documentMode === undefined) ){
			window.onhashchange = fn;
		}else{

		}

	}
}

var Router = exports.Router = function(routes){
	this.routes = {}; //路由表
	this.mount(routes);
	console.log(this.routes)
}

Router.prototype.mount = function(routes){
	if(!routes || typeof routes !== 'object' || Array.isArray(routes) ){
		return;
	}
	var that = this;

	for(var path in routes){
		if(routes.hasOwnProperty(path)){
			that.insert( path, routes[path] );
		}
	}
}

//构建路由表
Router.prototype.insert = function(path,fn){
	path = path.slice(1);
	this.routes[path] = fn;
}


//绑定 hashchange 事件
Router.prototype.init = function(){
	var that = this;
	that.hanlder = function(onChangeEvent){
		var newURL = onChangeEvent && onChangeEvent.newURL || window.location.hash;
    	var path = newURL.replace(/.*#\//, ''); // 如将 "http://localhost/index#/home" => "home"
		that.dispatch(path);
	}
	listener.init(that.hanlder);
}

Router.prototype.dispatch = function(path){
	if(typeof this.routes[path] === 'function'){
		this.routes[path]();
	}
}

}(window))