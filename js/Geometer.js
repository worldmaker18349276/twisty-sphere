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
function removeFirst(arr, filter) {
  var i = arr.findIndex(filter);
  if ( i === -1 )
    return false;
  arr.splice(i, 1);
  return true;
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
    var val = value.toFixed(this.precision);
    if ( val === "-"+(0).toFixed(this.precision) )
      val = (0).toFixed(this.precision);
    return val;
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
  collect(it) {
    var res = [];
    for ( let value of it )
      if ( !res.find(v => this.equals(v, value)) )
        res.push(value);
    return res;
  }
}
var defaultFuzzyTool = new FuzzyTool();


//  ######   ########  #######  
// ##    ##  ##       ##     ## 
// ##        ##       ##     ## 
// ##   #### ######   ##     ## 
// ##    ##  ##       ##     ## 
// ##    ##  ##       ##     ## 
//  ######   ########  #######  


const VERTICES = Object.freeze(["a", "b", "c"]);
const VERTICES_IND = Object.freeze({a:0,  b:1,  c:2});
const EDGES = Object.freeze(["ca", "ab", "bc"]);
const EDGES_DUAL = Object.freeze({ca:"b",  ab:"c",  bc:"a"});
const EDGES_NEXT = Object.freeze({ca:"ab", ab:"bc", bc:"ca"});
const EDGES_PREV = Object.freeze({ca:"bc", ab:"ca", bc:"ab"});

class Geometer
{
  // doubly linked faces structure:
  // we use `(face,edge)` to denote the edge of face
  // if it is link to `(adjFace,adjEdge)`, then we have
  // >  [ adjFace, adjEdge ] = [ face[edge], face.adj[edge] ]
  // >  [ face, edge ] = [ adjFace[adjEdge], adjFace.adj[adjEdge] ]

  // if `(face1,edge1)` and `(face2,edge2)` are adjacent (share same vertices)
  static areAdjacent(face1, edge1, face2, edge2) {
    return (face1[edge1[0]] === face2[edge2[1]]) && (face1[edge1[1]] === face2[edge2[0]]);
  }
  // connect `(face,edge)` and `(adjFace,adjEdge)`,
  //   then return connected links: `[ [face,edge], [adjFace,adjEdge] ]`
  static connect(face, edge, adjFace, adjEdge) {
    if ( adjFace ) {
      if ( !face.adj ) face.adj = {};
      if ( !adjFace.adj ) adjFace.adj = {};

      [face[edge], face.adj[edge]] = [adjFace, adjEdge];
      [adjFace[adjEdge], adjFace.adj[adjEdge]] = [face, edge];
      return [[face, edge], [adjFace, adjEdge]];

    } else {
      if ( !face.adj ) face.adj = {};

      delete face[edge];
      delete face.adj[edge];
      return [[face, edge]];
    }
  }
  // find all boundaries (`face[edge] === undefined`) in `faces`
  static boundariesIn(faces) {
    var boundaries = [];
    for ( let face of faces ) for ( let edge of EDGES )
      if ( !face[edge] || !faces.includes(face[edge]) )
        boundaries.push([face, edge]);
    return boundaries;
  }

  // modify structure of Face3 to faster computing
  static fly(geometry) {
    var uvs = geometry.faceVertexUvs;
    const nlayer = geometry.nlayer = geometry.faceVertexUvs.length;

    for ( let x=0,len=geometry.faces.length; x<len; x++ ) {
      let face = geometry.faces[x];

      face.label = [];

      face.vertexUvs = [];
      for ( let l=0; l<nlayer; l++ )
        if ( uvs[l][x] && uvs[l][x].length )
          face.vertexUvs[l] = uvs[l][x];

      // adjacent edges
      face.adj = {};
    }

    // link adjacent faces
    for ( let [face1, face2] of comb2(geometry.faces) )
      for ( let edge1 of EDGES ) for ( let edge2 of EDGES )
        if ( !face1[edge1] && !face2[edge2] )
          if ( this.areAdjacent(face1, edge1, face2, edge2) )
            this.connect(face1, edge1, face2, edge2);

    // find boundaries of faces
    geometry.boundaries = this.boundariesIn(geometry.faces);
  }
  static land(geometry) {
    var uvs = geometry.faceVertexUvs = [[]];
    const nlayer = geometry.nlayer;
    for ( let l=0; l<nlayer; l++ )
      uvs[l] = [];

    for ( let x in geometry.faces ) {
      let face = geometry.faces[x];

      if ( face.vertexUvs ) {
        for ( let l=0; l<nlayer; l++ ) {
          if ( face.vertexUvs[l] && face.vertexUvs[l].length )
            uvs[l][x] = face.vertexUvs[l];
          else
            uvs[l][x] = [new THREE.Vector2(0,0),new THREE.Vector2(0,0),new THREE.Vector2(0,0)];
        }
      } else {
        for ( let l=0; l<nlayer; l++ )
          uvs[l][x] = [new THREE.Vector2(0,0),new THREE.Vector2(0,0),new THREE.Vector2(0,0)];
      }
    }
  }
  static preprocess(face, param) {
    for ( let key in param ) {
      if ( typeof param[key] == "function" )
        face[key] = param[key](face);
      else
        face[key] = param[key];
    }
  }

  // copy flying face
  // shallow copy flying data `face.label`, `face.normals`, `face.colors`, `face.uvs`,
  //   but no link `face.ca`, `face.ab`, `face.bc` and `face.adj`
  static copyFace(face, copied=new THREE.Face3().copy(face)) {
    copied.label = (face.label || []).slice(0);

    copied.vertexUvs = [];
    if ( face.vertexUvs )
      for ( let l in face.vertexUvs )
        if ( face.vertexUvs[l].length )
          copied.vertexUvs[l] = face.vertexUvs[l].slice(0);

    copied.adj = {};

    return copied;
  }
  // copy flying faces with adjacent links
  static copyFaces(faces, copied_faces=faces.map(face=>new THREE.Face3().copy(face))) {
    for ( let [face, copied_face] of zip(faces, copied_faces) ) {
      this.copyFace(face, copied_face);

      // transfer link
      for ( let edge of EDGES ) {
        if ( !face.adj )
          break;
        let [adjFace, adjEdge] = [face[edge], face.adj[edge]];
        if ( adjFace !== undefined ) {
          adjFace = copied_faces[faces.indexOf(adjFace)];
          [copied_face[edge], copied_face.adj[edge]] = [adjFace, adjEdge];
        }
      }
    }
  }
  // copy flying geometry
  static copy(geometry, copied=geometry.clone()) {
    copied.nlayer = geometry.nlayer;
    this.copyFaces(geometry.faces, copied.faces);
    copied.boundaries = this.boundariesIn(copied.faces);
    return copied;
  }

  static reverse(geometry) {
    const EDGES_REV = {ca:"ca", ab:"bc", bc:"ab"};

    for ( let face of geometry.faces ) {
      [face.a, face.b, face.c] = [face.c, face.b, face.a];
      var old_adj = Object.assign({}, face.adj);
      for ( let edge of EDGES )
        face.adj[EDGES_REV[edge]] = EDGES_REV[old_adj[edge]];
    }

    for ( let bd of geometry.boundaries )
      bd[1] = EDGES_REV[bd[1]];

    return geometry;
  }

  // trim trivial vertices
  static trimVertices(geometry) {
    // find non-trivial vertices, which must be refered by face
    var nontriviality = []; // index of vertex -> if vertex is non-trivial
    var nontrivial_vertices = []; // non-trivial vertices
    var nontrivial_vertices_map = {}; // index of merged vertex -> index of non-trivial vertex
  
    for ( let face of geometry.faces ) for ( let a of VERTICES ) {
      let i = face[a];
      if ( !nontriviality[i] ) {
        nontriviality[i] = true;
        nontrivial_vertices_map[i] = nontrivial_vertices.push(geometry.vertices[i])-1;
      }
    }
  
    // re-index vertices of faces
    for ( let face of geometry.faces ) {
      face.a = nontrivial_vertices_map[face.a];
      face.b = nontrivial_vertices_map[face.b];
      face.c = nontrivial_vertices_map[face.c];
    }
  
    geometry.vertices = nontrivial_vertices;
  }

  // split face at edge with interpolation alpha `t` and vertex index `k`
  // return the new face splited out of `face`
  //
  //          c                            c          
  //         / \                          /|\         
  //        /   \                        / | \        
  //       /     \                      /  |  \       
  //      /       \                    /   |   \      
  //     /  face   \       ===>       /    |    \     
  //    /           \              splited |     \    
  //   /             \              /face  | face \   
  //  /_______________\            /_______|_______\  
  // a        |        b          a       b a       b 
  //    split edge `ab`
  static _split_face(face, edge, t, k) {
    // split face
    const ab = edge;
    const bc = EDGES_NEXT[ab];
    const ca = EDGES_PREV[ab];

    var splited_face = this.copyFace(face);
    face[ab[0]] = splited_face[ab[1]] = k;

    [splited_face[ab], splited_face.adj[ab]] = [face[ab], face.adj[ab]]
    this.connect(splited_face, ca, face[ca], face.adj[ca]);
    this.connect(face, ca, splited_face, bc);

    var a_ind = VERTICES_IND[ab[0]];
    var b_ind = VERTICES_IND[ab[1]];

    // interpolate normal
    if ( face.vertexNormals.length ) {
      let ni = face.vertexNormals[a_ind];
      let nj = face.vertexNormals[b_ind];
      let nk = ni.clone().lerp(nj, t);
      face.vertexNormals[a_ind] = splited_face.vertexNormals[b_ind] = nk;
    }

    // interpolate color
    if ( face.vertexColors.length ) {
      let ci = face.vertexColors[a_ind];
      let cj = face.vertexColors[b_ind];
      let ck = ci.clone().lerp(cj, t);
      face.vertexColors[a_ind] = splited_face.vertexColors[b_ind] = ck;
    }

    // interpolate uv
    if ( face.vertexUvs )
      for ( let l=0; l<face.vertexUvs.length; l++ )
        if ( face.vertexUvs[l] && face.vertexUvs[l].length ) {
          let uvli = face.vertexUvs[l][a_ind];
          let uvlj = face.vertexUvs[l][b_ind];
          let uvlk = uvli.clone().lerp(uvlj, t);
          face.vertexUvs[l][a_ind] = splited_face.vertexUvs[l][b_ind] = uvlk;
        }

    return splited_face;
  }
  // interpolate geometry at edge `(face,edge)`
  // new faces will be insert after splited faces
  // return the new faces splited out of `face` and its dual
  static interpolateAtEdge(geometry, face, edge, t, k) {
    var [adjFace, adjEdge] = [face[edge], face.adj[edge]];

    // interpolation
    if ( k === undefined ) {
      let i = face[edge[0]];
      let j = face[edge[1]];
      let vi = geometry.vertices[i];
      let vj = geometry.vertices[j];
      let vk = vi.clone().lerp(vj, t);
      k = geometry.vertices.push(vk)-1;
    }

    // split face
    var splited_face = this._split_face(face, edge, t, k);
    geometry.faces.splice(geometry.faces.indexOf(face)+1, 0, splited_face);

    if ( !adjFace ) {
      geometry.boundaries.push([splited_face, edge]);
      return [splited_face];
    }

    // split adjacent face
    var splited_adjFace = this._split_face(adjFace, adjEdge, 1-t, k);
    geometry.faces.splice(geometry.faces.indexOf(adjFace)+1, 0, splited_adjFace);

    this.connect(face, edge, splited_adjFace, adjEdge);
    this.connect(splited_face, edge, adjFace, adjEdge);

    return [splited_face, splited_adjFace];
  }
  // slice geometry by plane
  // in-place modify `geometry` as positive side, and return new geometry as negative side
  static slice(geometry, plane, sliced=false) {
    plane = new THREE.Plane().copy(plane);

    var vertices = geometry.vertices;
    var faces = geometry.faces;
    var boundaries = geometry.boundaries;

    var dis = vertices.map(v => plane.distanceToPoint(v));
    var sgn = dis.map(d => defaultFuzzyTool.sign(d));

    // split edge
    // notice: length of `geometry.faces` increase in method `interpolateAtEdge`
    for ( let face of faces ) for ( let edge of EDGES ) {
      let i = face[edge[0]];
      let j = face[edge[1]];

      if ( sgn[i] * sgn[j] < 0 ) {
        // interpolation
        let t = dis[i]/(dis[i]-dis[j]);
        let vi = vertices[i];
        let vj = vertices[j];
        let vk = vi.clone().lerp(vj, t);
        let k = vertices.push(vk)-1;
        dis.push(0);
        sgn.push(0);

        this.interpolateAtEdge(geometry, face, edge, t, k);
      }
    }

    // determine side of faces respect to cut plane
    const SIDE = Symbol("SIDE");
    const FRONT = 1;
    const BACK = 2;
    
    for ( let face of faces ) {
      if ( VERTICES.some(a => sgn[face[a]] !== 0) ) {
        if ( VERTICES.every(a => sgn[face[a]] >= 0) )
          face[SIDE] = FRONT;
        else if ( VERTICES.every(a => sgn[face[a]] <= 0) )
          face[SIDE] = BACK;
        else
          console.assert(false);
    
      } else {
        if ( plane.normal.dot(face.normal) < 0 )
          face[SIDE] = FRONT;
        else
          face[SIDE] = BACK;
      }
    }
    
    // unlink edge between two sides
    for ( let face of faces ) if ( face[SIDE] === FRONT ) for ( let edge of EDGES ) {
      if ( face[edge] && face[SIDE] !== face[edge][SIDE] ) {
        this.connect(face[edge], face.adj[edge]);
        this.connect(face, edge);
      }
    }
    
    // split geometry into `geometry` and `sliced_geometry`
    geometry.faces = [];
    geometry.boundaries = [];
    var sliced_geometry = this.copy(geometry);

    geometry.faces = faces.filter(face => face[SIDE] === FRONT);
    geometry.boundaries = this.boundariesIn(geometry.faces);
    this.trimVertices(geometry);

    if ( sliced ) {
      sliced_geometry.faces = [];
      sliced_geometry.boundaries = [];
      
      sliced_geometry.faces = faces.filter(face => face[SIDE] === BACK);
      sliced_geometry.boundaries = this.boundariesIn(sliced_geometry.faces);
      this.trimVertices(sliced_geometry);
    }
    
    for ( let face of faces )
      delete face[SIDE];

    if ( sliced )
      return sliced_geometry;
  }
  static walkBoundaries(geometry) {
    var loops = [];
    boundaries = geometry.boundaries.slice(0);

    while ( boundaries.length > 0 ) {
      let loop = [];

      let [face, edge] = boundaries[0];
      while ( removeFirst(boundaries, ([f,e]) => f===face && e==edge) ) {
        loop.push([face, edge]);
        while ( face[EDGES_NEXT[edge]] !== undefined )
          [face, edge] = [face[EDGES_NEXT[edge]], face.adj[EDGES_NEXT[edge]]];
        edge = EDGES_NEXT[edge];
      }
      loops.push(loop);
    }
    return loops;
  }
  static findLoops(boundaries) {
    var loops = [];
    boundaries = boundaries.slice(0);

    while ( boundaries.length > 0 ) {
      let loop = [];

      let res = boundaries[0];
      while ( true ) {
        let i = boundaries.findIndex(next => next[0][next[1][0]] === res[0][res[1][1]]);
        if ( i === -1 )
          break;
        res = boundaries[i];
        boundaries.splice(i,1);
        loop.push(res);
      }
      loops.push(loop);
    }
    return loops;
  }
  static fillHoles(geometry, plane, meta={}) {
    // offset and rotation to plane
    var offset = plane.normal.clone().multiplyScalar(-plane.constant);
    var {phi, theta} = new THREE.Spherical().setFromVector3(plane.normal);
    var rot = new THREE.Quaternion().setFromAxisAngle({x:-Math.cos(theta), y:0, z:Math.sin(theta)}, phi);

    // project vertices onto the plane
    var boundaries = geometry.boundaries;
    var points = {};

    for ( let [face, edge] of boundaries )
      for ( let i of [face[edge[0]], face[edge[1]]] )
        if ( points[i] === undefined ) {
          let v = geometry.vertices[i].clone();
          v.sub(offset).applyQuaternion(rot);
          points[i] = new THREE.Vector2(v.z, v.x);
        }

    // fill holes
    var loops = this.findLoops(boundaries);
    var normal = plane.normal.clone();
    
    for ( let loop of loops ) {
      // make face to fill the hole
      for ( let count=loop.length*(loop.length-1)/2; loop.length>=3 && count>0; count-- ) {
        let [[face_cb, bd_cb], [face_ba, bd_ba], ...remains] = loop;

        let i = face_ba[bd_ba[1]];
        let j = face_cb[bd_cb[1]];
        let k = face_cb[bd_cb[0]];

        // angle ijk
        let angle_ji = points[i].clone().sub(points[j]).angle()*2/Math.PI;
        let angle_jk = points[k].clone().sub(points[j]).angle()*2/Math.PI;
        let angle_ijk = ((angle_ji - angle_jk) % 4 + 4) % 4;
        if ( defaultFuzzyTool.greater_than(angle_ijk, 2) ) {
          loop.push(loop.shift());
          continue;
        }
    
        let face_ca = new THREE.Face3(i, j, k, normal);
        this.preprocess(face_ca, meta);
        let bd_ca = "ca";
        this.connect(face_ca, "ab", face_ba, bd_ba);
        this.connect(face_ca, "bc", face_cb, bd_cb);
        geometry.faces.push(face_ca);
    
        // remains.unshift([face_ca, bd_ca]); // fan-like filling
        remains.push([face_ca, bd_ca]); // rose-like filling
        loop = remains;
      }

      if ( loop.length >= 3 ) {
        console.log(loop.map(([f,e]) => geometry.vertices[f[e[0]]]));
        throw "unterminated loop";
      } else if ( loop.length === 2 ) {
        this.connect(...loop[0], ...loop[1]);
      } else {
        throw "???";
      }
    }
  }

  // merge two geometries
  static merge(geometry, merged, matrix, materialIndexOffset) {
    const origin_len = geometry.faces.length;
    geometry.merge(merged, matrix, materialIndexOffset);
  
    var origin_faces = geometry.faces.slice(0, origin_len);
    var merged_faces = geometry.faces.slice(origin_len);
    var merged_boundary = this.copyFaces(origin_faces, merged_faces);
  
    geometry.boundaries = this.boundariesIn(geometry.faces);
  
    // this.reduceVertices(geometry);
    // this.reduceFaces(geometry);
    // this.regularization(geometry);
    // this.trimVertices(geometry);
  }
  // merge duplicated (or similar) vertices and sew boundaries caused by merging
  static reduceVertices(geometry, snap=true, sew=true) {
    var vec_hash = snap
                 ? v => v.toArray().map(x => defaultFuzzyTool.toString(x)).join()
                 : v => geometry.vertices.indexOf(v);
    var vertices_hashmap = {}; // hash of vertex -> index of merged vertex
    var merged_vertices = [];
    var merged_vertices_map = {}; // original index of vertex -> index of merged vertex
    var duplicated = {}; // index of merged vertex -> if vertex is duplicated
    var sewable = [];

    // merge duplicated vertices
    for ( let i=0, len=geometry.vertices.length; i<len; i++ ) {
      let hash = vec_hash(geometry.vertices[i]);
      let new_index = vertices_hashmap[hash];

      if ( new_index === undefined ) {
        new_index = merged_vertices.push(geometry.vertices[i])-1;
        vertices_hashmap[hash] = new_index;
        merged_vertices_map[i] = new_index;
  
      } else {
        merged_vertices_map[i] = new_index;
        duplicated[new_index] = true;
      }
    }

    // merge vertices of faces
    for ( let face of geometry.faces ) {
      face.a = merged_vertices_map[face.a];
      face.b = merged_vertices_map[face.b];
      face.c = merged_vertices_map[face.c];
    }

    if ( sew ) {
      // find sewable boundaries, which are non-trivial boundaries containing duplicated vertex
      for ( let face of geometry.faces )
        for ( let edge of EDGES ) if ( !face[edge] )
          if ( face[edge[0]] !== face[edge[1]] )
            if ( duplicated[face[edge[0]]] || duplicated[face[edge[1]]] )
              sewable.push([face, edge]);
  
      // sew edges of duplicated vertices
      for ( let [[face1, edge1], [face2, edge2]] of comb2(sewable) )
        if ( !face1[edge1] && !face2[edge2] )
          if ( this.areAdjacent(face1, edge1, face2, edge2) ) {
            removeFirst(geometry.boundaries, ([f,e]) => f===face1 && e==edge1);
            removeFirst(geometry.boundaries, ([f,e]) => f===face2 && e==edge2);
            this.connect(face1, edge1, face2, edge2);
          }
    }
  
    geometry.vertices = merged_vertices;
  }
  // merge trivial edges and trivial faces
  static reduceFaces(geometry) {
    var merged_faces = [];
  
    for ( let face of geometry.faces ) {
      if ( EDGES.every(edge => face[edge[0]] !== face[edge[1]]) ) {
        // non-trivial face
        merged_faces.push(face);
  
      } else if ( EDGES.every(edge => face[edge[0]] === face[edge[1]]) ) {
        // trivial face with three trivial edges
        for ( let edge of EDGES ) {
          if ( !face[edge] )
            removeFirst(geometry.boundaries, ([f,e]) => f===face && e==edge);
        }
  
      } else {
        // trivial face with one trivial edge
        for ( let edge of EDGES ) if ( face[edge[0]] === face[edge[1]] ) { // find trivial edge
          var [face_next, edge_next] = [face[EDGES_NEXT[edge]], face.adj[EDGES_NEXT[edge]]];
          var [face_prev, edge_prev] = [face[EDGES_PREV[edge]], face.adj[EDGES_PREV[edge]]];

          if ( face_next && face_prev )
            this.connect(face_next, edge_next, face_prev, edge_prev);
          else if ( face_next )
            geometry.boundaries.push(...this.connect(face_next, edge_next));
          else if ( face_prev )
            geometry.boundaries.push(...this.connect(face_prev, edge_prev));

          for ( let edge_ of EDGES ) if ( !face[edge_] )
            removeFirst(geometry.boundaries, ([f,e]) => f===face && e==edge_);

          break;
        }
      }
    }
  
    geometry.faces = merged_faces;
  }
  // // merge gapless pairs of faces and separate gapless edges
  // static regularization(geometry) {
  //   var face_hashmap = {}; // hash of vertices of face -> [face, sorted_edges, parity]
  //   function face_hash(face) {
  //     var edges = EDGES.slice(0);
  //     edges.sort((e1, e2) => face[EDGES_DUAL[e1]] - face[EDGES_DUAL[e2]]);
  //     var parity = edges[0][1] == edges[1][0] ? 0 : 1; // parity of permutation
  //     return [edges.map(e => face[EDGES_DUAL[e]]).join(), edges, parity];
  //   }
  // 
  //   // remove gapless pair of faces
  //   for ( let face of geometry.faces ) {
  //     let [hash, edges, parity] = face_hash(face);
  //     if ( face_hashmap[hash] === undefined ) {
  //       face_hashmap[hash] = [face, edges, parity];
  // 
  //     } else {
  //       let [anti_face, anti_edges, anti_parity] = face_hashmap[hash];
  //       console.assert(anti_parity !== parity);
  // 
  //       // merge links
  //       for ( let [edge, anti_edge] of zip(edges, anti_edges) )
  //         if ( face[edge].dual !== anti_face[anti_edge] )
  //           face[edge].merge(anti_face[anti_edge]);
  // 
  //       delete face_hashmap[hash];
  //     }
  //   }
  // 
  //   geometry.faces = [...face_hashmap.values()];
  // 
  //   var tab_hashmap = {}; // hash of vertices of edge -> set of tabs
  //   function tab_hash(tab) {
  //     var a = tab.face[tab.edge[0]];
  //     var b = tab.face[tab.edge[1]];
  //     if ( a > b )
  //       return tab_hash(tab.face[tab.edge]);
  //     else
  //       return [a+","+b, tab];
  //   }
  // 
  //   // find meeting edges
  //   for ( let face of geometry.faces ) for ( let edge of EDGES ) if ( face[edge].isEdge ) {
  //     let [hash, tab] = tab_hash(face[edge]);
  //     if ( tab_hashmap[hash] === undefined )
  //       tab_hashmap[hash] = new Set([]);
  //     tab_hashmap[hash].add(tab);
  //   }
  // 
  //   // separate gapless edges
  //   const LEFT = Symbol("LEFT");
  //   const RIGHT = Symbol("RIGHT");
  // 
  //   for ( let tabs of tab_hashmap ) if ( tabs.size() > 1 ) {
  //     let tab0 = tabs.values().next().value;
  // 
  //     // rotate to align edge "ab" to axis +y
  //     let i = tab0.face[tab0.edge[0]];
  //     let j = tab0.face[tab0.edge[1]];
  //     let dir = new THREE.Vector3().subVectors(geometry.vertices[j], geometry.vertices[i]);
  //     let {phi, theta} = new THREE.Spherical().setFromVector3(dir);
  //     let rot = new THREE.Quaternion().setFromAxisAngle({x:-Math.cos(theta), y:0, z:Math.sin(theta)}, phi);
  // 
  //     let tabs_ = []; // list of tabs and its metadata: {tab, theta, side}
  //     for ( let tab of tabs ) {
  //       let normal = tab.face.normal.clone().applyQuaternion(rot);
  //       let theta = new THREE.Spherical().setFromVector3(normal).theta;
  //       tabs_.push({tab, theta, side:LEFT});
  // 
  //       let tab = tab.dual;
  //       normal = tab.face.normal.clone().negate().applyQuaternion(rot);
  //       theta = new THREE.Spherical().setFromVector3(normal).theta;
  //       tabs_.push({tab, theta, side:RIGHT});
  //     }
  // 
  //     tabs_.sort((a, b) => a.theta-b.theta);
  //     let prev_side = tabs_[tabs_.length-1].side;
  //     console.assert(tabs_.every(a => prev_side !== (prev_side = a.side)));
  // 
  //     if ( tabs_[0].side === LEFT )
  //         tabs_.push(tabs_.shift());
  //     for ( let i=0; i+1<tabs_.length; i+=2 )
  //       tabs_[i].tab.glue(tabs_[i+1].tab);
  //   }
  // }

  static makeEdgeHelper(geometry, face, edge) {
    var v1 = geometry.vertices[face[edge[0]]];
    var v2 = geometry.vertices[face[edge[1]]];
    var dir = new THREE.Vector3().subVectors(v2, v1);
    var len = dir.length();
    var head = 0.05<0.4*len ? 0.05 : 0.4*len;
    var arrow = new THREE.ArrowHelper(dir.normalize(), v1, len, 0xff0000, head);
    return arrow;
  }
}


//  ######  ########  ##     ## ######## ########  ####  ######     ###    ##       
// ##    ## ##     ## ##     ## ##       ##     ##  ##  ##    ##   ## ##   ##       
// ##       ##     ## ##     ## ##       ##     ##  ##  ##        ##   ##  ##       
//  ######  ########  ######### ######   ########   ##  ##       ##     ## ##       
//       ## ##        ##     ## ##       ##   ##    ##  ##       ######### ##       
// ##    ## ##        ##     ## ##       ##    ##   ##  ##    ## ##     ## ##       
//  ######  ##        ##     ## ######## ##     ## ####  ######  ##     ## ######## 


class SphericalGeometer
{
  static align(vs, normal) {
    var {phi, theta} = new THREE.Spherical().setFromVector3(normal);
    var rot = new THREE.Quaternion().setFromAxisAngle({x:-Math.cos(theta), y:0, z:Math.sin(theta)}, phi);
    return vs.map(v => v.clone().applyQuaternion(rot))
             .map(v => new THREE.Spherical().setFromVector3(v));
  }
  static angleTo(normal, v0, v1) {
    [v0,v1] = this.align([v0,v1], normal);
    const TAU = 2*Math.PI;
    return ((v1.theta-v0.theta) % TAU + TAU) % TAU;
  }

  static quadrant(plane, R=1) {
    return 2 - Math.acos(plane.constant/R)*2/Math.PI;
  }
  static qcolor(quad) {
    return new THREE.Color(`hsl(${Math.floor(Math.abs(quad-1)*300)}, 100%, 50%)`);
  }
  static plane(center, quad, R=1) {
    center = new THREE.Vector3().copy(center).normalize();
    var constant = Math.cos((2-quad)*Math.PI/2)*R;
    return new THREE.Plane(center, constant);
  }

  static arc(center, quad, v0, v1=v0, dA=0.02) {
    center = new THREE.Vector3().copy(center).normalize();
    if ( quad >= 2 || quad <= 0 )
      throw "bad quadrant value";

    var arc = {
      center: center,
      quad: quad,
      vertices: []
    };

    if ( v0 === undefined ) {
      let ax = new THREE.Vector3(0,1,0).cross(center);
      if ( ax.length() < 1e-3 )
        ax = new THREE.Vector3(1,0,0).cross(center);
      ax.normalize();
      v0 = new THREE.Vector3().copy(center).applyAxisAngle(ax, quad*Math.PI/2);
      v1 = v0;
    }

    if ( v0 === v1 ) {
      arc.type = "circle";

      let da = dA*Math.sin(quad*Math.PI/2);
      let angle = 2*Math.PI;
      for ( let a=0; a<angle; a+=da )
        arc.vertices.push(new THREE.Vector3().copy(v0).applyAxisAngle(center, a));

    } else {
      arc.type = "arc";

      let da = dA*Math.sin(quad*Math.PI/2);
      let angle = this.angleTo(center, v0, v1);
      for ( let a=0; a<angle; a+=da )
        arc.vertices.push(new THREE.Vector3().copy(v0).applyAxisAngle(normal, a));
      arc.vertices.push(v1);
    }

    return arc;
  }
  static sliceArc(arc, plane) {
    var vs = arc.vertices
      .map(v => ({v, dis:plane.distanceToPoint(v)}))
      .map(({v, dis}) => ({v, dis, sgn:defaultFuzzyTool.sign(dis)}));

    function interpolate(vi, vj) {
      var t = vi.dis/(vi.dis - vj.dis);
      var vk_v = vi.v.clone().lerp(vj.v, t);
      return {v:vk_v, dis:0, sgn:0};
    }

    // special cases: all or none
    if ( vs.every(({sgn}) => sgn>=0) )
      return [arc];
    else if ( vs.every(({sgn}) => sgn<=0) )
      return [];

    // cut circle as arc
    if ( arc.type == "circle" ) {
      while ( !(vs[0].sgn >= 0 && vs[vs.length-1].sgn === -1) )
        vs.push(vs.shift());

      if ( vs[0].sgn === 1 )
        vs.unshift(interpolate(vs[0], vs[vs.length-1]));
    }

    // interpolate
    for ( let i=0; i<vs.length; i++ )
      if ( (vs[i-1] || vs[0]).sgn * vs[i].sgn < 0 )
        vs.splice(i, 0, interpolate(vs[i], vs[i+1]));

    // slice arc as multiple segments
    var start_ind = [];
    var end_ind = [];

    if ( vs[0].sgn === 1 )
      start_ind.push(0);
    for ( let i=0; i<vs.length; i++ ) {
      let sgn = vs[i].sgn;
      let prev_sgn = (vs[i-1] || {sgn:-1}).sgn;

      if ( prev_sgn === -1 && sgn === 0 )
        start_ind.push(i);
      else if ( prev_sgn === 0 && sgn === -1 )
        end_ind.push(i);
    }
    if ( vs[vs.length-1].sgn !== -1 )
      end_ind.push(vs.length);

    var sliced_vs = [];
    for ( let [i, j] of zip(start_ind, end_ind) )
      sliced_vs.push(vs.slice(i,j).map(({v}) => v));

    return sliced_vs.map(vs => ({type:"arc", center:arc.center, quad:arc.quad, vertices:vs}));
  }
  static sliceShell(shell, center, quad) {
    var plane = this.plane(center, quad);
    var planes = defaultFuzzyTool.collect(map(shell, arc => this.plane(arc.center, arc.quad)));

    if ( planes.find(p => defaultFuzzyTool.equals(p, plane)) )
      return shell;
    else if ( planes.find(p => defaultFuzzyTool.equals(p, plane.clone().negate())) )
      return null;

    shell = [...flatmap(shell, arc => this.sliceArc(arc, plane))];
    var new_arcs = [this.arc(center, quad)];

    for ( let p of planes )
      new_arcs = [...flatmap(new_arcs, arc => this.sliceArc(arc, p))];
    shell.push(...new_arcs);

    if ( shell.length === 0 )
      return null;
    else
      return shell;
  }

  static makeLines(shell) {
    if ( shell === null )
      return null;

    var res = [];
    for ( let arc of shell ) {
      let geo = new THREE.Geometry();
      geo.vertices = arc.vertices;
      let mat = new THREE.LineBasicMaterial({color:0xff0000});

      if ( arc.type == "cricle" )
        res.push(new THREE.LineLoop(geo, mat));
      else
        res.push(new THREE.Line(geo, mat));
    }

    return res;
  }
}
