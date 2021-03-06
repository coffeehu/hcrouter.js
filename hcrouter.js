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

var unNestedRoutes = [];

var Router = exports.Router = function(routes){
	this.routes = {}; //路由表
	this.methods  = ['on', 'after', 'before']; //生命周期
	this.config();
	this.mount(routes);
	console.log(this.routes)
}

Router.prototype.config = function(){
	this._methods = {};
	for(var i=0,l=this.methods.length;i<l;i++){
		var m = this.methods[i];
		this._methods[m] = true;
	}
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
		//如果是这种形式："/home/detail"，那么 /home/detail 与 /home 是独立的
		if(path.split('/').length>2){
			unNestedRoutes[path]=true;
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

	// 带:号，如 :id
	if( /\:/.test(pathPart) ){
		pathPart = '([._a-zA-Z0-9-%()]+)';
	}

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
Router.prototype.init = function(r){
	var that = this;
	that.hanlder = function(onChangeEvent){
		var newURL = onChangeEvent && onChangeEvent.newURL || window.location.hash;
    	var path = newURL.replace(/.*#/, ''); // 如将 "http://localhost/index#/home" => "home"
		that.dispatch(path);
	}
	listener.init(that.hanlder);
	if(document.location.hash === '' && r){
		document.location.hash = r;
	}else if(document.location.hash.length > 0){
		that.hanlder();
	}
}

//根据 hash 执行对应的回调事件
//path 为 "/home" 或 "/home/detail"
var toOther=0,toNested=1,toParent=2,toReload=3;
Router.prototype.dispatch = function(path){
	var runList = this.createRunList(path,this.routes);

	//如果是这种形式："/home/detail"，那么 /home/detail 与 /home 是独立的
	if( unNestedRoutes[path] || unNestedRoutes[this.lastPath] ){
		this.invoke(this.last);
		this.invoke(runList);
		this.last = [ runList.after ];
		this.lastPath = path;
		return;
	}

	function typeOfRoute(path,lastPath,parentPath){
		if( lastPath === undefined && parentPath ){ //嵌套路由且执行了刷新操作
			return toReload;
		}
		else if( lastPath && lastPath === parentPath){
			return toNested;
		}
		else if( lastPath && lastPath.match( new RegExp(path) ) ){
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
		this.invoke(runList);
		this.last = [ runList.after ];
	}else if( type === toReload ){
		this.invoke(this.last); //调用上次路由的after	
		this.dispatch(runList.parentPath);
		this.invoke(runList);
		this.last = [ runList.after ];
	}
	this.lastPath = path;

}

//创建执行队列,如：[before,on]
// path 为数组，如 ["home"] 、['home','detail']
Router.prototype.createRunList = function(path,routes,parentReg){

	var _arr = path.split('?');
	var queryBody = _arr[1];
	var query={};
	if( queryBody ){
		path = _arr[0];

		var arr = queryBody.split('&');
		for(var i=0,l=arr.length;i<l;i++){
			var key = arr[i].split('=')[0],
				value = arr[i].split('=')[1];
			query[key] = value;
		}
	}

	
	var runList=[],parentReg = parentReg||'';
	for(var r in routes){
		if(routes.hasOwnProperty(r) && !this._methods[r]){
			var regexp = parentReg+'/'+r;
			var match = path.match( new RegExp('^'+regexp) );
			//未匹配
			if(!match){
				continue;
			}
			//匹配到路径
			if(match[0] && match[0] === path ){
				runList = [ routes[r].before, routes[r].on ].filter(Boolean);
				runList.after = routes[r].after;
				runList.capture = match.slice(1);
				runList.capture.push(query) ;
				runList.parentPath = parentReg;
				return runList;
			}
			//匹配到其父路径，递归
			runList = this.createRunList(path,routes[r],regexp);
			return runList;
		}
	}
	return runList;
}

Router.prototype.invoke = function(array){
	if(!array && !Array.isArray(array) ) return;
	for(var i=0,l=array.length;i<l;i++){
		if(typeof array[i] === "function"){
			array[i].apply(this,array.capture);
		}
	}
}

Router.prototype.goto = function(path,params){
	var queryString = this.toUrlString(params)
	window.location =  '#' + path+queryString;
}
Router.prototype.replace = function(path,params){
	var queryString = this.toUrlString(params)
	window.location.replace('#'+path+queryString);
}
Router.prototype.toUrlString = function(params){
	var string = '?';
	for(var key in params){
		string += key+'='+params[key]+'&';
	}
	string = string.substr(0, string.length-1);
	return string;
}

}(window))