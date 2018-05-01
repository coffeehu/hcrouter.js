/*思路参考 director.js*/

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

/*
	第一次，routes为路由配置对象，objPath为undefined
	递归时，可能的值为：routes为{on:func,after:func},objPath为对应的路径，如'/home'
*/
Router.prototype.mount = function(routes, parentPath){
	if(!routes || typeof routes !== 'object' || Array.isArray(routes) ){
		return;
	}
	var that = this,
		parentPath = parentPath || [];

	function insertOrMount(path,route,parentPath){

		//如果是这种形式："/home/detail"，直接插入 this.routes
		var unNested = path.split('/').length>2;
		if(unNested){
			that.routes[path] = route;
			return;
		}

		/*
			参数 path 可能是路径如"/home",
			也可能是生命周期如"on"、"before"、"after"
		*/
		var isRoute = ( path.split('/')[0]==='' ),
			routeType = typeof route,
			method = isRoute?'on':path;

		if(isRoute){
			path = parentPath.concat( path.split('/') );
			path = path.filter(Boolean)
		}

		// 是 路径=>Function 的情况时，直接插入，生命周期默认只有 on
		if(isRoute && routeType==='function'){
			that.insert( path, method, route );
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
			that.insert( parentPath, method, route );
			return;
		}
	}

	for(var path in routes){
		if(routes.hasOwnProperty(path)){
			insertOrMount(path, routes[path], parentPath.slice(0));
		}
	}
}

//构建路由表
Router.prototype.insert = function(path,method,fn,parentRoute){
	var route = parentRoute ? parentRoute : this.routes,
		pathPart = path.shift();

	if(path.length>0){
		route[pathPart] = route[pathPart] || {};
		this.insert(path,method,fn,route[pathPart]);
		return;
	}

	if(route[pathPart]){
		route[pathPart][method] = fn;
	}else{
		var nested = {};
		nested[method] = fn;
		route[pathPart] = nested;
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
//path 为 "home" 或 "home/detail"
var toOther=0,toNested=1,toParent=2;
Router.prototype.dispatch = function(path){
	var pathString = '/'+path;

	// 是 "/home/room" 这种形式的路径
	// 若能在 this.routes 中直接找到，则直接执行
	if( pathString.split('/').length>2 && this.routes[pathString]){
		var runList = [ this.routes[pathString].before, this.routes[pathString].on ];
		this.invoke(this.last);
		this.last = [ this.routes[pathString].after ];
		this.invoke(runList);
		return;
	}

	// 转成数组，如 ["home"]、["home","detail"]
	path = path.split('/');
	var runList = this.createRunList(path.slice(0),this.routes);

	function typeOfRoute(path,lastPath,parentPath){
		if( lastPath && lastPath === parentPath){
			return toNested;
		}
		else if( lastPath && lastPath.match( new RegExp(pathString) ) ){
			return toParent;
		}
		else{
			return toOther;
		}
	}

	var type = typeOfRoute(path,this.lastPath,runList.parentPath);

	/*
	 1、跳到嵌套路由时，如："/home"=>"/home/room" 时，不执行 /home 的 after；
	 而是将 /home 的 after 存储起来，若是再从 /home/room => /other, 会依次调用/home/room的after和/home的after
	*/
	if( type === toNested ){
		this.last.unshift( runList.after );
		this.invoke(runList);
	}else if( type === toParent ){
		if( this.last && this.last.length>0) this.invoke( [ this.last.shift() ] );
	}else if( type === toOther ){
		this.invoke(this.last); //调用上次路由的after	
		this.last = [ runList.after ];
		this.invoke(runList);
	}
	//this.invoke(runList);
	this.lastPath = '/'+path.join('/');
}

//创建执行队列,如：[before,on]
// path 为数组，如 ["home"] 、['home','detail']
Router.prototype.createRunList = function(path,routes,parentPath){
	var runList = [],
		pathPart,route;

	pathPart = path.shift();

	if(typeof routes[pathPart] === 'object'){
		if(path.length > 0){ //说明是嵌套路由
			parentPath = parentPath || ''; //记录其父路径
			runList = this.createRunList(path, routes[pathPart],parentPath+'/'+pathPart);
			return runList;
		}

		route = routes[pathPart];
		runList = [ route.before, route.on ].filter(Boolean);
		runList.after = route.after;
		runList.parentPath = parentPath;
	}

	return runList;
}

Router.prototype.invoke = function(array){
	if(!array && !Array.isArray(array) ) return;
	for(var i=0,l=array.length;i<l;i++){
		if(typeof array[i] === "function") array[i]();
	}
}

}(window))