const Vec = (x,y,z) => new THREE.Vector3(x,y,z);
const pi = Math.PI;
const tolerance = 1e-5;

class Digraph
{
  constructor() {
    this.data = new Map();
  }
  toString() {
    return [...this.data].map(([i, js]) => [...js].map(j => i+"→"+j).join()).join();
  }
  get size() {
    return [...this.data].reduce((total, js) => total+js.size, 0);
  }
  has(i, j) {
    var js = this.data.get(i);
    if ( js )
      return js.has(j);
    return false;
  }
  add(i, j) {
    var js = this.data.get(i);
    if ( js )
      return js.add(j);
    this.data.set(i, new Set([j]));
    return true;
  }
  remove(i, j) {
    var js = this.data.get(i);
    if ( !js )
      return false;
    let res = js.delete(j);
    if ( js.size === 0 )
      this.data.delete(i);
    return res;
  }
}
function toDirectedCycles(dg, has_bidirected_edges=true, check=false) {
  // eleminate bidirected edges
  if ( has_bidirected_edges ) {
    for ( let i of dg.data.keys() ) {
      let set = dg.data.get(i);
      if ( set ) for ( let j of set )
        if ( dg.remove(j, i) ) dg.remove(i, j);
    }
  }

  var i, i0, js, res = [];
  while ( (i = dg.data.keys().next().value) !== undefined ) {
    // walk from i
    let cycle = [];

    i0 = i;
    while ( js = dg.data.get(i) ) {
      dg.data.delete(i);

      if ( check && js.size > 1 )
        return console.log("branch edge", i, js);

      i = js.values().next().value;
      cycle.push(i);
    }

    if ( check && i !== i0 ) return console.log("break edge", i);

    res.push(cycle);
  }

  return res;
}

function cutPolygon(geometry, plane) {
  if ( geometry.vertices.length === 0 ) return geometry;

  plane = new THREE.Plane().copy(plane);
  var vertices = geometry.vertices;
  geometry.vertices = [];
  
  var dis = vertices.map(v => plane.distanceToPoint(v))
                    .map(d => Math.abs(d) < tolerance ? 0 : d);
  var sgn = dis.map(d => Math.sign(d));

  function interpolate(i, j) {
    let di = -dis[i];
    let dj =  dis[j];
    let vi = vertices[i];
    let vj = vertices[j];
    return vi.clone().lerp(vj, di/(di+dj));
  }
  
  for ( let i=dis.length-1,j=0; j<dis.length; i=j++ ) {
  	if ( sgn[i] * sgn[j] < 0 )
      geometry.vertices.push(interpolate(i,j));
    if ( sgn[j] !== -1 )
      geometry.vertices.push(vertices[j]);
  }
  
  return geometry;
}
function cutConvexPolyhedron(geometry, plane, closeHoles) {
  if ( geometry.vertices.length === 0 ) return geometry;

  plane = new THREE.Plane().copy(plane);
  var faces = geometry.faces;
  geometry.faces = [];

  var dis = geometry.vertices.map(v => plane.distanceToPoint(v))
                             .map(d => Math.abs(d) < tolerance ? 0 : d);
  var sgn = dis.map(v => Math.sign(v));

  var cache = {};
  function interpolate(i, j) {
    if ( i > j ) [i, j] = [j, i];
    if ( cache[i+","+j] ) return cache[i+","+j];
    var di = -dis[i];
    var dj =  dis[j];
    var vi = geometry.vertices[i];
    var vj = geometry.vertices[j];
    var v0 = vi.clone().lerp(vj, di/(di+dj));
    var k = geometry.vertices.push(v0) - 1;
    dis.push(0);
    sgn.push(0);
    cache[i+","+j] = k;
    return k;
  }

  // cut face by plane
  var edges = new Digraph();
  for ( let face of faces ) {
    let {a, b, c} = face;
    let sliced_face = [];

    for ( let [i, j] of [[c,a], [a,b], [b,c]] ) {
      if ( sgn[i] * sgn[j] < 0 )
        sliced_face.push(interpolate(i,j));
      if ( sgn[j] !== -1 )
        sliced_face.push(j);
    }

    if ( sliced_face.length < 3 )
      continue;

    for ( let x=2; x<sliced_face.length; x++ ) {
      if ( x > 2 ) face = face.clone();
      face.a = sliced_face[0];
      face.b = sliced_face[x-1];
      face.c = sliced_face[x];
      geometry.faces.push(face);
    }

    // find edge touching the plane
    if ( closeHoles ) {
      for ( let i=sliced_face.length-1,j=0; j<sliced_face.length; i=j++ ) {
        let a = sliced_face[i], b = sliced_face[j];
        if ( sgn[a] === 0 && sgn[b] === 0 )
          if ( !edges.remove(b, a) ) edges.add(a, b);
      }
    }
  }

  // make new side cutted by plane
  if ( closeHoles ) {
    let new_normals = new Array(3).fill(plane.normal.clone().negate());
    let cycles = toDirectedCycles(edges, false, false);
    for ( let bd of cycles )
      for ( let x=2; x<bd.length; x++ )
        geometry.faces.push(new THREE.Face3(bd[0], bd[x], bd[x-1], new_normals));
  }

  // remove useless vertices
  var j = 0;
  var ind_map = geometry.vertices.map((_, i) => (sgn[i] !== -1) ? j++ : -1);
  geometry.vertices = geometry.vertices.filter((_, i) => (sgn[i] !== -1));
  for ( let face of geometry.faces ) {
    face.a = ind_map[face.a];
    face.b = ind_map[face.b];
    face.c = ind_map[face.c];
  }

  return geometry;
}
function cutConvexPolyhedron_(geometry, plane, closeHoles) {
  cutConvexPolyhedron(geometry, plane, false);
  if ( closeHoles ) {
    let normals = new Array(3).fill(plane.normal.clone().negate());
    boundaries = findOpenEdge(geometry);
    for ( let bd of boundaries )
      for ( let x=2; x<bd.length; x++ )
        geometry.faces.push(new THREE.Face3(bd[0], bd[x], bd[x-1], normals));
  }
  return geometry;
}
function findOpenEdge(geometry, check=false) {
  var edges = new Digraph();
  for ( let {a, b, c} of geometry.faces ) for ( let [i, j] of [[c,a], [a,b], [b,c]] ) {
    if ( i === j )
      if ( check ) return console.log("trivial edge", i);
    else if ( !edges.add(i, j) )
      if ( check ) return console.log("wing edge", i, j);
  }

  return toDirectedCycles(edges, true, check);
}
function makeCrossSection(geometry, plane) {
  if ( geometry.vertices.length === 0 ) return new THREE.Geometry();

  plane = new THREE.Plane().copy(plane);
  var vertices = geometry.vertices.slice(0);
  var faces = [];

  var dis = vertices.map(v => plane.distanceToPoint(v))
                    .map(d => Math.abs(d) < tolerance ? 0 : d);
  var sgn = dis.map(v => Math.sign(v));

  var cache = {};
  function interpolate(i, j) {
    if ( i > j ) [i, j] = [j, i];
    if ( cache[i+","+j] ) return cache[i+","+j];
    var di = -dis[i];
    var dj =  dis[j];
    var vi = vertices[i];
    var vj = vertices[j];
    var v0 = vi.clone().lerp(vj, di/(di+dj));
    var k = vertices.push(v0) - 1;
    dis.push(0);
    sgn.push(0);
    cache[i+","+j] = k;
    return k;
  }

  // cut face by plane
  var edges = new Digraph();
  for ( let face of geometry.faces ) {
    let {a, b, c} = face;
    let sliced_face = [];

    for ( let [i, j] of [[c,a], [a,b], [b,c]] ) {
      if ( sgn[i] * sgn[j] < 0 )
        sliced_face.push(interpolate(i,j));
      if ( sgn[j] !== -1 )
        sliced_face.push(j);
    }

    if ( sliced_face.length < 3 )
      continue;

    // find edge touching the plane
    for ( let i=sliced_face.length-1,j=0; j<sliced_face.length; i=j++ ) {
      let a = sliced_face[i], b = sliced_face[j];
      if ( sgn[a] === 0 && sgn[b] === 0 )
        if ( !edges.remove(b, a) ) edges.add(a, b);
    }
  }

  // make new side cutted by plane
  var cycles = toDirectedCycles(edges, false, false);
  var res = [];
  for ( let bd of cycles ) {
    var geo = new THREE.Geometry();
    geo.vertices = bd.map(i => vertices[i]);
    res.push(geo);
  }
  return res;
}
function makeCrossSection_(geometry, plane) {
  geometry = geometry.clone();
  cutConvexPolyhedron(geometry, plane, false);
  var boundaries = findOpenEdge(geometry);
  var res = [];
  for ( let bd of boundaries ) {
    var geo = new THREE.Geometry();
    geo.vertices = bd.map(i => geometry.vertices[i]);
    res.push(geo);
  }
  return res;
}

