let scriptElementw = document.createElement('script');
scriptElementw.type = 'text/javascript';
scriptElementw.async = false;
scriptElementw.src = './jsapi.js';// 加载脚本
document.head.appendChild(scriptElementw); // 加载脚本

scriptElementw.addEventListener('error', function () {
    console.error(`依赖脚本加载失败[${scriptElementw.src}]!`);
});
let aa =  new Promise((resolve, reject) => {
    scriptElementw.addEventListener('load', function () {
        try {
            console.log(window);
            this.amap = this.amap || new AMap.Map('container');
            if (this.amap) {
                resolve(this)
            }
        } catch (e) {
            reject(e);
        }
    });
})
console.log(aa);


// var map = new AMap.Map('container', {
//     zoom: 10,
//     center: [116.39, 39.9]
// });


// function QyMap(options) {
//     this.amap = undefined;
//     // 初始化方法， 提供地图的各种数据
//     this.initialize = function (config) {
//         if (config.dependencyJsPaths) {
//             let scripts = document.getElementsByTagName('script');
//             let currScript = undefined;
//             for (let i = 0; i < scripts.length; i++) {
//                 if (scripts.item(i).src.indexOf('qymap.min.js') > 0) {
//                     currScript = scripts.item(i);
//                     break;
//                 }
//             }
//             for (let i = 0; i < config.dependencyJsPaths.length; i++) {
//                 let scriptElementw = document.createElement('script');
//                 scriptElementw.type = 'text/javascript';
//                 scriptElementw.async = false;
//                 scriptElementw.src = config.dependencyJsPaths[i];
//                 document.head.insertBefore(scriptElementw, currScript); // 加载脚本

//                 scriptElementw.addEventListener('error', function () {
//                     console.error(`依赖脚本加载失败[${scriptElementw.src}]!`);
//                 });
//                 return new Promise((resolve, reject) => {
//                     scriptElementw.addEventListener('load', function () {
//                         try {
//                             this.amap = this.amap || new AMap.Map(config.container, config.amapConfig);
//                             if (this.amap) {
//                                 resolve(this)
//                             }
//                         } catch (e) {
//                             reject(e);
//                         }
//                     });
//                 })
//             }
//         } else {
//             console.error('请配置云图js库的依赖地址！');
//         }
//     }

//     this.xxx = function (options) {

//     };

//     if (!options || typeof options != 'object') {
//         console.error("初始化失败， 入参必须是object类型！")
//         return;
//     }

//     // 配置项，从options获取，或提供默认值
//     let config = {
//         container: options.container || 'containerId', // 地图渲染到的容器ID
//         dependencyJsPaths: options.dependencyJsPaths || ["http://gd.qingyun.prod/api/jsapi.js", "http://gd.qingyun.prod/api/loca.js"], // 加载远程依赖js库
//         search: options.search || false,
//         amapConfig: Object.assign({
//             offlineServer: `${window.location.protocol}//${window.location.host}`,
//             assetsServer: `${window.location.protocol}//${window.location.host}`,
//             viewMode: "3D",
//             zoom: 7,
//             center: [119.161721, 36.707668]
//         }, options.amapConfig)
//     }

//     return this.initialize(config);
// }
