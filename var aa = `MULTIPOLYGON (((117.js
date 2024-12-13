var aa = `MULTIPOLYGON (((117.0108778400622 35.879403428626915, 117.01147997055257 35.87530405802662, 117.01107833073955 35.876003050834356, 117.01158047493091 35.87600456398265, 117.01137963904198 35.87620401692174, 117.01208279061422 35.87760653964613, 117.0108778400622 35.879403428626915), (117.0347162882517 35.897754473171915, 117.03517973654756 35.8974786287478, 117.03548093006256 35.897779517579636, 117.0347162882517 35.897754473171915)), ((117.02402884473565 35.923445548815316, 117.02534338392137 35.92355829514537, 117.02413836941335 35.92295466786807, 117.02402884473565 35.923445548815316)), ((117.02402586237238 35.92345891553166, 117.02402884473565 35.923445548815316, 117.02 35.9231, 117.02402586237238 35.92345891553166)))`


var s = `MULTIPOLYGON (
        (
            (117.0108778400622 35.879403428626915),
            (117.0347162882517 35.897754473171915)
        ),
        ((117.02402884473565 35.923445548815316)),
        ((117.02402586237238 35.92345891553166))
    )`

console.log(aa.indexOf('('));
console.log(aa.indexOf(')'));

console.log(aa.indexOf('(', 14));
console.log(aa.indexOf('(', 15));
console.log(aa.indexOf('(', 16));
console.log(aa.indexOf('(', 285));
console.log(aa.indexOf('(', 440));
console.log(aa.indexOf('(', 441));
console.log(aa.indexOf('(', 598));
console.log(aa.indexOf('(', 599));


var arr = []

function aaIndexOf(val, index) {
    if (aa.indexOf(val, index) == -1) {
        return arr
    } else {
        arr.push(val, aa.indexOf(val, index) + 1)
        aaIndexOf()
    }
}
aaIndexOf('(', 0)









// console.log(aa.indexOf('),'));
// console.log(aa.indexOf(', ('));
/**
 *  计算左右括号位置
 **/


export function handleParkPointNewRoadNetworkModify(e) {
    let array = []
    let path
    path = e.substring(e.indexOf('(') + 1, e.lastIndexOf(')'))
    let a = path.split('),')
    // a.forEach(item => {
    //     let small = item.split(' ')
    //     const filtered = small.filter((itemi) => {
    //         return itemi !== null && typeof itemi !== "undefined" && itemi !== "";
    //     });
    //     small = [filtered[0] * 1, filtered[1] * 1]
    //     array.push(small)
    // })
    return a

}

console.log(handleParkPointNewRoadNetworkModify(aa));
