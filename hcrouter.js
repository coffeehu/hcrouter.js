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
	this.methods  = ['on', 'after', 'before']; //生命周期
	this.mount(routes);
	console.log(this.routes)
}

Router.prototype.mount = function(routes, objPath){
	if(!routes || typeof routes !== 'object' || Array.isArray(routes) ){
		return;
	}
	var that = this;

	function insertOrMount(path,route,objPath){
		var isRoute = ( path.split('/')[0]==='' ),
			routeType = typeof route,
			method = 'on';

		/*
			参数 path 可能是路径如"/home",
			也可能是生命周期如"on"、"before"、"after"
		*/
		// 是 路径=>Function 的情况时，直接插入，生命周期默认只有 on
		if(isRoute && routeType==='function'){
			that.insert( path, method, routes[path] );
			return;
		}

		// 是 路径=>Object 的情况时，递归 mount()
		if(isRoute && routeType==='object' && !Array.isArray(route)){
			// 此时 route 是一个对象如 {before:func,on:func}
			that.mount( route, path);
			return;
		}

		//是生命周期=>function的情况时（如："on":function）
		if(!isRoute && routeType==='function'){
			method = path;
			that.insert( objPath, method, routes[path] );
			return;
		}
	}

	for(var path in routes){
		if(routes.hasOwnProperty(path)){
			insertOrMount(path, routes[path], objPath);
		}
	}
}

//构建路由表
Router.prototype.insert = function(path,method,fn){
	path = path.slice(1); // "/home" => "home"
	if(this.routes[path]){
		this.routes[path][method] = fn;
	}else{
		var nested = {};
		nested[method] = fn;
		this.routes[path] = nested;	
	}
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

//根据 hash 执行对应的回调事件
Router.prototype.dispatch = function(path){
	var runList,route;
	if(typeof this.routes[path] === 'object'){
		this.invoke(this.last); //调用上次路由的after

		route = this.routes[path];
		runList = [ route.before, route.on ].filter(Boolean);

		this.last = [ route.after ];
	}
	this.invoke(runList); //存储这次路由的after
}

Router.prototype.invoke = function(array){
	if(!array && !Array.isArray(array) ) return;
	for(var i=0,l=array.length;i<l;i++){
		if(typeof array[i] === "function") array[i]();
	}
}

}(window))