// #### ######## ######## ########  
//  ##     ##    ##       ##     ## 
//  ##     ##    ##       ##     ## 
//  ##     ##    ######   ########  
//  ##     ##    ##       ##   ##   
//  ##     ##    ##       ##    ##  
// ####    ##    ######## ##     ## 


// iterator tools
function* map(it, mapping=function(v,i){return v;}) {
  var i = 0;
  for ( let v of it )
    yield mapping(v,i++);
}
function* flatmap(it, mapping=function(v,i){return [v];}) {
  var i = 0;
  for ( let v of it )
    yield* mapping(v,i++);
}
function* filter(it, filtering=function(v,i){return true;}) {
  var i = 0;
  for ( let v of it )
    if ( filtering(v,i++) )
      yield v;
}
function reduce(it, callback, initial) {
  if ( initial === undefined ) {
    var original_callback = callback;
    callback = function(acc, value){ callback = original_callback; return value; }
  }
  for ( let v of it )
    initial = callback(initial, v);
  return initial;
}

function* repeat(v) { while ( true ) yield v; }
// zip iterables, where un-iterable transform as infinited repeated iterator
function* zip(...iterables) {
  var iterators = iterables.map(it => {
    if ( it != null && typeof it[Symbol.iterator] === "function" )
      return it[Symbol.iterator]();
    else
      return repeat(it);
  });
  var data = iterators.map(it => it.next());
  while ( data.every(d => !d.done) ) {
    yield data.map(d => d.value);
    data = iterators.map(it => it.next());
  }
}
// comb2([1,2,3]) ==>> [[1,2], [1,3], [2,3]]
function* comb2(list) {
  if ( !Array.isArray(list) )
    list = [...list];
  const length = list.length;
  for ( let i=0; i<length-1; i++ )
    for ( let j=i+1; j<length; j++ )
      yield [list[i], list[j]];
}

// in-place filter array, return false if nothing change
function filterInPlace(arr, condition) {
  var j = 0;
  for ( var i = 0; i < arr.length; i++ )
    if ( condition(arr[i], i, arr) ) arr[j++] = arr[i];
  if ( arr.length === j )
    return true;
  arr.length = j;
  return false;
}


// ######## ##     ## ######## ######## ##    ## 
// ##       ##     ##      ##       ##   ##  ##  
// ##       ##     ##     ##       ##     ####   
// ######   ##     ##    ##       ##       ##    
// ##       ##     ##   ##       ##        ##    
// ##       ##     ##  ##       ##         ##    
// ##        #######  ######## ########    ##    


// fuzzy compare tool
class FuzzyTool
{
  constructor(param) {
    param = Object.assign({
      precision: 5
    }, param);
    this.precision = param.precision;
    this.tolerance = Math.pow(10, -this.precision);
    this.scale = Math.pow(10, this.precision);
  }
  toString(value) {
    return value.toFixed(this.precision);
  }
  round(value) {
    // return parseFloat(value.toFixed(this.precision));
    return Math.round(value * this.scale) / this.scale;
  }
  roundTo(value, pool) {
    res = pool.find(v => this.equals(value, v));
    return res === undefined ? value : res;
  }
  greater_than(v1, v2) {
    return (v1-v2 > -this.tolerance);
  }
  less_than(v1, v2) {
    return (v1-v2 < this.tolerance);
  }
  equals(v1, v2) {
    if ( v1.x !== undefined && v1.y !== undefined && v1.z !== undefined )
      return (Math.abs(v1.x-v2.x) < this.tolerance)
          && (Math.abs(v1.y-v2.y) < this.tolerance)
          && (Math.abs(v1.z-v2.z) < this.tolerance);
    else if ( v1.constant !== undefined && v1.normal !== undefined )
      return this.equals(v1.constant, v2.constant)
          && this.equals(v1.normal, v2.normal);
    else
      return Math.abs(v1-v2) < this.tolerance;
  }
  isZero(value) {
    return Math.abs(value) < this.tolerance;
  }
  sign(value) {
    return (Math.abs(value) < this.tolerance) ? 0 : Math.sign(value);
  }
}
var defaultFuzzyTool = new FuzzyTool();


// ########    ###     ######  ######## 
// ##         ## ##   ##    ## ##       
// ##        ##   ##  ##       ##       
// ######   ##     ## ##       ######   
// ##       ######### ##       ##       
// ##       ##     ## ##    ## ##       
// ##       ##     ##  ######  ######## 


//
//            __Vector3 ---- a
//           / /\ \
//          / /  \ \
//         / /    \ \---- ab
// ca ----/ /      \ \
//       / / Face3  \ \
//      / /          \ \
//      \/____________\/
// c ..-'\___GlueTab__/`-.. b
//             \
//              `-- bc
//

const VERTICES = Object.freeze(["a", "b", "c"]);
const EDGES = Object.freeze(["ca", "ab", "bc"]);
const EDGES_DUAL = Object.freeze({ca:"b",  ab:"c",  bc:"a"});
const EDGES_NEXT = Object.freeze({ca:"ab", ab:"bc", bc:"ca"});
const EDGES_PREV = Object.freeze({ca:"bc", ab:"ca", bc:"ab"});

// linking type of `GlueTab`
const LINK = Object.freeze({
  BACK: Symbol("LINK.BACK"),
  EDGE: Symbol("LINK.EDGE"), // flat, convax or concave
  FLAT: Symbol("LINK.FLAT"),
  CONVAX: Symbol("LINK.CONVAX"),
  CONCAVE: Symbol("LINK.CONCAVE"),
});

class GlueTab // 糊地
{
  // types and labels of dual tab should be same
  // glue tab has no direct linking to its owner
  // to create or modify glue tab, use factory method `make`
  //   and setter `setType`, `setLabel` instead
  constructor(face, edge, type, label) {
    this.face = face;
    this.edge = edge;
    this.type = type;
    this.label = label;
  }
  setType(t)  { this.type  = t; if ( this.dual ) this.dual.type  = t; }
  setLabel(l) { this.label = l; if ( this.dual ) this.dual.label = l; }

  // dual glue tab, it always links back to its owner
  get dual() { return this.face[this.edge]; }
  // get glue tab linking to `face[edge]`
  static to(face, edge) { return (face[edge] || {}).dual; }
  // return if `face1[edge1]` and `face2[edge2]` are adjacent by checking vertices
  // direction is important
  static areAdjacent(face1, edge1, face2, edge2) {
    return (face1[edge1[0]] === face2[edge2[1]]) && (face1[edge1[1]] === face2[edge2[0]]);
  }

  // link glue tab and `face[edge]` each others, then return modified tabs
  glue(adjFace, adjEdge) {
    if ( this.face === adjFace && this.edge === adjEdge )
      return [];

    var dual = adjFace[adjEdge];
    var {face, edge} = this;

    this.face = adjFace;
    this.edge = adjEdge;
    this.type = LINK.EDGE;

    dual.face = face;
    dual.edge = edge;
    dual.type = LINK.EDGE;

    return [this, dual];
  }
  // link glue tab and its dual to itself, then return modified tabs
  unglue() {
    if ( this.type === LINK.BACK )
      return [];

    var dual = this.dual;
    var {face:adjFace, edge:adjEdge} = this;
    var {face, edge} = dual;

    this.face = face;
    this.edge = edge;
    this.type = LINK.BACK;

    dual.face = adjFace;
    dual.edge = adjEdge;
    dual.type = LINK.BACK;

    return [this, dual];
  }
  // make glue tab at `face[edge]` and `adjFace[adjEdge]` and gluing each others
  // if `adjFace`, `adjEdge` are `undefined`, make back-linking tab at `face[edge]`
  // return new tab at `face[edge]` and `adjFace[adjEdge]`
  // not in-place modification
  static make(face, edge, adjFace, adjEdge, {type, label}={}) {
    if ( type === undefined ) {
      if ( adjFace !== undefined )
        type = LINK.EDGE;
      else
        type = LINK.BACK;
    }

    if ( type !== LINK.BACK ) {
      face[edge] = new GlueTab(adjFace, adjEdge, type, label);
      adjFace[adjEdge] = new GlueTab(face, edge, type, label);

      return [face[edge], adjFace[adjEdge]];

    } else if ( adjFace !== undefined ) {
      face[edge] = new GlueTab(face, edge, type, label);
      adjFace[adjEdge] = new GlueTab(adjFace, adjEdge, type, label);

      return [face[edge], adjFace[adjEdge]];

    } else {
      face[edge] = new GlueTab(face, edge, type, label);

      return [face[edge]];
    }
  }
  // make and glue each tabs by checking vertices, then return back-linking tabs
  // not in-place modification
  static assemble(faces) {
    // remove old glue tabs
    for ( let face of faces ) for ( let edge of EDGES )
      delete face[edge];

    // link adjacent faces
    for ( let [face1, face2] of comb2(faces) ) for ( let edge1 of EDGES ) for ( let edge2 of EDGES )
      if ( !(edge1 in face1) && !(edge2 in face2) )
        if ( this.areAdjacent(face1, edge1, face2, edge2) )
          this.make(face1, edge1, face2, edge2);

    // make boundary
    var boundary = new Set();
    for ( let face of faces ) for ( let edge of EDGES )
      if ( !(edge in face) )
        boundary.add(this.make(face, edge)[0]);

    return boundary;
  }

  // unglue all out-linking tabs in `faces`, then return modified tabs
  static trim(faces) {
    faces = new Set(faces);
    var unglued = [];

    for ( let face of faces ) for ( let edge of EDGES ) {
      let {face:adjFace, edge:adjEdge} = face[edge];
      if ( !faces.has(adjFace) )
        unglued.push(...this.unglue(face, edge));
    }

    return unglued;
  }
  // glue all back-linking tabs between `faces1` and `faces2`, then return modified tabs
  static merge(faces1, faces2) {
    var glued = [];
  
    for ( let face1 of faces1 ) for ( let edge1 of EDGES )
      for ( let face2 of faces2 ) for ( let edge2 of EDGES )
        if ( face1[edge1].type === LINK.BACK && face2[edge2].type === LINK.BACK )
          if ( this.areAdjacent(face1, edge1, face2, edge2) )
            glued.push(...this.make(face1, edge1, face2, edge2));

    return glued;
  }

  static boundaryOf(faces) {
    // var boundary = new Set();
    // for ( let face of faces ) for ( let edge of EDGES )
    //   if ( face[edge] && face[edge].type === LINK.BACK )
    //     boundary.add(face[edge]);
    // return boundary;
    return new Set(filter(this.tabs(faces), tab => tab.type===LINK.BACK));
  }
  next_boundary() {
    var bd = this;
    if ( bd.type === LINK.BACK ) {
      while ( (bd = bd.face[EDGES_NEXT[bd.edge]]).type !== LINK.BACK );
      return bd;
    }
  }
  prev_boundary() {
    var bd = this;
    if ( bd.type === LINK.BACK ) {
      while ( (bd = bd.face[EDGES_PREV[bd.edge]]).type !== LINK.BACK );
      return bd;
    }
  }
}


//  ######   ########  #######  
// ##    ##  ##       ##     ## 
// ##        ##       ##     ## 
// ##   #### ######   ##     ## 
// ##    ##  ##       ##     ## 
// ##    ##  ##       ##     ## 
//  ######   ########  #######  


class Geometer
{
  // modify structure of Face3 faster computing
  static fly(geometry) {
    var uvs = geometry.faceVertexUvs;
    geometry.nlayer = geometry.faceVertexUvs.length;
    geometry.faceVertexUvs = [[]];

    for ( let x in geometry.faces ) {
      let face = geometry.faces[x];

      // face.vertexNormals = [a,b,c]  =>  face.normals = {a,b,c}
      let ns = face.vertexNormals;
      if ( ns.length ) {
        face.normals = {a:ns[0], b:ns[1], c:ns[2]};
        face.vertexNormals = [];
      }

      // face.vertexColors = [a,b,c]  =>  face.colors = {a,b,c}
      let cs = face.vertexColors;
      if ( cs.length ) {
        face.colors = {a:cs[0], b:cs[1], c:cs[2]};
        face.vertexColors = [];
      }

      // faceVertexUvs[x] = [[a,b,c], ...]  =>  face.uvs = [{a,b,c}, ...]
      face.uvs = [];
      for ( let l=0; l<uvs.length; l++ ) {
        let uv = uvs[l][x];
        if ( uv && uv.length )
          face.uvs[l] = {a:uv[0], b:uv[1], c:uv[2]};
      }
    }

    geometry.boundary = GlueTab.assemble(geometry.faces);
  }
  static land(geometry) {
    var uvs = geometry.faceVertexUvs = [[]];
    for ( let l=0; l<geometry.nlayer; l++ )
      uvs[l] = [];

    for ( let x in geometry.faces ) {
      let face = geometry.faces[x];

      if ( face.normals )
        face.vertexNormals = [face.normals.a, face.normals.b, face.normals.c];
      delete face.normals;

      if ( face.colors )
        face.vertexColors = [face.colors.a, face.colors.b, face.colors.c];
      delete face.colors;

      if ( face.uvs ) for ( let l in face.uvs )
          uvs[l][x] = [face.uvs[l].a, face.uvs[l].b, face.uvs[l].c];
      delete face.uvs;

      for ( let edge of EDGES )
        delete face[edge];
    }

    delete geometry.boundary;
  }

}